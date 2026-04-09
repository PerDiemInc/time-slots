import {
	addMinutes,
	compareAsc,
	eachMinuteOfInterval,
	isAfter,
	isBefore,
	max,
} from "date-fns";
import { findTimeZone, getZonedTime } from "timezone-support";
import { MINUTES_PER_DAY, PREP_TIME_CADENCE } from "../constants";
import type {
	BusinessHour,
	BusinessHoursOverrideOutput,
	DaySchedule,
	GenerateScheduleParams,
} from "../types";
import {
	isTodayInTimeZone,
	isZeroPrepTimeForMidnightShift,
	lastShiftEndsAtMidnight,
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
}: GetSelectedBusinessHoursParams): BusinessHour[] {
	if (!date || !timeZone) {
		return [];
	}

	const zonedDate = getZonedTime(date, findTimeZone(timeZone));
	const dayOfWeek = zonedDate.dayOfWeek ?? 0;

	const dayBusinessHours = businessHours?.filter((bh) => bh.day === dayOfWeek);

	const businessHoursOverride = businessHoursOverrides?.filter(
		(override) =>
			zonedDate.month === override.month && zonedDate.day === override.day,
	);

	return preSaleHoursOverride
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
}

/**
 * Project the time-of-day from `source` onto `targetDate` in the given timezone.
 * e.g. source = Sat 2:30 PM, targetDate = Mon → Mon 2:30 PM (in timezone).
 */
function projectTimeOfDay(
	source: Date,
	targetDate: Date,
	timeZone: string,
): Date {
	const tz = findTimeZone(timeZone);
	const zonedSource = getZonedTime(source, tz);
	const hh = String(zonedSource.hours).padStart(2, "0");
	const mm = String(zonedSource.minutes).padStart(2, "0");
	return setHmOnDate(targetDate, `${hh}:${mm}`, timeZone);
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

	const minuteCadenceDaysSkipped = isMinutesCadence
		? Math.floor(prepTimeFrequency / MINUTES_PER_DAY)
		: 0;
	const effectivePrepMinutes =
		minuteCadenceDaysSkipped > 0
			? prepTimeFrequency % MINUTES_PER_DAY
			: prepTimeFrequency;
	let shiftStartDateWithPrepTime: Date | null = null;

	return dates
		.map((date, index) => {
			const lastDate = dates?.[index - 1];

			const selectedBusinessHours = getSelectedBusinessHours({
				businessHours,
				businessHoursOverrides,
				date,
				timeZone,
				preSaleHoursOverride,
			});

			const prevSelectedBusinessHours = getSelectedBusinessHours({
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
			const isTodayEndingInMidnightSpill = lastShiftEndsAtMidnight(
				selectedBusinessHours,
			);

			// For DAY cadence: the first date in dates IS the target date (after slicing in location.ts)
			const isDayCadenceFirstDate = isDayCadence && index === 0;
			// For MINUTE cadence with ≥1 day of prep: days were skipped via dates.slice()
			// in location.ts, so the first date here is the target day.
			const isMinuteCadenceFirstDate =
				isMinutesCadence && minuteCadenceDaysSkipped > 0 && index === 0;

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
					const isMidnightShiftContinuation =
						isFirstShift &&
						isZeroPrepTimeForMidnightShift({
							prevDayBusinessHours: prevSelectedBusinessHours,
							businessHour,
						});

					// Determine if closing buffer should be applied:
					// - Apply to last shift normally
					// - BUT if this day ends in midnight spill, don't apply yet (wait for tomorrow's last shift)
					// - Always apply to midnight continuation shifts (they are the real
					//   end of the previous day's shift that spilled past midnight)
					const shouldApplyClosingBuffer =
						isMidnightShiftContinuation ||
						(isLastShift && !isTodayEndingInMidnightSpill);

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

					if (isAfter(effectiveShiftStart, shiftEndDate)) {
						// Shift fully skipped — keep shiftStartDateWithPrepTime so it
						// can carry forward to the next shift or day.
						return [];
					}

					storeTimes.totalShifts += 1;

					const fixedSlots = eachMinuteOfInterval(
						{ start: shiftStartDate, end: shiftEndDate },
						{ step: gapInMinutes },
					);

					// ── Today / first-date logic ────────────────────────────────────
					const isActualToday = isTodayInTimeZone(date, timeZone);

					if (
						isActualToday ||
						isDayCadenceFirstDate ||
						isMinuteCadenceFirstDate
					) {
						let effectiveFirstSlot: Date;

						if (isFirstShift) {
							const openingTime = startDate;

							if (isDayCadenceFirstDate) {
								// DAY cadence: first slot = opening + buffer
								effectiveFirstSlot = addMinutes(openingTime, openingBuffer);
							} else if (isMinuteCadenceFirstDate) {
								// MINUTE cadence with day skipping: project now's time-of-day
								// onto the target date, then add any remaining prep minutes.
								const projectedNow = projectTimeOfDay(
									currentDate,
									date,
									timeZone,
								);
								const projectedWithPrep = addMinutes(
									projectedNow,
									effectivePrepMinutes,
								);
								const openingPlusBuffer = addMinutes(
									openingTime,
									openingBuffer,
								);
								effectiveFirstSlot = max([
									projectedWithPrep,
									openingPlusBuffer,
								]);
							} else {
								// Actual today with MINUTE cadence
								if (isBefore(currentDate, openingTime)) {
									effectiveFirstSlot = addMinutes(
										openingTime,
										Math.max(openingBuffer, prepTimeFrequency),
									);
								} else {
									const nowPlusPrep = addMinutes(
										currentDate,
										prepTimeFrequency,
									);
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

					// Opening buffer applies to the first "real" shift of the day — i.e. the
					// first shift that is NOT a midnight-spill continuation.  When a
					// continuation is present it is always i === 0, so the real first shift
					// is i === 1 (the second element).
					const hasMidnightContinuation =
						selectedBusinessHours.length > 1 &&
						isZeroPrepTimeForMidnightShift({
							prevDayBusinessHours: prevSelectedBusinessHours,
							businessHour: selectedBusinessHours[0],
						});
					const isRealFirstShift = hasMidnightContinuation
						? i === 1
						: isFirstShift;
					const effectiveOpeningBuffer =
						isRealFirstShift ? openingBuffer : 0;
					// Roll from the opening time for the real first shift; other shifts from their own start
					const rollFromDate =
						isRealFirstShift && storeTimes.openingTime
							? (hasMidnightContinuation ? startDate : storeTimes.openingTime)
							: startDate;

					const prepTimeSlot = addMinutes(
						rollFromDate,
						effectiveOpeningBuffer + estimatedDeliveryMinutes,
					);

					// Use the later of prepTimeSlot and effectiveShiftStart, so that
					// prep-time rollover from a prior day is respected.
					const effectiveFirstSlot = max([prepTimeSlot, effectiveShiftStart]);

					if (isAfter(effectiveFirstSlot, shiftEndDate)) {
						shiftStartDateWithPrepTime = effectiveFirstSlot;
						return [];
					}

					if (isBefore(effectiveFirstSlot, startDate)) {
						storeTimes.remainingShifts += 1;
						return fixedSlots;
					}

					const slotDates = fixedSlots.filter((d) =>
						isAfter(d, effectiveFirstSlot),
					);
					slotDates.unshift(effectiveFirstSlot);
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
