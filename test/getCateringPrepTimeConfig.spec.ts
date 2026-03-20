import { describe, expect, it } from "vitest";
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

/**
 * Catering prep is applied in hours (first slot only); cadence/frequency from config
 * are not used for slot logic. Result always has prepTimeCadence "minute",
 * prepTimeFrequency 0, weekDayPrepTimes {}. totalCateringPrepTimeInHours carries
 * the actual prep (hours or days*24).
 */
describe("getCateringPrepTimeConfig", () => {
	describe("when items is empty", () => {
		it("should return hour cadence, frequency 0, and totalCateringPrepTimeInHours from fallback (1)", () => {
			const result = getCateringPrepTimeConfig({ items: [] });

			expect(result.prepTimeCadence).toBe(PREP_TIME_CADENCE.MINUTE);
			expect(result.prepTimeFrequency).toBe(0);
			expect(result.weekDayPrepTimes).toEqual({});
			expect(result.totalCateringPrepTimeInHours).toBe(1);
		});

		it("should use params for totalCateringPrepTimeInHours only (DAY 2 → 48h)", () => {
			const result = getCateringPrepTimeConfig({
				items: [],
				prepTimeCadence: PREP_TIME_CADENCE.DAY,
				prepTimeFrequency: 2,
			});

			expect(result.prepTimeCadence).toBe(PREP_TIME_CADENCE.MINUTE);
			expect(result.prepTimeFrequency).toBe(0);
			expect(result.weekDayPrepTimes).toEqual({});
			expect(result.totalCateringPrepTimeInHours).toBe(48);
		});

		it("should return totalCateringPrepTimeInHours when timezone provided (3h)", () => {
			const result = getCateringPrepTimeConfig({
				items: [],
				prepTimeCadence: PREP_TIME_CADENCE.HOUR,
				prepTimeFrequency: 3,
				timezone: "UTC",
			});

			expect(result.prepTimeCadence).toBe(PREP_TIME_CADENCE.MINUTE);
			expect(result.prepTimeFrequency).toBe(0);
			expect(result.weekDayPrepTimes).toEqual({});
			expect(result.totalCateringPrepTimeInHours).toBe(3);
		});
	});

	describe("when items have catering prep_time", () => {
		it("should return totalCateringPrepTimeInHours for max day frequency (3 days → 72h)", () => {
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

			expect(result.prepTimeCadence).toBe(PREP_TIME_CADENCE.MINUTE);
			expect(result.prepTimeFrequency).toBe(0);
			expect(result.weekDayPrepTimes).toEqual({});
			expect(result.totalCateringPrepTimeInHours).toBe(72);
		});

		it("should return totalCateringPrepTimeInHours for max hour frequency (5h)", () => {
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

			expect(result.prepTimeCadence).toBe(PREP_TIME_CADENCE.MINUTE);
			expect(result.prepTimeFrequency).toBe(0);
			expect(result.weekDayPrepTimes).toEqual({});
			expect(result.totalCateringPrepTimeInHours).toBe(5);
		});

		it("should give DAY priority when items have both DAY and HOUR (2 days → 48h)", () => {
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

			expect(result.prepTimeCadence).toBe(PREP_TIME_CADENCE.MINUTE);
			expect(result.prepTimeFrequency).toBe(0);
			expect(result.weekDayPrepTimes).toEqual({});
			expect(result.totalCateringPrepTimeInHours).toBe(48);
		});

		it("should fall back to params totalCateringPrepTimeInHours when no valid catering prep_time (1 day → 24h)", () => {
			const result = getCateringPrepTimeConfig({
				items: [
					makeCartItem({}),
					makeCartItem({
						cateringService: {
							min_quantity: 1,
							max_quantity: 10,
							serve_count: 1,
							prep_time: { cadence: "minute" as const, frequency: 30 },
						},
					}),
				],
				prepTimeCadence: PREP_TIME_CADENCE.DAY,
				prepTimeFrequency: 1,
				timezone: "UTC",
			});

			expect(result.prepTimeCadence).toBe(PREP_TIME_CADENCE.MINUTE);
			expect(result.prepTimeFrequency).toBe(0);
			expect(result.weekDayPrepTimes).toEqual({});
			expect(result.totalCateringPrepTimeInHours).toBe(24);
		});

		it("should return totalCateringPrepTimeInHours for max hour frequency (8h)", () => {
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

			expect(result.prepTimeCadence).toBe(PREP_TIME_CADENCE.MINUTE);
			expect(result.prepTimeFrequency).toBe(0);
			expect(result.totalCateringPrepTimeInHours).toBe(8);
		});
	});
});
