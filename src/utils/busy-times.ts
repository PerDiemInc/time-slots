import type { BusyTimeItem } from "../types";

/** A busy window as absolute epoch milliseconds, `[start, end]`. */
export type BusyRange = [number, number];

/**
 * The busy windows that apply to an order, given what is in the cart.
 *
 * A window scoped to categories only blocks orders containing those categories;
 * an unscoped window blocks everything.
 */
export function getApplicableBusyTimes({
	busyTimes = [],
	cartCategoryIds = [],
}: {
	busyTimes?: BusyTimeItem[];
	cartCategoryIds?: string[];
}): BusyTimeItem[] {
	if (!Array.isArray(busyTimes) || busyTimes.length === 0) {
		return [];
	}

	const uniqueCartCategoryIds = Array.isArray(cartCategoryIds)
		? Array.from(new Set(cartCategoryIds.filter(Boolean)))
		: [];

	return busyTimes.filter((busyTime) => {
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
}

/**
 * Busy windows as sorted, non-overlapping ranges, so a stretch of time can be
 * tested against them in one pass.
 */
export function mergeBusyRanges(busyTimes: BusyTimeItem[] = []): BusyRange[] {
	if (!Array.isArray(busyTimes)) {
		return [];
	}

	const ranges = busyTimes
		.map(
			(busyTime) =>
				[
					new Date(busyTime?.startTime).getTime(),
					new Date(busyTime?.endTime).getTime(),
				] as BusyRange,
		)
		.filter(
			([start, end]) =>
				Number.isFinite(start) && Number.isFinite(end) && end > start,
		)
		.sort((a, b) => a[0] - b[0]);

	const merged: BusyRange[] = [];
	for (const [start, end] of ranges) {
		const last = merged[merged.length - 1];
		if (last && start <= last[1]) {
			last[1] = Math.max(last[1], end);
		} else {
			merged.push([start, end]);
		}
	}
	return merged;
}

/**
 * The first instant at or after `from` that no busy window covers.
 *
 * Ranges arrive merged and sorted, so an instant inside a window jumps straight
 * to that window's end. Returns `from` unchanged when nothing covers it.
 */
export function getFirstUnblockedTime({
	from,
	busyRanges = [],
}: {
	from: number;
	busyRanges?: BusyRange[];
}): number {
	if (!Array.isArray(busyRanges)) {
		return from;
	}

	let at = from;
	for (const [start, end] of busyRanges) {
		if (end <= at) {
			continue;
		}
		if (start > at) {
			break;
		}
		at = end;
	}
	return at;
}
