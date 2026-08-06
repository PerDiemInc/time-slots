import { afterEach, describe, expect, it, vi } from "vitest";
import { PREP_TIME_CADENCE } from "../src/constants";
import { getSchedules } from "../src/schedule/get-schedules";
import type {
	GetSchedulesParams,
	LocationLike,
	PrepTimeSettings,
	StoreConfig,
} from "../src/types";

const nineToFive = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
	day,
	start_time: "09:00",
	end_time: "17:00",
}));

function makeLocation(overrides: Partial<LocationLike> = {}): LocationLike {
	return {
		location_id: "loc-test",
		timezone: "UTC",
		pickup_hours: nineToFive,
		...overrides,
	};
}

function makeStore(overrides: Partial<StoreConfig> = {}): StoreConfig {
	return {
		isAsapOrders: false,
		isSameDayOrders: false,
		max_future_order_days: 7,
		businessHoursOverrides: [],
		weeklyPreSaleConfig: { active: false, pickup_days: [], ordering_days: [] },
		...overrides,
	};
}

function makePrepTimeSettings(
	overrides: Partial<PrepTimeSettings> = {},
): PrepTimeSettings {
	return {
		prepTimeInMinutes: 0,
		gapInMinutes: 15,
		busyTimes: {},
		fulfillAtBusinessDayStart: false,
		...overrides,
	};
}

function makeParams(
	prepTimeSettings: PrepTimeSettings,
	overrides: Partial<GetSchedulesParams> = {},
): GetSchedulesParams {
	const location = makeLocation();
	return {
		store: makeStore(),
		locations: [location],
		cartItems: [],
		fulfillmentPreference: "PICKUP",
		prepTimeSettings,
		currentLocation: location,
		...overrides,
	};
}

/** Freeze the clock at a UTC instant for the duration of a test. */
function at(isoInstant: string) {
	vi.useFakeTimers();
	vi.setSystemTime(new Date(isoInstant));
}

describe("getSchedules prep time impact", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	describe("always reported", () => {
		it("reports the impact without the caller asking for it", () => {
			at("2026-01-05T10:00:00.000Z");

			const result = getSchedules(
				makeParams(makePrepTimeSettings({ prepTimeInMinutes: 240 })),
			);

			expect(result.prepTimeImpact).toBeDefined();
			expect(result.schedule.length).toBeGreaterThan(0);
		});

		it("leaves the schedule itself untouched", () => {
			// The counterfactual pass must never leak into the returned schedule:
			// its first slot still reflects the real prep time.
			at("2026-01-05T10:00:00.000Z");

			const { schedule, prepTimeImpact } = getSchedules(
				makeParams(makePrepTimeSettings({ prepTimeInMinutes: 240 })),
			);

			const earliest = schedule.find(
				(day) => day.firstAvailableSlot,
			)?.firstAvailableSlot;
			expect(earliest?.toISOString()).toBe("2026-01-05T14:00:00.000Z");
			expect(prepTimeImpact.earliestSlotWithoutPrepTime?.toISOString()).toBe(
				"2026-01-05T10:00:00.000Z",
			);
		});
	});

	describe("when prep time is the binding constraint", () => {
		it("reports the delay in minutes and the prep-free earliest slot", () => {
			// Store open 09:00–17:00, now 10:00 → without prep the earliest slot is
			// ~10:00; four hours of prep pushes it to ~14:00.
			at("2026-01-05T10:00:00.000Z");

			const { prepTimeImpact } = getSchedules(
				makeParams(makePrepTimeSettings({ prepTimeInMinutes: 240 })),
			);

			expect(prepTimeImpact.delayInMinutes).toBe(240);
			expect(prepTimeImpact.earliestSlotWithoutPrepTime?.toISOString()).toBe(
				"2026-01-05T10:00:00.000Z",
			);
		});

		it("scales with the prep time", () => {
			at("2026-01-05T10:00:00.000Z");

			const { prepTimeImpact } = getSchedules(
				makeParams(makePrepTimeSettings({ prepTimeInMinutes: 45 })),
			);

			expect(prepTimeImpact.delayInMinutes).toBe(45);
		});
	});

	describe("when business hours bind before prep time does", () => {
		it("reports no delay for a store that is closed until after the prep window", () => {
			// Now 02:00, store opens 09:00. Prep of 4h lands at 06:00, still before
			// opening, so the earliest slot is 09:00 either way.
			at("2026-01-05T02:00:00.000Z");

			const { prepTimeImpact } = getSchedules(
				makeParams(makePrepTimeSettings({ prepTimeInMinutes: 240 })),
			);

			expect(prepTimeImpact.delayInMinutes).toBe(0);
			expect(prepTimeImpact.earliestSlotWithoutPrepTime?.toISOString()).toBe(
				"2026-01-05T09:00:00.000Z",
			);
		});

		it("reports no delay when there is no prep time at all", () => {
			at("2026-01-05T10:00:00.000Z");

			const { prepTimeImpact } = getSchedules(
				makeParams(makePrepTimeSettings({ prepTimeInMinutes: 0 })),
			);

			expect(prepTimeImpact.delayInMinutes).toBe(0);
		});
	});

	describe("when prep time pushes the order past closing time", () => {
		it("reports the full delay to the next open day", () => {
			// Now 16:00, store closes 17:00. Four hours of prep cannot fit today, so
			// the earliest slot moves to tomorrow 09:00 — 17 hours later.
			at("2026-01-05T16:00:00.000Z");

			const { prepTimeImpact } = getSchedules(
				makeParams(makePrepTimeSettings({ prepTimeInMinutes: 240 })),
			);

			expect(prepTimeImpact.earliestSlotWithoutPrepTime?.toISOString()).toBe(
				"2026-01-05T16:00:00.000Z",
			);
			expect(prepTimeImpact.delayInMinutes).toBe(17 * 60);
		});
	});

	describe("day-cadence prep time", () => {
		it("reports the delay when prep is expressed in whole days", () => {
			// fulfillAtBusinessDayStart turns prep into a day cadence: 2 days of prep
			// from Monday 10:00 lands on Wednesday at opening.
			at("2026-01-05T10:00:00.000Z");

			const { prepTimeImpact } = getSchedules(
				makeParams(
					makePrepTimeSettings({
						prepTimeInMinutes: 2 * 24 * 60,
						fulfillAtBusinessDayStart: true,
					}),
				),
			);

			expect(prepTimeImpact.earliestSlotWithoutPrepTime?.toISOString()).toBe(
				"2026-01-05T10:00:00.000Z",
			);
			expect(prepTimeImpact.delayInMinutes).toBe(2 * 24 * 60 - 60);
		});

		it("neutralizes prep passed explicitly as cadence + frequency", () => {
			// Catering passes cadence/frequency directly, bypassing prepTimeInMinutes.
			at("2026-01-05T10:00:00.000Z");

			const { prepTimeImpact } = getSchedules(
				makeParams(
					makePrepTimeSettings({
						prepTimeInMinutes: 0,
						prepTimeCadence: PREP_TIME_CADENCE.MINUTE,
						prepTimeFrequency: 240,
					}),
				),
			);

			expect(prepTimeImpact.delayInMinutes).toBe(240);
			expect(prepTimeImpact.earliestSlotWithoutPrepTime?.toISOString()).toBe(
				"2026-01-05T10:00:00.000Z",
			);
		});
	});

	describe("pre-sale carts", () => {
		const weeklyPreSaleParams = () =>
			makeParams(makePrepTimeSettings({ prepTimeInMinutes: 240 }), {
				store: makeStore({
					weeklyPreSaleConfig: {
						active: true,
						pickup_days: [3],
						ordering_days: [0, 1, 2, 3, 4, 5, 6],
					},
				}),
				cartItems: [{ weeklyPreSale: true }],
			});

		it("reports no delay for a weekly pre-sale cart (slots ignore prep time)", () => {
			at("2026-01-05T10:00:00.000Z");

			const { prepTimeImpact } = getSchedules(weeklyPreSaleParams());

			expect(prepTimeImpact.delayInMinutes).toBe(0);
		});

		it("still reports the weekly pre-sale schedule's own earliest slot", () => {
			// Prep is never applied on this path, so that schedule already IS the
			// prep-free one — the slot is known, not unknown.
			at("2026-01-05T10:00:00.000Z");

			const { schedule, prepTimeImpact } = getSchedules(weeklyPreSaleParams());

			expect(prepTimeImpact.earliestSlotWithoutPrepTime).toEqual(
				schedule.find((day) => day.firstAvailableSlot)?.firstAvailableSlot,
			);
			expect(prepTimeImpact.earliestSlotWithoutPrepTime).toBeDefined();
		});
	});
});
