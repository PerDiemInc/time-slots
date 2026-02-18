import { addDays, compareAsc } from "date-fns";
import { findTimeZone, getUnixTime, getZonedTime } from "timezone-support";

import type { BusinessHour } from "../types";

export function setHmOnDate(date: Date, hm: string, timeZone: string): Date {
	const [hours, minutes] = String(hm).split(":");

	const zonedTime = getZonedTime(new Date(date), findTimeZone(timeZone));

	return new Date(
		getUnixTime({
			zone: zonedTime.zone,
			year: zonedTime.year,
			month: zonedTime.month,
			day: zonedTime.day,
			hours: hours === "24" ? 23 : Number(hours),
			minutes: hours === "24" ? 59 : Number(minutes),
			seconds: 0,
			milliseconds: 0,
		}),
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

export function addDaysInTimeZone(
	date: Date,
	days: number,
	timeZone: string,
): Date {
	const zonedTime = getZonedTime(addDays(date, days), findTimeZone(timeZone));
	return new Date(
		getUnixTime({
			...zonedTime,
			hours: 0,
			minutes: 0,
			seconds: 0,
			milliseconds: 0,
		}),
	);
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
