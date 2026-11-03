import { tz } from "@date-fns/tz";
import { addDays, startOfDay } from "date-fns";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getSchedules } from "../src/schedule/get-schedules";
import type {
	GetSchedulesParams,
	LocationLike,
	PrepTimeSettings,
	StoreConfig,
} from "../src/types";
import {
	isTodayInTimeZone,
	isTomorrowInTimeZone,
	toDateStringInTimeZone,
} from "../src/utils/date";

/**
 * Alberta, British Columbia and Manitoba changed their clock rules after the tz
 * database `timezone-support` ships was frozen. Reading calendar days from Intl and
 * shift times from that copy put the two an hour apart, which moved every schedule in
 * those provinces a day ahead: the app offered today's slots under tomorrow's date and
 * labelled it Today (SUP-987). Toronto is here as the zone both copies agree on.
 */
const ZONES = [
	"America/Edmonton",
	"America/Vancouver",
	"America/Winnipeg",
	"America/Toronto",
];

const NOW = new Date("2026-11-03T19:44:00.000Z");

const allDaysPickupHours = [
	{ day: 0, start_time: "08:00", end_time: "20:00" },
	{ day: 1, start_time: "08:00", end_time: "20:00" },
	{ day: 2, start_time: "08:00", end_time: "20:00" },
	{ day: 3, start_time: "08:00", end_time: "20:00" },
	{ day: 4, start_time: "08:00", end_time: "20:00" },
	{ day: 5, start_time: "08:00", end_time: "20:00" },
	{ day: 6, start_time: "08:00", end_time: "20:00" },
];

/** The calendar date in that zone, read from Intl rather than from the code under test. */
function dateInZone(date: Date, timeZone: string): string {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(date);
	const value = (type: string) =>
		parts.find((part) => part.type === type)?.value;

	return `${value("year")}-${value("month")}-${value("day")}`;
}

function makeParams(timeZone: string): GetSchedulesParams {
	const location: LocationLike = {
		location_id: "loc-test",
		store_id: "store-1",
		timezone: timeZone,
		pickup_hours: allDaysPickupHours,
	};
	const store: StoreConfig = {
		isAsapOrders: false,
		isSameDayOrders: false,
		max_future_order_days: 7,
		businessHoursOverrides: [],
		weeklyPreSaleConfig: { active: false, pickup_days: [], ordering_days: [] },
	};
	const prepTimeSettings: PrepTimeSettings = {
		prepTimeInMinutes: 30,
		gapInMinutes: 5,
		busyTimes: {},
		fulfillAtBusinessDayStart: false,
	};

	return {
		store,
		locations: [location],
		cartItems: [],
		fulfillmentPreference: "PICKUP",
		prepTimeSettings,
		currentLocation: location,
	};
}

describe.each(ZONES)("a store in %s", (timeZone) => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	const localMidnight = () => new Date(startOfDay(NOW, { in: tz(timeZone) }));

	it("calls the store's own midnight today", () => {
		expect(toDateStringInTimeZone(localMidnight(), timeZone)).toBe(
			dateInZone(NOW, timeZone),
		);
		expect(isTodayInTimeZone(localMidnight(), timeZone)).toBe(true);
	});

	it("does not call tomorrow today", () => {
		const tomorrow = new Date(
			addDays(localMidnight(), 1, { in: tz(timeZone) }),
		);

		expect(isTodayInTimeZone(tomorrow, timeZone)).toBe(false);
		expect(isTomorrowInTimeZone(tomorrow, timeZone)).toBe(true);
	});

	it("opens the schedule on today, with today's slots under it", () => {
		const { schedule } = getSchedules(makeParams(timeZone));
		const today = dateInZone(NOW, timeZone);

		expect(dateInZone(schedule[0].date, timeZone)).toBe(today);
		expect(dateInZone(schedule[0].slots[0], timeZone)).toBe(today);
		expect(isTodayInTimeZone(schedule[0].date, timeZone)).toBe(true);
	});

	it("runs the week on consecutive days", () => {
		const { schedule } = getSchedules(makeParams(timeZone));

		schedule.forEach((day, index) => {
			expect(dateInZone(day.date, timeZone)).toBe(
				dateInZone(new Date(addDays(NOW, index)), timeZone),
			);
			expect(dateInZone(day.slots[0], timeZone)).toBe(
				dateInZone(day.date, timeZone),
			);
		});
	});
});
