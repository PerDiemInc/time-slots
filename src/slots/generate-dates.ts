import { isSameDay } from "date-fns";
import { addDaysInTimeZone } from "../utils/date";

export function generateDates(
	startDate: Date,
	daysAhead: number,
	timeZone: string,
): Date[] {
	const dates: Date[] = [];
	let current = addDaysInTimeZone(startDate, 0, timeZone);

	for (let guard = 0; dates.length < daysAhead && guard <= 60; guard++) {
		const last = dates.at(-1);
		if (last && isSameDay(last, current)) {
			current = addDaysInTimeZone(current, 1, timeZone);
			continue;
		}
		dates.push(current);
		current = addDaysInTimeZone(current, 1, timeZone);
	}

	return dates;
}
