import { compareAsc } from "date-fns";
import { findTimeZone, getUnixTime, getZonedTime } from "timezone-support";
import { generateDates } from "./generate-dates";
import { generateSlotsForShift } from "./generate-slots";
import { applyTransforms } from "./pipeline";
import { resolveShiftsForDate } from "./resolve-shifts";
import { setHmOnDate } from "../utils/date";
import type {
	CreateScheduleConfig,
	DaySlots,
	Schedule,
	ScheduleContext,
	ShiftContext,
	ShiftTransform,
} from "./types";
import { addDays } from "date-fns";

function dateKey(date: Date, timeZone: string): string {
	const z = getZonedTime(date, findTimeZone(timeZone));
	return `${z.year}-${z.month}-${z.day}`;
}

function startOfDayInZone(date: Date, timeZone: string): Date {
	const z = getZonedTime(date, findTimeZone(timeZone));
	return new Date(
		getUnixTime({
			...z,
			hours: 0,
			minutes: 0,
			seconds: 0,
			milliseconds: 0,
		}),
	);
}

function applyShiftTransforms(
	slots: Date[],
	ctx: ShiftContext,
	transforms: ShiftTransform[],
): Date[] {
	return transforms.reduce((acc, fn) => fn(acc, ctx), slots);
}

export function createSchedule(config: CreateScheduleConfig): Schedule {
	const {
		timeZone,
		now = new Date(),
		startDate = now,
		daysAhead,
		intervalMinutes = 15,
		shifts,
		overrides = [],
		shiftTransforms = [],
		transforms = [],
	} = config;

	const ctx: ScheduleContext = { timeZone, now, intervalMinutes, shifts };
	const dates = generateDates(startDate, daysAhead, timeZone);

	const dayMap = new Map<string, { date: Date; slots: Date[] }>();

	for (const date of dates) {
		const key = dateKey(date, timeZone);
		if (!dayMap.has(key)) {
			dayMap.set(key, { date, slots: [] });
		}
	}

	for (const date of dates) {
		const resolved = resolveShiftsForDate(date, shifts, overrides, timeZone);

		for (const shift of resolved) {
			let slots = generateSlotsForShift(
				date,
				shift,
				intervalMinutes,
				timeZone,
			);

			const shiftStart = setHmOnDate(date, shift.start, timeZone);
			const shiftEnd = shift.overnight
				? setHmOnDate(addDays(date, 1), shift.end, timeZone)
				: setHmOnDate(date, shift.end, timeZone);

			const shiftCtx: ShiftContext = {
				date,
				start: shiftStart,
				end: shiftEnd,
				isOvernight: shift.overnight,
				timeZone,
				now,
			};

			slots = applyShiftTransforms(slots, shiftCtx, shiftTransforms);

			for (const slot of slots) {
				const key = dateKey(slot, timeZone);
				if (!dayMap.has(key)) {
					dayMap.set(key, {
						date: startOfDayInZone(slot, timeZone),
						slots: [],
					});
				}
				dayMap.get(key)!.slots.push(slot);
			}
		}
	}

	let schedule: Schedule = Array.from(dayMap.values())
		.filter((d) => d.slots.length > 0)
		.map((d) => ({
			date: d.date,
			slots: d.slots.sort(compareAsc),
		}))
		.sort((a, b) => compareAsc(a.date, b.date));

	return applyTransforms(schedule, ctx, transforms);
}
