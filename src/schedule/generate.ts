import {
	addMinutes,
	compareAsc,
	differenceInMinutes,
	eachMinuteOfInterval,
	isAfter,
	isBefore,
	max,
} from "date-fns";
import { findTimeZone, getZonedTime } from "timezone-support";
import { PREP_TIME_CADENCE } from "../constants";
import type {
	BusinessHour,
	BusinessHoursOverrideOutput,
	DaySchedule,
	GenerateScheduleParams,
} from "../types";
import {
	isSameDateInTimeZone,
	isTodayInTimeZone,
	isZeroPrepTimeForMidnightShift,
	setHmOnDate,
} from "../utils/date";

// ── Private helpers ─────────────────────────────────────────────────────────

function calculateRemainingMinutesAfterRollover(
	now: Date,
	prepTimeMinutes: number,
	businessHours: BusinessHour[],
	timeZone: string,
): { targetDate: Date; remainingMinutes: number; shouldRollover: boolean } {
	const targetTime = addMinutes(now, prepTimeMinutes);

	const zonedNow = getZonedTime(now, findTimeZone(timeZone));
	const zonedTarget = getZonedTime(targetTime, findTimeZone(timeZone));
	const isDifferentDay =
		zonedNow.day !== zonedTarget.day || zonedNow.month !== zonedTarget.month;

	if (!isDifferentDay) {
		return {
			targetDate: targetTime,
			remainingMinutes: 0,
			shouldRollover: false,
		};
	}

	const targetDayOfWeek = zonedTarget.dayOfWeek ?? 0;
	const targetDayBusinessHours = businessHours.filter(
		(bh) => bh.day === targetDayOfWeek,
	);

	if (targetDayBusinessHours.length === 0) {
		return {
			targetDate: targetTime,
			remainingMinutes: 0,
			shouldRollover: true,
		};
	}

	const firstShift = targetDayBusinessHours[0];
	const openingTime = setHmOnDate(targetTime, firstShift.startTime, timeZone);

	let remainingMinutes = 0;
	if (isAfter(targetTime, openingTime)) {
		remainingMinutes = differenceInMinutes(targetTime, openingTime);
	}

	return {
		targetDate: targetTime,
		remainingMinutes,
		shouldRollover: true,
	};
}

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
	timeZone,
	dates = [],
	businessHours = [],
	businessHoursOverrides = [],
	preSaleHoursOverride,
	gapInMinutes = 15,
	prepTimeCadence = null,
	prepTimeFrequency = 0,
	openingBuffer = 0,
	closingBuffer = 0,
	estimatedDeliveryMinutes = 0,
}: GenerateScheduleParams): DaySchedule[] {
	const isMinutesCadence = prepTimeCadence !== PREP_TIME_CADENCE.DAY;
	const isDayCadence = prepTimeCadence === PREP_TIME_CADENCE.DAY;
	let shiftStartDateWithPrepTime: Date | null = null;

	// Prep time only applies to today (minute cadence) or via day-skipping (day cadence).
	// Future days always start at opening + buffers with no prep offset.
	const zonedCurrent = getZonedTime(currentDate, findTimeZone(timeZone));
	const todayDayOfWeek = zonedCurrent.dayOfWeek ?? 0;
	const todayPrepTime = isMinutesCadence ? prepTimeFrequency : 0;

	// Check if today has business hours - if not, don't apply prep time rollover
	const todayBusinessHours = businessHours.filter(
		(bh) => bh.day === todayDayOfWeek,
	);
	const hasBusinessHoursToday = todayBusinessHours.length > 0;

	// For DAY cadence: dates are already filtered in generateLocationFulfillmentSchedule
	// which does: dates.slice(prepTimeFrequency)
	// So we don't need to filter here for DAY cadence.
	// For MINUTE cadence: Check if prep time exceeds today's closing and filter dates accordingly
	let effectiveDates = dates;
	let minuteRolloverInfo: {
		targetDate: Date;
		remainingMinutes: number;
		shouldRollover: boolean;
	} | null = null;

	if (isMinutesCadence && todayPrepTime > 0 && hasBusinessHoursToday) {
		const rolloverResult = calculateRemainingMinutesAfterRollover(
			currentDate,
			todayPrepTime,
			businessHours,
			timeZone,
		);
		minuteRolloverInfo = rolloverResult;
		// If rollover is needed, filter dates to only include from target date onwards
		if (rolloverResult.shouldRollover) {
			const targetDate = rolloverResult.targetDate;
			effectiveDates = effectiveDates.filter((date) => {
				return (
					date >= targetDate || isSameDateInTimeZone(date, targetDate, timeZone)
				);
			});
		}
	}

	return effectiveDates
		.map((date, index) => {
			const lastDate = effectiveDates?.[index - 1];

			const [selectedBusinessHours] = getSelectedBusinessHours({
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

			const storeTimes = {
				openingTime: null as Date | null,
				closingTime: null as Date | null,
				remainingShifts: 0,
				totalShifts: 0,
			};

			// Track midnight spill: if today's last shift ends at 24:00, we need to
			// apply closing buffer to tomorrow's last shift instead
			let isTodayEndingInMidnightSpill = false;
			if (selectedBusinessHours.length > 0) {
				const lastShift =
					selectedBusinessHours[selectedBusinessHours.length - 1];
				isTodayEndingInMidnightSpill =
					lastShift.endTime === "24:00" || lastShift.endTime === "23:59";
			}

			// Track if previous day ended in midnight spill (so today's closing buffer should be applied)
			let prevDayEndedInMidnightSpill = false;
			if (lastDate) {
				const [prevHours] = getSelectedBusinessHours({
					businessHours,
					businessHoursOverrides,
					date: lastDate,
					timeZone,
					preSaleHoursOverride,
				});
				if (prevHours.length > 0) {
					const prevLastShift = prevHours[prevHours.length - 1];
					prevDayEndedInMidnightSpill =
						prevLastShift.endTime === "24:00" ||
						prevLastShift.endTime === "23:59";
				}
			}

			// For DAY cadence: the first date in effectiveDates IS the target date (after slicing in location.ts)
			// For MINUTE cadence: check if this is the rollover target date
			const isDayCadenceFirstDate = isDayCadence && index === 0;

			const slots = selectedBusinessHours
				.flatMap((businessHour, i) => {
					const isFirstShift = i === 0;
					const isLastShift = i === selectedBusinessHours.length - 1;

					const startDate = setHmOnDate(date, businessHour.startTime, timeZone);
					// The effective start accounts for prep-time rollover from a prior
					// shift, but the slot grid must always be anchored to the raw
					// business-hour start so that the 15-min cadence stays on
					// :00 / :15 / :30 / :45.
					const effectiveShiftStart =
						isMinutesCadence && shiftStartDateWithPrepTime
							? max([shiftStartDateWithPrepTime, startDate])
							: startDate;
					const shiftStartDate = startDate;

					// Check if this is a midnight spill continuation from previous day
					// (first shift starts at 00:00 AND previous day ended at 24:00)
					const isMidnightSpillContinuation =
						isFirstShift &&
						businessHour.startTime === "00:00" &&
						prevDayEndedInMidnightSpill;

					// Determine if closing buffer should be applied:
					// - Apply to last shift normally
					// - BUT if this day ends in midnight spill, don't apply yet (wait for tomorrow's last shift)
					// - If this is a midnight spill continuation AND it's the last shift, apply closing buffer
					const shouldApplyClosingBuffer =
						isLastShift &&
						!isTodayEndingInMidnightSpill &&
						(!isMidnightSpillContinuation || !prevDayEndedInMidnightSpill);

					const rawEndDate = setHmOnDate(date, businessHour.endTime, timeZone);
					const shiftEndDate = shouldApplyClosingBuffer
						? addMinutes(rawEndDate, -closingBuffer)
						: rawEndDate;

					if (isFirstShift) {
						// Store the raw opening time (pre-buffer) for reference in today logic
						storeTimes.openingTime = startDate;
					}

					if (isLastShift) {
						storeTimes.closingTime = shiftEndDate;
					}

					if (!isBefore(effectiveShiftStart, shiftEndDate)) {
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

					// ── Today logic ──────────────────────────────────────────────────
					// Check if this is the "effective today" - either actual today,
					// or the target date for DAY cadence, or a rolled-over date for MINUTE cadence
					const isActualToday = isTodayInTimeZone(date, timeZone);
					// For DAY cadence: the first date in effectiveDates IS the target date
					// For MINUTE cadence: check if this is the rollover target date
					const isRolloverDate =
						isMinutesCadence &&
						minuteRolloverInfo &&
						!isSameDateInTimeZone(
							currentDate,
							minuteRolloverInfo.targetDate,
							timeZone,
						) &&
						isSameDateInTimeZone(date, minuteRolloverInfo.targetDate, timeZone);

					if (isActualToday || isDayCadenceFirstDate || isRolloverDate) {
						const openingTime = storeTimes.openingTime ?? new Date(0);
						const baseDate =
							currentDate instanceof Date ? currentDate : new Date(currentDate);

						let effectiveFirstSlot: Date;

						if (isFirstShift) {
							if (isDayCadenceFirstDate) {
								// DAY cadence: first slot = opening + buffer (no prep time on future days)
								effectiveFirstSlot = addMinutes(openingTime, openingBuffer);
							} else if (isRolloverDate && minuteRolloverInfo) {
								// MINUTE cadence rollover: use the rolled-over target time as "now"
								const targetTime = minuteRolloverInfo.targetDate;
								const remainingMinutes = minuteRolloverInfo.remainingMinutes;

								if (isBefore(targetTime, openingTime)) {
									// Target time is before opening: first slot = opening + max(buffer, remainingMinutes)
									effectiveFirstSlot = addMinutes(
										openingTime,
										Math.max(openingBuffer, remainingMinutes),
									);
								} else {
									// Target time is at or after opening: first slot = max(targetTime, opening + buffer)
									const openingPlusBuffer = addMinutes(
										openingTime,
										openingBuffer,
									);
									effectiveFirstSlot = max([targetTime, openingPlusBuffer]);
								}
							} else {
								// Actual today with MINUTE cadence
								// Prep time only applies to today (from prepTimeFrequency)
								const prepTimeMinutes = isMinutesCadence ? todayPrepTime : 0;

								if (isBefore(baseDate, openingTime)) {
									// Now is before opening: first slot = opening + max(buffer, prepTime)
									effectiveFirstSlot = addMinutes(
										openingTime,
										Math.max(openingBuffer, prepTimeMinutes),
									);
								} else {
									// Now is at or after opening: first slot = max(now + prepTime, opening + buffer)
									const nowPlusPrep = addMinutes(baseDate, prepTimeMinutes);
									const openingPlusBuffer = addMinutes(
										openingTime,
										openingBuffer,
									);
									effectiveFirstSlot = max([nowPlusPrep, openingPlusBuffer]);
								}
							}

							// Delivery always added on top
							effectiveFirstSlot = addMinutes(
								effectiveFirstSlot,
								estimatedDeliveryMinutes,
							);
						} else {
							// Non-first shifts: use the effective start (which accounts for
							// prep-time rollover) but keep the slot grid on the raw boundary.
							effectiveFirstSlot = effectiveShiftStart;
						}

						if (isAfter(effectiveFirstSlot, shiftEndDate)) {
							if (isMinutesCadence) {
								shiftStartDateWithPrepTime = effectiveFirstSlot;
							}
							return [];
						}

						if (isBefore(effectiveFirstSlot, effectiveShiftStart)) {
							storeTimes.remainingShifts += 1;
							return fixedSlots;
						}

						const slotDates = fixedSlots.filter((d) =>
							isAfter(d, effectiveFirstSlot),
						);
						slotDates.unshift(effectiveFirstSlot);
						storeTimes.remainingShifts += 1;
						if (isMinutesCadence) {
							shiftStartDateWithPrepTime = null;
						}
						return slotDates;
					}

					// ── Future day logic ─────────────────────────────────────────────
					const allowZeroPrepTimeForMidnightShift =
						isZeroPrepTimeForMidnightShift({
							prevDayBusinessHours: prevSelectedBusinessHours,
							businessHour,
						});

					// Opening buffer applies to the first shift only, and not to midnight-spill
					// continuations (those are an extension of the previous day's last shift)
					const effectiveOpeningBuffer =
						isFirstShift && !allowZeroPrepTimeForMidnightShift
							? openingBuffer
							: 0;
					// Roll from the opening time for first shift; subsequent shifts from their own start
					const rollFromDate =
						isFirstShift &&
						!allowZeroPrepTimeForMidnightShift &&
						storeTimes.openingTime
							? storeTimes.openingTime
							: startDate;

					const prepTimeSlot = addMinutes(
						rollFromDate,
						effectiveOpeningBuffer + estimatedDeliveryMinutes,
					);

					if (prepTimeSlot > shiftEndDate) {
						if (isMinutesCadence) {
							shiftStartDateWithPrepTime = prepTimeSlot;
						}
						shiftStartDateWithPrepTime = prepTimeSlot;
						return [];
					}

					if (prepTimeSlot < startDate) {
						storeTimes.remainingShifts += 1;
						return fixedSlots;
					}

					const slotDates = fixedSlots.filter((d) => isAfter(d, prepTimeSlot));
					slotDates.unshift(prepTimeSlot);
					storeTimes.remainingShifts += 1;
					shiftStartDateWithPrepTime = null;
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
