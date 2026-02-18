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
		it("should skip Sep 28 (past closing in Halifax) and return next 7 days", () => {
			const date = new Date("2023-09-29T02:00:00.000Z");

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
		it("should skip Sep 27 (past closing in Karachi) and return next 7 days", () => {
			const date = new Date("2023-09-27T18:00:00.000Z");

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

	describe("When passing 2025-03-09T04:00:00.000Z that is previous day in New York (8th of March) and timezone as America/New_York", () => {
		it("should skip Mar 8 (past closing in NY) and return next 7 days across DST", () => {
			const date = new Date("2025-03-09T04:00:00.000Z");

			const expectedArray = [
				new Date("2025-03-09T05:00:00.000Z"),
				new Date("2025-03-10T04:00:00.000Z"),
				new Date("2025-03-11T04:00:00.000Z"),
				new Date("2025-03-12T04:00:00.000Z"),
				new Date("2025-03-13T04:00:00.000Z"),
				new Date("2025-03-14T04:00:00.000Z"),
				new Date("2025-03-15T04:00:00.000Z"),
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
		it("should include Feb 9 for start times before closing (01:00Z), skip it after", () => {
			const includedExpected = [
				new Date("2025-02-09T05:00:00.000Z"),
				new Date("2025-02-10T05:00:00.000Z"),
				new Date("2025-02-11T05:00:00.000Z"),
				new Date("2025-02-12T05:00:00.000Z"),
				new Date("2025-02-13T05:00:00.000Z"),
				new Date("2025-02-14T05:00:00.000Z"),
				new Date("2025-02-15T05:00:00.000Z"),
			];

			const skippedExpected = [
				new Date("2025-02-10T05:00:00.000Z"),
				new Date("2025-02-11T05:00:00.000Z"),
				new Date("2025-02-12T05:00:00.000Z"),
				new Date("2025-02-13T05:00:00.000Z"),
				new Date("2025-02-14T05:00:00.000Z"),
				new Date("2025-02-15T05:00:00.000Z"),
				new Date("2025-02-16T05:00:00.000Z"),
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
					expect(el).toEqual(skippedExpected[index]);
					expect(el).toEqual(expect.any(Date));
				});
			}
		});
	});

	describe("When passing 2025-03-09T05:00:00.000Z through 2025-03-10T03:00:00.000Z and timezone as America/New_York (DST transition)", () => {
		it("should include Mar 9 only for pre-DST start times (05:00Z-06:00Z), skip it once EDT kicks in", () => {
			const includedExpected = [
				new Date("2025-03-09T05:00:00.000Z"),
				new Date("2025-03-10T04:00:00.000Z"),
				new Date("2025-03-11T04:00:00.000Z"),
				new Date("2025-03-12T04:00:00.000Z"),
				new Date("2025-03-13T04:00:00.000Z"),
				new Date("2025-03-14T04:00:00.000Z"),
				new Date("2025-03-15T04:00:00.000Z"),
			];

			const skippedExpected = [
				new Date("2025-03-10T04:00:00.000Z"),
				new Date("2025-03-11T04:00:00.000Z"),
				new Date("2025-03-12T04:00:00.000Z"),
				new Date("2025-03-13T04:00:00.000Z"),
				new Date("2025-03-14T04:00:00.000Z"),
				new Date("2025-03-15T04:00:00.000Z"),
				new Date("2025-03-16T04:00:00.000Z"),
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
					expect(el).toEqual(includedExpected[index]);
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
					expect(el).toEqual(skippedExpected[index]);
					expect(el).toEqual(expect.any(Date));
				});
			}
		});
	});

	describe("When passing 2023-09-27T18:00:00.000Z date with closed business hours overrides", () => {
		it("should skip Sep 27 (past closing) and Sep 28, Oct 1 (overrides) then return next 7 dates", () => {
			const date = new Date("2023-09-27T18:00:00.000Z");

			const expectedArray = [
				new Date("2023-09-28T19:00:00.000Z"),
				new Date("2023-09-29T19:00:00.000Z"),
				new Date("2023-10-01T19:00:00.000Z"),
				new Date("2023-10-02T19:00:00.000Z"),
				new Date("2023-10-03T19:00:00.000Z"),
				new Date("2023-10-04T19:00:00.000Z"),
				new Date("2023-10-05T19:00:00.000Z"),
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
			const preSaleDates = [1, 5, 10, 15];

			const generatedArray = getNextAvailableDates({
				startDate: date,
				datesCount: 7,
				timeZone: "UTC",
				businessHours: allDaysBusinessHours,
				preSaleDates,
				presalePickupWeekDays: [1, 3, 5],
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
			const preSaleDates = [31];

			const generatedArray = getNextAvailableDates({
				startDate: date,
				datesCount: 7,
				timeZone: "UTC",
				businessHours: [{ day: 0, startTime: "08:00", endTime: "20:00" }],
				preSaleDates,
				presalePickupWeekDays: [1],
			});

			expect(generatedArray).toHaveLength(0);
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
			const preSaleDates = [1, 5, 10, 15, 20, 25];

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
				presalePickupWeekDays: [1],
			});

			const expectedArray = [
				new Date("2024-01-01T00:00:00.000Z"),
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
		it("should skip Oct 28 (past closing in NY) and return next 7 days across DST fall-back", () => {
			const date = new Date("2025-10-29T02:00:00.000Z");

			const expectedArray = [
				new Date("2025-10-29T04:00:00.000Z"),
				new Date("2025-10-30T04:00:00.000Z"),
				new Date("2025-10-31T04:00:00.000Z"),
				new Date("2025-11-01T04:00:00.000Z"),
				new Date("2025-11-02T04:00:00.000Z"),
				new Date("2025-11-03T05:00:00.000Z"),
				new Date("2025-11-04T05:00:00.000Z"),
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
});
