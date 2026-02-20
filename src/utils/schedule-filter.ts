import { findTimeZone, getZonedTime } from "timezone-support";

import type {
	BusyTimeItem,
	FilterBusyTimesFromScheduleParams,
	FulfillmentSchedule,
	MenuType,
} from "../types";
import { isTimeInRange } from "./time";

// ── Private helpers ─────────────────────────────────────────────────────────

function isSlotBusy(
	applicableBusyTimes: BusyTimeItem[],
	slotTimeValue: Date | number,
): boolean {
	const slotTime = new Date(slotTimeValue);

	if (Number.isNaN(slotTime.getTime())) {
		return false;
	}

	return applicableBusyTimes.some((busyTime) => {
		const busyStart = new Date(busyTime?.startTime);
		const busyEnd = new Date(busyTime?.endTime);

		if (Number.isNaN(busyStart.getTime()) || Number.isNaN(busyEnd.getTime())) {
			return false;
		}

		return slotTime > busyStart && slotTime <= busyEnd;
	});
}

// ── Public API ──────────────────────────────────────────────────────────────

export function filterBusyTimesFromSchedule({
	schedule = [],
	busyTimes = [],
	cartCategoryIds = [],
}: FilterBusyTimesFromScheduleParams): FulfillmentSchedule {
	if (!Array.isArray(schedule) || schedule.length === 0) {
		return [];
	}

	if (!Array.isArray(busyTimes) || busyTimes.length === 0) {
		return schedule;
	}

	const uniqueCartCategoryIds = Array.isArray(cartCategoryIds)
		? Array.from(new Set(cartCategoryIds.filter(Boolean)))
		: [];

	const applicableBusyTimes = busyTimes.filter((busyTime) => {
		const thresholdCategoryIds = busyTime?.threshold?.categoryIds || [];

		if (!thresholdCategoryIds.length) {
			return true;
		}

		if (!uniqueCartCategoryIds.length) {
			return false;
		}

		return uniqueCartCategoryIds.some((cartCategoryId) =>
			thresholdCategoryIds.includes(cartCategoryId),
		);
	});

	if (!applicableBusyTimes.length) {
		return schedule;
	}

	return schedule
		.map((daySchedule) => {
			const slots = Array.isArray(daySchedule?.slots) ? daySchedule.slots : [];
			const filteredSlots = slots.filter(
				(slot) => !isSlotBusy(applicableBusyTimes, slot),
			);

			return {
				...daySchedule,
				slots: filteredSlots,
				openingTime: filteredSlots[0],
				closingTime: filteredSlots[filteredSlots.length - 1],
				firstAvailableSlot: filteredSlots[0],
			};
		})
		.filter((daySchedule) => (daySchedule?.slots || []).length > 0);
}

export function filterMenusFromSchedule({
	schedule = [],
	menus = [],
	timeZone,
}: {
	schedule?: FulfillmentSchedule;
	menus?: MenuType[];
	timeZone: string;
}): FulfillmentSchedule {
	return schedule
		.map((daySchedule) => ({
			...daySchedule,
			slots: daySchedule.slots.filter((slot) => {
				const zonedSlot = getZonedTime(slot, findTimeZone(timeZone));
				const dayOfWeek = zonedSlot.dayOfWeek;

				if (!menus.length) {
					return true;
				}

				return menus.some((menu) => {
					const dayScheduleConfig = menu.times[String(dayOfWeek)];
					if (!dayScheduleConfig) {
						return false;
					}

					if (dayScheduleConfig.all_day) {
						return true;
					}
					// Only show slot if it falls within the configured time range
					// Check for null start_time or end_time
					if (!dayScheduleConfig.start_time || !dayScheduleConfig.end_time) {
						return false;
					}
					return isTimeInRange(
						{
							start_time: dayScheduleConfig.start_time,
							end_time: dayScheduleConfig.end_time,
						},
						{
							hours: Number(zonedSlot.hours),
							minutes: Number(zonedSlot.minutes),
						},
					);
				});
			}),
		}))
		.filter((daySchedule) => daySchedule.slots.length > 0);
}
