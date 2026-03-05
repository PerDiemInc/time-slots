import { describe, expect, it } from "vitest";
import { getNextAvailableDates } from "../src/schedule/available-dates";

const allDaysBusinessHours = [
	{ day: 0, startTime: "08:00", endTime: "20:00" },
	{ day: 1, startTime: "08:00", endTime: "20:00" },
	{ day: 2, startTime: "08:00", endTime: "20:00" },
	{ day: 3, startTime: "08:00", endTime: "20:00" },
	{ day: 4, startTime: "08:00", endTime: "20:00" },
	{ day: 5, startTime: "08:00", endTime: "20:00" },
	{ day: 6, startTime: "08:00", endTime: "20:00" },
];

describe("getNextAvailableDates", () => {
	describe("When passing 2023-09-29T02:00:00.000Z date and timezone as America/Halifax", () => {
		it("should return 7 days starting from start date day in zone (no skip when isDaysCadence not set)", () => {
			const date = new Date("2023-09-29T02:00:00.000Z");

			const expectedArray = [
				new Date("2023-09-28T03:00:00.000Z"),
				new Date("2023-09-29T03:00:00.000Z"),
				new Date("2023-09-30T03:00:00.000Z"),
				new Date("2023-10-01T03:00:00.000Z"),
				new Date("2023-10-02T03:00:00.000Z"),
				new Date("2023-10-03T03:00:00.000Z"),
				new Date("2023-10-04T03:00:00.000Z"),
			];

			const generatedArray = getNextAvailableDates({
				startDate: date,
				datesCount: 7,
				timeZone: "America/Halifax",
				businessHours: allDaysBusinessHours,
			});

			generatedArray.forEach((el, index) => {
				expect(el).toEqual(expectedArray[index]);
				expect(el).toEqual(expect.any(Date));
			});
		});
	});

	describe("When isDaysCadence is true", () => {
		it("should skip current date when start time is past closing in zone and return next 7 days", () => {
			const date = new Date("2023-09-29T02:00:00.000Z"); // Past closing on Sep 28 in Halifax

			const expectedArray = [
				new Date("2023-09-29T03:00:00.000Z"),
				new Date("2023-09-30T03:00:00.000Z"),
				new Date("2023-10-01T03:00:00.000Z"),
				new Date("2023-10-02T03:00:00.000Z"),
				new Date("2023-10-03T03:00:00.000Z"),
				new Date("2023-10-04T03:00:00.000Z"),
				new Date("2023-10-05T03:00:00.000Z"),
			];

			const generatedArray = getNextAvailableDates({
				startDate: date,
				datesCount: 7,
				timeZone: "America/Halifax",
				businessHours: allDaysBusinessHours,
				isDaysCadence: true,
			});

			generatedArray.forEach((el, index) => {
				expect(el).toEqual(expectedArray[index]);
				expect(el).toEqual(expect.any(Date));
			});
		});
	});

	describe("When passing 2023-09-29T03:00:00.000Z date and timezone as America/Halifax", () => {
		it("should return next 7 days dates", () => {
			const date = new Date("2023-09-29T03:00:00.000Z");

			const expectedArray = [
				new Date("2023-09-29T03:00:00.000Z"),
				new Date("2023-09-30T03:00:00.000Z"),
				new Date("2023-10-01T03:00:00.000Z"),
				new Date("2023-10-02T03:00:00.000Z"),
				new Date("2023-10-03T03:00:00.000Z"),
				new Date("2023-10-04T03:00:00.000Z"),
				new Date("2023-10-05T03:00:00.000Z"),
			];

			const generatedArray = getNextAvailableDates({
				startDate: date,
				datesCount: 7,
				timeZone: "America/Halifax",
				businessHours: allDaysBusinessHours,
			});

			generatedArray.forEach((el, index) => {
				expect(el).toEqual(expectedArray[index]);
				expect(el).toEqual(expect.any(Date));
			});
		});
	});

	describe("When passing 2023-09-27T19:00:00.000Z date and timezone as Asia/Karachi", () => {
		it("should return next 7 days dates", () => {
			const date = new Date("2023-09-27T19:00:00.000Z");

			const expectedArray = [
				new Date("2023-09-27T19:00:00.000Z"),
				new Date("2023-09-28T19:00:00.000Z"),
				new Date("2023-09-29T19:00:00.000Z"),
				new Date("2023-09-30T19:00:00.000Z"),
				new Date("2023-10-01T19:00:00.000Z"),
				new Date("2023-10-02T19:00:00.000Z"),
				new Date("2023-10-03T19:00:00.000Z"),
			];

			const generatedArray = getNextAvailableDates({
				startDate: date,
				datesCount: 7,
				timeZone: "Asia/Karachi",
				businessHours: allDaysBusinessHours,
			});

			generatedArray.forEach((el, index) => {
				expect(el).toEqual(expectedArray[index]);
				expect(el).toEqual(expect.any(Date));
			});
		});
	});

	describe("When passing 2023-09-27T18:00:00.000Z date and timezone as Asia/Karachi", () => {
		it("should return 7 days starting from start date day in zone (no skip when isDaysCadence not set)", () => {
			const date = new Date("2023-09-27T18:00:00.000Z");

			const expectedArray = [
				new Date("2023-09-26T19:00:00.000Z"),
				new Date("2023-09-27T19:00:00.000Z"),
				new Date("2023-09-28T19:00:00.000Z"),
				new Date("2023-09-29T19:00:00.000Z"),
				new Date("2023-09-30T19:00:00.000Z"),
				new Date("2023-10-01T19:00:00.000Z"),
				new Date("2023-10-02T19:00:00.000Z"),
			];

			const generatedArray = getNextAvailableDates({
				startDate: date,
				datesCount: 7,
				timeZone: "Asia/Karachi",
				businessHours: allDaysBusinessHours,
			});

			generatedArray.forEach((el, index) => {
				expect(el).toEqual(expectedArray[index]);
				expect(el).toEqual(expect.any(Date));
			});
		});
	});

	describe("When passing 2025-03-09T04:00:00.000Z that is previous day in New York (8th of March) and timezone as America/New_York", () => {
		it("should return 7 days starting from start date day in zone (no skip when isDaysCadence not set)", () => {
			const date = new Date("2025-03-09T04:00:00.000Z");

			const expectedArray = [
				new Date("2025-03-08T05:00:00.000Z"),
				new Date("2025-03-09T05:00:00.000Z"),
				new Date("2025-03-10T04:00:00.000Z"),
				new Date("2025-03-11T04:00:00.000Z"),
				new Date("2025-03-12T04:00:00.000Z"),
				new Date("2025-03-13T04:00:00.000Z"),
				new Date("2025-03-14T04:00:00.000Z"),
			];

			const generatedArray = getNextAvailableDates({
				startDate: date,
				datesCount: 7,
				timeZone: "America/New_York",
				businessHours: allDaysBusinessHours,
			});

			generatedArray.forEach((el, index) => {
				expect(el).toEqual(expectedArray[index]);
				expect(el).toEqual(expect.any(Date));
			});
		});
	});

	describe("When passing 2025-02-09T05:00:00.000Z through 2025-02-10T03:00:00.000Z and timezone as America/New_York", () => {
		it("should include Feb 9 for all start times in zone when isDaysCadence not set (no skip after closing)", () => {
			const includedExpected = [
				new Date("2025-02-09T05:00:00.000Z"),
				new Date("2025-02-10T05:00:00.000Z"),
				new Date("2025-02-11T05:00:00.000Z"),
				new Date("2025-02-12T05:00:00.000Z"),
				new Date("2025-02-13T05:00:00.000Z"),
				new Date("2025-02-14T05:00:00.000Z"),
				new Date("2025-02-15T05:00:00.000Z"),
			];

			const beforeClosing = [
				new Date("2025-02-09T05:00:00.000Z"),
				new Date("2025-02-09T06:00:00.000Z"),
				new Date("2025-02-09T07:00:00.000Z"),
				new Date("2025-02-09T08:00:00.000Z"),
				new Date("2025-02-09T09:00:00.000Z"),
				new Date("2025-02-09T10:00:00.000Z"),
				new Date("2025-02-09T11:00:00.000Z"),
				new Date("2025-02-09T12:00:00.000Z"),
				new Date("2025-02-09T13:00:00.000Z"),
				new Date("2025-02-09T14:00:00.000Z"),
				new Date("2025-02-09T15:00:00.000Z"),
				new Date("2025-02-09T16:00:00.000Z"),
				new Date("2025-02-09T17:00:00.000Z"),
				new Date("2025-02-09T18:00:00.000Z"),
				new Date("2025-02-09T19:00:00.000Z"),
				new Date("2025-02-09T20:00:00.000Z"),
				new Date("2025-02-09T21:00:00.000Z"),
				new Date("2025-02-09T22:00:00.000Z"),
				new Date("2025-02-09T23:00:00.000Z"),
				new Date("2025-02-10T00:00:00.000Z"),
				new Date("2025-02-10T01:00:00.000Z"),
			];

			const afterClosing = [
				new Date("2025-02-10T02:00:00.000Z"),
				new Date("2025-02-10T03:00:00.000Z"),
			];

			for (const date of beforeClosing) {
				const generatedArray = getNextAvailableDates({
					startDate: date,
					datesCount: 7,
					timeZone: "America/New_York",
					businessHours: allDaysBusinessHours,
				});
				generatedArray.forEach((el, index) => {
					expect(el).toEqual(includedExpected[index]);
					expect(el).toEqual(expect.any(Date));
				});
			}

			for (const date of afterClosing) {
				const generatedArray = getNextAvailableDates({
					startDate: date,
					datesCount: 7,
					timeZone: "America/New_York",
					businessHours: allDaysBusinessHours,
				});
				generatedArray.forEach((el, index) => {
					expect(el).toEqual(includedExpected[index]);
					expect(el).toEqual(expect.any(Date));
				});
			}
		});
	});

	describe("When passing 2025-03-09T05:00:00.000Z through 2025-03-10T03:00:00.000Z and timezone as America/New_York (DST transition)", () => {
		it("should include Mar 9 for all start times when isDaysCadence not set (no skip after EDT)", () => {
			const includedExpectedPreDst = [
				new Date("2025-03-09T05:00:00.000Z"),
				new Date("2025-03-10T04:00:00.000Z"),
				new Date("2025-03-11T04:00:00.000Z"),
				new Date("2025-03-12T04:00:00.000Z"),
				new Date("2025-03-13T04:00:00.000Z"),
				new Date("2025-03-14T04:00:00.000Z"),
				new Date("2025-03-15T04:00:00.000Z"),
			];
			// With platform "web" (@date-fns/tz), start of day Mar 9 is 05:00Z
			const includedExpectedPostDst = [
				new Date("2025-03-09T05:00:00.000Z"),
				new Date("2025-03-10T04:00:00.000Z"),
				new Date("2025-03-11T04:00:00.000Z"),
				new Date("2025-03-12T04:00:00.000Z"),
				new Date("2025-03-13T04:00:00.000Z"),
				new Date("2025-03-14T04:00:00.000Z"),
				new Date("2025-03-15T04:00:00.000Z"),
			];

			const preDst = [
				new Date("2025-03-09T05:00:00.000Z"),
				new Date("2025-03-09T06:00:00.000Z"),
			];

			const postDst = [
				new Date("2025-03-09T07:00:00.000Z"),
				new Date("2025-03-09T08:00:00.000Z"),
				new Date("2025-03-09T09:00:00.000Z"),
				new Date("2025-03-09T10:00:00.000Z"),
				new Date("2025-03-09T11:00:00.000Z"),
				new Date("2025-03-09T12:00:00.000Z"),
				new Date("2025-03-09T13:00:00.000Z"),
				new Date("2025-03-09T14:00:00.000Z"),
				new Date("2025-03-09T15:00:00.000Z"),
				new Date("2025-03-09T16:00:00.000Z"),
				new Date("2025-03-09T17:00:00.000Z"),
				new Date("2025-03-09T18:00:00.000Z"),
				new Date("2025-03-09T19:00:00.000Z"),
				new Date("2025-03-09T20:00:00.000Z"),
				new Date("2025-03-09T21:00:00.000Z"),
				new Date("2025-03-09T22:00:00.000Z"),
				new Date("2025-03-09T23:00:00.000Z"),
				new Date("2025-03-10T00:00:00.000Z"),
				new Date("2025-03-10T01:00:00.000Z"),
				new Date("2025-03-10T02:00:00.000Z"),
				new Date("2025-03-10T03:00:00.000Z"),
			];

			for (const date of preDst) {
				const generatedArray = getNextAvailableDates({
					startDate: date,
					datesCount: 7,
					timeZone: "America/New_York",
					businessHours: allDaysBusinessHours,
				});
				generatedArray.forEach((el, index) => {
					expect(el).toEqual(includedExpectedPreDst[index]);
					expect(el).toEqual(expect.any(Date));
				});
			}

			for (const date of postDst) {
				const generatedArray = getNextAvailableDates({
					startDate: date,
					datesCount: 7,
					timeZone: "America/New_York",
					businessHours: allDaysBusinessHours,
				});
				generatedArray.forEach((el, index) => {
					expect(el).toEqual(includedExpectedPostDst[index]);
					expect(el).toEqual(expect.any(Date));
				});
			}
		});
	});

	describe("When passing 2023-09-27T18:00:00.000Z date with closed business hours overrides", () => {
		it("should skip Sep 28, Oct 1 (overrides) and return 7 dates from start day in zone", () => {
			const date = new Date("2023-09-27T18:00:00.000Z");

			const expectedArray = [
				new Date("2023-09-26T19:00:00.000Z"),
				new Date("2023-09-28T19:00:00.000Z"),
				new Date("2023-09-29T19:00:00.000Z"),
				new Date("2023-10-01T19:00:00.000Z"),
				new Date("2023-10-02T19:00:00.000Z"),
				new Date("2023-10-03T19:00:00.000Z"),
				new Date("2023-10-04T19:00:00.000Z"),
			];

			const generatedArray = getNextAvailableDates({
				startDate: date,
				datesCount: 7,
				timeZone: "Asia/Karachi",
				businessHours: allDaysBusinessHours,
				businessHoursOverrides: [
					{ month: 10, day: 1, startTime: null, endTime: null },
					{ month: 9, day: 28, startTime: null, endTime: null },
				],
			});

			generatedArray.forEach((el, index) => {
				expect(el).toEqual(expectedArray[index]);
				expect(el).toEqual(expect.any(Date));
			});
		});
	});

	describe("When using preSaleDates parameter", () => {
		it("should only return dates that match the preSaleDates array", () => {
			const date = new Date("2024-01-01T00:00:00.000Z");
			const preSaleDates = [
				new Date("2024-01-01T00:00:00.000Z"),
				new Date("2024-01-05T00:00:00.000Z"),
				new Date("2024-01-10T00:00:00.000Z"),
				new Date("2024-01-15T00:00:00.000Z"),
			];

			const generatedArray = getNextAvailableDates({
				startDate: date,
				datesCount: 7,
				timeZone: "UTC",
				businessHours: allDaysBusinessHours,
				preSaleDates,
			});

			const expectedArray = [
				new Date("2024-01-01T00:00:00.000Z"),
				new Date("2024-01-05T00:00:00.000Z"),
				new Date("2024-01-10T00:00:00.000Z"),
				new Date("2024-01-15T00:00:00.000Z"),
			];

			expect(generatedArray.length).toBeLessThanOrEqual(expectedArray.length);
			generatedArray.forEach((el, index) => {
				expect(el.getDate()).toBe(expectedArray[index].getDate());
				expect(el).toEqual(expect.any(Date));
			});
		});

		it("should return empty array when no dates match preSaleDates", () => {
			const date = new Date("2024-01-01T00:00:00.000Z");
			const preSaleDates = [new Date("2024-01-31T00:00:00.000Z")];

			const generatedArray = getNextAvailableDates({
				startDate: date,
				datesCount: 7,
				timeZone: "UTC",
				businessHours: [{ day: 0, startTime: "08:00", endTime: "20:00" }],
				preSaleDates,
			});

			expect(generatedArray).toHaveLength(0);
		});

	});

	describe("When using regular business hours across month boundary", () => {
		it("should not get stuck on March 8 across DST (America/New_York): Mar 7–13", () => {
			// Regression: date iteration must advance correctly across DST (e.g. not stuck on Mar 8).
			// Start Mar 7 00:00 NY (EST); DST springs forward Mar 9 2AM; we must get Mar 7–13.
			const startDate = new Date("2025-03-07T05:00:00.000Z"); // Mar 7 00:00 EST

			const generatedArray = getNextAvailableDates({
				startDate,
				datesCount: 7,
				timeZone: "America/New_York",
				businessHours: allDaysBusinessHours,
			});

			expect(generatedArray).toHaveLength(7);
			const expected = [
				new Date("2025-03-07T05:00:00.000Z"), // Mar 7 00:00 EST
				new Date("2025-03-08T05:00:00.000Z"), // Mar 8 00:00 EST
				new Date("2025-03-09T05:00:00.000Z"), // Mar 9 00:00 EST
				new Date("2025-03-10T04:00:00.000Z"), // Mar 10 00:00 EDT
				new Date("2025-03-11T04:00:00.000Z"), // Mar 11 00:00 EDT
				new Date("2025-03-12T04:00:00.000Z"), // Mar 12 00:00 EDT
				new Date("2025-03-13T04:00:00.000Z"), // Mar 13 00:00 EDT
			];
			generatedArray.forEach((el, index) => {
				expect(el).toEqual(expected[index]);
			});
		});
	});

	describe("When using endDate parameter", () => {
		it("should not return dates after endDate", () => {
			const startDate = new Date("2024-01-01T00:00:00.000Z");
			const endDate = new Date("2024-01-03T23:59:59.999Z");

			const generatedArray = getNextAvailableDates({
				startDate,
				endDate,
				datesCount: 7,
				timeZone: "UTC",
				businessHours: [
					{ day: 0, startTime: "08:00", endTime: "20:00" },
					{ day: 1, startTime: "08:00", endTime: "20:00" },
					{ day: 2, startTime: "08:00", endTime: "20:00" },
					{ day: 3, startTime: "08:00", endTime: "20:00" },
				],
			});

			const expectedArray = [
				new Date("2024-01-01T00:00:00.000Z"),
				new Date("2024-01-02T00:00:00.000Z"),
				new Date("2024-01-03T00:00:00.000Z"),
			];

			expect(generatedArray).toHaveLength(expectedArray.length);
			generatedArray.forEach((el, index) => {
				expect(el.getDate()).toBe(expectedArray[index].getDate());
				expect(el).toEqual(expect.any(Date));
				expect(el.getTime()).toBeLessThan(endDate.getTime());
			});
		});

		it("should handle endDate with preSaleDates", () => {
			const startDate = new Date("2024-01-01T00:00:00.000Z");
			const endDate = new Date("2024-01-15T23:59:59.999Z");
			const preSaleDates = [
				new Date("2024-01-01T00:00:00.000Z"),
				new Date("2024-01-05T00:00:00.000Z"),
				new Date("2024-01-10T00:00:00.000Z"),
				new Date("2024-01-15T00:00:00.000Z"),
				new Date("2024-01-20T00:00:00.000Z"),
				new Date("2024-01-25T00:00:00.000Z"),
			];

			const generatedArray = getNextAvailableDates({
				startDate,
				endDate,
				datesCount: 10,
				timeZone: "UTC",
				businessHours: [
					{ day: 1, startTime: "08:00", endTime: "20:00" },
					{ day: 1, startTime: "08:00", endTime: "20:00" },
				],
				preSaleDates,
			});

			const expectedArray = [
				new Date("2024-01-01T00:00:00.000Z"),
				new Date("2024-01-05T00:00:00.000Z"),
				new Date("2024-01-10T00:00:00.000Z"),
				new Date("2024-01-15T00:00:00.000Z"),
			];

			expect(generatedArray).toHaveLength(expectedArray.length);
			generatedArray.forEach((el, index) => {
				expect(el.getDate()).toBe(expectedArray[index].getDate());
				expect(el).toEqual(expect.any(Date));
				expect(el.getTime()).toBeLessThan(endDate.getTime());
			});
		});
	});

	describe("When passing 2025-10-29T02:00:00.000Z and timezone as America/New_York (fall back DST)", () => {
		it("should return 7 days starting from start date day in zone (no skip when isDaysCadence not set)", () => {
			const date = new Date("2025-10-29T02:00:00.000Z");

			const expectedArray = [
				new Date("2025-10-28T04:00:00.000Z"),
				new Date("2025-10-29T04:00:00.000Z"),
				new Date("2025-10-30T04:00:00.000Z"),
				new Date("2025-10-31T04:00:00.000Z"),
				new Date("2025-11-01T04:00:00.000Z"),
				new Date("2025-11-02T04:00:00.000Z"),
				new Date("2025-11-03T05:00:00.000Z"),
			];

			const generatedArray = getNextAvailableDates({
				startDate: date,
				datesCount: 7,
				timeZone: "America/New_York",
				businessHours: allDaysBusinessHours,
			});

			generatedArray.forEach((el, index) => {
				expect(el).toEqual(expectedArray[index]);
				expect(el).toEqual(expect.any(Date));
			});
		});
	});

	describe("with business hours override and endDate (pre-sale)", () => {
		describe("when endDate is passed (pre-sale)", () => {
			it("still excludes dates closed by business hours override", () => {
				const startDate = new Date("2024-01-01T00:00:00.000Z");
				const endDate = new Date("2024-01-07T23:59:59.999Z");
				const businessHoursOverrides = [
					{ month: 1, day: 2, startTime: null, endTime: null },
					{ month: 1, day: 3, startTime: null, endTime: null },
				];

				const result = getNextAvailableDates({
					startDate,
					endDate,
					datesCount: 7,
					timeZone: "UTC",
					businessHours: allDaysBusinessHours,
					businessHoursOverrides,
				});

				expect(result.map((d) => d.getUTCDate())).toEqual([1, 4, 5, 6, 7]);
				expect(result.length).toBe(5);
				const dates = result.map((d) => d.getUTCDate());
				expect(dates).not.toContain(2);
				expect(dates).not.toContain(3);
				result.forEach((el) => {
					expect(el).toEqual(expect.any(Date));
				});
			});
		});

		describe("when endDate is not passed", () => {
			it("excludes dates that are closed by business hours override", () => {
				const startDate = new Date("2024-01-01T00:00:00.000Z");
				const businessHoursOverrides = [
					{ month: 1, day: 2, startTime: null, endTime: null },
					{ month: 1, day: 3, startTime: null, endTime: null },
				];

				const result = getNextAvailableDates({
					startDate,
					datesCount: 7,
					timeZone: "UTC",
					businessHours: allDaysBusinessHours,
					businessHoursOverrides,
				});

				expect(result.map((d) => d.getUTCDate())).toEqual([
					1, 4, 5, 6, 7, 8, 9,
				]);
				const dates = result.map((d) => d.getUTCDate());
				expect(dates).not.toContain(2);
				expect(dates).not.toContain(3);
				result.forEach((el) => {
					expect(el).toEqual(expect.any(Date));
				});
			});
		});

		describe("when two days are closed in regular business hours (e.g. weekend)", () => {
			const weekdaysOnlyBusinessHours = [
				{ day: 1, startTime: "08:00", endTime: "20:00" },
				{ day: 2, startTime: "08:00", endTime: "20:00" },
				{ day: 3, startTime: "08:00", endTime: "20:00" },
				{ day: 4, startTime: "08:00", endTime: "20:00" },
				{ day: 5, startTime: "08:00", endTime: "20:00" },
			];

			it("with endDate and no override: includes days closed per regular hours (pre-sale)", () => {
				const startDate = new Date("2024-01-01T00:00:00.000Z");
				const endDate = new Date("2024-01-10T23:59:59.999Z");

				const result = getNextAvailableDates({
					startDate,
					endDate,
					datesCount: 10,
					timeZone: "UTC",
					businessHours: weekdaysOnlyBusinessHours,
					businessHoursOverrides: [],
				});

				expect(result.length).toBe(10);
				expect(result.map((d) => d.getUTCDate())).toEqual([
					1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
				]);
				expect(result.map((d) => d.getUTCDate())).toContain(6);
				expect(result.map((d) => d.getUTCDate())).toContain(7);
				result.forEach((el) => {
					expect(el).toEqual(expect.any(Date));
				});
			});

			it("with endDate: includes those days when override opens them", () => {
				const startDate = new Date("2024-01-01T00:00:00.000Z");
				const endDate = new Date("2024-01-10T23:59:59.999Z");
				const businessHoursOverrides = [
					{ month: 1, day: 6, startTime: "09:00", endTime: "17:00" },
					{ month: 1, day: 7, startTime: "09:00", endTime: "17:00" },
				];

				const result = getNextAvailableDates({
					startDate,
					endDate,
					datesCount: 10,
					timeZone: "UTC",
					businessHours: weekdaysOnlyBusinessHours,
					businessHoursOverrides,
				});

				expect(result.length).toBe(10);
				expect(result.map((d) => d.getUTCDate())).toEqual([
					1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
				]);
				result.forEach((el) => {
					expect(el).toEqual(expect.any(Date));
				});
			});

			it("without endDate: excludes those days when closed override is used", () => {
				const startDate = new Date("2024-01-01T00:00:00.000Z");
				const businessHoursOverrides = [
					{ month: 1, day: 6, startTime: null, endTime: null },
					{ month: 1, day: 7, startTime: null, endTime: null },
				];

				const result = getNextAvailableDates({
					startDate,
					datesCount: 7,
					timeZone: "UTC",
					businessHours: weekdaysOnlyBusinessHours,
					businessHoursOverrides,
				});

				expect(result.map((d) => d.getUTCDate())).toEqual([
					1, 2, 3, 4, 5, 8, 9,
				]);
				const dates = result.map((d) => d.getUTCDate());
				expect(dates).not.toContain(6);
				expect(dates).not.toContain(7);
				result.forEach((el) => {
					expect(el).toEqual(expect.any(Date));
				});
			});
		});
	});

	describe("UTC (consecutive midnights)", () => {
		const timeZone = "UTC";

		it("returns consecutive midnights at 00:00 UTC", () => {
			const startDate = new Date("2026-03-01T12:00:00.000Z");
			const result = getNextAvailableDates({
				startDate,
				timeZone,
				businessHours: allDaysBusinessHours,
				datesCount: 5,
			});
			expect(result).toHaveLength(5);
			expect(result[0].toISOString()).toBe("2026-03-01T00:00:00.000Z");
			expect(result[1].toISOString()).toBe("2026-03-02T00:00:00.000Z");
			expect(result[2].toISOString()).toBe("2026-03-03T00:00:00.000Z");
			expect(result[3].toISOString()).toBe("2026-03-04T00:00:00.000Z");
			expect(result[4].toISOString()).toBe("2026-03-05T00:00:00.000Z");
		});

		it("start of day is midnight UTC", () => {
			const startDate = new Date("2026-06-10T23:30:00.000Z");
			const result = getNextAvailableDates({
				startDate,
				timeZone,
				businessHours: allDaysBusinessHours,
				datesCount: 1,
			});
			expect(result).toHaveLength(1);
			expect(result[0].toISOString()).toBe("2026-06-10T00:00:00.000Z");
		});
	});

	describe("Asia/Karachi (no DST, UTC+5) - 2026", () => {
		const timeZone = "Asia/Karachi";

		it("returns requested number of consecutive midnights in Karachi", () => {
			const startDate = new Date("2026-03-04T12:00:00.000Z");
			const result = getNextAvailableDates({
				startDate,
				timeZone,
				businessHours: allDaysBusinessHours,
				datesCount: 5,
			});
			expect(result).toHaveLength(5);
			// Midnight Karachi = 19:00 UTC previous day
			expect(result[0].toISOString()).toBe("2026-03-03T19:00:00.000Z");
			expect(result[1].toISOString()).toBe("2026-03-04T19:00:00.000Z");
			expect(result[2].toISOString()).toBe("2026-03-05T19:00:00.000Z");
			expect(result[3].toISOString()).toBe("2026-03-06T19:00:00.000Z");
			expect(result[4].toISOString()).toBe("2026-03-07T19:00:00.000Z");
		});

		it("keeps same UTC hour across many days (no DST)", () => {
			const startDate = new Date("2026-06-15T10:00:00.000Z");
			const result = getNextAvailableDates({
				startDate,
				timeZone,
				businessHours: allDaysBusinessHours,
				datesCount: 7,
			});
			expect(result).toHaveLength(7);
			result.forEach((date, i) => {
				expect(date.toISOString()).toBe(
					new Date(Date.UTC(2026, 5, 14 + i, 19, 0, 0, 0)).toISOString(),
				);
			});
		});
	});

	describe("America/New_York (DST) - 2026", () => {
		const timeZone = "America/New_York";

		it("spring forward: consecutive midnights shift from 05:00 to 04:00 UTC after DST", () => {
			const startDate = new Date("2026-03-07T12:00:00.000Z");
			const result = getNextAvailableDates({
				startDate,
				timeZone,
				businessHours: allDaysBusinessHours,
				datesCount: 4,
			});
			expect(result).toHaveLength(4);
			expect(result[0].toISOString()).toBe("2026-03-07T05:00:00.000Z");
			expect(result[1].toISOString()).toBe("2026-03-08T05:00:00.000Z");
			expect(result[2].toISOString()).toBe("2026-03-09T04:00:00.000Z");
			expect(result[3].toISOString()).toBe("2026-03-10T04:00:00.000Z");
		});

		it("fall back: consecutive midnights shift from 04:00 to 05:00 UTC after DST ends", () => {
			const startDate = new Date("2026-10-31T12:00:00.000Z");
			const result = getNextAvailableDates({
				startDate,
				timeZone,
				businessHours: allDaysBusinessHours,
				datesCount: 4,
			});
			expect(result).toHaveLength(4);
			expect(result[0].toISOString()).toBe("2026-10-31T04:00:00.000Z");
			expect(result[1].toISOString()).toBe("2026-11-01T04:00:00.000Z");
			expect(result[2].toISOString()).toBe("2026-11-02T05:00:00.000Z");
			expect(result[3].toISOString()).toBe("2026-11-03T05:00:00.000Z");
		});

		it("winter: all midnights at 05:00 UTC (EST)", () => {
			const startDate = new Date("2026-01-15T12:00:00.000Z");
			const result = getNextAvailableDates({
				startDate,
				timeZone,
				businessHours: allDaysBusinessHours,
				datesCount: 3,
			});
			expect(result).toHaveLength(3);
			expect(result[0].toISOString()).toBe("2026-01-15T05:00:00.000Z");
			expect(result[1].toISOString()).toBe("2026-01-16T05:00:00.000Z");
			expect(result[2].toISOString()).toBe("2026-01-17T05:00:00.000Z");
		});

		it("summer: all midnights at 04:00 UTC (EDT)", () => {
			const startDate = new Date("2026-07-15T12:00:00.000Z");
			const result = getNextAvailableDates({
				startDate,
				timeZone,
				businessHours: allDaysBusinessHours,
				datesCount: 3,
			});
			expect(result).toHaveLength(3);
			expect(result[0].toISOString()).toBe("2026-07-15T04:00:00.000Z");
			expect(result[1].toISOString()).toBe("2026-07-16T04:00:00.000Z");
			expect(result[2].toISOString()).toBe("2026-07-17T04:00:00.000Z");
		});
	});

	describe("Australia/Sydney (DST southern hemisphere)", () => {
		const timeZone = "Australia/Sydney";

		it("DST end (April 5 2026 3am -> 2am): next midnight shifts from 13:00 to 14:00 UTC", () => {
			const startDate = new Date("2026-04-04T12:00:00.000Z");
			const result = getNextAvailableDates({
				startDate,
				timeZone,
				businessHours: allDaysBusinessHours,
				datesCount: 4,
			});
			expect(result).toHaveLength(4);
			expect(result[0].toISOString()).toBe("2026-04-03T13:00:00.000Z");
			expect(result[1].toISOString()).toBe("2026-04-04T13:00:00.000Z");
			expect(result[2].toISOString()).toBe("2026-04-05T14:00:00.000Z");
			expect(result[3].toISOString()).toBe("2026-04-06T14:00:00.000Z");
		});

		it("DST start (October 4 2026 2am -> 3am): next midnight shifts from 14:00 to 13:00 UTC", () => {
			const startDate = new Date("2026-10-03T12:00:00.000Z");
			const result = getNextAvailableDates({
				startDate,
				timeZone,
				businessHours: allDaysBusinessHours,
				datesCount: 4,
			});
			expect(result).toHaveLength(4);
			expect(result[0].toISOString()).toBe("2026-10-02T14:00:00.000Z");
			expect(result[1].toISOString()).toBe("2026-10-03T14:00:00.000Z");
			expect(result[2].toISOString()).toBe("2026-10-04T13:00:00.000Z");
			expect(result[3].toISOString()).toBe("2026-10-05T13:00:00.000Z");
		});

		it("summer (AEDT): midnights at 13:00 UTC", () => {
			const startDate = new Date("2026-01-20T12:00:00.000Z");
			const result = getNextAvailableDates({
				startDate,
				timeZone,
				businessHours: allDaysBusinessHours,
				datesCount: 3,
			});
			expect(result).toHaveLength(3);
			expect(result[0].toISOString()).toBe("2026-01-19T13:00:00.000Z");
			expect(result[1].toISOString()).toBe("2026-01-20T13:00:00.000Z");
			expect(result[2].toISOString()).toBe("2026-01-21T13:00:00.000Z");
		});

		it("winter (AEST): midnights at 14:00 UTC", () => {
			const startDate = new Date("2026-08-15T12:00:00.000Z");
			const result = getNextAvailableDates({
				startDate,
				timeZone,
				businessHours: allDaysBusinessHours,
				datesCount: 3,
			});
			expect(result).toHaveLength(3);
			expect(result[0].toISOString()).toBe("2026-08-14T14:00:00.000Z");
			expect(result[1].toISOString()).toBe("2026-08-15T14:00:00.000Z");
			expect(result[2].toISOString()).toBe("2026-08-16T14:00:00.000Z");
		});
	});

	describe("Edge cases (invalid, datesCount, cap, leap, year boundary)", () => {
		it("returns empty when startDate is invalid", () => {
			const result = getNextAvailableDates({
				startDate: new Date("invalid"),
				timeZone: "UTC",
				businessHours: allDaysBusinessHours,
				datesCount: 3,
			});
			expect(result).toEqual([]);
		});

		it("respects datesCount", () => {
			const result = getNextAvailableDates({
				startDate: new Date("2026-03-01T00:00:00.000Z"),
				timeZone: "UTC",
				businessHours: allDaysBusinessHours,
				datesCount: 1,
			});
			expect(result).toHaveLength(1);
			expect(result[0].toISOString()).toBe("2026-03-01T00:00:00.000Z");
		});

		it("returns empty when datesCount is 0", () => {
			const result = getNextAvailableDates({
				startDate: new Date("2026-03-01T00:00:00.000Z"),
				timeZone: "UTC",
				businessHours: allDaysBusinessHours,
				datesCount: 0,
			});
			expect(result).toEqual([]);
		});

		it("stops at endDate (inclusive of end date day)", () => {
			const startDate = new Date("2026-03-01T00:00:00.000Z");
			const endDate = new Date("2026-03-05T00:00:00.000Z");
			const result = getNextAvailableDates({
				startDate,
				timeZone: "UTC",
				businessHours: allDaysBusinessHours,
				datesCount: 10,
				endDate,
			});
			expect(result).toHaveLength(5);
			expect(result[0].toISOString()).toBe("2026-03-01T00:00:00.000Z");
			expect(result[4].toISOString()).toBe("2026-03-05T00:00:00.000Z");
		});

		it("caps at 61 iterations (maxRuns <= 60 allows 61 runs)", () => {
			const result = getNextAvailableDates({
				startDate: new Date("2026-03-01T00:00:00.000Z"),
				timeZone: "UTC",
				businessHours: allDaysBusinessHours,
				datesCount: 100,
			});
			expect(result.length).toBeLessThanOrEqual(61);
			expect(result.length).toBe(61);
			expect(result[result.length - 1].getTime()).toBeGreaterThan(
				result[0].getTime(),
			);
		});

		it("no duplicate calendar days in result (DST)", () => {
			const result = getNextAvailableDates({
				startDate: new Date("2026-03-07T12:00:00.000Z"),
				timeZone: "America/New_York",
				businessHours: allDaysBusinessHours,
				datesCount: 5,
			});
			expect(result).toHaveLength(5);
			const utcDates = result.map((d) => d.toISOString().slice(0, 10));
			expect([...new Set(utcDates)].length).toBe(result.length);
		});

		it("leap year: includes Feb 29", () => {
			const result = getNextAvailableDates({
				startDate: new Date("2024-02-28T12:00:00.000Z"),
				timeZone: "UTC",
				businessHours: allDaysBusinessHours,
				datesCount: 4,
			});
			expect(result).toHaveLength(4);
			expect(result[0].toISOString()).toBe("2024-02-28T00:00:00.000Z");
			expect(result[1].toISOString()).toBe("2024-02-29T00:00:00.000Z");
			expect(result[2].toISOString()).toBe("2024-03-01T00:00:00.000Z");
			expect(result[3].toISOString()).toBe("2024-03-02T00:00:00.000Z");
		});

		it("year boundary: Dec 31 and Jan 1", () => {
			const result = getNextAvailableDates({
				startDate: new Date("2026-12-30T12:00:00.000Z"),
				timeZone: "UTC",
				businessHours: allDaysBusinessHours,
				datesCount: 4,
			});
			expect(result).toHaveLength(4);
			expect(result[0].toISOString()).toBe("2026-12-30T00:00:00.000Z");
			expect(result[1].toISOString()).toBe("2026-12-31T00:00:00.000Z");
			expect(result[2].toISOString()).toBe("2027-01-01T00:00:00.000Z");
			expect(result[3].toISOString()).toBe("2027-01-02T00:00:00.000Z");
		});
	});

	describe("Business hours (empty and partial)", () => {
		it("empty businessHours: returns no days (no open hours so every day is skipped)", () => {
			const result = getNextAvailableDates({
				startDate: new Date("2026-03-01T00:00:00.000Z"),
				timeZone: "UTC",
				businessHours: [],
				datesCount: 3,
			});
			expect(result).toHaveLength(0);
		});

		it("partial businessHours (weekdays only) with no overrides: returns only weekdays", () => {
			const weekdaysOnly = [1, 2, 3, 4, 5].map((day) => ({
				day,
				startTime: "09:00",
				endTime: "17:00",
			}));
			const result = getNextAvailableDates({
				startDate: new Date("2026-03-07T12:00:00.000Z"),
				timeZone: "UTC",
				businessHours: weekdaysOnly,
				businessHoursOverrides: [],
				datesCount: 5,
			});
			expect(result).toHaveLength(5);
			// Mar 7 2026 is Saturday → first included day is Monday Mar 9
			expect(result[0].toISOString()).toBe("2026-03-09T00:00:00.000Z");
			expect(result[4].toISOString()).toBe("2026-03-13T00:00:00.000Z");
		});
	});

	describe("Karachi and NY DST (strict ISO expectations)", () => {
		it("Asia/Karachi: returns requested count, strictly increasing, no duplicate days", () => {
			const result = getNextAvailableDates({
				startDate: new Date("2026-03-04T12:00:00.000Z"),
				timeZone: "Asia/Karachi",
				businessHours: allDaysBusinessHours,
				datesCount: 5,
			});
			expect(result).toHaveLength(5);
			for (let i = 1; i < result.length; i++) {
				expect(result[i].getTime()).toBeGreaterThan(result[i - 1].getTime());
			}
			const dateStrings = result.map((d) => d.toISOString().slice(0, 10));
			expect([...new Set(dateStrings)].length).toBe(5);
		});

		it("Asia/Karachi: each date is midnight in store TZ (19:00 UTC)", () => {
			const result = getNextAvailableDates({
				startDate: new Date("2026-03-04T12:00:00.000Z"),
				timeZone: "Asia/Karachi",
				businessHours: allDaysBusinessHours,
				datesCount: 3,
			});
			expect(result).toHaveLength(3);
			expect(result[0].toISOString()).toBe("2026-03-03T19:00:00.000Z");
			expect(result[1].toISOString()).toBe("2026-03-04T19:00:00.000Z");
			expect(result[2].toISOString()).toBe("2026-03-05T19:00:00.000Z");
		});

		it("America/New_York DST spring: midnights shift 05:00 -> 04:00 UTC", () => {
			const result = getNextAvailableDates({
				startDate: new Date("2026-03-07T12:00:00.000Z"),
				timeZone: "America/New_York",
				businessHours: allDaysBusinessHours,
				datesCount: 3,
			});
			expect(result).toHaveLength(3);
			expect(result[0].toISOString()).toBe("2026-03-07T05:00:00.000Z");
			expect(result[1].toISOString()).toBe("2026-03-08T05:00:00.000Z");
			expect(result[2].toISOString()).toBe("2026-03-09T04:00:00.000Z");
		});
	});
});
