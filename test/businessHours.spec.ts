import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FULFILLMENT_TYPES } from "../src/constants";
import {
	getLocationBusinessHoursForFulfillment,
	toBusinessHoursOverride,
} from "../src/utils/business-hours";
import { overrideTimeZoneOnUTC, setHmOnDate } from "../src/utils/date";
import { getOpeningClosingTimeOnDate } from "../src/utils/store-hours";

const timezone = "America/New_York";

describe("Business Hours Utils", () => {
	describe("setHmOnDate", () => {
		describe("when using same timezone (UTC)", () => {
			it("should set time correctly without conversion", () => {
				const baseDate = new Date("2023-03-15T12:00:00Z");
				const result = setHmOnDate(baseDate, "08:00", "UTC");
				expect(result.toISOString()).toBe("2023-03-15T08:00:00.000Z");
			});

			describe("with various time formats", () => {
				const baseDate = new Date("2023-03-15T12:00:00Z");

				it("should handle single-digit hours", () => {
					const result = setHmOnDate(baseDate, "8:05", "UTC");
					expect(result.toISOString()).toBe("2023-03-15T08:05:00.000Z");
				});

				it("should handle 24-hour format", () => {
					const result = setHmOnDate(baseDate, "23:45", "UTC");
					expect(result.toISOString()).toBe("2023-03-15T23:45:00.000Z");
				});

				it("should handle leading zeros", () => {
					const result = setHmOnDate(baseDate, "04:09", "UTC");
					expect(result.toISOString()).toBe("2023-03-15T04:09:00.000Z");
				});
			});
		});

		describe("when converting to New York timezone", () => {
			it("should adjust time for Eastern Time", () => {
				const baseDate = new Date("2023-03-15T12:00:00Z");
				const result = setHmOnDate(baseDate, "08:00", "America/New_York");
				expect(result.toISOString()).toBe("2023-03-15T12:00:00.000Z");
			});

			describe("during daylight saving time transitions", () => {
				it("should handle EDT (UTC-4)", () => {
					const summerDate = new Date("2023-06-15T12:00:00Z");
					const result = setHmOnDate(summerDate, "08:00", "America/New_York");
					expect(result.toISOString()).toBe("2023-06-15T12:00:00.000Z");
				});

				it("should handle EST (UTC-5)", () => {
					const winterDate = new Date("2023-12-15T12:00:00Z");
					const result = setHmOnDate(winterDate, "08:00", "America/New_York");
					expect(result.toISOString()).toBe("2023-12-15T13:00:00.000Z");
				});
			});

			it("should handle midnight correctly", () => {
				const baseDate = new Date("2023-03-15T12:00:00Z");
				const result = setHmOnDate(baseDate, "00:00", "America/New_York");
				expect(result.toISOString()).toBe("2023-03-15T04:00:00.000Z");
			});
		});

		describe("when converting to Los Angeles timezone", () => {
			it("should adjust time for Pacific Time", () => {
				const baseDate = new Date("2023-03-15T12:00:00Z");
				const result = setHmOnDate(baseDate, "08:00", "America/Los_Angeles");
				expect(result.toISOString()).toBe("2023-03-15T15:00:00.000Z");
			});
		});
	});

	describe("getOpeningClosingTimeOnDate", () => {
		const testDate = overrideTimeZoneOnUTC(
			new Date("2025-03-11T06:00:00"),
			timezone,
		);

		it("should return null when no business hours are available", () => {
			const result = getOpeningClosingTimeOnDate({
				date: testDate,
				businessHours: [],
				businessHoursOverrides: [],
				timeZone: timezone,
			});

			expect(result).toBeNull();
		});

		it("should return opening and closing times for a regular business day", () => {
			const businessHours = [{ day: 2, startTime: "09:00", endTime: "17:00" }];

			const opening = setHmOnDate(
				overrideTimeZoneOnUTC(new Date("2025-03-11T06:00:00"), timezone),
				"09:00",
				timezone,
			);
			const closing = setHmOnDate(
				overrideTimeZoneOnUTC(new Date("2025-03-11T06:00:00"), timezone),
				"17:00",
				timezone,
			);

			const result = getOpeningClosingTimeOnDate({
				date: testDate,
				businessHours,
				businessHoursOverrides: [],
				timeZone: timezone,
			});

			expect(result).toEqual({
				openingTime: opening,
				closingTime: closing,
			});
		});

		it("should return next available date when no business hours match the current day of week", () => {
			const businessHours = [{ day: 1, startTime: "09:00", endTime: "17:00" }];

			const opening = setHmOnDate(
				overrideTimeZoneOnUTC(new Date("2025-03-17T06:00:00"), timezone),
				"09:00",
				timezone,
			);
			const closing = setHmOnDate(
				overrideTimeZoneOnUTC(new Date("2025-03-17T06:00:00"), timezone),
				"17:00",
				timezone,
			);

			const result = getOpeningClosingTimeOnDate({
				date: testDate,
				businessHours,
				businessHoursOverrides: [],
				timeZone: timezone,
			});

			expect(result).toEqual({
				openingTime: opening,
				closingTime: closing,
			});
		});

		it("should use business hours override when available", () => {
			const businessHours = [{ day: 2, startTime: "09:00", endTime: "17:00" }];

			const businessHoursOverrides = [
				{ day: 11, month: 3, startTime: "10:00", endTime: "15:00" },
			];

			const overrideOpening = setHmOnDate(
				overrideTimeZoneOnUTC(new Date("2025-03-11T06:00:00"), timezone),
				"10:00",
				timezone,
			);
			const overrideClosing = setHmOnDate(
				overrideTimeZoneOnUTC(new Date("2025-03-11T06:00:00"), timezone),
				"15:00",
				timezone,
			);

			const result = getOpeningClosingTimeOnDate({
				date: testDate,
				businessHours,
				businessHoursOverrides,
				timeZone: timezone,
			});

			expect(result).toEqual({
				openingTime: overrideOpening,
				closingTime: overrideClosing,
			});
		});

		it("should handle multiple business hour periods in a day", () => {
			const businessHours = [
				{ day: 2, startTime: "09:00", endTime: "12:00" },
				{ day: 2, startTime: "13:00", endTime: "17:00" },
			];

			const morningOpen = setHmOnDate(
				overrideTimeZoneOnUTC(new Date("2025-03-11T06:00:00"), timezone),
				"09:00",
				timezone,
			);
			const afternoonClose = setHmOnDate(
				overrideTimeZoneOnUTC(new Date("2025-03-11T06:00:00"), timezone),
				"12:00",
				timezone,
			);

			const result = getOpeningClosingTimeOnDate({
				date: testDate,
				businessHours,
				businessHoursOverrides: [],
				timeZone: timezone,
			});

			expect(result).toEqual({
				openingTime: morningOpen,
				closingTime: afternoonClose,
			});
		});

		it("should return null for invalid business hours where end time is before start time", () => {
			const businessHours = [{ day: 2, startTime: "17:00", endTime: "09:00" }];

			const result = getOpeningClosingTimeOnDate({
				date: testDate,
				businessHours,
				businessHoursOverrides: [],
				timeZone: timezone,
			});

			expect(result).toBeNull();
		});

		it("should handle a closed day with business hours override", () => {
			const businessHoursOverrides = [
				{ day: 11, month: 3, startTime: null, endTime: null },
			];

			const opening = setHmOnDate(
				overrideTimeZoneOnUTC(new Date("2025-03-12T06:00:00"), timezone),
				"09:00",
				timezone,
			);
			const closing = setHmOnDate(
				overrideTimeZoneOnUTC(new Date("2025-03-12T06:00:00"), timezone),
				"17:00",
				timezone,
			);

			const result = getOpeningClosingTimeOnDate({
				date: testDate,
				businessHours: [
					{ day: 2, startTime: "09:00", endTime: "17:00" },
					{ day: 3, startTime: "09:00", endTime: "17:00" },
				],
				businessHoursOverrides,
				timeZone: timezone,
			});

			expect(result).toEqual({
				openingTime: opening,
				closingTime: closing,
			});
		});

		it("should use default parameters when not provided", () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date("2025-03-11T00:00:00"));

			const businessHours = [{ day: 2, startTime: "09:00", endTime: "17:00" }];

			const opening = setHmOnDate(
				overrideTimeZoneOnUTC(new Date("2025-03-11T06:00:00"), timezone),
				"09:00",
				timezone,
			);
			const closing = setHmOnDate(
				overrideTimeZoneOnUTC(new Date("2025-03-11T06:00:00"), timezone),
				"17:00",
				timezone,
			);

			const result = getOpeningClosingTimeOnDate({
				businessHours,
				timeZone: timezone,
			});

			expect(result).toEqual({
				openingTime: opening,
				closingTime: closing,
			});

			vi.useRealTimers();
		});
	});

	describe("toBusinessHoursOverride", () => {
		describe("when business is open", () => {
			it("should return correct business hours override format", () => {
				const input = {
					month: 9,
					day: 15,
					start_time: "08:00",
					end_time: "20:00",
					is_open: true,
				};

				expect(toBusinessHoursOverride(input)).toEqual({
					month: 9,
					day: 15,
					startTime: "08:00",
					endTime: "20:00",
				});
			});
		});

		describe("when business is closed", () => {
			it("should return override with null times", () => {
				const input = {
					month: 9,
					day: 15,
					start_time: "08:00",
					end_time: "20:00",
					is_open: false,
				};

				expect(toBusinessHoursOverride(input)).toEqual({
					month: 9,
					day: 15,
					startTime: null,
					endTime: null,
				});
			});
		});
	});

	describe("getLocationBusinessHoursForFulfillment", () => {
		describe("when fulfillment type is PICKUP", () => {
			it("should return pickup hours", () => {
				const location = {
					location_id: "loc-1",
					timezone: "UTC",
					pickup_hours: [{ day: 1, start_time: "08:00", end_time: "20:00" }],
					delivery_hours: [{ day: 1, start_time: "09:00", end_time: "19:00" }],
				};

				const result = getLocationBusinessHoursForFulfillment(
					location,
					FULFILLMENT_TYPES.PICKUP,
				);

				expect(result).toEqual([
					{ day: 1, startTime: "08:00", endTime: "20:00" },
				]);
			});
		});

		describe("when fulfillment type is DELIVERY", () => {
			it("should return delivery hours", () => {
				const location = {
					location_id: "loc-1",
					timezone: "UTC",
					pickup_hours: [{ day: 1, start_time: "08:00", end_time: "20:00" }],
					delivery_hours: [{ day: 1, start_time: "09:00", end_time: "19:00" }],
				};

				const result = getLocationBusinessHoursForFulfillment(
					location,
					FULFILLMENT_TYPES.DELIVERY,
				);

				expect(result).toEqual([
					{ day: 1, startTime: "09:00", endTime: "19:00" },
				]);
			});
		});

		describe("when fulfillment type is CURBSIDE with use_pickup_hours", () => {
			it("should return pickup hours", () => {
				const location = {
					location_id: "loc-1",
					timezone: "UTC",
					pickup_hours: [{ day: 1, start_time: "08:00", end_time: "20:00" }],
					curbside_hours: {
						use_pickup_hours: true,
					},
				};

				const result = getLocationBusinessHoursForFulfillment(
					location,
					FULFILLMENT_TYPES.CURBSIDE,
				);

				expect(result).toEqual([
					{ day: 1, startTime: "08:00", endTime: "20:00" },
				]);
			});
		});

		describe("when fulfillment type is CURBSIDE with custom hours", () => {
			it("should return curbside hours", () => {
				const location = {
					location_id: "loc-1",
					timezone: "UTC",
					pickup_hours: [{ day: 1, start_time: "08:00", end_time: "20:00" }],
					curbside_hours: {
						use_pickup_hours: false,
						times: [{ day: 1, start_time: "10:00", end_time: "18:00" }],
					},
				};

				const result = getLocationBusinessHoursForFulfillment(
					location,
					FULFILLMENT_TYPES.CURBSIDE,
				);

				expect(result).toEqual([
					{ day: 1, startTime: "10:00", endTime: "18:00" },
				]);
			});
		});
	});

	describe("When today is closed but have special business hours override for today", () => {
		it("should return the override time for today", () => {
			const businessHours = getLocationBusinessHoursForFulfillment(
				{
					location_id: "loc-1",
					timezone: "UTC",
					pickup_hours: [
						{ day: 1, start_time: "09:00", end_time: "17:00" },
						{ day: 2, start_time: "09:00", end_time: "17:00" },
						{ day: 3, start_time: "09:00", end_time: "17:00" },
						{ day: 4, start_time: "09:00", end_time: "17:00" },
						{ day: 5, start_time: "09:00", end_time: "17:00" },
						{ day: 6, start_time: "09:00", end_time: "17:00" },
					],
				},
				"PICKUP",
			);

			const times = getOpeningClosingTimeOnDate({
				date: new Date("2024-03-18T00:00:00.000Z"),
				timeZone: "UTC",
				businessHours,
				businessHoursOverrides: [
					{
						month: 3,
						day: 18,
						startTime: "10:00:00",
						endTime: "23:59:00",
					},
				],
			});

			expect(times?.openingTime).toEqual(new Date("2024-03-18T10:00:00.000Z"));
			expect(times?.closingTime).toEqual(new Date("2024-03-18T23:59:00.000Z"));
		});
	});

	describe("When day has multiple business hours opening times", () => {
		describe("When current time is less than all business hours opening times", () => {
			it("should return first shift opening/closing time", () => {
				const businessHours = [
					{ day: 0, startTime: "09:00", endTime: "12:00" },
					{ day: 0, startTime: "14:00", endTime: "17:00" },
				];
				const times = getOpeningClosingTimeOnDate({
					date: new Date("2024-10-27T00:00:00.000Z"),
					timeZone: "UTC",
					businessHours,
					businessHoursOverrides: [],
				});

				expect(times?.openingTime).toEqual(
					new Date("2024-10-27T09:00:00.000Z"),
				);
				expect(times?.closingTime).toEqual(
					new Date("2024-10-27T12:00:00.000Z"),
				);
			});
		});

		describe("When current time is after first business hours opening time", () => {
			it("should return first shift opening/closing time", () => {
				const businessHours = [
					{ day: 0, startTime: "09:00", endTime: "12:00" },
					{ day: 0, startTime: "14:00", endTime: "17:00" },
				];
				const times = getOpeningClosingTimeOnDate({
					date: new Date("2024-10-27T11:00:00.000Z"),
					timeZone: "UTC",
					businessHours,
					businessHoursOverrides: [],
				});

				expect(times?.openingTime).toEqual(
					new Date("2024-10-27T09:00:00.000Z"),
				);
				expect(times?.closingTime).toEqual(
					new Date("2024-10-27T12:00:00.000Z"),
				);
			});
		});

		describe("When current time is between first close and second open", () => {
			it("should return second shift opening/closing time", () => {
				const businessHours = [
					{ day: 0, startTime: "09:00", endTime: "12:00" },
					{ day: 0, startTime: "14:00", endTime: "17:00" },
				];
				const times = getOpeningClosingTimeOnDate({
					date: new Date("2024-10-27T13:00:00.000Z"),
					timeZone: "UTC",
					businessHours,
					businessHoursOverrides: [],
				});

				expect(times?.openingTime).toEqual(
					new Date("2024-10-27T14:00:00.000Z"),
				);
				expect(times?.closingTime).toEqual(
					new Date("2024-10-27T17:00:00.000Z"),
				);
			});
		});

		describe("When current time is after second business hours closing time", () => {
			it("should return next day opening/closing time", () => {
				const businessHours = [
					{ day: 0, startTime: "09:00", endTime: "12:00" },
					{ day: 0, startTime: "14:00", endTime: "17:00" },
					{ day: 1, startTime: "09:00", endTime: "12:00" },
				];
				const times = getOpeningClosingTimeOnDate({
					date: new Date("2024-10-27T22:00:00.000Z"),
					timeZone: "UTC",
					businessHours,
					businessHoursOverrides: [],
				});

				expect(times?.openingTime).toEqual(
					new Date("2024-10-28T09:00:00.000Z"),
				);
				expect(times?.closingTime).toEqual(
					new Date("2024-10-28T12:00:00.000Z"),
				);
			});
		});

		describe("when handling midnight shift", () => {
			beforeEach(() => {
				vi.useFakeTimers();
				vi.setSystemTime(new Date("2024-10-27T04:00:00.000Z").getTime());
			});

			afterEach(() => {
				vi.useRealTimers();
			});

			describe("when current day closing time is 23:59 and next day open time is 00:00", () => {
				it("should return next day closing time as closing time", () => {
					const businessHours = [
						{ day: 0, startTime: "01:00", endTime: "23:59" },
						{ day: 1, startTime: "00:00", endTime: "02:00" },
					];
					const times = getOpeningClosingTimeOnDate({
						date: new Date("2024-10-27T04:00:00.000Z"),
						timeZone: "UTC",
						businessHours,
						businessHoursOverrides: [],
					});

					expect(times?.openingTime).toEqual(
						new Date("2024-10-27T01:00:00.000Z"),
					);
					expect(times?.closingTime).toEqual(
						new Date("2024-10-28T02:00:00.000Z"),
					);
				});
			});

			describe("when current day closing time is not 23:59 and next day open time is 00:00", () => {
				it("should return current day closing time", () => {
					const businessHours = [
						{ day: 0, startTime: "01:00", endTime: "23:00" },
						{ day: 1, startTime: "00:00", endTime: "02:00" },
					];
					const times = getOpeningClosingTimeOnDate({
						date: new Date("2024-10-27T04:00:00.000Z"),
						timeZone: "UTC",
						businessHours,
						businessHoursOverrides: [],
					});

					expect(times?.openingTime).toEqual(
						new Date("2024-10-27T01:00:00.000Z"),
					);
					expect(times?.closingTime).toEqual(
						new Date("2024-10-27T23:00:00.000Z"),
					);
				});
			});

			describe("when next day closing time is less than 4am", () => {
				it("should return next day closing time", () => {
					const businessHours = [
						{ day: 0, startTime: "01:00", endTime: "23:59" },
						{ day: 1, startTime: "00:00", endTime: "03:00" },
					];
					const times = getOpeningClosingTimeOnDate({
						date: new Date("2024-10-27T04:00:00.000Z"),
						timeZone: "UTC",
						businessHours,
						businessHoursOverrides: [],
					});

					expect(times?.openingTime).toEqual(
						new Date("2024-10-27T01:00:00.000Z"),
					);
					expect(times?.closingTime).toEqual(
						new Date("2024-10-28T03:00:00.000Z"),
					);
				});
			});

			describe("when next day closing time is greater than 4am", () => {
				it("should return next day closing time", () => {
					const businessHours = [
						{ day: 0, startTime: "01:00", endTime: "23:59" },
						{ day: 1, startTime: "00:00", endTime: "05:00" },
					];
					const times = getOpeningClosingTimeOnDate({
						date: new Date("2024-10-27T04:00:00.000Z"),
						timeZone: "UTC",
						businessHours,
						businessHoursOverrides: [],
					});

					expect(times?.openingTime).toEqual(
						new Date("2024-10-27T01:00:00.000Z"),
					);
					expect(times?.closingTime).toEqual(
						new Date("2024-10-28T05:00:00.000Z"),
					);
				});
			});
		});
	});
});
