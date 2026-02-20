import { findTimeZone, getZonedTime } from "timezone-support";
import type { ScheduleTransform } from "../types";

/**
 * Keeps only days that fall on the specified weekdays (0=Sun … 6=Sat).
 */
export function filterByWeekday(
	allowedDays: number[],
): ScheduleTransform {
	return (schedule, ctx) => {
		const allowed = new Set(allowedDays);
		return schedule.filter((day) => {
			const z = getZonedTime(day.date, findTimeZone(ctx.timeZone));
			return allowed.has(z.dayOfWeek ?? 0);
		});
	};
}
