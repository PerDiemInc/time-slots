import { isAfter, isBefore, isValid } from "date-fns";
import { getZonedTime } from "timezone-support";

import { MIN_LOOKAHEAD_DAYS } from "../constants";
import type { GetNextAvailableDatesParams } from "../types";
import {
	addDaysInTimeZone,
	isSameDateInTimeZone,
	setHmOnDate,
	startOfDateInTimeZone,
} from "../utils/date";
import { findTimeZone } from "../utils/timezone";

export function getNextAvailableDates({
	startDate,
	timeZone,
	businessHours,
	businessHoursOverrides = [],
	datesCount = 1,
	preSaleDates = [],
	endDate = null,
	isDaysCadence = false,
}: GetNextAvailableDatesParams): Date[] {
	const requestTime = new Date(startDate);

	if (!isValid(requestTime)) {
		return [];
	}

	startDate = startOfDateInTimeZone(requestTime, timeZone);

	const timeZoneInfo = findTimeZone(timeZone);
	const dates: Date[] = [];

	const lookaheadDays = Math.max(MIN_LOOKAHEAD_DAYS, datesCount);

	for (
		let date = startDate, maxRuns = 0;
		dates.length < datesCount && maxRuns <= lookaheadDays;
		date = addDaysInTimeZone(date, 1, timeZone), maxRuns += 1
	) {
		/**
		 * Skip if date is the same as the last date in the dates array (can happen due to DST)
		 */
		const lastDate = dates?.at(-1);
		if (lastDate && isSameDateInTimeZone(lastDate, date, timeZone)) {
			continue;
		}

		if (endDate && isAfter(date, endDate)) {
			break;
		}

		if (isBefore(date, startDate)) {
			continue;
		}

		const zonedDate = getZonedTime(date, timeZoneInfo);
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

		if (isDaysCadence) {
			const lastShiftEndTime = todayBusinessHours.at(-1)?.endTime;
			const shiftEndDate = lastShiftEndTime
				? setHmOnDate(date, lastShiftEndTime, timeZone)
				: null;
			if (shiftEndDate && isAfter(requestTime, shiftEndDate)) {
				continue;
			}
		}

		if (
			!todayBusinessHours?.length &&
			!todayBusinessHoursOverride.length &&
			!endDate
		) {
			continue;
		}

		if (preSaleDates.length > 0) {
			if (preSaleDates.some((d) => isSameDateInTimeZone(date, d, timeZone))) {
				dates.push(date);
			}
		} else {
			dates.push(date);
		}
	}

	return dates;
}
