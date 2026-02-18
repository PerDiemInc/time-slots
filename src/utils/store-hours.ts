import { compareAsc, isBefore } from "date-fns";
import { findTimeZone, getZonedTime } from "timezone-support";

import { getNextAvailableDates } from "../schedule/available-dates";
import type {
	BusinessHour,
	BusinessHoursOverrideOutput,
	FulfillmentPreference,
	GetOpeningClosingTimeOnDateParams,
	LocationLike,
} from "../types";
import { getLocationBusinessHoursForFulfillment } from "./business-hours";
import { isMidnightTransition, isTodayInTimeZone, setHmOnDate } from "./date";

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

	const dayBusinessTimes = dayBusinessHours
		.map((businessHour) => {
			const effectiveHour = businessHoursOverride
				? {
						day: businessHour.day,
						startTime: businessHoursOverride.startTime ?? "00:00",
						endTime: businessHoursOverride.endTime ?? "23:59",
					}
				: businessHour;

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
}: GetOpeningClosingTimeOnDateParams): {
	openingTime: Date;
	closingTime: Date;
} | null {
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

					return { openingTime, closingTime };
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

			if (
				isTodayInTimeZone(nextAvailableDate, timeZone) &&
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
}: {
	location: LocationLike;
	fulfillmentPreference: FulfillmentPreference;
	businessHoursOverrides?: Record<string, BusinessHoursOverrideOutput[]>;
}): { openingTime: Date; closingTime: Date } | null {
	const businessHours = getLocationBusinessHoursForFulfillment(
		location,
		fulfillmentPreference,
	);

	return getOpeningClosingTimeOnDate({
		businessHours,
		businessHoursOverrides:
			businessHoursOverrides?.[location.location_id] ?? [],
		timeZone: location.timezone,
	});
}
