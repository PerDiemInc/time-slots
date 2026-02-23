import { findTimeZone, getZonedTime } from "timezone-support";
import type { ScheduleTransform } from "../types";

export interface RestrictedDate {
	month: number;
	day: number;
}

function toRestricted(
	input: Date | string | RestrictedDate,
	timeZone?: string,
): RestrictedDate {
	if (typeof input === "object" && "month" in input && "day" in input) {
		return input;
	}
	const d = new Date(input);
	if (timeZone) {
		const z = getZonedTime(d, findTimeZone(timeZone));
		return { month: z.month, day: z.day };
	}
	return { month: d.getMonth() + 1, day: d.getDate() };
}

/**
 * Removes entire days from the schedule that match any of the restricted dates.
 * Accepts dates as { month, day } objects, Date instances, or ISO strings.
 */
export function restrictDates(
	dates: (Date | string | RestrictedDate)[],
): ScheduleTransform {
	return (schedule, ctx) => {
		const restricted = dates.map((d) => toRestricted(d, ctx.timeZone));

		return schedule.filter((day) => {
			const z = getZonedTime(day.date, findTimeZone(ctx.timeZone));
			return !restricted.some((r) => r.month === z.month && r.day === z.day);
		});
	};
}
