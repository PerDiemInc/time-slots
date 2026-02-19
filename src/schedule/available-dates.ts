import { isAfter, isSameDay } from "date-fns";
import { findTimeZone, getUnixTime, getZonedTime } from "timezone-support";

import type { GetNextAvailableDatesParams } from "../types";
import { addDaysInTimeZone, setHmOnDate } from "../utils/date";

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
}: GetNextAvailableDatesParams): Date[] {
	const zonedStartTime = getZonedTime(startDate, findTimeZone(timeZone));
	const startOfDayInZone = new Date(
		getUnixTime({
			...zonedStartTime,
			hours: 0,
			minutes: 0,
			seconds: 0,
			milliseconds: 0,
		}),
	);

	const dates: Date[] = [];

	for (
		let date = new Date(startOfDayInZone.getTime()), maxRuns = 0;
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
			todayBusinessHoursOverride.length &&
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
