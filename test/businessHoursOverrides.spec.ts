import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { BusinessHoursOverrideInput, LocationLike } from "../src/types";
import { getLocationsBusinessHoursOverrides } from "../src/utils/business-hours";

describe("Business hours overrides", () => {
	const locations: LocationLike[] = [
		{ location_id: randomUUID(), store_id: "store-a", timezone: "UTC" },
		{ location_id: randomUUID(), store_id: "store-a", timezone: "UTC" },
	];

	describe("getLocationsBusinessHoursOverrides", () => {
		describe("When hours override is for all locations", () => {
			it("should override all locations hours", () => {
				const override: BusinessHoursOverrideInput = {
					store_id: "store-a",
					start_time: "07:00",
					end_time: "17:00",
					day: 1,
					month: 3,
					is_open: true,
					all_locations: true,
					location_ids: [],
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
					store_id: "store-a",
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

		describe("When locations belong to different stores (org)", () => {
			const orgLocations: LocationLike[] = [
				{ location_id: randomUUID(), store_id: "store-a", timezone: "UTC" },
				{ location_id: randomUUID(), store_id: "store-a", timezone: "UTC" },
				{ location_id: randomUUID(), store_id: "store-b", timezone: "UTC" },
			];

			it("should apply an all-locations override only to its own store", () => {
				const override: BusinessHoursOverrideInput = {
					store_id: "store-a",
					start_time: "07:00",
					end_time: "17:00",
					day: 1,
					month: 3,
					is_open: true,
					all_locations: true,
					location_ids: [],
				};

				const result = getLocationsBusinessHoursOverrides(
					[override],
					orgLocations,
				);

				expect(Object.keys(result)).toEqual([
					orgLocations[0].location_id,
					orgLocations[1].location_id,
				]);
			});

			it("should skip a listed location that belongs to another store", () => {
				const override: BusinessHoursOverrideInput = {
					store_id: "store-a",
					start_time: "07:00",
					end_time: "17:00",
					day: 1,
					month: 3,
					is_open: true,
					all_locations: false,
					location_ids: [
						orgLocations[0].location_id,
						orgLocations[2].location_id,
					],
				};

				const result = getLocationsBusinessHoursOverrides(
					[override],
					orgLocations,
				);

				expect(Object.keys(result)).toEqual([orgLocations[0].location_id]);
			});
		});
	});
});
