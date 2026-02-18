import { FULFILLMENT_TYPES } from "../constants";
import type {
	BusinessHour,
	BusinessHoursOverrideInput,
	BusinessHoursOverrideOutput,
	FulfillmentPreference,
	LocationLike,
} from "../types";

export function toBusinessHoursOverride(
	businessHoursOverride: BusinessHoursOverrideInput,
): BusinessHoursOverrideOutput {
	const {
		month,
		day,
		start_time: startTime,
		end_time: endTime,
		is_open: isOpen,
	} = businessHoursOverride;

	return {
		month,
		day,
		startTime: isOpen ? startTime : null,
		endTime: isOpen ? endTime : null,
	};
}

export function getLocationsBusinessHoursOverrides(
	businessHoursOverrides: BusinessHoursOverrideInput[],
	locations: LocationLike[],
): Record<string, BusinessHoursOverrideOutput[]> {
	const result: Record<string, BusinessHoursOverrideOutput[]> = {};

	for (const override of businessHoursOverrides) {
		const { all_locations: allLocations, location_ids: locationIds } =
			override || {};

		if (allLocations === true) {
			for (const location of locations || []) {
				const id = location.location_id;
				result[id] ??= [];
				result[id].push(toBusinessHoursOverride(override));
			}
		} else {
			for (const id of locationIds || []) {
				const location = locations.find((loc) => loc.location_id === id);
				if (location) {
					result[id] ??= [];
					result[id].push(toBusinessHoursOverride(override));
				}
			}
		}
	}

	return result;
}

export function getLocationBusinessHoursForFulfillment(
	location: LocationLike,
	fulfillmentPreference: FulfillmentPreference,
): BusinessHour[] {
	const fulfillmentBusinessHours: Record<
		string,
		Array<{ day: number; start_time: string; end_time: string }> | undefined
	> = {
		[FULFILLMENT_TYPES.PICKUP]: location?.pickup_hours,
		[FULFILLMENT_TYPES.DELIVERY]: location?.delivery_hours,
		[FULFILLMENT_TYPES.CURBSIDE]: location?.curbside_hours?.use_pickup_hours
			? location?.pickup_hours
			: location?.curbside_hours?.times,
	};

	const businessHours = fulfillmentBusinessHours[fulfillmentPreference];

	return (
		businessHours?.map((bh) => ({
			day: bh.day,
			startTime: bh.start_time,
			endTime: bh.end_time,
		})) ?? []
	);
}
