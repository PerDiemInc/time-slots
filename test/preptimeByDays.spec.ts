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

describe("preptimeByDays", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it("should skip open days equal to prepTimeFrequency", () => {
		// Wed Jan 1 2025, 5:55pm. frequency=2 → skip Wed+Thu, first day = Fri
		// Do not pass weekDayPrepTimes for days cadence
		vi.setSystemTime(new Date("2025-01-01T17:55:00.000Z"));

		const { weekDayPrepTimes: _w, ...daysSettings } = makePrepTimeSettings({
			prepTimeCadence: PREP_TIME_CADENCE.DAY,
			prepTimeFrequency: 2,
		});
		const { schedule } = callGetSchedules(daysSettings as PrepTimeSettings);

		// First 2 open days (Wed, Thu) are skipped entirely; default prep (5 min) applies
		const firstDate = schedule[0].date;
		expect(firstDate.getUTCDate()).toBe(3); // Fri Jan 3
		expect(schedule[0].slots[0]).toEqual(new Date("2025-01-03T08:05:00.000Z"));
	});

	it("should start from opening time on the first available day", () => {
		// Thu Jan 2 2025 8am. frequency=1 → skip Thu, start Fri
		// Do not pass weekDayPrepTimes for days cadence
		vi.setSystemTime(new Date("2025-01-02T08:00:00.000Z"));

		const { weekDayPrepTimes: _w, ...daysSettings } = makePrepTimeSettings({
			prepTimeCadence: PREP_TIME_CADENCE.DAY,
			prepTimeFrequency: 1,
		});
		const { schedule } = callGetSchedules(daysSettings as PrepTimeSettings);

		expect(schedule[0].date.getUTCDate()).toBe(3); // Fri
		expect(schedule[0].slots[0]).toEqual(new Date("2025-01-03T08:05:00.000Z"));
	});
});
