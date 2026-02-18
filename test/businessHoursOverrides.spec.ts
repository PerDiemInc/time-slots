import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { BusinessHoursOverrideInput, LocationLike } from "../src/types";
import { getLocationsBusinessHoursOverrides } from "../src/utils/business-hours";

describe("Business hours overrides", () => {
	const locations: LocationLike[] = [
		{ location_id: randomUUID(), timezone: "UTC" },
		{ location_id: randomUUID(), timezone: "UTC" },
	];

	describe("getLocationsBusinessHoursOverrides", () => {
		describe("When hours override is for all locations", () => {
			it("should override all locations hours", () => {
				const override: BusinessHoursOverrideInput = {
					start_time: "07:00",
					end_time: "17:00",
					day: 1,
					month: 3,
					is_open: true,
					all_locations: true,
				};

				const result = getLocationsBusinessHoursOverrides(
					[override],
					locations,
				);

				expect(Object.entries(result).length).toEqual(2);
			});
		});

		describe("When hours override is for specific locations", () => {
			it("should override only specified location hours", () => {
				const override: BusinessHoursOverrideInput = {
					start_time: "07:00",
					end_time: "17:00",
					day: 1,
					month: 3,
					is_open: true,
					all_locations: false,
					location_ids: [locations[0].location_id],
				};

				const result = getLocationsBusinessHoursOverrides(
					[override],
					locations,
				);

				expect(Object.entries(result).length).toEqual(1);
			});
		});

		describe("When hours override is not available for any locations", () => {
			it("should return empty result", () => {
				const result = getLocationsBusinessHoursOverrides([], locations);

				expect(Object.entries(result).length).toEqual(0);
			});
		});
	});
});
