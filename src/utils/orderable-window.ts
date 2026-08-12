import { addMinutes } from "date-fns";

import type {
	GetNextOrderableWindowParams,
	OpeningClosingTime,
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
}: GetNextOrderableWindowParams): OpeningClosingTime | null {
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

	let date = new Date(from);

	for (let lookup = 0; lookup < MAX_WINDOW_LOOKUPS; lookup += 1) {
		const times = getOpeningClosingTimeOnDate({
			date,
			businessHours,
			businessHoursOverrides: overrides,
			timeZone: location.timezone,
		});

		if (!times?.openingTime || !times?.closingTime) {
			return null;
		}

		const openingTime = times.isFirstShift
			? addMinutes(times.openingTime, openingBufferMinutes)
			: times.openingTime;
		const closingTime = times.isLastShift
			? addMinutes(times.closingTime, -closingBufferMinutes)
			: times.closingTime;

		// Where ordering could start in this window, and where busy windows let it
		// actually start. They differ when a block covers the front of the window.
		const windowStart = Math.max(from, openingTime.getTime());
		const orderableFrom = getFirstUnblockedTime({
			from: windowStart,
			busyRanges,
		});

		if (orderableFrom < closingTime.getTime()) {
			return {
				...times,
				openingTime:
					orderableFrom > windowStart ? new Date(orderableFrom) : openingTime,
				closingTime,
			};
		}

		// Nothing left in this window — resume the search after it closes.
		date = new Date(times.closingTime.getTime() + 1);
	}

	return null;
}
