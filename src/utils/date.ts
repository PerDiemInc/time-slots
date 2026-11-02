import { addDays, compareAsc } from "date-fns";
import { getUnixTime, getZonedTime } from "timezone-support";

import type { BusinessHour } from "../types";
import { findTimeZone } from "./timezone";

const MS_PER_MINUTE = 60_000;

/**
 * The instant `hm` falls on `date`'s calendar day in `timeZone`.
 *
 * The UTC offset has to be the one in force at `hm`, not at `date`: on a clock-change
 * day they differ, and using `date`'s (usually local midnight) puts every later shift
 * an hour out. Hence two passes: the first lands close enough to read the right offset.
 * The passes only disagree on a time the clocks skip, and the later one moves it forward
 * (02:30 -> 03:30), including where midnight itself is skipped.
 */
export function setHmOnDate(date: Date, hm: string, timeZone: string): Date {
	const [hours, minutes] = String(hm).split(":");
	const zone = findTimeZone(timeZone);
	const {
		year,
		month,
		day,
		zone: dateZone,
	} = getZonedTime(new Date(date), zone);

	const wallClockMs = Date.UTC(
		year,
		month - 1,
		day,
		hours === "24" ? 23 : Number(hours),
		hours === "24" ? 59 : Number(minutes),
	);
	const toInstantMs = (offsetInMinutes = 0) =>
		wallClockMs + offsetInMinutes * MS_PER_MINUTE;
	const offsetAt = (instantMs: number) =>
		getZonedTime(instantMs, zone).zone?.offset;

	const firstPassMs = toInstantMs(dateZone?.offset);
	const offset = offsetAt(firstPassMs);
	const secondPassMs = toInstantMs(offset);

	return new Date(
		offsetAt(secondPassMs) === offset
			? secondPassMs
			: Math.max(firstPassMs, secondPassMs),
	);
}

const MS_PER_DAY = 24 * 60 * MS_PER_MINUTE;

/**
 * The first instant of the calendar day `year`-`month`-`day` in `timeZone`, worked out
 * from the package's own tz data so the answer is the same on every server.
 *
 * date-fns' `startOfDay`/`addDays` with `{ in: tz() }` resolve a midnight the clocks skip
 * (Cairo, Beirut, Havana, Santiago...) according to the process time zone: on a UTC server
 * they land on 23:00 of the day before, so the schedule lists that day twice and drops the
 * last one. Here a skipped midnight moves forward to the first minute that exists (01:00),
 * and a repeated one takes its first occurrence.
 */
export function startOfDayInTimeZone(
	year: number,
	month: number,
	day: number,
	timeZone: string,
): Date {
	const zone = findTimeZone(timeZone);
	const wallClockMs = Date.UTC(year, month - 1, day);
	const offsets = new Set(
		[wallClockMs - MS_PER_DAY, wallClockMs, wallClockMs + MS_PER_DAY].map(
			(instantMs) => getZonedTime(instantMs, zone).zone?.offset ?? 0,
		),
	);
	const candidates = [...offsets].map(
		(offset) => wallClockMs + offset * MS_PER_MINUTE,
	);
	const exact = candidates.filter((instantMs) => {
		const zoned = getZonedTime(instantMs, zone);
		return (
			zoned.hours === 0 &&
			zoned.minutes === 0 &&
			Date.UTC(zoned.year, zoned.month - 1, zoned.day) === wallClockMs
		);
	});
	return new Date(exact.length ? Math.min(...exact) : Math.max(...candidates));
}

/** Start of `date`'s calendar day in `timeZone`; see `startOfDayInTimeZone`. */
export function startOfDateInTimeZone(date: Date, timeZone: string): Date {
	const { year, month, day } = getZonedTime(date, findTimeZone(timeZone));
	return startOfDayInTimeZone(year, month, day, timeZone);
}

/** Start of the calendar day `days` after `date`'s in `timeZone`; see `startOfDayInTimeZone`. */
export function addDaysInTimeZone(
	date: Date,
	days: number,
	timeZone: string,
): Date {
	const { year, month, day } = getZonedTime(date, findTimeZone(timeZone));
	return startOfDayInTimeZone(year, month, day + days, timeZone);
}

export function getNextDateForDayOfWeek(
	targetDayIndex: number,
	referenceDate: Date = new Date(),
): Date {
	const currentDayIndex = referenceDate.getDay();
	const daysUntilTarget = (targetDayIndex - currentDayIndex + 7) % 7;
	return addDays(referenceDate, daysUntilTarget);
}

export function getPreSalePickupDates(
	preSalePickupDays: number[] = [],
	preSaleOrderingDays: number[] = [],
): Date[] {
	const today = new Date();
	const currentDayIndex = today.getDay();

	if (preSalePickupDays.includes(currentDayIndex)) {
		return [];
	}

	if (!preSaleOrderingDays.includes(currentDayIndex)) {
		return [];
	}

	return preSalePickupDays
		.map((day) => getNextDateForDayOfWeek(day))
		.sort(compareAsc);
}

export function overrideTimeZoneOnUTC(
	date: Date | string,
	timeZoneB: string,
): Date {
	const timeZoneATime = getZonedTime(new Date(date), findTimeZone("UTC"));
	const timeZoneBTime = getZonedTime(new Date(date), findTimeZone(timeZoneB));

	return new Date(
		getUnixTime({
			...timeZoneATime,
			zone: timeZoneBTime.zone,
		}),
	);
}

export function isTodayInTimeZone(date: Date, timeZone: string): boolean {
	if (!date) {
		return false;
	}
	const zonedNow = getZonedTime(Date.now(), findTimeZone(timeZone));
	const zonedTime = getZonedTime(date, findTimeZone(timeZone));

	return zonedNow.day === zonedTime.day && zonedNow.month === zonedTime.month;
}

export function isTomorrowInTimeZone(date: Date, timeZone: string): boolean {
	const zonedNow = getZonedTime(addDays(Date.now(), 1), findTimeZone(timeZone));
	const zonedTime = getZonedTime(date, findTimeZone(timeZone));

	return zonedNow.day === zonedTime.day && zonedNow.month === zonedTime.month;
}

/** Returns YYYY-MM-DD for the given date in the given timezone. */
export function toDateStringInTimeZone(date: Date, timeZone: string): string {
	const z = getZonedTime(date, findTimeZone(timeZone));
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${z.year}-${pad(z.month)}-${pad(z.day)}`;
}

export function isSameDateInTimeZone(
	dateLeft: Date,
	dateRight: Date,
	timeZone: string,
): boolean {
	const zonedDateLeft = getZonedTime(dateLeft, findTimeZone(timeZone));
	const zonedDateRight = getZonedTime(dateRight, findTimeZone(timeZone));

	return (
		zonedDateLeft.year === zonedDateRight.year &&
		zonedDateLeft.month === zonedDateRight.month &&
		zonedDateLeft.day === zonedDateRight.day
	);
}

export function isMidnightTransition(
	endDate: Date,
	startDateNextDay: Date,
	timeZone: string,
): boolean {
	if (!endDate || !startDateNextDay) {
		return false;
	}
	const zonedEndDate = getZonedTime(endDate, findTimeZone(timeZone));
	const zonedStartDate = getZonedTime(startDateNextDay, findTimeZone(timeZone));

	return (
		zonedEndDate.hours === 23 &&
		zonedEndDate.minutes === 59 &&
		zonedStartDate.hours === 0 &&
		zonedStartDate.minutes === 0
	);
}

export function lastShiftEndsAtMidnight(
	businessHours: BusinessHour[],
): boolean {
	if (!businessHours.length) return false;
	const lastShift = businessHours[businessHours.length - 1];
	return lastShift.endTime === "24:00" || lastShift.endTime === "23:59";
}

export function isZeroPrepTimeForMidnightShift({
	prevDayBusinessHours,
	businessHour,
}: {
	prevDayBusinessHours: BusinessHour[];
	businessHour: BusinessHour;
}): boolean {
	if (
		!Array.isArray(prevDayBusinessHours) ||
		prevDayBusinessHours.length === 0
	) {
		return false;
	}

	if (!businessHour || businessHour.startTime !== "00:00") {
		return false;
	}

	const currentDay = businessHour.day;
	const prevDay = (currentDay + 6) % 7;

	const prevDayHas24End = prevDayBusinessHours.some(
		(bh) =>
			bh.day === prevDay && (bh.endTime === "24:00" || bh.endTime === "23:59"),
	);
	return prevDayHas24End;
}
