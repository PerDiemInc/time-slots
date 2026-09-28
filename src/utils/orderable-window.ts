import { addMinutes } from "date-fns";

import type {
	GetNextOrderableWindowParams,
	OpeningClosingTime,
	OrderableWindow,
} from "../types";
import { getLocationBusinessHoursForFulfillment } from "./business-hours";
import {
	getApplicableBusyTimes,
	getFirstUnblockedTime,
	mergeBusyRanges,
} from "./busy-times";
import { getOpeningClosingTimeOnDate } from "./store-hours";

// Windows to walk before giving up. Two weeks of shifts is far past anything a
// status label should claim.
const MAX_WINDOW_LOOKUPS = 14;

/**
 * The next window a customer can actually order in: business hours with the
 * opening/closing buffers applied, skipping any window that busy times cover end
 * to end. Returns null when the location has no hours, or when nothing is
 * orderable within the lookahead.
 *
 * This is what a location list labels itself from, so it answers the same
 * question the generated schedule does without paying to build one.
 */
export function getNextOrderableWindow({
	location,
	fulfillmentPreference,
	businessHoursOverrides,
	isCatering = false,
	busyTimes = [],
	cartCategoryIds = [],
	openingBuffer = 0,
	closingBuffer = 0,
	now = Date.now(),
}: GetNextOrderableWindowParams): OrderableWindow | null {
	if (!location) {
		return null;
	}

	// Buffers cross app/API boundaries as JSON; a string or NaN would poison every
	// date derived from them.
	const openingBufferMinutes = Number(openingBuffer) || 0;
	const closingBufferMinutes = Number(closingBuffer) || 0;
	const from = Number.isFinite(now) ? now : Date.now();

	const businessHours = getLocationBusinessHoursForFulfillment(
		location,
		fulfillmentPreference,
		isCatering,
	);
	const overrides = businessHoursOverrides?.[location.location_id] ?? [];
	const busyRanges = mergeBusyRanges(
		getApplicableBusyTimes({ busyTimes, cartCategoryIds }),
	);

	// The shift covering or following `date`, and the last order time in it: the
	// day's last shift stops short of closing by the closing buffer.
	const getShift = (date: Date) =>
		getOpeningClosingTimeOnDate({
			date,
			businessHours,
			businessHoursOverrides: overrides,
			timeZone: location.timezone,
		});
	const getBufferedClosingTime = (shift: OpeningClosingTime) =>
		shift.isLastShift
			? addMinutes(shift.closingTime, -closingBufferMinutes)
			: shift.closingTime;
	const afterClose = (shift: OpeningClosingTime) =>
		new Date(shift.closingTime.getTime() + 1);

	let date = new Date(from);

	for (let lookup = 0; lookup < MAX_WINDOW_LOOKUPS; lookup += 1) {
		const times = getShift(date);

		if (!times?.openingTime || !times?.closingTime) {
			return null;
		}

		const openingTime = times.isFirstShift
			? addMinutes(times.openingTime, openingBufferMinutes)
			: times.openingTime;
		const closingTime = getBufferedClosingTime(times);

		// Where ordering could start in this window, and where busy windows let it
		// actually start. They differ when a block covers the front of the window.
		const windowStart = Math.max(from, openingTime.getTime());
		const orderableFrom = getFirstUnblockedTime({
			from: windowStart,
			busyRanges,
		});

		if (orderableFrom < closingTime.getTime()) {
			// Split hours (11–3, 5–10) come back one shift at a time, so walk the
			// day's later shifts for when ordering actually ends: past the break,
			// but not into a shift busy times cover end to end. Runs once, after the
			// window is found, and only over the shifts left in the day.
			let dayClosingTime = closingTime;
			let shift = times;
			for (
				let shiftLookup = 0;
				shiftLookup < MAX_WINDOW_LOOKUPS && !shift.isLastShift;
				shiftLookup += 1
			) {
				const next = getShift(afterClose(shift));
				// Another day's first shift means this day's shifts ran out, which
				// only overlapping hours can cause.
				if (!next || next.isFirstShift) break;
				shift = next;

				const shiftClosingTime = getBufferedClosingTime(shift);
				const shiftOrderableFrom = getFirstUnblockedTime({
					from: shift.openingTime.getTime(),
					busyRanges,
				});
				if (shiftOrderableFrom < shiftClosingTime.getTime()) {
					dayClosingTime = shiftClosingTime;
				}
			}

			return {
				...times,
				openingTime:
					orderableFrom > windowStart ? new Date(orderableFrom) : openingTime,
				closingTime,
				dayClosingTime,
			};
		}

		// Nothing left in this window — resume the search after it closes.
		date = afterClose(times);
	}

	return null;
}
