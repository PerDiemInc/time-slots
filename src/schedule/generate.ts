import {
	addMinutes,
	compareAsc,
	eachMinuteOfInterval,
	isAfter,
	isBefore,
	max,
} from "date-fns";
import { findTimeZone, getZonedTime } from "timezone-support";
import type { PrepTimeBehaviourType } from "../constants";
import {
	DEFAULT_PREP_TIME_IN_MINUTES,
	PREP_TIME_CADENCE,
	PrepTimeBehaviour,
} from "../constants";
import type {
	BusinessHour,
	BusinessHoursOverrideOutput,
	DaySchedule,
	GenerateScheduleParams,
} from "../types";
import {
	isTodayInTimeZone,
	isZeroPrepTimeForMidnightShift,
	setHmOnDate,
} from "../utils/date";

// ── Private helpers ─────────────────────────────────────────────────────────

interface GetSelectedBusinessHoursParams {
	businessHours?: BusinessHour[];
	businessHoursOverrides?: BusinessHoursOverrideOutput[];
	date?: Date;
	timeZone?: string;
	preSaleHoursOverride?: Array<{
		startTime: string;
		endTime: string;
		month?: number;
		day?: number;
	}> | null;
}

function getSelectedBusinessHours({
	businessHours = [],
	businessHoursOverrides = [],
	date,
	timeZone,
	preSaleHoursOverride,
}: GetSelectedBusinessHoursParams): [
	BusinessHour[],
	ReturnType<typeof getZonedTime>,
] {
	if (!date || !timeZone) {
		return [[], getZonedTime(new Date(), findTimeZone(timeZone ?? "UTC"))];
	}

	const zonedDate = getZonedTime(date, findTimeZone(timeZone));
	const dayOfWeek = zonedDate.dayOfWeek ?? 0;

	const dayBusinessHours = businessHours?.filter((bh) => bh.day === dayOfWeek);

	const businessHoursOverride = businessHoursOverrides?.filter(
		(override) =>
			zonedDate.month === override.month && zonedDate.day === override.day,
	);

	const selectedBusinessHours: BusinessHour[] = preSaleHoursOverride
		? preSaleHoursOverride.map((o) => ({
				day: dayOfWeek,
				startTime: o.startTime,
				endTime: o.endTime,
			}))
		: businessHoursOverride.length
			? businessHoursOverride.map((o) => ({
					day: dayOfWeek,
					startTime: o.startTime ?? "00:00",
					endTime: o.endTime ?? "23:59",
				}))
			: (dayBusinessHours ?? []);

	return [selectedBusinessHours, zonedDate];
}

// ── Public API ──────────────────────────────────────────────────────────────

export function generateSchedule({
	currentDate = new Date(),
	prepTimeBehaviour = PrepTimeBehaviour.ROLL_FROM_FIRST_SHIFT,
	weekDayPrepTimes = {},
	timeZone,
	dates = [],
	businessHours = [],
	businessHoursOverrides = [],
	preSaleHoursOverride,
	gapInMinutes = 15,
	prepTimeCadence = null,
}: GenerateScheduleParams): DaySchedule[] {
	const isMinutesCadence = prepTimeCadence === PREP_TIME_CADENCE.MINUTE;
	let shiftStartDateWithPrepTime: Date | null = null;
	return dates
		.map((date, index) => {
			const lastDate = dates?.[index - 1];

			const [selectedBusinessHours, zonedDate] = getSelectedBusinessHours({
				businessHours,
				businessHoursOverrides,
				date,
				timeZone,
				preSaleHoursOverride,
			});

			const [prevSelectedBusinessHours] = getSelectedBusinessHours({
				businessHours,
				businessHoursOverrides,
				date: lastDate,
				timeZone,
				preSaleHoursOverride,
			});

			const weekDayPrepTime =
				weekDayPrepTimes[zonedDate.dayOfWeek] ?? DEFAULT_PREP_TIME_IN_MINUTES;

			const storeTimes = {
				openingTime: null as Date | null,
				closingTime: null as Date | null,
				remainingShifts: 0,
				totalShifts: 0,
			};

			let isPrevDayMidnightTransition = false;

			const slots = selectedBusinessHours
				.flatMap((businessHour, i) => {
					const startDate = setHmOnDate(date, businessHour.startTime, timeZone);
					const shiftStartDate =
						isMinutesCadence && shiftStartDateWithPrepTime
							? max([shiftStartDateWithPrepTime, startDate])
							: startDate;
					const shiftEndDate = setHmOnDate(
						date,
						businessHour.endTime,
						timeZone,
					);

					if (i === 0) {
						storeTimes.openingTime = shiftStartDate;
					}

					if (i === selectedBusinessHours.length - 1) {
						storeTimes.closingTime = shiftEndDate;
					}

					if (!isBefore(shiftStartDate, shiftEndDate)) {
						if (isMinutesCadence) {
							shiftStartDateWithPrepTime = null;
						}
						return [];
					}

					storeTimes.totalShifts += 1;

					const fixedSlots = eachMinuteOfInterval(
						{ start: shiftStartDate, end: shiftEndDate },
						{ step: gapInMinutes },
					);

					if (isTodayInTimeZone(date, timeZone)) {
						const openingTime = storeTimes.openingTime ?? new Date(0);
						const baseDate =
							currentDate instanceof Date ? currentDate : new Date(currentDate);
						const currentDateWithPrepTime = addMinutes(
							new Date(Math.max(baseDate.getTime(), openingTime.getTime())),
							Math.max(DEFAULT_PREP_TIME_IN_MINUTES, weekDayPrepTime),
						);

						if (isAfter(currentDateWithPrepTime, shiftEndDate)) {
							// If the prep time cadence is minutes, we need to set the shift start date with the prep time
							if (isMinutesCadence) {
								shiftStartDateWithPrepTime = currentDateWithPrepTime;
							}
							return [];
						}

						if (isBefore(currentDateWithPrepTime, shiftStartDate)) {
							storeTimes.remainingShifts += 1;

							if (
								(prepTimeBehaviour as PrepTimeBehaviourType) ===
								PrepTimeBehaviour.EVERY_SHIFT
							) {
								const shiftStartDateWithPrepTime = addMinutes(
									shiftStartDate,
									weekDayPrepTime,
								);

								const slotDates = fixedSlots.filter((d) =>
									isAfter(d, shiftStartDateWithPrepTime),
								);

								slotDates.unshift(shiftStartDateWithPrepTime);
								return slotDates;
							}

							return fixedSlots;
						}

						const slotDates = fixedSlots.filter((d) =>
							isAfter(d, currentDateWithPrepTime),
						);

						slotDates.unshift(currentDateWithPrepTime);
						storeTimes.remainingShifts += 1;
						return slotDates;
					}

					if (prepTimeBehaviour === PrepTimeBehaviour.FIRST_SHIFT && i !== 0) {
						storeTimes.remainingShifts += 1;
						return fixedSlots;
					}

					const allowZeroPrepTimeForMidnightShift =
						isZeroPrepTimeForMidnightShift({
							prevDayBusinessHours: prevSelectedBusinessHours,
							businessHour,
						});

					const prepTimeSlot = addMinutes(
						prepTimeBehaviour === PrepTimeBehaviour.ROLL_FROM_FIRST_SHIFT &&
							!isPrevDayMidnightTransition &&
							storeTimes.openingTime
							? storeTimes.openingTime
							: shiftStartDate,
						allowZeroPrepTimeForMidnightShift ? 0 : weekDayPrepTime,
					);

					isPrevDayMidnightTransition = allowZeroPrepTimeForMidnightShift;

					if (prepTimeSlot > shiftEndDate) {
						if (isMinutesCadence) {
							shiftStartDateWithPrepTime = prepTimeSlot;
						}
						shiftStartDateWithPrepTime = prepTimeSlot;
						return [];
					}

					if (prepTimeSlot < shiftStartDate) {
						storeTimes.remainingShifts += 1;
						return fixedSlots;
					}

					const slotDates = fixedSlots.filter((d) => isAfter(d, prepTimeSlot));

					slotDates.unshift(prepTimeSlot);
					storeTimes.remainingShifts += 1;
					shiftStartDateWithPrepTime = null; //reset the shift start date with prep time
					return slotDates;
				})
				.sort(compareAsc);

			const currentDateMs =
				currentDate instanceof Date ? currentDate.getTime() : currentDate;
			const availableSlots = slots.filter((d) => d.getTime() >= currentDateMs);

			return {
				date,
				originalStoreOpeningTime: storeTimes.openingTime,
				originalStoreClosingTime: storeTimes.closingTime,
				remainingShifts: storeTimes.remainingShifts,
				openingTime: slots[0],
				closingTime: slots[slots.length - 1],
				firstAvailableSlot: availableSlots[0],
				slots: availableSlots,
			};
		})
		.filter((a) => a.slots.length);
}
