import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PREP_TIME_CADENCE } from "../src/constants";
import { getSchedules } from "../src/schedule/get-schedules";
import type {
	GetSchedulesParams,
	LocationLike,
	PrepTimeSettings,
	StoreConfig,
} from "../src/types";

const MINUTES_24H = 24 * 60;
const MINUTES_48H = 48 * 60;
const MINUTES_72H = 72 * 60;

// Standard store: Mon–Sat 8:00–20:00, Sun closed
const STANDARD_PICKUP_HOURS = [
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
		pickup_hours: STANDARD_PICKUP_HOURS,
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

function getFirstSlot(
	prepTimeSettings: PrepTimeSettings,
	location?: LocationLike,
): Date | undefined {
	const { schedule } = callGetSchedules(prepTimeSettings, location);
	return schedule[0]?.slots[0];
}

/** Prep time only for the order day (weekday of orderDate). Other days explicitly 0 so future days don't add DEFAULT_PREP_TIME (5 min). */
function prepTimeForOrderDayOnly(
	orderDate: Date,
	prepMinutes: number,
): Record<number, number> {
	const dayOfWeek = orderDate.getUTCDay();
	return {
		0: 0,
		1: 0,
		2: 0,
		3: 0,
		4: 0,
		5: 0,
		6: 0,
		[dayOfWeek]: prepMinutes,
	};
}

describe("preptimeByMinutes", () => {
	let location: LocationLike;
	let prepTimeSettings: PrepTimeSettings;

	beforeEach(() => {
		vi.useFakeTimers();
		location = makeLocation();
		prepTimeSettings = makePrepTimeSettings({
			prepTimeCadence: PREP_TIME_CADENCE.MINUTE,
		});
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	/** Sets system time and prep time (order-day only) for the given order date and minutes. */
	function applyPrepAtOrderDate(orderDate: Date, prepMinutes: number): void {
		vi.setSystemTime(orderDate);
		prepTimeSettings = makePrepTimeSettings({
			prepTimeCadence: PREP_TIME_CADENCE.MINUTE,
			weekDayPrepTimes: prepTimeForOrderDayOnly(orderDate, prepMinutes),
		});
	}

	describe("when during normal store hours with 24h prep time", () => {
		describe("when current time is Monday 2:00 PM", () => {
			beforeEach(() =>
				applyPrepAtOrderDate(
					new Date("2025-01-06T14:00:00.000Z"),
					MINUTES_24H,
				),
			);
			it("should return first slot Tuesday 2:00 PM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-07T14:00:00.000Z"),
				);
			});
		});

		describe("when current time is Monday 4:00 PM", () => {
			beforeEach(() =>
				applyPrepAtOrderDate(
					new Date("2025-01-06T16:00:00.000Z"),
					MINUTES_24H,
				),
			);
			it("should return first slot Tuesday 4:00 PM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-07T16:00:00.000Z"),
				);
			});
		});

		describe("when current time is Monday 8:00 AM", () => {
			beforeEach(() =>
				applyPrepAtOrderDate(
					new Date("2025-01-06T08:00:00.000Z"),
					MINUTES_24H,
				),
			);
			it("should return first slot Tuesday 8:00 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-07T08:00:00.000Z"),
				);
			});
		});

		describe("when current time is Monday 7:00 PM", () => {
			beforeEach(() =>
				applyPrepAtOrderDate(
					new Date("2025-01-06T19:00:00.000Z"),
					MINUTES_24H,
				),
			);
			it("should return first slot Tuesday 7:00 PM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-07T19:00:00.000Z"),
				);
			});
		});

		describe("when current time is Monday 10:00 AM", () => {
			beforeEach(() =>
				applyPrepAtOrderDate(
					new Date("2025-01-06T10:00:00.000Z"),
					MINUTES_24H,
				),
			);
			it("should return first slot Tuesday 10:00 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-07T10:00:00.000Z"),
				);
			});
		});
	});

	describe("when before or after store hours with 24h prep time", () => {
		describe("when current time is Monday 2:00 AM before open", () => {
			beforeEach(() =>
				applyPrepAtOrderDate(
					new Date("2025-01-06T02:00:00.000Z"),
					MINUTES_24H,
				),
			);
			it("should return first slot Tuesday 8:00 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-07T08:00:00.000Z"),
				);
			});
		});

		describe("when current time is Monday 6:00 AM before open", () => {
			beforeEach(() =>
				applyPrepAtOrderDate(
					new Date("2025-01-06T06:00:00.000Z"),
					MINUTES_24H,
				),
			);
			it("should return first slot Tuesday 8:00 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-07T08:00:00.000Z"),
				);
			});
		});

		describe("when current time is Monday 7:59 AM before open", () => {
			beforeEach(() =>
				applyPrepAtOrderDate(
					new Date("2025-01-06T07:59:00.000Z"),
					MINUTES_24H,
				),
			);
			it("should return first slot Tuesday 8:00 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-07T08:00:00.000Z"),
				);
			});
		});

		describe("when current time is Monday 9:00 PM after close", () => {
			beforeEach(() =>
				applyPrepAtOrderDate(
					new Date("2025-01-06T21:00:00.000Z"),
					MINUTES_24H,
				),
			);
			it("should return first slot Wednesday 8:00 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-08T08:00:00.000Z"),
				);
			});
		});

		describe("when current time is Monday 11:00 PM after close", () => {
			beforeEach(() =>
				applyPrepAtOrderDate(
					new Date("2025-01-06T23:00:00.000Z"),
					MINUTES_24H,
				),
			);
			it("should return first slot Wednesday 8:00 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-08T08:00:00.000Z"),
				);
			});
		});
	});

	describe("when store is closed on Sunday with 24h prep time", () => {
		describe("when current time is Saturday 2:00 PM", () => {
			beforeEach(() =>
				applyPrepAtOrderDate(
					new Date("2025-01-11T14:00:00.000Z"),
					MINUTES_24H,
				),
			);
			it("should return first slot Monday 8:00 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-13T08:00:00.000Z"),
				);
			});
		});

		describe("when current time is Saturday 8:00 AM", () => {
			beforeEach(() =>
				applyPrepAtOrderDate(
					new Date("2025-01-11T08:00:00.000Z"),
					MINUTES_24H,
				),
			);
			it("should return first slot Monday 8:00 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-13T08:00:00.000Z"),
				);
			});
		});

		describe("when current time is Saturday 6:00 PM", () => {
			beforeEach(() =>
				applyPrepAtOrderDate(
					new Date("2025-01-11T18:00:00.000Z"),
					MINUTES_24H,
				),
			);
			it("should return first slot Monday 8:00 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-13T08:00:00.000Z"),
				);
			});
		});

		describe("when current time is Saturday 10:00 PM after close", () => {
			beforeEach(() =>
				applyPrepAtOrderDate(
					new Date("2025-01-11T22:00:00.000Z"),
					MINUTES_24H,
				),
			);
			it("should return first slot Monday 8:00 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-13T08:00:00.000Z"),
				);
			});
		});

		describe("when current time is Sunday 10:00 AM (store closed)", () => {
			beforeEach(() =>
				applyPrepAtOrderDate(
					new Date("2025-01-12T10:00:00.000Z"),
					MINUTES_24H,
				),
			);
			it("should return first slot Monday 8:00 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-13T08:00:00.000Z"),
				);
			});
		});

		describe("when current time is Sunday 7:00 PM (store closed)", () => {
			beforeEach(() =>
				applyPrepAtOrderDate(
					new Date("2025-01-12T19:00:00.000Z"),
					MINUTES_24H,
				),
			);
			it("should return first slot Monday 8:00 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-13T08:00:00.000Z"),
				);
			});
		});
	});

	describe("when store has variable hours (Sat 10–18, Sun closed) with 24h prep time", () => {
		beforeEach(() => {
			location = makeLocation({
				pickup_hours: [
					{ day: 1, start_time: "08:00", end_time: "20:00" },
					{ day: 2, start_time: "08:00", end_time: "20:00" },
					{ day: 3, start_time: "08:00", end_time: "20:00" },
					{ day: 4, start_time: "08:00", end_time: "20:00" },
					{ day: 5, start_time: "08:00", end_time: "20:00" },
					{ day: 6, start_time: "10:00", end_time: "18:00" },
				],
			});
		});

		describe("when current time is Friday 2:00 PM", () => {
			beforeEach(() =>
				applyPrepAtOrderDate(
					new Date("2025-01-10T14:00:00.000Z"),
					MINUTES_24H,
				),
			);
			it("should return first slot Saturday 2:00 PM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-11T14:00:00.000Z"),
				);
			});
		});

		describe("when current time is Friday 5:00 PM", () => {
			beforeEach(() =>
				applyPrepAtOrderDate(
					new Date("2025-01-10T17:00:00.000Z"),
					MINUTES_24H,
				),
			);
			it("should return first slot Saturday 5:00 PM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-11T17:00:00.000Z"),
				);
			});
		});

		describe("when current time is Friday 7:00 PM", () => {
			beforeEach(() =>
				applyPrepAtOrderDate(
					new Date("2025-01-10T19:00:00.000Z"),
					MINUTES_24H,
				),
			);
			it("should return first slot Monday 8:00 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-13T08:00:00.000Z"),
				);
			});
		});

		describe("when current time is Saturday 11:00 AM", () => {
			beforeEach(() =>
				applyPrepAtOrderDate(
					new Date("2025-01-11T11:00:00.000Z"),
					MINUTES_24H,
				),
			);
			it("should return first slot Monday 8:00 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-13T08:00:00.000Z"),
				);
			});
		});
	});

	describe("when Friday has extended hours (8–22) and Saturday closes at 18:00 with 24h prep time", () => {
		beforeEach(() => {
			location = makeLocation({
				pickup_hours: [
					{ day: 1, start_time: "08:00", end_time: "20:00" },
					{ day: 2, start_time: "08:00", end_time: "20:00" },
					{ day: 3, start_time: "08:00", end_time: "20:00" },
					{ day: 4, start_time: "08:00", end_time: "22:00" },
					{ day: 5, start_time: "08:00", end_time: "20:00" },
					{ day: 6, start_time: "10:00", end_time: "18:00" },
				],
			});
		});

		describe("when current time is Friday 9:00 PM", () => {
			beforeEach(() =>
				applyPrepAtOrderDate(
					new Date("2025-01-10T21:00:00.000Z"),
					MINUTES_24H,
				),
			);
			it("should return first slot Monday 8:00 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-13T08:00:00.000Z"),
				);
			});
		});
	});

	describe("when during normal hours with 24h prep time (early closure scenario)", () => {
		describe("when current time is Tuesday 2:00 PM", () => {
			beforeEach(() =>
				applyPrepAtOrderDate(
					new Date("2025-01-07T14:00:00.000Z"),
					MINUTES_24H,
				),
			);
			it("should return first slot Wednesday 2:00 PM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-08T14:00:00.000Z"),
				);
			});
		});
	});

	describe("when Wednesday has late opening (11 AM) with 24h prep time", () => {
		beforeEach(() => {
			location = makeLocation({
				pickup_hours: [
					{ day: 1, start_time: "08:00", end_time: "20:00" },
					{ day: 2, start_time: "08:00", end_time: "20:00" },
					{ day: 3, start_time: "11:00", end_time: "20:00" },
					{ day: 4, start_time: "08:00", end_time: "20:00" },
					{ day: 5, start_time: "08:00", end_time: "20:00" },
					{ day: 6, start_time: "08:00", end_time: "20:00" },
				],
			});
		});

		describe("when current time is Tuesday 9:00 AM", () => {
			beforeEach(() =>
				applyPrepAtOrderDate(
					new Date("2025-01-07T09:00:00.000Z"),
					MINUTES_24H,
				),
			);
			it("should return first slot Wednesday 11:00 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-08T11:00:00.000Z"),
				);
			});
		});

		describe("when current time is Tuesday 12:00 PM", () => {
			beforeEach(() =>
				applyPrepAtOrderDate(
					new Date("2025-01-07T12:00:00.000Z"),
					MINUTES_24H,
				),
			);
			it("should return first slot Wednesday 12:00 PM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-08T12:00:00.000Z"),
				);
			});
		});
	});

	describe("when prep time is 48 hours", () => {
		describe("when current time is Monday 2:00 PM", () => {
			beforeEach(() =>
				applyPrepAtOrderDate(
					new Date("2025-01-06T14:00:00.000Z"),
					MINUTES_48H,
				),
			);
			it("should return first slot Wednesday 8:00 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-08T08:00:00.000Z"),
				);
			});
		});

		describe("when current time is Monday 9:00 PM", () => {
			beforeEach(() =>
				applyPrepAtOrderDate(
					new Date("2025-01-06T21:00:00.000Z"),
					MINUTES_48H,
				),
			);
			it("should return first slot Wednesday 8:00 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-08T08:00:00.000Z"),
				);
			});
		});

		describe("when current time is Friday 2:00 PM", () => {
			beforeEach(() =>
				applyPrepAtOrderDate(
					new Date("2025-01-10T14:00:00.000Z"),
					MINUTES_48H,
				),
			);
			it("should return first slot Monday 8:00 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-13T08:00:00.000Z"),
				);
			});
		});

		describe("when current time is Saturday 10:00 AM", () => {
			beforeEach(() =>
				applyPrepAtOrderDate(
					new Date("2025-01-11T10:00:00.000Z"),
					MINUTES_48H,
				),
			);
			it("should return first slot Monday 10:00 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-13T10:00:00.000Z"),
				);
			});
		});
	});

	describe("when prep time is 72 hours", () => {
		describe("when current time is Monday 2:00 PM", () => {
			beforeEach(() =>
				applyPrepAtOrderDate(
					new Date("2025-01-06T14:00:00.000Z"),
					MINUTES_72H,
				),
			);
			it("should return first slot Wednesday 8:00 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-08T08:00:00.000Z"),
				);
			});
		});

		describe("when current time is Friday 2:00 PM", () => {
			beforeEach(() =>
				applyPrepAtOrderDate(
					new Date("2025-01-10T14:00:00.000Z"),
					MINUTES_72H,
				),
			);
			it("should return first slot Monday 8:00 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-13T08:00:00.000Z"),
				);
			});
		});
	});

	describe("when testing exact boundary times with 24h prep time", () => {
		describe("when current time is 8:00:00 AM just opened", () => {
			beforeEach(() =>
				applyPrepAtOrderDate(
					new Date("2025-01-06T08:00:00.000Z"),
					MINUTES_24H,
				),
			);
			it("should return first slot next day 8:00 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-07T08:00:00.000Z"),
				);
			});
		});

		describe("when current time is 7:59:59 AM before open", () => {
			beforeEach(() =>
				applyPrepAtOrderDate(
					new Date("2025-01-06T07:59:59.000Z"),
					MINUTES_24H,
				),
			);
			it("should return first slot next day 8:00 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-07T08:00:00.000Z"),
				);
			});
		});

		describe("when current time is 8:00:00 PM just closed", () => {
			beforeEach(() =>
				applyPrepAtOrderDate(
					new Date("2025-01-06T20:00:00.000Z"),
					MINUTES_24H,
				),
			);
			it("should return first slot day after next 8:00 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-08T08:00:00.000Z"),
				);
			});
		});

		describe("when current time is 7:59:59 PM", () => {
			beforeEach(() =>
				applyPrepAtOrderDate(
					new Date("2025-01-06T19:59:59.000Z"),
					MINUTES_24H,
				),
			);
			it("should return first slot Wednesday 8:00 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-08T08:00:00.000Z"),
				);
			});
		});
	});

	describe("when verifying existing behaviour (regression)", () => {
		it("should roll prep time across shifts when weekday prep exceeds closing", () => {
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
			expect(schedule[0].date.getUTCDate()).toBe(3);
			expect(schedule[0].slots[0]).toEqual(new Date("2025-01-03T08:20:00.000Z"));
		});

		it("should carry prep time into the next shift on the same day", () => {
			vi.setSystemTime(new Date("2025-01-06T08:00:00.000Z"));
			location = makeLocation({
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
});
