import { findTimeZone, getZonedTime } from "timezone-support";
import type { DateOverride, Shift } from "./types";

export interface ResolvedShift {
	start: string;
	end: string;
	overnight: boolean;
}

function isOvernight(start: string, end: string): boolean {
	const [sh, sm] = start.split(":").map(Number);
	const [eh, em] = end.split(":").map(Number);
	return eh < sh || (eh === sh && em < sm);
}

export function resolveShiftsForDate(
	date: Date,
	shifts: Shift[],
	overrides: DateOverride[],
	timeZone: string,
): ResolvedShift[] {
	const zoned = getZonedTime(date, findTimeZone(timeZone));

	const override = overrides.find(
		(o) => o.month === zoned.month && o.day === zoned.day,
	);

	if (override) {
		if (!override.shifts || override.shifts.length === 0) {
			return [];
		}
		return override.shifts.map((s) => ({
			start: s.start,
			end: s.end,
			overnight: isOvernight(s.start, s.end),
		}));
	}

	const dayOfWeek = zoned.dayOfWeek ?? 0;
	return shifts
		.filter((s) => s.day === dayOfWeek)
		.map((s) => ({
			start: s.start,
			end: s.end,
			overnight: isOvernight(s.start, s.end),
		}));
}
