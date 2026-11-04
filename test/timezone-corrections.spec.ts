import {
	findTimeZone as findBundledTimeZone,
	getUTCOffset,
} from "timezone-support";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getSchedules } from "../src/schedule/get-schedules";
import type { LocationLike } from "../src/types";
import {
	addDaysInTimeZone,
	setHmOnDate,
	startOfDateInTimeZone,
	startOfDayInTimeZone,
} from "../src/utils/date";
import { findTimeZone } from "../src/utils/timezone";
import { TIME_ZONE_DATA_VERSION } from "../src/utils/timezone-corrections";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const YEARS_AHEAD = 5;
const STEP_IN_MINUTES = 30;

/** Zones merchants run in, including legacy spellings and fixed-offset names. */
const MERCHANT_ZONES = [
	"Africa/Cairo",
	"Africa/Johannesburg",
	"Africa/Lagos",
	"America/Anchorage",
	"America/Bogota",
	"America/Boise",
	"America/Caracas",
	"America/Chicago",
	"America/Denver",
	"America/Detroit",
	"America/Edmonton",
	"America/Guatemala",
	"America/Halifax",
	"America/Indiana/Indianapolis",
	"America/Indianapolis",
	"America/Los_Angeles",
	"America/Moncton",
	"America/New_York",
	"America/North_Dakota/Center",
	"America/Phoenix",
	"America/Port-au-Prince",
	"America/Regina",
	"America/Sao_Paulo",
	"America/St_Johns",
	"America/Thunder_Bay",
	"America/Toronto",
	"America/Vancouver",
	"America/Whitehorse",
	"America/Winnipeg",
	"Asia/Calcutta",
	"Asia/Dhaka",
	"Asia/Dubai",
	"Asia/Jerusalem",
	"Asia/Karachi",
	"Asia/Riyadh",
	"Asia/Shanghai",
	"Asia/Tbilisi",
	"Asia/Tokyo",
	"Australia/Adelaide",
	"Australia/Brisbane",
	"Australia/Darwin",
	"Australia/Melbourne",
	"Australia/Perth",
	"Australia/Sydney",
	"Etc/GMT+1",
	"Etc/GMT-10",
	"Europe/Amsterdam",
	"Europe/Belgrade",
	"Europe/Berlin",
	"Europe/Bucharest",
	"Europe/Kiev",
	"Europe/Lisbon",
	"Europe/Ljubljana",
	"Europe/London",
	"Europe/Moscow",
	"Europe/Paris",
	"Europe/Tallinn",
	"Pacific/Honolulu",
	"Pacific/Pago_Pago",
];

/** Stale bundled rules, or clocks that skip midnight itself. */
const ZONES_WITH_KNOWN_PROBLEMS = [
	"America/Asuncion",
	"America/Ciudad_Juarez",
	"America/Coyhaique",
	"America/Godthab",
	"America/Havana",
	"America/Nuuk",
	"America/Ojinaga",
	"America/Santiago",
	"America/Scoresbysund",
	"Asia/Almaty",
	"Asia/Beirut",
	"Asia/Qostanay",
	"Atlantic/Azores",
];

const pad = (value: number) => String(value).padStart(2, "0");

const wallClockFormatters = new Map<string, Intl.DateTimeFormat>();
const offsetFormatters = new Map<string, Intl.DateTimeFormat>();

/** Local "YYYY-MM-DD HH:mm" from Intl, independent of timezone-support. */
const wallClock = (instant: number, timeZone: string) => {
	let formatter = wallClockFormatters.get(timeZone);
	if (!formatter) {
		formatter = new Intl.DateTimeFormat("en-US", {
			timeZone,
			hourCycle: "h23",
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
		});
		wallClockFormatters.set(timeZone, formatter);
	}
	const part: Record<string, string> = {};
	for (const { type, value } of formatter.formatToParts(instant)) {
		part[type] = value;
	}
	return `${part.year}-${part.month}-${part.day} ${part.hour}:${part.minute}`;
};

/** Minutes behind UTC from Intl, the sign timezone-support uses. */
const intlOffset = (instant: number, timeZone: string) => {
	let formatter = offsetFormatters.get(timeZone);
	if (!formatter) {
		formatter = new Intl.DateTimeFormat("en-US", {
			timeZone,
			timeZoneName: "longOffset",
		});
		offsetFormatters.set(timeZone, formatter);
	}
	const label =
		formatter.formatToParts(instant).find((p) => p.type === "timeZoneName")
			?.value ?? "";
	const match = label.match(/GMT([+-])(\d{2}):(\d{2})/);
	if (!match) return 0;
	const minutes = Number(match[2]) * 60 + Number(match[3]);
	return match[1] === "+" ? -minutes : minutes;
};

/** Each instant showing `want`, earliest first, given the offsets either side of the day. */
const instantsShowing = (
	utcWall: number,
	want: string,
	offsets: number[],
	timeZone: string,
) =>
	[...new Set(offsets.map((offset) => utcWall + offset * 60_000))]
		.filter((instant) => wallClock(instant, timeZone) === want)
		.sort((a, b) => a - b);

const firstYear = new Date().getUTCFullYear();

/**
 * Checks against Intl only mean something when this Node's tzdata is at least as new as the
 * data the corrections came from. On older Node, Intl itself has the old rules.
 */
const intlIsCurrent = (process.versions.tz ?? "") >= TIME_ZONE_DATA_VERSION;

/** Days whose offset changes around them; neighbours are included, which only adds checks. */
const changeDays = (timeZone: string) => {
	const days: { utcMidnight: number; offsets: number[] }[] = [];
	const end = Date.UTC(firstYear + YEARS_AHEAD, 0, 1);
	for (let at = Date.UTC(firstYear, 0, 1); at < end; at += DAY_MS) {
		const before = intlOffset(at - 16 * HOUR_MS, timeZone);
		const after = intlOffset(at + 40 * HOUR_MS, timeZone);
		if (before !== after) {
			days.push({ utcMidnight: at, offsets: [before, after] });
		}
	}
	return days;
};

describe.runIf(intlIsCurrent)("every merchant and known-problem zone", () => {
	describe.each([
		...MERCHANT_ZONES,
		...ZONES_WITH_KNOWN_PROBLEMS,
	])("%s", (timeZone) => {
		it("shows stored times as stored, and moves skipped ones forward", () => {
			for (const { utcMidnight, offsets } of changeDays(timeZone)) {
				const date = new Date(utcMidnight).toISOString().slice(0, 10);
				const expectations: { hm: string; instants: number[] }[] = [];
				for (let minutes = 0; minutes < 24 * 60; minutes += STEP_IN_MINUTES) {
					const hm = `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
					expectations.push({
						hm,
						instants: instantsShowing(
							utcMidnight + minutes * 60_000,
							`${date} ${hm}`,
							offsets,
							timeZone,
						),
					});
				}
				const startOfDay = expectations.find(
					({ instants }) => instants.length > 0,
				)?.instants[0];
				expect(startOfDay, `${timeZone} ${date}`).toBeDefined();

				for (const { hm, instants } of expectations) {
					const actual = setHmOnDate(
						new Date(startOfDay as number),
						hm,
						timeZone,
					).getTime();
					const label = `${timeZone} ${date} ${hm}`;
					if (instants.length > 0) {
						expect(actual, label).toBe(instants[0]);
					} else {
						const shown = wallClock(actual, timeZone);
						expect(shown > `${date} ${hm}`, label).toBe(true);
						// Greenland skips 23:00-24:00, leaving nowhere later on that day to go.
						const hasLaterTimeToday = expectations.some(
							(later) => later.hm > hm && later.instants.length > 0,
						);
						if (hasLaterTimeToday) {
							expect(shown.slice(0, 10), label).toBe(date);
						}
					}
				}
			}
		});

		it("is right on ordinary days", () => {
			const date = Date.UTC(firstYear + 1, 6, 1);
			const offset = intlOffset(date, timeZone);
			const startOfDay = date + offset * 60_000;
			expect(
				setHmOnDate(new Date(startOfDay), "09:00", timeZone).getTime(),
			).toBe(startOfDay + 9 * HOUR_MS);
		});
	});
});

describe("zones the bundled tz data has wrong", () => {
	it.each([
		["Africa/Cairo", "2027-07-01T00:00:00+03:00", "2027-07-01T06:00:00.000Z"],
		[
			"America/Asuncion",
			"2027-07-01T00:00:00-03:00",
			"2027-07-01T12:00:00.000Z",
		],
		["America/Nuuk", "2027-01-15T00:00:00-02:00", "2027-01-15T11:00:00.000Z"],
		[
			"America/Ojinaga",
			"2027-07-01T00:00:00-05:00",
			"2027-07-01T14:00:00.000Z",
		],
		["Asia/Almaty", "2027-01-15T00:00:00+05:00", "2027-01-15T04:00:00.000Z"],
	])("%s opens 09:00 at the right instant", (timeZone, midnight, expected) => {
		expect(
			setHmOnDate(new Date(midnight), "09:00", timeZone).toISOString(),
		).toBe(expected);
	});

	it.each([
		"America/Ciudad_Juarez",
		"America/Coyhaique",
	])("%s no longer throws", (timeZone) => {
		expect(() => findBundledTimeZone(timeZone)).toThrow();
		expect(findTimeZone(timeZone).name).toBe(timeZone);
	});

	it("still throws on a name that isn't a time zone", () => {
		expect(() => findTimeZone("Not/AZone")).toThrow();
	});

	it("keeps the bundled history before the corrected rules", () => {
		const past = Date.UTC(2015, 6, 1);
		expect(getUTCOffset(past, findTimeZone("Africa/Cairo")).offset).toBe(
			getUTCOffset(past, findBundledTimeZone("Africa/Cairo")).offset,
		);
	});

	it.each([
		// Clocks skip midnight, so 00:00 is the first valid minute, not the night before.
		["America/Havana", "2027-03-14T05:00:00.000Z"],
		["America/Santiago", "2026-09-06T04:00:00.000Z"],
		["Asia/Beirut", "2026-03-28T22:00:00.000Z"],
		["Atlantic/Azores", "2026-03-29T01:00:00.000Z"],
	])("%s moves a skipped midnight forward", (timeZone, startOfDay) => {
		expect(
			setHmOnDate(new Date(startOfDay), "00:00", timeZone).toISOString(),
		).toBe(startOfDay);
	});

	describe("startOfDayInTimeZone / addDaysInTimeZone", () => {
		it.each([
			["America/New_York", 2027, 3, 14, "2027-03-14T05:00:00.000Z"],
			["America/New_York", 2026, 11, 1, "2026-11-01T04:00:00.000Z"],
			// Midnight is skipped: the day starts at 01:00.
			["Africa/Cairo", 2027, 4, 30, "2027-04-29T22:00:00.000Z"],
			["Asia/Beirut", 2026, 3, 29, "2026-03-28T22:00:00.000Z"],
			["America/Havana", 2027, 3, 14, "2027-03-14T05:00:00.000Z"],
			// Midnight happens twice: the day starts at the first one.
			["America/Havana", 2026, 11, 1, "2026-11-01T04:00:00.000Z"],
			// Month and year roll over.
			["Asia/Karachi", 2026, 12, 32, "2026-12-31T19:00:00.000Z"],
		])("%s %i-%i-%i starts at %s on every server", (timeZone, year, month, day, expected) => {
			expect(
				startOfDayInTimeZone(year, month, day, timeZone).toISOString(),
			).toBe(expected);
		});

		it("steps through Cairo's skipped midnight one day at a time", () => {
			const eve = startOfDateInTimeZone(
				new Date("2027-04-29T12:00:00Z"),
				"Africa/Cairo",
			);
			const changeDay = addDaysInTimeZone(eve, 1, "Africa/Cairo");
			const dayAfter = addDaysInTimeZone(changeDay, 1, "Africa/Cairo");
			expect(
				[eve, changeDay, dayAfter].map((date) => date.toISOString()),
			).toEqual([
				"2027-04-28T22:00:00.000Z",
				"2027-04-29T22:00:00.000Z",
				"2027-04-30T21:00:00.000Z",
			]);
		});
	});

	it("moves a skipped time forward whatever time of day the date is at", () => {
		const lateEvening = new Date("2027-03-15T03:00:00Z");
		expect(
			setHmOnDate(lateEvening, "02:30", "America/New_York").toISOString(),
		).toBe("2027-03-14T07:30:00.000Z");
	});

	describe("through getSchedules", () => {
		beforeEach(() => {
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it("opens and closes Cairo at its stored hours in summer", () => {
			vi.setSystemTime(new Date("2027-07-01T03:00:00Z"));
			const everyDay = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
				day,
				start_time: "09:00",
				end_time: "17:00",
			}));
			const location = {
				location_id: "loc-1",
				store_id: "store-1",
				timezone: "Africa/Cairo",
				pickup_hours: everyDay,
				delivery_hours: everyDay,
			} as unknown as LocationLike;

			const [today] = getSchedules({
				store: {
					isAsapOrders: false,
					isSameDayOrders: false,
					max_future_order_days: 3,
				},
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

			expect(today.openingTime?.toISOString()).toBe("2027-07-01T06:00:00.000Z");
			expect(today.closingTime?.toISOString()).toBe("2027-07-01T14:00:00.000Z");
		});

		/**
		 * Cairo skips midnight when its clocks go forward (2027-04-30 starts at 01:00). The
		 * day loop used to resolve that midnight by the process time zone, so on a UTC server
		 * 04/29 was listed twice and the last day of the window dropped.
		 */
		it("lists each day once around Cairo's skipped midnight", () => {
			vi.setSystemTime(new Date("2027-04-29T07:00:00Z"));
			const everyDay = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
				day,
				start_time: "09:00",
				end_time: "17:00",
			}));
			const location = {
				location_id: "loc-1",
				store_id: "store-1",
				timezone: "Africa/Cairo",
				pickup_hours: everyDay,
				delivery_hours: everyDay,
			} as unknown as LocationLike;

			const schedule = getSchedules({
				store: {
					isAsapOrders: false,
					isSameDayOrders: false,
					max_future_order_days: 3,
				},
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

			expect(
				schedule.map(
					(day) =>
						`${day.openingTime?.toISOString()} ${day.closingTime?.toISOString()}`,
				),
			).toEqual([
				"2027-04-29T07:00:00.000Z 2027-04-29T15:00:00.000Z",
				"2027-04-30T06:00:00.000Z 2027-04-30T14:00:00.000Z",
				"2027-05-01T06:00:00.000Z 2027-05-01T14:00:00.000Z",
			]);
		});
	});
});

describe.runIf(intlIsCurrent)("tz data drift", () => {
	/**
	 * Fails when Node's tz data has rules this package doesn't, for example after a country
	 * changes its clocks. Fix it with `npm run generate:tz-corrections`, not by editing tests.
	 */
	it("agrees with Intl on every zone for the next few years", () => {
		const end = Date.UTC(firstYear + YEARS_AHEAD, 0, 1);
		const drifted = new Set<string>();
		for (const timeZone of Intl.supportedValuesOf("timeZone")) {
			const zone = findTimeZone(timeZone);
			for (let at = Date.UTC(firstYear, 0, 1); at < end; at += DAY_MS) {
				if (getUTCOffset(at, zone).offset !== intlOffset(at, timeZone)) {
					drifted.add(timeZone);
					break;
				}
			}
		}
		expect([...drifted]).toEqual([]);
	}, 60_000);
});
