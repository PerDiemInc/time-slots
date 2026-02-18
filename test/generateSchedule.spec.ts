import { describe, expect, it } from "vitest";
import { generateSchedule } from "../src/schedule/generate";

const allDaysBusinessHours = [
	{ day: 0, startTime: "08:00", endTime: "20:00" },
	{ day: 1, startTime: "08:00", endTime: "20:00" },
	{ day: 2, startTime: "08:00", endTime: "20:00" },
	{ day: 3, startTime: "08:00", endTime: "20:00" },
	{ day: 4, startTime: "08:00", endTime: "20:00" },
	{ day: 5, startTime: "08:00", endTime: "20:00" },
	{ day: 6, startTime: "08:00", endTime: "20:00" },
];

const zeroPrepTimes: Record<number, number> = {
	0: 0,
	1: 0,
	2: 0,
	3: 0,
	4: 0,
	5: 0,
	6: 0,
};

describe("generateSchedule", () => {
	describe("When passing 2 dates 2024-01-01 and 2024-01-02 and timezone as UTC", () => {
		it("Should generate slots for those two dates", () => {
			const dates = [
				new Date("2024-01-01T00:00:00.000Z"),
				new Date("2024-01-02T00:00:00.000Z"),
			];

			const generatedSchedule = generateSchedule({
				currentDate: new Date("2024-01-01T00:00:00.000Z"),
				timeZone: "UTC",
				dates,
				businessHours: allDaysBusinessHours,
				gapInMinutes: 60,
				weekDayPrepTimes: zeroPrepTimes,
			});

			expect(generatedSchedule.length).toBe(2);

			for (const daySchedule of generatedSchedule) {
				expect(daySchedule.slots.length).toBe(13);
			}

			expect(generatedSchedule[0].slots[0]).toEqual(
				new Date("2024-01-01T08:00:00.000Z"),
			);
			expect(generatedSchedule[0].slots[12]).toEqual(
				new Date("2024-01-01T20:00:00.000Z"),
			);
			expect(generatedSchedule[1].slots[0]).toEqual(
				new Date("2024-01-02T08:00:00.000Z"),
			);
			expect(generatedSchedule[1].slots[12]).toEqual(
				new Date("2024-01-02T20:00:00.000Z"),
			);
		});
	});

	describe("When passing 1 date 2024-01-01 and timezone as UTC", () => {
		it("Should generate slots for the date", () => {
			const dates = [new Date("2024-01-01T00:00:00.000Z")];

			const generatedSchedule = generateSchedule({
				currentDate: new Date("2024-01-01T00:00:00.000Z"),
				timeZone: "UTC",
				dates,
				businessHours: allDaysBusinessHours,
				gapInMinutes: 60,
				weekDayPrepTimes: zeroPrepTimes,
			});

			expect(generatedSchedule.length).toBe(1);
			expect(generatedSchedule[0].slots.length).toBe(13);

			expect(generatedSchedule[0].slots[0]).toEqual(
				new Date("2024-01-01T08:00:00.000Z"),
			);
			expect(generatedSchedule[0].slots[12]).toEqual(
				new Date("2024-01-01T20:00:00.000Z"),
			);
		});
	});

	describe("When passing 1 date with two shifts and timezone as UTC", () => {
		it("Should generate slots for the date with shifts", () => {
			const dates = [new Date("2024-01-01T00:00:00.000Z")];
			const businessHours = [
				{ day: 0, startTime: "08:00", endTime: "20:00" },
				{ day: 1, startTime: "08:00", endTime: "10:00" },
				{ day: 1, startTime: "14:00", endTime: "20:00" },
				{ day: 2, startTime: "08:00", endTime: "20:00" },
				{ day: 3, startTime: "08:00", endTime: "20:00" },
				{ day: 4, startTime: "08:00", endTime: "20:00" },
				{ day: 5, startTime: "08:00", endTime: "20:00" },
				{ day: 6, startTime: "08:00", endTime: "20:00" },
			];

			const generatedSchedule = generateSchedule({
				currentDate: new Date("2024-01-01T08:00:00.000Z"),
				timeZone: "UTC",
				dates,
				businessHours,
				gapInMinutes: 60,
				weekDayPrepTimes: zeroPrepTimes,
			});

			expect(generatedSchedule.length).toBe(1);
			expect(generatedSchedule[0].slots.length).toBe(10);

			expect(generatedSchedule[0].slots).toEqual([
				new Date("2024-01-01T08:00:00.000Z"),
				new Date("2024-01-01T09:00:00.000Z"),
				new Date("2024-01-01T10:00:00.000Z"),
				new Date("2024-01-01T14:00:00.000Z"),
				new Date("2024-01-01T15:00:00.000Z"),
				new Date("2024-01-01T16:00:00.000Z"),
				new Date("2024-01-01T17:00:00.000Z"),
				new Date("2024-01-01T18:00:00.000Z"),
				new Date("2024-01-01T19:00:00.000Z"),
				new Date("2024-01-01T20:00:00.000Z"),
			]);
		});
	});
});
