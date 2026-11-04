import { addDays, compareAsc } from "date-fns";

import type { BusinessHour } from "../types";
import { getZonedParts, zonedPartsToDate } from "./zoned";

/** The instant `hm` falls on `date`'s calendar day in `timeZone`. */
export function setHmOnDate(date: Date, hm: string, timeZone: string): Date {
	const [hours, minutes] = String(hm).split(":");
	const { year, month, day } = getZonedParts(date, timeZone);
	const isEndOfDay = hours === "24";

	return zonedPartsToDate(
		{
			year,
			month,
			day,
			hours: isEndOfDay ? 23 : Number(hours),
			minutes: isEndOfDay ? 59 : Number(minutes),
			seconds: 0,
			milliseconds: 0,
		},
		timeZone,
	);
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
	return zonedPartsToDate(getZonedParts(date, "UTC"), timeZoneB);
}

export function isTodayInTimeZone(date: Date, timeZone: string): boolean {
	if (!date) {
		return false;
	}

	return isSameDateInTimeZone(new Date(Date.now()), date, timeZone);
}

export function isTomorrowInTimeZone(date: Date, timeZone: string): boolean {
	return isSameDateInTimeZone(addDays(Date.now(), 1), date, timeZone);
}

/** Returns YYYY-MM-DD for the given date in the given timezone. */
export function toDateStringInTimeZone(date: Date, timeZone: string): string {
	const { year, month, day } = getZonedParts(date, timeZone);
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${year}-${pad(month)}-${pad(day)}`;
}

export function isSameDateInTimeZone(
	dateLeft: Date,
	dateRight: Date,
	timeZone: string,
): boolean {
	const zonedDateLeft = getZonedParts(dateLeft, timeZone);
	const zonedDateRight = getZonedParts(dateRight, timeZone);

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
	const zonedEndDate = getZonedParts(endDate, timeZone);
	const zonedStartDate = getZonedParts(startDateNextDay, timeZone);

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
