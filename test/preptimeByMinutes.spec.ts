import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PREP_TIME_CADENCE } from "../src/constants";
import { getSchedules } from "../src/schedule/get-schedules";
import type {
	GetSchedulesParams,
	LocationLike,
	PrepTimeSettings,
	StoreConfig,
} from "../src/types";

const allDaysPickupHours = [
	{ day: 0, start_time: "08:00", end_time: "20:00" },
	{ day: 1, start_time: "08:00", end_time: "20:00" },
	{ day: 2, start_time: "08:00", end_time: "20:00" },
	{ day: 3, start_time: "08:00", end_time: "20:00" },
	{ day: 4, start_time: "08:00", end_time: "20:00" },
	{ day: 5, start_time: "08:00", end_time: "20:00" },
	{ day: 6, start_time: "08:00", end_time: "20:00" },
];

function makeLocation(overrides: Partial<LocationLike> = {}): LocationLike {
	return {
		location_id: "loc-test",
		timezone: "UTC",
		pickup_hours: allDaysPickupHours,
		...overrides,
	};
}

function makeStore(overrides: Partial<StoreConfig> = {}): StoreConfig {
	return {
		isAsapOrders: false,
		isSameDayOrders: false,
		max_future_order_days: 7,
		businessHoursOverrides: [],
		weeklyPreSaleConfig: {
			active: false,
			pickup_days: [],
			ordering_days: [],
		},
		...overrides,
	};
}

function makePrepTimeSettings(
	overrides: Partial<PrepTimeSettings> = {},
): PrepTimeSettings {
	return {
		prepTimeInMinutes: 0,
		weekDayPrepTimes: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
		gapInMinutes: 15,
		busyTimes: {},
		prepTimeFrequency: 0,
		prepTimeCadence: PREP_TIME_CADENCE.MINUTE,
		...overrides,
	};
}

function callGetSchedules(
	prepTimeSettings: PrepTimeSettings,
	location?: LocationLike,
) {
	const loc = location ?? makeLocation();
	const params: GetSchedulesParams = {
		store: makeStore(),
		locations: [loc],
		cartItems: [],
		fulfillmentPreference: "PICKUP",
		prepTimeSettings,
		currentLocation: loc,
	};
	return getSchedules(params);
}

describe("preptimeByMinutes", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it("should roll prep time across shifts when weekday prep exceeds closing", () => {
		// Wed 5:55pm, Wed prep=2880min(48h) → carried to Fri 5:55pm
		// But carry resets when it exceeds Thu's end, so Fri uses its own prep (20min from opening)
		vi.setSystemTime(new Date("2025-01-01T17:55:00.000Z"));

		const { schedule } = callGetSchedules(
			makePrepTimeSettings({
				weekDayPrepTimes: {
					0: 0,
					1: 0,
					2: 0,
					3: 2880,
					4: 0,
					5: 20,
					6: 0,
				},
				prepTimeCadence: PREP_TIME_CADENCE.MINUTE,
			}),
		);

		// Wed and Thu are skipped (no slots), first available is Fri
		expect(schedule[0].date.getUTCDate()).toBe(3); // Fri Jan 3
		expect(schedule[0].slots[0]).toEqual(new Date("2025-01-03T08:20:00.000Z"));
	});

	it("should carry prep time into the next shift on the same day", () => {
		// Mon 8am, two shifts 8-10 and 14-20, Mon prep=150min
		// 8am + 150min = 10:30am → past first shift end (10am) → skip shift 1
		// For shift 2 we use the greater of carried (10:30) and shift start (14:00) → 14:00
		// So first slot = second shift opening at 14:00
		vi.setSystemTime(new Date("2025-01-06T08:00:00.000Z"));

		const location = makeLocation({
			pickup_hours: [
				{ day: 1, start_time: "08:00", end_time: "10:00" },
				{ day: 1, start_time: "14:00", end_time: "20:00" },
			],
		});

		const { schedule } = callGetSchedules(
			makePrepTimeSettings({
				weekDayPrepTimes: { 1: 150 },
				prepTimeCadence: PREP_TIME_CADENCE.MINUTE,
			}),
			location,
		);

		expect(schedule[0].slots[0]).toEqual(new Date("2025-01-06T14:00:00.000Z"));
	});
});
