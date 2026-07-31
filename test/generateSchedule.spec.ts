import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PREP_TIME_CADENCE } from "../src/constants";
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
				prepTimeFrequency: 0,
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
				prepTimeFrequency: 0,
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
				prepTimeFrequency: 0,
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

	describe("When today's order lands past the closing buffer but before the raw close", () => {
		// Store 08:00–20:00, closing buffer 30 → last-order time is 19:30.
		const closingBufferParams = {
			timeZone: "UTC",
			businessHours: allDaysBusinessHours,
			gapInMinutes: 15,
			prepTimeCadence: PREP_TIME_CADENCE.MINUTE,
			prepTimeFrequency: 30,
			closingBuffer: 30,
		};

		beforeEach(() => {
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		function generateAt(now: Date, overrides = {}) {
			vi.setSystemTime(now);
			const today = new Date(now);
			today.setUTCHours(0, 0, 0, 0);
			return generateSchedule({
				...closingBufferParams,
				currentDate: now,
				dates: [today],
				...overrides,
			});
		}

		it("Should offer a single ASAP slot at now + prep when now is before the last-order time", () => {
			const schedule = generateAt(new Date("2025-01-06T19:29:00.000Z"));

			expect(schedule.length).toBe(1);
			expect(schedule[0].slots).toEqual([
				new Date("2025-01-06T19:59:00.000Z"),
			]);
		});

		it("Should offer the ASAP slot when now + prep lands exactly at the raw close", () => {
			const schedule = generateAt(new Date("2025-01-06T19:30:00.000Z"));

			expect(schedule.length).toBe(1);
			expect(schedule[0].slots).toEqual([
				new Date("2025-01-06T20:00:00.000Z"),
			]);
		});

		it("Should return no slots when now is past the last-order time", () => {
			const schedule = generateAt(new Date("2025-01-06T19:31:00.000Z"));

			expect(schedule.length).toBe(0);
		});

		it("Should return no slots when now + prep lands past the raw close", () => {
			const schedule = generateAt(new Date("2025-01-06T19:29:00.000Z"), {
				prepTimeFrequency: 45,
			});

			expect(schedule.length).toBe(0);
		});

		it("Should keep normal buffered slots when now + prep is before the buffered close", () => {
			const schedule = generateAt(new Date("2025-01-06T18:55:00.000Z"));

			expect(schedule.length).toBe(1);
			const slots = schedule[0].slots;
			expect(slots[0]).toEqual(new Date("2025-01-06T19:25:00.000Z"));
			expect(slots[slots.length - 1]).toEqual(
				new Date("2025-01-06T19:30:00.000Z"),
			);
		});

		it("Should offer only the ASAP slot, no grid slots inside the buffer window", () => {
			// 19:10 + 30 prep = 19:40 — past the 19:30 buffered close. The grid
			// slots at 19:15 / 19:30 can't satisfy prep, so only 19:40 is offered.
			const schedule = generateAt(new Date("2025-01-06T19:10:00.000Z"));

			expect(schedule.length).toBe(1);
			expect(schedule[0].slots).toEqual([
				new Date("2025-01-06T19:40:00.000Z"),
			]);
		});

		it("Should count delivery minutes toward the raw-close cutoff", () => {
			// 19:25 + 20 prep + 15 delivery = 20:00 — exactly at close, allowed
			const schedule = generateAt(new Date("2025-01-06T19:25:00.000Z"), {
				prepTimeFrequency: 20,
				estimatedDeliveryMinutes: 15,
			});

			expect(schedule.length).toBe(1);
			expect(schedule[0].slots).toEqual([
				new Date("2025-01-06T20:00:00.000Z"),
			]);
		});

		it("Should return no slots when prep + delivery lands past the raw close", () => {
			// 19:29 + 20 prep + 15 delivery = 20:04 > 20:00
			const schedule = generateAt(new Date("2025-01-06T19:29:00.000Z"), {
				prepTimeFrequency: 20,
				estimatedDeliveryMinutes: 15,
			});

			expect(schedule.length).toBe(0);
		});

		it("Should not extend past the raw close when closingBuffer is 0", () => {
			// With no buffer the last-order gate IS the close: 19:45 + 30 = 20:15 > 20:00
			const schedule = generateAt(new Date("2025-01-06T19:45:00.000Z"), {
				closingBuffer: 0,
			});

			expect(schedule.length).toBe(0);
		});

		it("Should keep normal behavior with closingBuffer 0 when now + prep fits", () => {
			const schedule = generateAt(new Date("2025-01-06T19:29:00.000Z"), {
				closingBuffer: 0,
			});

			expect(schedule.length).toBe(1);
			expect(schedule[0].slots).toEqual([
				new Date("2025-01-06T19:59:00.000Z"),
				new Date("2025-01-06T20:00:00.000Z"),
			]);
		});

		it("Should not extend past the buffered close when there is no prep time", () => {
			// Only now + prep may spill past the buffer; with prep 0 the buffered
			// close stays a hard cutoff.
			const schedule = generateAt(new Date("2025-01-06T19:31:00.000Z"), {
				prepTimeFrequency: 0,
			});

			expect(schedule.length).toBe(0);
		});

		it("Should still cap scheduled slots at the buffered close when prep fits", () => {
			const schedule = generateAt(new Date("2025-01-06T19:29:00.000Z"), {
				prepTimeFrequency: 0,
			});

			expect(schedule.length).toBe(1);
			expect(schedule[0].slots).toEqual([
				new Date("2025-01-06T19:29:00.000Z"),
				new Date("2025-01-06T19:30:00.000Z"),
			]);
		});

		it("Should apply the rule in the store's timezone", () => {
			// 7:29 PM EST on Jan 6 = 00:29 UTC Jan 7; store hours are local
			const now = new Date("2025-01-07T00:29:00.000Z");
			vi.setSystemTime(now);
			const schedule = generateSchedule({
				...closingBufferParams,
				timeZone: "America/New_York",
				currentDate: now,
				dates: [new Date("2025-01-06T05:00:00.000Z")],
			});

			expect(schedule.length).toBe(1);
			expect(schedule[0].slots).toEqual([
				new Date("2025-01-07T00:59:00.000Z"),
			]);
		});

		describe("on a multi-shift day (08:00–12:00 and 14:00–20:00)", () => {
			const twoShiftHours = [0, 1, 2, 3, 4, 5, 6].flatMap((day) => [
				{ day, startTime: "08:00", endTime: "12:00" },
				{ day, startTime: "14:00", endTime: "20:00" },
			]);

			it("Should offer the ASAP slot in the last shift via prep rollover", () => {
				const schedule = generateAt(new Date("2025-01-06T19:29:00.000Z"), {
					businessHours: twoShiftHours,
				});

				expect(schedule.length).toBe(1);
				expect(schedule[0].slots).toEqual([
					new Date("2025-01-06T19:59:00.000Z"),
				]);
			});

			it("Should return no slots when now is past the last-order time", () => {
				const schedule = generateAt(new Date("2025-01-06T19:31:00.000Z"), {
					businessHours: twoShiftHours,
				});

				expect(schedule.length).toBe(0);
			});

			it("Should return no slots when now + prep lands past the raw close", () => {
				const schedule = generateAt(new Date("2025-01-06T19:29:00.000Z"), {
					businessHours: twoShiftHours,
					prepTimeFrequency: 45,
				});

				expect(schedule.length).toBe(0);
			});

			it("Should not apply the carve-out to a non-last shift", () => {
				// 11:50 + 30 prep overshoots the first shift's 12:00 end; the first
				// shift has no closing buffer, so it just rolls into the next shift.
				const schedule = generateAt(new Date("2025-01-06T11:50:00.000Z"), {
					businessHours: twoShiftHours,
				});

				expect(schedule.length).toBe(1);
				const slots = schedule[0].slots;
				expect(slots[0]).toEqual(new Date("2025-01-06T14:00:00.000Z"));
				expect(slots[slots.length - 1]).toEqual(
					new Date("2025-01-06T19:30:00.000Z"),
				);
			});

			it("Should roll prep into the next shift during a break without touching the buffer", () => {
				// 13:50 + 30 prep = 14:20, inside the second shift's normal window
				const schedule = generateAt(new Date("2025-01-06T13:50:00.000Z"), {
					businessHours: twoShiftHours,
				});

				expect(schedule.length).toBe(1);
				const slots = schedule[0].slots;
				expect(slots[0]).toEqual(new Date("2025-01-06T14:20:00.000Z"));
				expect(slots[slots.length - 1]).toEqual(
					new Date("2025-01-06T19:30:00.000Z"),
				);
			});
		});
	});
});
