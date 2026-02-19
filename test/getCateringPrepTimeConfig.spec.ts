import { describe, expect, it, vi } from "vitest";
import { PREP_TIME_CADENCE } from "../src/constants";
import type { GetCateringPrepTimeParams } from "../src/types";
import { getCateringPrepTimeConfig } from "../src/utils/catering";

function makeCartItem(overrides: GetCateringPrepTimeParams["items"][0] = {}) {
	return {
		preSale: false,
		weeklyPreSale: false,
		...overrides,
	};
}

describe("getCateringPrepTimeConfig", () => {
	describe("when items is empty", () => {
		it("should return fallback with HOUR cadence and frequency 1 when no params are given", () => {
			const result = getCateringPrepTimeConfig({ items: [] });

			expect(result.prepTimeCadence).toBe(PREP_TIME_CADENCE.HOUR);
			expect(result.prepTimeFrequency).toBe(1);
			expect(result.weekDayPrepTimes).toBeDefined();
			expect(Object.keys(result.weekDayPrepTimes ?? {})).toHaveLength(1);
		});

		it("should use prepTimeCadence and prepTimeFrequency from params when provided", () => {
			const result = getCateringPrepTimeConfig({
				items: [],
				prepTimeCadence: PREP_TIME_CADENCE.DAY,
				prepTimeFrequency: 2,
			});

			expect(result.prepTimeCadence).toBe(PREP_TIME_CADENCE.DAY);
			expect(result.prepTimeFrequency).toBe(2);
			expect(result.weekDayPrepTimes).toEqual({});
		});

		it("should return weekDayPrepTimes for current day when cadence is HOUR and timezone is provided", () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date("2026-01-05T12:00:00.000Z")); // Monday = 1 in timezone-support

			const result = getCateringPrepTimeConfig({
				items: [],
				prepTimeCadence: PREP_TIME_CADENCE.HOUR,
				prepTimeFrequency: 3,
				timezone: "UTC",
			});

			expect(result.prepTimeCadence).toBe(PREP_TIME_CADENCE.HOUR);
			expect(result.prepTimeFrequency).toBe(3);
			expect(result.weekDayPrepTimes).toBeDefined();
			// 3 hours * 60 = 180 minutes
			expect(Object.values(result.weekDayPrepTimes ?? {})).toContain(180);

			vi.useRealTimers();
		});
	});

	describe("when items have catering prep_time", () => {
		it("should return DAY cadence with max day frequency when only day items exist", () => {
			const result = getCateringPrepTimeConfig({
				items: [
					makeCartItem({
						cateringService: {
							min_quantity: 1,
							max_quantity: 10,
							serve_count: 1,
							prep_time: { cadence: PREP_TIME_CADENCE.DAY, frequency: 1 },
						},
					}),
					makeCartItem({
						cateringService: {
							min_quantity: 1,
							max_quantity: 10,
							serve_count: 1,
							prep_time: { cadence: PREP_TIME_CADENCE.DAY, frequency: 3 },
						},
					}),
				],
				timezone: "UTC",
			});

			expect(result.prepTimeCadence).toBe(PREP_TIME_CADENCE.DAY);
			expect(result.prepTimeFrequency).toBe(3);
			expect(result.weekDayPrepTimes).toEqual({});
		});

		it("should return HOUR cadence with max hour frequency when only hour items exist", () => {
			const result = getCateringPrepTimeConfig({
				items: [
					makeCartItem({
						cateringService: {
							min_quantity: 1,
							max_quantity: 10,
							serve_count: 1,
							prep_time: { cadence: PREP_TIME_CADENCE.HOUR, frequency: 2 },
						},
					}),
					makeCartItem({
						cateringService: {
							min_quantity: 1,
							max_quantity: 10,
							serve_count: 1,
							prep_time: { cadence: PREP_TIME_CADENCE.HOUR, frequency: 5 },
						},
					}),
				],
				timezone: "UTC",
			});

			expect(result.prepTimeCadence).toBe(PREP_TIME_CADENCE.HOUR);
			expect(result.prepTimeFrequency).toBe(5);
			expect(result.weekDayPrepTimes).toBeDefined();
			expect(Object.values(result.weekDayPrepTimes ?? {})).toContain(5 * 60);
		});

		it("should give DAY priority when items have both DAY and HOUR cadence", () => {
			const result = getCateringPrepTimeConfig({
				items: [
					makeCartItem({
						cateringService: {
							min_quantity: 1,
							max_quantity: 10,
							serve_count: 1,
							prep_time: { cadence: PREP_TIME_CADENCE.HOUR, frequency: 10 },
						},
					}),
					makeCartItem({
						cateringService: {
							min_quantity: 1,
							max_quantity: 10,
							serve_count: 1,
							prep_time: { cadence: PREP_TIME_CADENCE.DAY, frequency: 2 },
						},
					}),
				],
				timezone: "UTC",
			});

			expect(result.prepTimeCadence).toBe(PREP_TIME_CADENCE.DAY);
			expect(result.prepTimeFrequency).toBe(2);
			expect(result.weekDayPrepTimes).toEqual({});
		});

		it("should fall back to params when items have no valid catering prep_time", () => {
			const result = getCateringPrepTimeConfig({
				items: [
					makeCartItem({}), // no cateringService
					makeCartItem({
						cateringService: {
							min_quantity: 1,
							max_quantity: 10,
							serve_count: 1,
							prep_time: { cadence: "minute" as const, frequency: 30 }, // MINUTE not DAY/HOUR
						},
					}),
				],
				prepTimeCadence: PREP_TIME_CADENCE.DAY,
				prepTimeFrequency: 1,
				timezone: "UTC",
			});

			expect(result.prepTimeCadence).toBe(PREP_TIME_CADENCE.DAY);
			expect(result.prepTimeFrequency).toBe(1);
			expect(result.weekDayPrepTimes).toEqual({});
		});

		it("should return max frequency when multiple items have valid HOUR catering prep_time", () => {
			const result = getCateringPrepTimeConfig({
				items: [
					makeCartItem({
						cateringService: {
							min_quantity: 1,
							max_quantity: 10,
							serve_count: 1,
							prep_time: { cadence: PREP_TIME_CADENCE.HOUR, frequency: 4 },
						},
					}),
					makeCartItem({
						cateringService: {
							min_quantity: 1,
							max_quantity: 10,
							serve_count: 1,
							prep_time: { cadence: PREP_TIME_CADENCE.HOUR, frequency: 8 },
						},
					}),
				],
				timezone: "UTC",
			});

			expect(result.prepTimeCadence).toBe(PREP_TIME_CADENCE.HOUR);
			expect(result.prepTimeFrequency).toBe(8);
		});
	});
});
