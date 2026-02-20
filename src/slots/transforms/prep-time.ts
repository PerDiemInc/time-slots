import { addMinutes, isAfter } from "date-fns";
import type { ShiftTransform } from "../types";

/**
 * Shift-level transform that offsets the first available slot by prep time.
 * For "today" shifts, uses max(shiftStart, now) + minutes as the cutoff.
 * For future shifts, uses shiftStart + minutes.
 * Overnight shifts are treated as continuous — prep time from the previous
 * calendar day carries into the next naturally.
 */
export function applyPrepTime(config: {
	minutes: number;
}): ShiftTransform {
	const { minutes } = config;

	return (slots, ctx) => {
		if (slots.length === 0 || minutes <= 0) return slots;

		const base =
			ctx.now > ctx.start
				? new Date(Math.max(ctx.now.getTime(), ctx.start.getTime()))
				: ctx.start;

		const cutoff = addMinutes(base, minutes);

		if (isAfter(cutoff, ctx.end)) return [];

		const filtered = slots.filter((s) => s >= cutoff);

		if (filtered.length === 0) return [];

		if (filtered[0].getTime() !== cutoff.getTime()) {
			filtered.unshift(cutoff);
		}

		return filtered;
	};
}
