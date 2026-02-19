import { describe, expect, it, vi } from "vitest";
import { PREP_TIME_CADENCE } from "../src/constants";
import { getSchedules } from "../src/schedule/get-schedules";
import type {
	GetSchedulesParams,
	LocationLike,
	PrepTimeSettings,
	StoreConfig,
} from "../src/types";
import { getLocationBusinessHoursForFulfillment } from "../src/utils/business-hours";
import { filterMenusFromSchedule } from "../src/utils/schedule-filter";
import { getOpeningClosingTimeOnDate } from "../src/utils/store-hours";

const allDaysPickupHours = [
	{ day: 0, start_time: "09:00", end_time: "17:00" },
	{ day: 1, start_time: "09:00", end_time: "17:00" },
	{ day: 2, start_time: "09:00", end_time: "17:00" },
	{ day: 3, start_time: "09:00", end_time: "17:00" },
	{ day: 4, start_time: "09:00", end_time: "17:00" },
	{ day: 5, start_time: "09:00", end_time: "17:00" },
	{ day: 6, start_time: "09:00", end_time: "17:00" },
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

describe("getSchedules", () => {
	describe("When calling with a 7-day future order window and UTC timezone", () => {
		it("should return a schedule with 7 days of time slots", () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

			const location = makeLocation();
			const params: GetSchedulesParams = {
				store: makeStore(),
				locations: [location],
				cartItems: [],
				fulfillmentPreference: "PICKUP",
				prepTimeSettings: makePrepTimeSettings(),
				currentLocation: location,
			};

			const { schedule, isWeeklyPreSaleAvailable } = getSchedules(params);

			expect(isWeeklyPreSaleAvailable).toBe(false);
			expect(schedule).toHaveLength(7);
			schedule.forEach((day) => {
				expect(day.date).toEqual(expect.any(Date));
				expect(day.slots.length).toBeGreaterThan(0);
			});

			vi.useRealTimers();
		});
	});

	describe("When filtering the schedule by menu time windows", () => {
		it("should narrow slots to the menu's active window", () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

			const location = makeLocation();
			const { schedule } = getSchedules({
				store: makeStore(),
				locations: [location],
				cartItems: [],
				fulfillmentPreference: "PICKUP",
				prepTimeSettings: makePrepTimeSettings(),
				currentLocation: location,
			});

			const menus = [
				{
					menu_id: "1",
					times: {
						"0": {
							all_day: false,
							start_time: "16:00",
							end_time: "16:30",
						},
					},
				},
			];

			const filteredSchedule = filterMenusFromSchedule({
				schedule,
				menus,
				timeZone: "UTC",
			});

			expect(filteredSchedule[0].slots.length).toEqual(3);

			vi.useRealTimers();
		});
	});

	describe("When store only allows same-day orders", () => {
		it("should return a schedule with 1 day only", () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date("2026-01-05T10:00:00.000Z"));

			const location = makeLocation();
			const { schedule } = getSchedules({
				store: makeStore({ isSameDayOrders: true }),
				locations: [location],
				cartItems: [],
				fulfillmentPreference: "PICKUP",
				prepTimeSettings: makePrepTimeSettings(),
				currentLocation: location,
			});

			expect(schedule).toHaveLength(1);
			expect(schedule[0].slots.length).toBeGreaterThan(0);

			vi.useRealTimers();
		});
	});
});

describe("getOpeningClosingTimeOnDate", () => {
	describe("When no next date is available for whole month", () => {
		it("should return null", () => {
			const businessHours = getLocationBusinessHoursForFulfillment(
				{
					location_id: "loc-test",
					timezone: "UTC",
					pickup_hours: [
						{ day: 0, start_time: "09:00", end_time: "17:00" },
						{ day: 1, start_time: "09:00", end_time: "17:00" },
						{ day: 2, start_time: "09:00", end_time: "17:00" },
						{ day: 3, start_time: "09:00", end_time: "17:00" },
						{ day: 4, start_time: "09:00", end_time: "17:00" },
						{ day: 5, start_time: "09:00", end_time: "17:00" },
						{ day: 6, start_time: "09:00", end_time: "17:00" },
					],
				},
				"PICKUP",
			);

			const times = getOpeningClosingTimeOnDate({
				date: new Date("2024-01-01T00:00:00.000Z"),
				timeZone: "UTC",
				businessHours,
				businessHoursOverrides: Array.from({ length: 31 }, (_, i) => ({
					month: 1,
					day: i + 1,
					startTime: null,
					endTime: null,
				})),
			});

			expect(times).toEqual(null);
		});
	});

	describe("When next date is available but no business times", () => {
		it("should return null", () => {
			const businessHours = getLocationBusinessHoursForFulfillment(
				{
					location_id: "loc-test",
					timezone: "UTC",
					pickup_hours: [],
				},
				"PICKUP",
			);

			const times = getOpeningClosingTimeOnDate({
				date: new Date("2024-01-01T00:00:00.000Z"),
				timeZone: "UTC",
				businessHours,
			});

			expect(times).toEqual(null);
		});
	});

	describe("When next date is available but store only opens on Sunday", () => {
		it("should return time for Sunday", () => {
			const businessHours = getLocationBusinessHoursForFulfillment(
				{
					location_id: "loc-test",
					timezone: "UTC",
					pickup_hours: [{ day: 0, start_time: "09:00", end_time: "17:00" }],
				},
				"PICKUP",
			);

			const times = getOpeningClosingTimeOnDate({
				date: new Date("2024-10-25T00:00:00.000Z"),
				timeZone: "UTC",
				businessHours,
				businessHoursOverrides: [
					{ month: 10, day: 24, startTime: null, endTime: null },
				],
			});

			expect(times?.openingTime).toEqual(new Date("2024-10-27T09:00:00.000Z"));
			expect(times?.closingTime).toEqual(new Date("2024-10-27T17:00:00.000Z"));
		});
	});

	describe("When next date is available but store only opens on Sunday and has breaks", () => {
		it("should return time for Sunday first shift", () => {
			const businessHours = getLocationBusinessHoursForFulfillment(
				{
					location_id: "loc-test",
					timezone: "UTC",
					pickup_hours: [
						{ day: 0, start_time: "09:00", end_time: "12:00" },
						{ day: 0, start_time: "14:00", end_time: "17:00" },
					],
				},
				"PICKUP",
			);

			const times = getOpeningClosingTimeOnDate({
				date: new Date("2024-10-25T00:00:00.000Z"),
				timeZone: "UTC",
				businessHours,
				businessHoursOverrides: [
					{ month: 10, day: 24, startTime: null, endTime: null },
				],
			});

			expect(times?.openingTime).toEqual(new Date("2024-10-27T09:00:00.000Z"));
			expect(times?.closingTime).toEqual(new Date("2024-10-27T12:00:00.000Z"));
		});
	});

	describe("When today date is available and store has all opening times", () => {
		it("should return time for today", () => {
			const businessHours = getLocationBusinessHoursForFulfillment(
				{
					location_id: "loc-test",
					timezone: "UTC",
					pickup_hours: [
						{ day: 0, start_time: "09:00", end_time: "17:00" },
						{ day: 1, start_time: "09:00", end_time: "17:00" },
						{ day: 2, start_time: "09:00", end_time: "17:00" },
						{ day: 3, start_time: "09:00", end_time: "17:00" },
						{ day: 4, start_time: "09:00", end_time: "17:00" },
						{ day: 5, start_time: "09:00", end_time: "15:00" },
						{ day: 6, start_time: "09:00", end_time: "17:00" },
					],
				},
				"PICKUP",
			);

			const times = getOpeningClosingTimeOnDate({
				date: new Date("2024-10-25T00:00:00.000Z"),
				timeZone: "UTC",
				businessHours,
				businessHoursOverrides: [
					{ month: 10, day: 24, startTime: null, endTime: null },
				],
			});

			expect(times?.openingTime).toEqual(new Date("2024-10-25T09:00:00.000Z"));
			expect(times?.closingTime).toEqual(new Date("2024-10-25T15:00:00.000Z"));
		});
	});

	describe("When today date is available and last month of same day is closed", () => {
		it("should return time for today using current month override", () => {
			const businessHours = getLocationBusinessHoursForFulfillment(
				{
					location_id: "loc-test",
					timezone: "UTC",
					pickup_hours: [
						{ day: 0, start_time: "09:00", end_time: "17:00" },
						{ day: 1, start_time: "09:00", end_time: "17:00" },
						{ day: 2, start_time: "09:00", end_time: "17:00" },
						{ day: 3, start_time: "09:00", end_time: "17:00" },
						{ day: 4, start_time: "09:00", end_time: "17:00" },
						{ day: 5, start_time: "09:00", end_time: "15:00" },
						{ day: 6, start_time: "09:00", end_time: "17:00" },
					],
				},
				"PICKUP",
			);

			const times = getOpeningClosingTimeOnDate({
				date: new Date("2024-12-30T00:00:00.000Z"),
				timeZone: "UTC",
				businessHours,
				businessHoursOverrides: [
					{ month: 11, day: 30, startTime: null, endTime: null },
					{
						month: 12,
						day: 30,
						startTime: "10:00:00",
						endTime: "23:59:00",
					},
				],
			});

			expect(times?.openingTime).toEqual(new Date("2024-12-30T10:00:00.000Z"));
			expect(times?.closingTime).toEqual(new Date("2024-12-30T23:59:00.000Z"));
		});
	});

	describe("When today is closed and the same day in next month and past month is open", () => {
		it("should return time for next available day", () => {
			const businessHours = getLocationBusinessHoursForFulfillment(
				{
					location_id: "loc-test",
					timezone: "UTC",
					pickup_hours: [
						{ day: 0, start_time: "09:00", end_time: "17:00" },
						{ day: 1, start_time: "09:00", end_time: "17:00" },
						{ day: 2, start_time: "09:00", end_time: "17:00" },
						{ day: 3, start_time: "09:00", end_time: "17:00" },
						{ day: 4, start_time: "09:00", end_time: "17:00" },
						{ day: 5, start_time: "09:00", end_time: "15:00" },
						{ day: 6, start_time: "09:00", end_time: "17:00" },
					],
				},
				"PICKUP",
			);

			const times = getOpeningClosingTimeOnDate({
				date: new Date("2024-12-30T00:00:00.000Z"),
				timeZone: "UTC",
				businessHours,
				businessHoursOverrides: [
					{
						month: 1,
						day: 30,
						startTime: "10:00:00",
						endTime: "23:59:00",
					},
					{ month: 12, day: 30, startTime: null, endTime: null },
					{
						month: 11,
						day: 30,
						startTime: "10:00:00",
						endTime: "23:59:00",
					},
				],
			});

			expect(times?.openingTime).toEqual(new Date("2024-12-31T09:00:00.000Z"));
			expect(times?.closingTime).toEqual(new Date("2024-12-31T17:00:00.000Z"));
		});
	});
});
