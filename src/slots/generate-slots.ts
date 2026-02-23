import { addDays, eachMinuteOfInterval } from "date-fns";
import { setHmOnDate } from "../utils/date";
import type { ResolvedShift } from "./resolve-shifts";

export function generateSlotsForShift(
	date: Date,
	shift: ResolvedShift,
	intervalMinutes: number,
	timeZone: string,
): Date[] {
	const start = setHmOnDate(date, shift.start, timeZone);
	const end = shift.overnight
		? setHmOnDate(addDays(date, 1), shift.end, timeZone)
		: setHmOnDate(date, shift.end, timeZone);

	if (start >= end) return [];

	return eachMinuteOfInterval({ start, end }, { step: intervalMinutes });
}
