import type { ScheduleTransform } from "../types";

export interface BusyWindow {
	start: Date | string;
	end: Date | string;
	categoryIds?: string[];
}

function isSlotInWindow(slot: Date, start: Date, end: Date): boolean {
	return slot > start && slot <= end;
}

/**
 * Removes slots that fall within any busy time window.
 * When a busy window has categoryIds, it only applies if any of the
 * provided cartCategoryIds overlap.
 */
export function filterBusyTimes(
	busyTimes: BusyWindow[],
	cartCategoryIds: string[] = [],
): ScheduleTransform {
	return (schedule) => {
		if (busyTimes.length === 0) return schedule;

		const uniqueCart = [...new Set(cartCategoryIds.filter(Boolean))];

		const applicable = busyTimes.filter((bt) => {
			const cats = bt.categoryIds ?? [];
			if (cats.length === 0) return true;
			if (uniqueCart.length === 0) return false;
			return uniqueCart.some((id) => cats.includes(id));
		});

		if (applicable.length === 0) return schedule;

		const parsed = applicable.map((bt) => ({
			start: new Date(bt.start),
			end: new Date(bt.end),
		}));

		return schedule
			.map((day) => ({
				...day,
				slots: day.slots.filter(
					(slot) => !parsed.some((w) => isSlotInWindow(slot, w.start, w.end)),
				),
			}))
			.filter((day) => day.slots.length > 0);
	};
}
