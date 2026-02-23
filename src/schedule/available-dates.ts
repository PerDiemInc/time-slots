import { tz } from "@date-fns/tz";
import { isAfter, isSameDay, startOfDay } from "date-fns";
import { findTimeZone, getUnixTime, getZonedTime } from "timezone-support";

import { PLATFORM } from "../constants";
import type { GetNextAvailableDatesParams, Platform } from "../types";
import { addDaysInTimeZone, setHmOnDate } from "../utils/date";

function getStartOfDayInZone(
	startDate: Date,
	timeZone: string,
	platform: Platform,
): Date {
	if (platform !== PLATFORM.ANDROID) {
		return startOfDay(startDate, { in: tz(timeZone) });
	}
	const zoned = getZonedTime(startDate, findTimeZone(timeZone));
	return new Date(
		getUnixTime({
			...zoned,
			hours: 0,
			minutes: 0,
			seconds: 0,
			milliseconds: 0,
		}),
	);
}

export function getNextAvailableDates({
	startDate,
	timeZone,
	businessHours,
	businessHoursOverrides = [],
	datesCount = 1,
	preSaleDates = [],
	presalePickupWeekDays = [],
	endDate = null,
	isDaysCadence = false,
	platform = PLATFORM.WEB,
}: GetNextAvailableDatesParams): Date[] {
	const startOfDayInZone = getStartOfDayInZone(startDate, timeZone, platform);
	const zonedStartTime = getZonedTime(startOfDayInZone, findTimeZone(timeZone));

	const dates: Date[] = [];

	for (
		let date = new Date(
				getUnixTime({
					...zonedStartTime,
					hours: 0,
					minutes: 0,
					seconds: 0,
					milliseconds: 0,
				}),
			),
			maxRuns = 0;
		dates.length < datesCount && maxRuns <= 30;
		date = addDaysInTimeZone(date, 1, timeZone), maxRuns += 1
	) {
		const lastDate = dates?.at(-1);
		if (lastDate && isSameDay(lastDate, date)) {
			continue;
		}

		if (endDate && isAfter(date, endDate)) {
			break;
		}

		if (date.getTime() < getUnixTime(zonedStartTime)) {
			continue;
		}

		const zonedDate = getZonedTime(date, findTimeZone(timeZone));
		const dayOfWeek = zonedDate.dayOfWeek ?? 0;

		const todayBusinessHoursOverride = businessHoursOverrides.filter(
			(override) =>
				zonedDate.month === override.month && zonedDate.day === override.day,
		);

		const closedBusinessHoursOverride = todayBusinessHoursOverride.filter(
			(override) => !override.startTime && !override.endTime,
		);

		if (closedBusinessHoursOverride.length) {
			continue;
		}

		const todayBusinessHours = businessHours.filter(
			(bh) => bh.day === dayOfWeek,
		);
		// If days cadence, we dont need to skip date even if it is after the last shift end time
		if (isDaysCadence) {
			const lastShiftEndTime = todayBusinessHours.at(-1)?.endTime;
			const shiftEndDate = lastShiftEndTime
				? setHmOnDate(date, lastShiftEndTime, timeZone)
				: null;
			/**
			 * Skip current date if current time is after the last shift end time
			 */
			if (shiftEndDate && isAfter(startDate, shiftEndDate)) {
				continue;
			}
		}
		/**
		 * Skip if today is closed by location hours or by override hours
		 */
		if (
			!todayBusinessHours?.length &&
			!todayBusinessHoursOverride.length &&
			!endDate
		) {
			continue;
		}

		if (preSaleDates.length && presalePickupWeekDays.length) {
			if (
				preSaleDates.includes(zonedDate.day) &&
				presalePickupWeekDays.includes(dayOfWeek)
			) {
				dates.push(date);
			}
		} else {
			dates.push(date);
		}
	}

	return dates;
}
