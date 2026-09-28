import { addMinutes, compareAsc, isBefore } from "date-fns";
import { findTimeZone, getZonedTime } from "timezone-support";

import { getNextAvailableDates } from "../schedule/available-dates";
import type {
	BusinessHour,
	BusinessHoursOverrideOutput,
	GetOpeningClosingTimeOnDateParams,
	GetOpeningClosingTimeParams,
	OpeningClosingTime,
} from "../types";
import { getLocationBusinessHoursForFulfillment } from "./business-hours";
import {
	isMidnightTransition,
	isSameDateInTimeZone,
	setHmOnDate,
} from "./date";

// ── Private helpers ─────────────────────────────────────────────────────────

interface GetAvailableBusinessHoursParams {
	businessHours?: BusinessHour[];
	businessHoursOverrides?: BusinessHoursOverrideOutput[];
	timeZone: string;
	nextAvailableDate: Date;
}

function getAvailableBusinessHours({
	businessHours = [],
	businessHoursOverrides = [],
	timeZone,
	nextAvailableDate,
}: GetAvailableBusinessHoursParams): {
	dayBusinessTimes: Array<{ startDate: Date; endDate: Date }>;
	businessHoursOverride: BusinessHoursOverrideOutput | undefined;
} {
	const zonedDate = getZonedTime(nextAvailableDate, findTimeZone(timeZone));

	const dayBusinessHours = businessHours.filter(
		(bh) =>
			bh.day ===
			getZonedTime(nextAvailableDate, findTimeZone(timeZone)).dayOfWeek,
	);

	const businessHoursOverride = businessHoursOverrides.find(
		(override) =>
			override.day === zonedDate.day && override.month === zonedDate.month,
	);

	if (
		businessHoursOverride &&
		!businessHoursOverride.startTime &&
		!businessHoursOverride.endTime
	) {
		return { dayBusinessTimes: [], businessHoursOverride };
	}

	// An override replaces the day's shifts with one window, however many shifts
	// the day normally has, as the schedule reads it. One copy per shift would
	// leave the first copy looking like it isn't the day's last.
	const effectiveHours =
		businessHoursOverride && dayBusinessHours.length
			? [
					{
						startTime: businessHoursOverride.startTime ?? "00:00",
						endTime: businessHoursOverride.endTime ?? "23:59",
					},
				]
			: dayBusinessHours;

	const dayBusinessTimes = effectiveHours
		.map((effectiveHour) => {
			const startDate = setHmOnDate(
				nextAvailableDate,
				effectiveHour.startTime,
				timeZone,
			);

			const endDate = setHmOnDate(
				nextAvailableDate,
				effectiveHour.endTime,
				timeZone,
			);

			if (!isBefore(startDate, endDate)) {
				return null;
			}

			return { startDate, endDate };
		})
		.filter((time): time is { startDate: Date; endDate: Date } => time !== null)
		.sort((a, b) => compareAsc(a.startDate, b.startDate));

	return { dayBusinessTimes, businessHoursOverride };
}

// ── Public API ──────────────────────────────────────────────────────────────

export function getOpeningClosingTimeOnDate({
	date = new Date(),
	businessHours = [],
	businessHoursOverrides = [],
	timeZone,
}: GetOpeningClosingTimeOnDateParams): OpeningClosingTime | null {
	try {
		const nextAvailableDates = getNextAvailableDates({
			startDate: date,
			businessHours,
			businessHoursOverrides,
			timeZone,
			datesCount: 7,
		});

		if (!Array.isArray(nextAvailableDates) || !nextAvailableDates.length) {
			return null;
		}

		for (
			let nextDateIndex = 0;
			nextDateIndex < nextAvailableDates.length;
			++nextDateIndex
		) {
			const nextAvailableDate = nextAvailableDates[nextDateIndex];

			const { dayBusinessTimes, businessHoursOverride } =
				getAvailableBusinessHours({
					businessHours,
					businessHoursOverrides,
					timeZone,
					nextAvailableDate,
				});

			if (!Array.isArray(dayBusinessTimes) || dayBusinessTimes.length === 0) {
				if (
					businessHoursOverride?.startTime &&
					businessHoursOverride?.endTime
				) {
					const openingTime = setHmOnDate(
						nextAvailableDate,
						businessHoursOverride.startTime,
						timeZone,
					);
					const closingTime = setHmOnDate(
						nextAvailableDate,
						businessHoursOverride.endTime,
						timeZone,
					);

					if (isBefore(closingTime, date)) {
						continue;
					}

					// an override collapses the day to a single window
					return {
						openingTime,
						closingTime,
						isFirstShift: true,
						isLastShift: true,
					};
				}

				continue;
			}

			const currentTime = date;
			let currentSlot: { startDate: Date; endDate: Date } | null = null;

			for (const slot of dayBusinessTimes) {
				if (isBefore(currentTime, slot.endDate)) {
					currentSlot = slot;
					break;
				}
			}

			if (!currentSlot) {
				currentSlot = dayBusinessTimes[0];
			}

			if (isBefore(currentSlot.endDate, date)) {
				continue;
			}

			// A 00:00 shift after a day that ran to midnight is the tail of that night,
			// not the start of this day, the same call the schedule makes: it closes the
			// night, and the day's own shifts start after it.
			const { dayBusinessTimes: prevDayTimes } = getAvailableBusinessHours({
				businessHours,
				businessHoursOverrides,
				timeZone,
				nextAvailableDate: addMinutes(dayBusinessTimes[0].startDate, -1),
			});
			const prevDayLastSlot = prevDayTimes[prevDayTimes.length - 1];
			const continuesLastNight =
				dayBusinessTimes.length > 1 &&
				!!prevDayLastSlot &&
				isMidnightTransition(
					prevDayLastSlot.endDate,
					dayBusinessTimes[0].startDate,
					timeZone,
				);
			const dayShifts = continuesLastNight
				? dayBusinessTimes.slice(1)
				: dayBusinessTimes;

			// read before the midnight-transition branch below replaces the slot
			const isFirstShift = currentSlot === dayShifts[0];
			const isLastShift =
				currentSlot === dayShifts[dayShifts.length - 1] ||
				(continuesLastNight && currentSlot === dayBusinessTimes[0]);

			// Open till 23:59 and back at 00:00 means the store never really closed,
			// so the two shifts merge into one window.
			if (
				isSameDateInTimeZone(nextAvailableDate, date, timeZone) &&
				nextDateIndex + 1 < nextAvailableDates.length
			) {
				const { dayBusinessTimes: nextDayTimes } = getAvailableBusinessHours({
					businessHours,
					businessHoursOverrides,
					timeZone,
					nextAvailableDate: nextAvailableDates[nextDateIndex + 1],
				});
				if (nextDayTimes.length) {
					const firstNextDaySlot = nextDayTimes?.[0];
					if (
						firstNextDaySlot &&
						isMidnightTransition(
							currentSlot.endDate,
							firstNextDaySlot.startDate,
							timeZone,
						)
					) {
						currentSlot = {
							...currentSlot,
							endDate: firstNextDaySlot.endDate,
						};
					}
				}
			}

			return {
				openingTime: currentSlot.startDate,
				closingTime: currentSlot.endDate,
				isFirstShift,
				isLastShift,
			};
		}

		return null;
	} catch {
		return null;
	}
}

export function getOpeningClosingTime({
	location,
	fulfillmentPreference,
	businessHoursOverrides,
	isCatering = false,
}: GetOpeningClosingTimeParams): OpeningClosingTime | null {
	const businessHours = getLocationBusinessHoursForFulfillment(
		location,
		fulfillmentPreference,
		isCatering,
	);

	return getOpeningClosingTimeOnDate({
		businessHours,
		businessHoursOverrides:
			businessHoursOverrides?.[location.location_id] ?? [],
		timeZone: location.timezone,
	});
}
