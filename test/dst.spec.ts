import { TZDate } from "@date-fns/tz";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getSchedules } from "../src/schedule/get-schedules";
import type { LocationLike } from "../src/types";
import { setHmOnDate } from "../src/utils/date";

const MS_PER_HOUR = 3_600_000;
const SHIFT_STEP_IN_MINUTES = 30;
const YEARS_AHEAD = 5;

/** Zones merchants run in, with northern, southern, 30-minute and midnight changes. */
const ZONES_WITH_CLOCK_CHANGES = [
	"America/New_York",
	"America/Chicago",
	"America/Denver",
	"America/Los_Angeles",
	"America/Anchorage",
	"America/Toronto",
	"America/Vancouver",
	"America/Halifax",
	"America/Havana",
	"Europe/London",
	"Australia/Sydney",
	"Australia/Adelaide",
	"Australia/Lord_Howe",
];
const ZONES_WITHOUT_CLOCK_CHANGES = [
	"America/Phoenix",
	"Pacific/Honolulu",
	"Asia/Karachi",
	"Etc/UTC",
];

const startOfLocalDay = (
	year: number,
	month: number,
	day: number,
	timeZone: string,
) => new TZDate(year, month, day, 0, 0, timeZone);

const dayLengthInHours = (
	year: number,
	month: number,
	day: number,
	timeZone: string,
) =>
	(startOfLocalDay(year, month, day + 1, timeZone).getTime() -
		startOfLocalDay(year, month, day, timeZone).getTime()) /
	MS_PER_HOUR;

/** Worked out from the tz database, so these tests keep covering future years untouched. */
const findClockChangeDays = (timeZone: string, year: number) => {
	const days: TZDate[] = [];
	for (let dayOfYear = 1; dayOfYear <= 366; dayOfYear += 1) {
		if (dayLengthInHours(year, 0, dayOfYear, timeZone) !== 24) {
			days.push(startOfLocalDay(year, 0, dayOfYear, timeZone));
		}
	}
	return days;
};

const toHm = (minutesIntoDay: number) =>
	`${String(Math.floor(minutesIntoDay / 60)).padStart(2, "0")}:${String(minutesIntoDay % 60).padStart(2, "0")}`;

const firstYear = new Date().getUTCFullYear();
const years = Array.from(
	{ length: YEARS_AHEAD },
	(_, index) => firstYear + index,
);

describe("setHmOnDate on clock-change days", () => {
	it.each([
		// Fall back, 2026-11-01: midnight is still daylight time, shifts are in standard time.
		[
			"America/New_York",
			"2026-11-01T04:00:00Z",
			"09:00",
			"2026-11-01T14:00:00.000Z",
		],
		[
			"America/New_York",
			"2026-11-01T04:00:00Z",
			"17:00",
			"2026-11-01T22:00:00.000Z",
		],
		[
			"America/Chicago",
			"2026-11-01T05:00:00Z",
			"09:00",
			"2026-11-01T15:00:00.000Z",
		],
		[
			"America/Los_Angeles",
			"2026-11-01T07:00:00Z",
			"09:00",
			"2026-11-01T17:00:00.000Z",
		],
		// Spring forward, 2027-03-14: midnight is standard time, shifts are in daylight time.
		[
			"America/New_York",
			"2027-03-14T05:00:00Z",
			"09:00",
			"2027-03-14T13:00:00.000Z",
		],
		[
			"America/New_York",
			"2027-03-14T05:00:00Z",
			"17:00",
			"2027-03-14T21:00:00.000Z",
		],
		[
			"America/Los_Angeles",
			"2027-03-14T08:00:00Z",
			"09:00",
			"2027-03-14T16:00:00.000Z",
		],
		// Southern hemisphere, 2026-10-04, clocks go forward at 02:00.
		[
			"Australia/Sydney",
			"2026-10-03T14:00:00Z",
			"00:30",
			"2026-10-03T14:30:00.000Z",
		],
		[
			"Australia/Sydney",
			"2026-10-03T14:00:00Z",
			"09:00",
			"2026-10-03T22:00:00.000Z",
		],
	])("%s from %s: %s is %s", (timeZone, date, hm, expected) => {
		expect(setHmOnDate(new Date(date), hm, timeZone).toISOString()).toBe(
			expected,
		);
	});

	it("places the hour right after clocks fall back", () => {
		const midnight = new Date("2026-11-01T04:00:00Z");
		expect(
			setHmOnDate(midnight, "02:30", "America/New_York").toISOString(),
		).toBe("2026-11-01T07:30:00.000Z");
	});

	it("uses the first 01:30 when clocks fall back and it happens twice", () => {
		const midnight = new Date("2026-11-01T04:00:00Z");
		expect(
			setHmOnDate(midnight, "01:30", "America/New_York").toISOString(),
		).toBe("2026-11-01T05:30:00.000Z");
	});

	it("moves a time the clocks skip forward", () => {
		const midnight = new Date("2027-03-14T05:00:00Z");
		expect(
			setHmOnDate(midnight, "02:30", "America/New_York").toISOString(),
		).toBe("2027-03-14T07:30:00.000Z");
	});

	it("keeps 24:00 as the end of the local day", () => {
		const midnight = new Date("2026-11-01T04:00:00Z");
		expect(
			setHmOnDate(midnight, "24:00", "America/New_York").toISOString(),
		).toBe("2026-11-02T04:59:00.000Z");
	});

	it("gives the same answer whatever time of day the date is at", () => {
		const midnight = new Date("2026-11-01T04:00:00Z");
		const evening = new Date("2026-11-01T23:00:00Z");
		expect(setHmOnDate(evening, "09:00", "America/New_York")).toEqual(
			setHmOnDate(midnight, "09:00", "America/New_York"),
		);
		expect(setHmOnDate(evening, "00:30", "America/New_York")).toEqual(
			setHmOnDate(midnight, "00:30", "America/New_York"),
		);
	});

	describe.each(ZONES_WITH_CLOCK_CHANGES)("%s", (timeZone) => {
		it.each(
			years,
		)("shows every stored time as stored on %i's change days", (year) => {
			const changeDays = findClockChangeDays(timeZone, year);
			expect(changeDays.length).toBeGreaterThan(0);

			for (const day of changeDays) {
				const midnight = new Date(day.getTime());
				for (
					let minutes = 0;
					minutes < 24 * 60;
					minutes += SHIFT_STEP_IN_MINUTES
				) {
					const hm = toHm(minutes);
					const requested = new TZDate(
						day.getFullYear(),
						day.getMonth(),
						day.getDate(),
						Math.floor(minutes / 60),
						minutes % 60,
						timeZone,
					);
					const isSkippedByClocks =
						requested.getHours() * 60 + requested.getMinutes() !== minutes;
					if (isSkippedByClocks) continue;

					const local = new TZDate(
						setHmOnDate(midnight, hm, timeZone).getTime(),
						timeZone,
					);
					expect(
						`${day.toDateString()} ${toHm(local.getHours() * 60 + local.getMinutes())}`,
					).toBe(`${day.toDateString()} ${hm}`);
					expect(local.getDate()).toBe(day.getDate());
				}
			}
		});
	});

	it.each(
		ZONES_WITHOUT_CLOCK_CHANGES,
	)("%s has no change days to get wrong", (timeZone) => {
		expect(findClockChangeDays(timeZone, firstYear)).toEqual([]);
	});
});

describe("getSchedules on clock-change days", () => {
	const everyDay = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
		day,
		start_time: "09:00",
		end_time: "17:00",
	}));
	const scheduleAt = (now: string, timezone: string, isAsapOrders = false) => {
		vi.setSystemTime(new Date(now));
		const location = {
			location_id: "loc-1",
			store_id: "store-1",
			timezone,
			pickup_hours: everyDay,
			delivery_hours: everyDay,
		} as unknown as LocationLike;
		return getSchedules({
			store: { isAsapOrders, isSameDayOrders: false, max_future_order_days: 3 },
			locations: [location],
			cartItems: [],
			fulfillmentPreference: "PICKUP",
			prepTimeSettings: {
				prepTimeInMinutes: 0,
				gapInMinutes: 30,
				fulfillAtBusinessDayStart: false,
				busyTimes: {},
			},
			currentLocation: location,
		}).schedule;
	};

	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it.each([
		[
			"fall back",
			"America/New_York",
			"2026-11-01T12:00:00Z",
			"2026-11-01T14:00:00.000Z",
			"2026-11-01T22:00:00.000Z",
		],
		[
			"fall back",
			"America/Los_Angeles",
			"2026-11-01T12:00:00Z",
			"2026-11-01T17:00:00.000Z",
			"2026-11-02T01:00:00.000Z",
		],
		[
			"spring forward",
			"America/New_York",
			"2027-03-14T11:00:00Z",
			"2027-03-14T13:00:00.000Z",
			"2027-03-14T21:00:00.000Z",
		],
		[
			"spring forward",
			"America/Los_Angeles",
			"2027-03-14T14:00:00Z",
			"2027-03-14T16:00:00.000Z",
			"2027-03-15T00:00:00.000Z",
		],
	])("%s in %s opens and closes at the stored hours", (_change, timezone, now, opening, closing) => {
		const [today] = scheduleAt(now, timezone);

		expect(today.openingTime?.toISOString()).toBe(opening);
		expect(today.closingTime?.toISOString()).toBe(closing);
		expect(today.slots[0]?.toISOString()).toBe(opening);
		expect(today.slots.at(-1)?.toISOString()).toBe(closing);
	});

	it("leaves the day after the change at the stored hours", () => {
		const [, tomorrow] = scheduleAt("2026-11-01T12:00:00Z", "America/New_York");

		expect(tomorrow.openingTime?.toISOString()).toBe(
			"2026-11-02T14:00:00.000Z",
		);
		expect(tomorrow.closingTime?.toISOString()).toBe(
			"2026-11-02T22:00:00.000Z",
		);
	});
});
