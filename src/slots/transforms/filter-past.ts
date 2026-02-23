import type { ScheduleTransform } from "../types";

/**
 * Removes slots that are before a given cutoff (defaults to ctx.now).
 * Days with no remaining slots are dropped entirely.
 */
export function filterPast(cutoff?: Date): ScheduleTransform {
	return (schedule, ctx) => {
		const threshold = cutoff ?? ctx.now;
		const ms = threshold.getTime();

		return schedule
			.map((day) => ({
				...day,
				slots: day.slots.filter((s) => s.getTime() >= ms),
			}))
			.filter((day) => day.slots.length > 0);
	};
}
