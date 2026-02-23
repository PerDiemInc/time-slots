import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MINUTES_PER_DAY } from "../src/constants";
import { getSchedules } from "../src/schedule/get-schedules";
import type {
	GetSchedulesParams,
	LocationLike,
	PrepTimeSettings,
	StoreConfig,
} from "../src/types";

// ── Standard store: Mon–Sat 8:00–20:00, Sun closed (day 0 = Sunday)
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
		fulfillAtBusinessDayStart: false,
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

describe("preptimeByDays", () => {
	let location: LocationLike;
	let prepTimeSettings: PrepTimeSettings;

	beforeEach(() => {
		vi.useFakeTimers();
		location = makeLocation();
		prepTimeSettings = makePrepTimeSettings({
			fulfillAtBusinessDayStart: true,
			prepTimeInMinutes: MINUTES_PER_DAY,
		});
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("when during normal store hours with 1 day prep time", () => {
		describe("when current time is Monday 2:00 PM", () => {
			beforeEach(() =>
				vi.setSystemTime(new Date("2025-01-06T14:00:00.000Z")),
			);
			it("should return first slot Tuesday 8:05 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-07T08:05:00.000Z"),
				);
			});
		});

		describe("when current time is Monday 4:00 PM", () => {
			beforeEach(() =>
				vi.setSystemTime(new Date("2025-01-06T16:00:00.000Z")),
			);
			it("should return first slot Tuesday 8:05 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-07T08:05:00.000Z"),
				);
			});
		});

		describe("when current time is Monday 8:00 AM just opened", () => {
			beforeEach(() =>
				vi.setSystemTime(new Date("2025-01-06T08:00:00.000Z")),
			);
			it("should return first slot Tuesday 8:05 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-07T08:05:00.000Z"),
				);
			});
		});

		describe("when current time is Monday 7:59 PM about to close", () => {
			beforeEach(() =>
				vi.setSystemTime(new Date("2025-01-06T19:59:00.000Z")),
			);
			it("should return first slot Tuesday 8:05 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-07T08:05:00.000Z"),
				);
			});
		});

		describe("when current time is Tuesday 12:00 PM", () => {
			beforeEach(() =>
				vi.setSystemTime(new Date("2025-01-07T12:00:00.000Z")),
			);
			it("should return first slot Wednesday 8:05 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-08T08:05:00.000Z"),
				);
			});
		});
	});

	describe("when before or after store hours with 1 day prep time", () => {
		describe("when current time is Monday 2:00 AM before open", () => {
			beforeEach(() =>
				vi.setSystemTime(new Date("2025-01-06T02:00:00.000Z")),
			);
			it("should return first slot Tuesday 8:05 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-07T08:05:00.000Z"),
				);
			});
		});

		describe("when current time is Monday 6:00 AM before open", () => {
			beforeEach(() =>
				vi.setSystemTime(new Date("2025-01-06T06:00:00.000Z")),
			);
			it("should return first slot Tuesday 8:05 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-07T08:05:00.000Z"),
				);
			});
		});

		describe("when current time is Monday 7:59 AM one minute before open", () => {
			beforeEach(() =>
				vi.setSystemTime(new Date("2025-01-06T07:59:00.000Z")),
			);
			it("should return first slot Tuesday 8:05 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-07T08:05:00.000Z"),
				);
			});
		});

		describe("when current time is Monday 8:00 PM exactly at close", () => {
			beforeEach(() =>
				vi.setSystemTime(new Date("2025-01-06T20:00:00.000Z")),
			);
			it("should return first slot Tuesday 8:05 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-07T08:05:00.000Z"),
				);
			});
		});

		describe("when current time is Monday 9:00 PM after close", () => {
			beforeEach(() =>
				vi.setSystemTime(new Date("2025-01-06T21:00:00.000Z")),
			);
			it("should return first slot Wednesday 8:05 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-08T08:05:00.000Z"),
				);
			});
		});

		describe("when current time is Monday 11:59 PM late night", () => {
			beforeEach(() =>
				vi.setSystemTime(new Date("2025-01-06T23:59:00.000Z")),
			);
			it("should return first slot Wednesday 8:05 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-08T08:05:00.000Z"),
				);
			});
		});
	});

	describe("when store is closed on Sunday with 1 day prep time", () => {
		describe("when current time is Saturday 2:00 PM", () => {
			beforeEach(() =>
				vi.setSystemTime(new Date("2025-01-11T14:00:00.000Z")),
			);
			it("should return first slot Monday 8:05 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-13T08:05:00.000Z"),
				);
			});
		});

		describe("when current time is Saturday 8:00 PM just closed", () => {
			beforeEach(() =>
				vi.setSystemTime(new Date("2025-01-11T20:00:00.000Z")),
			);
			it("should return first slot Monday 8:05 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-13T08:05:00.000Z"),
				);
			});
		});

		describe("when current time is Saturday 10:00 PM after close", () => {
			beforeEach(() =>
				vi.setSystemTime(new Date("2025-01-11T22:00:00.000Z")),
			);
			it("should return first slot Tuesday 8:05 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-14T08:05:00.000Z"),
				);
			});
		});

		describe("when current time is Sunday 2:00 PM (store closed all day)", () => {
			beforeEach(() =>
				vi.setSystemTime(new Date("2025-01-12T14:00:00.000Z")),
			);
			it("should return first slot Tuesday 8:05 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-14T08:05:00.000Z"),
				);
			});
		});

		describe("when current time is Sunday 2:00 AM", () => {
			beforeEach(() =>
				vi.setSystemTime(new Date("2025-01-12T02:00:00.000Z")),
			);
			it("should return first slot Tuesday 8:05 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-14T08:05:00.000Z"),
				);
			});
		});

		describe("when current time is Friday 3:00 PM", () => {
			beforeEach(() =>
				vi.setSystemTime(new Date("2025-01-10T15:00:00.000Z")),
			);
			it("should return first slot Saturday 8:05 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-11T08:05:00.000Z"),
				);
			});
		});
	});

	describe("when store has variable hours by day (Sat 10–18, Sun closed)", () => {
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
				vi.setSystemTime(new Date("2025-01-10T14:00:00.000Z")),
			);
			it("should return first slot Saturday 10:05 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-11T10:05:00.000Z"),
				);
			});
		});

		describe("when current time is Friday 8:00 PM", () => {
			beforeEach(() =>
				vi.setSystemTime(new Date("2025-01-10T20:00:00.000Z")),
			);
			it("should return first slot Saturday 10:05 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-11T10:05:00.000Z"),
				);
			});
		});

		describe("when current time is Saturday 2:00 PM", () => {
			beforeEach(() =>
				vi.setSystemTime(new Date("2025-01-11T14:00:00.000Z")),
			);
			it("should return first slot Monday 8:05 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-13T08:05:00.000Z"),
				);
			});
		});

		describe("when current time is Saturday 7:00 PM after Sat close", () => {
			beforeEach(() =>
				vi.setSystemTime(new Date("2025-01-11T19:00:00.000Z")),
			);
			it("should return first slot Tuesday 8:05 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-14T08:05:00.000Z"),
				);
			});
		});
	});

	describe("when Tuesday has early closure with 1 day prep time", () => {
		describe("when current time is Tuesday 2:00 PM before early close", () => {
			beforeEach(() =>
				vi.setSystemTime(new Date("2025-01-07T14:00:00.000Z")),
			);
			it("should return first slot Wednesday 8:05 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-08T08:05:00.000Z"),
				);
			});
		});

		describe("when current time is Tuesday 4:00 PM after store closed", () => {
			beforeEach(() =>
				vi.setSystemTime(new Date("2025-01-07T16:00:00.000Z")),
			);
			it("should return first slot Wednesday 8:05 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-08T08:05:00.000Z"),
				);
			});
		});
	});

	describe("when Wednesday has late opening (11 AM)", () => {
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

		describe("when current time is Tuesday 2:00 PM", () => {
			beforeEach(() =>
				vi.setSystemTime(new Date("2025-01-07T14:00:00.000Z")),
			);
			it("should return first slot Wednesday 11:05 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-08T11:05:00.000Z"),
				);
			});
		});

		describe("when current time is Tuesday 10:00 PM after close", () => {
			beforeEach(() =>
				vi.setSystemTime(new Date("2025-01-07T22:00:00.000Z")),
			);
			it("should return first slot Thursday 8:05 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-09T08:05:00.000Z"),
				);
			});
		});
	});

	describe("when prep time is 2 days", () => {
		beforeEach(() => {
			prepTimeSettings = makePrepTimeSettings({
				fulfillAtBusinessDayStart: true,
				prepTimeInMinutes: 2 * MINUTES_PER_DAY,
			});
		});

		describe("when current time is Monday 2:00 PM", () => {
			beforeEach(() =>
				vi.setSystemTime(new Date("2025-01-06T14:00:00.000Z")),
			);
			it("should return first slot Wednesday 8:05 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-08T08:05:00.000Z"),
				);
			});
		});

		describe("when current time is Monday 9:00 PM after close", () => {
			beforeEach(() =>
				vi.setSystemTime(new Date("2025-01-06T21:00:00.000Z")),
			);
			it("should return first slot Thursday 8:05 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-09T08:05:00.000Z"),
				);
			});
		});

		describe("when current time is Friday 2:00 PM", () => {
			beforeEach(() =>
				vi.setSystemTime(new Date("2025-01-10T14:00:00.000Z")),
			);
			it("should return first slot Monday 8:05 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-13T08:05:00.000Z"),
				);
			});
		});

		describe("when current time is Saturday 2:00 PM", () => {
			beforeEach(() =>
				vi.setSystemTime(new Date("2025-01-11T14:00:00.000Z")),
			);
			it("should return first slot Tuesday 8:05 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-14T08:05:00.000Z"),
				);
			});
		});
	});

	describe("when prep time is 3 days", () => {
		beforeEach(() => {
			prepTimeSettings = makePrepTimeSettings({
				fulfillAtBusinessDayStart: true,
				prepTimeInMinutes: 3 * MINUTES_PER_DAY,
			});
		});

		describe("when current time is Monday 2:00 PM", () => {
			beforeEach(() =>
				vi.setSystemTime(new Date("2025-01-06T14:00:00.000Z")),
			);
			it("should return first slot Thursday 8:05 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-09T08:05:00.000Z"),
				);
			});
		});

		describe("when current time is Friday 2:00 PM", () => {
			beforeEach(() =>
				vi.setSystemTime(new Date("2025-01-10T14:00:00.000Z")),
			);
			it("should return first slot Tuesday 8:05 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-14T08:05:00.000Z"),
				);
			});
		});
	});

	describe("when testing exact boundary times", () => {
		describe("when current time is 8:00:00 AM exactly at open", () => {
			beforeEach(() =>
				vi.setSystemTime(new Date("2025-01-06T08:00:00.000Z")),
			);
			it("should return first slot next day 8:05 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-07T08:05:00.000Z"),
				);
			});
		});

		describe("when current time is 7:59:59 AM before open", () => {
			beforeEach(() =>
				vi.setSystemTime(new Date("2025-01-06T07:59:59.000Z")),
			);
			it("should return first slot next day 8:05 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-07T08:05:00.000Z"),
				);
			});
		});

		describe("when current time is 8:00:00 PM exactly at close", () => {
			beforeEach(() =>
				vi.setSystemTime(new Date("2025-01-06T20:00:00.000Z")),
			);
			it("should return first slot next day 8:05 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-07T08:05:00.000Z"),
				);
			});
		});
	});

	describe("when testing midnight edge cases", () => {
		describe("when current time is 12:00:00 AM midnight", () => {
			beforeEach(() =>
				vi.setSystemTime(new Date("2025-01-06T00:00:00.000Z")),
			);
			it("should return first slot next day 8:05 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-07T08:05:00.000Z"),
				);
			});
		});

		describe("when current time is 11:59:59 PM", () => {
			beforeEach(() =>
				vi.setSystemTime(new Date("2025-01-06T23:59:59.000Z")),
			);
			it("should return first slot Wednesday 8:05 AM", () => {
				expect(getFirstSlot(prepTimeSettings, location)).toEqual(
					new Date("2025-01-08T08:05:00.000Z"),
				);
			});
		});
	});
});
