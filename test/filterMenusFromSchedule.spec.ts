import { describe, expect, it } from "vitest";
import { filterMenusFromSchedule } from "../src/utils/schedule-filter";

describe("filterMenusFromSchedule", () => {
	describe("when menus are available", () => {
		it("should filter slots based on menu schedules", () => {
			const schedule = [
				{
					date: new Date("2023-09-15T00:00:00.000Z"),
					slots: [
						new Date("2023-09-15T08:00:00.000Z"),
						new Date("2023-09-15T09:00:00.000Z"),
						new Date("2023-09-15T10:00:00.000Z"),
						new Date("2023-09-15T11:00:00.000Z"),
						new Date("2023-09-15T12:00:00.000Z"),
					],
				},
			];

			const menus = [
				{
					menu_id: "1",
					times: {
						"5": {
							all_day: false,
							start_time: "07:00",
							end_time: "10:00",
						},
					},
				},
			];

			const result = filterMenusFromSchedule({
				schedule,
				menus,
				timeZone: "America/New_York",
			});

			expect(result.length).toBe(1);
			expect(result[0].slots.length).toBe(2);
		});

		it("should show all slots when menu is configured for all day", () => {
			const schedule = [
				{
					date: new Date("2023-09-15T00:00:00.000Z"),
					slots: [
						new Date("2023-09-15T08:00:00.000Z"),
						new Date("2023-09-15T09:00:00.000Z"),
						new Date("2023-09-15T10:00:00.000Z"),
					],
				},
			];

			const menus = [
				{
					menu_id: "1",
					times: {
						"5": {
							all_day: true,
						},
					},
				},
			];

			const result = filterMenusFromSchedule({
				schedule,
				menus,
				timeZone: "America/New_York",
			});

			expect(result.length).toBe(1);
			expect(result[0].slots.length).toBe(3);
		});
	});

	describe("when no menus are available", () => {
		it("should return all slots", () => {
			const schedule = [
				{
					date: new Date("2023-09-15T00:00:00.000Z"),
					slots: [
						new Date("2023-09-15T08:00:00.000Z"),
						new Date("2023-09-15T09:00:00.000Z"),
					],
				},
			];

			const result = filterMenusFromSchedule({
				schedule,
				menus: [],
				timeZone: "America/New_York",
			});

			expect(result.length).toBe(1);
			expect(result[0].slots.length).toBe(2);
		});
	});

	describe("when menu is configured for different day", () => {
		it("should hide all slots", () => {
			const schedule = [
				{
					date: new Date("2023-09-15T00:00:00.000Z"),
					slots: [
						new Date("2023-09-15T08:00:00.000Z"),
						new Date("2023-09-15T09:00:00.000Z"),
					],
				},
			];

			const menus = [
				{
					menu_id: "1",
					times: {
						"6": {
							all_day: true,
						},
					},
				},
			];

			const result = filterMenusFromSchedule({
				schedule,
				menus,
				timeZone: "America/New_York",
			});

			expect(result.length).toBe(0);
		});
	});
});
