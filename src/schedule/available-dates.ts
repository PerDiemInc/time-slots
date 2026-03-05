import { tz } from "@date-fns/tz";
import {
	addDays,
	isAfter,
	isBefore,
	isSameDay,
	isValid,
	startOfDay,
} from "date-fns";
import { findTimeZone, getZonedTime } from "timezone-support";

import type { GetNextAvailableDatesParams } from "../types";
import { setHmOnDate } from "../utils/date";

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
	startDate = new Date(startOfDay(startDate, { in: tz(timeZone) }));

	if (!isValid(startDate)) {
		return [];
	}

	const timeZoneInfo = findTimeZone(timeZone);
	const dates: Date[] = [];

	for (
		let date = startDate, maxRuns = 0;
		dates.length < datesCount && maxRuns <= 60;
		date = new Date(addDays(date, 1, { in: tz(timeZone) })), maxRuns += 1
	) {
		/**
		 * Skip if date is the same as the last date in the dates array (can happen due to DST)
		 */
		const lastDate = dates?.at(-1);
		if (lastDate && isSameDay(lastDate, date)) {
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
			if (preSaleDates.some((d) => isSameDay(date, d, { in: tz(timeZone) }))) {
				dates.push(date);
			}
		} else {
			dates.push(date);
		}
	}

	return dates;
}
