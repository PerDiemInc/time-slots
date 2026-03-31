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
 * DAY cadence is preserved for business-day-skip via dates.slice().
 * HOUR cadence is converted to minutes so the standard minute-cadence
 * rollover logic in generateSchedule handles it.
 */
describe("getCateringPrepTimeConfig", () => {
	describe("when items is empty", () => {
		it("should convert default HOUR fallback (1h) to 60 minutes", () => {
			const result = getCateringPrepTimeConfig({ items: [] });

			expect(result.prepTimeCadence).toBe(PREP_TIME_CADENCE.MINUTE);
			expect(result.prepTimeFrequency).toBe(60);
			expect(result).not.toHaveProperty("weekDayPrepTimes");
		});

		it("should preserve DAY cadence and frequency for business-day skip (DAY 2)", () => {
			const result = getCateringPrepTimeConfig({
				items: [],
				prepTimeCadence: PREP_TIME_CADENCE.DAY,
				prepTimeFrequency: 2,
			});

			expect(result.prepTimeCadence).toBe(PREP_TIME_CADENCE.DAY);
			expect(result.prepTimeFrequency).toBe(2);
			expect(result).not.toHaveProperty("weekDayPrepTimes");
		});

		it("should convert HOUR fallback (3h) to 180 minutes", () => {
			const result = getCateringPrepTimeConfig({
				items: [],
				prepTimeCadence: PREP_TIME_CADENCE.HOUR,
				prepTimeFrequency: 3,
				timezone: "UTC",
			});

			expect(result.prepTimeCadence).toBe(PREP_TIME_CADENCE.MINUTE);
			expect(result.prepTimeFrequency).toBe(180);
			expect(result).not.toHaveProperty("weekDayPrepTimes");
		});
	});

	describe("when items have catering prep_time", () => {
		it("should preserve DAY cadence with max day frequency (3 days)", () => {
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
			expect(result).not.toHaveProperty("weekDayPrepTimes");
		});

		it("should convert max hour frequency (5h) to 300 minutes", () => {
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
			expect(result.prepTimeFrequency).toBe(300);
			expect(result).not.toHaveProperty("weekDayPrepTimes");
		});

		it("should give DAY priority when items have both DAY and HOUR (2 days)", () => {
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
			expect(result).not.toHaveProperty("weekDayPrepTimes");
		});

		it("should fall back to params with preserved DAY cadence when no valid catering prep_time (1 day)", () => {
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

			expect(result.prepTimeCadence).toBe(PREP_TIME_CADENCE.DAY);
			expect(result.prepTimeFrequency).toBe(1);
			expect(result).not.toHaveProperty("weekDayPrepTimes");
		});

		it("should convert max hour frequency (8h) to 480 minutes", () => {
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
			expect(result.prepTimeFrequency).toBe(480);
			expect(result).not.toHaveProperty("weekDayPrepTimes");
		});
	});
});
