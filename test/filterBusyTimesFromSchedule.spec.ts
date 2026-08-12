import { describe, expect, it } from "vitest";

import type { BusyTimeItem, FulfillmentSchedule } from "../src/types";
import { filterBusyTimesFromSchedule } from "../src/utils/schedule-filter";

const slotAt = (time: string) => new Date(`2026-08-11T${time}:00Z`);

const daySchedule = (slots: Date[]) =>
	({
		date: slotAt("00:00"),
		originalStoreOpeningTime: slotAt("09:00"),
		originalStoreClosingTime: slotAt("17:00"),
		remainingShifts: 1,
		openingTime: slots[0],
		closingTime: slots[slots.length - 1],
		firstAvailableSlot: slots[0],
		slots,
	}) as unknown as FulfillmentSchedule[number];

const schedule = [
	daySchedule([
		slotAt("10:00"),
		slotAt("10:15"),
		slotAt("10:30"),
		slotAt("10:45"),
	]),
];

const busy = (
	startTime: string,
	endTime: string,
	extra: Partial<BusyTimeItem> = {},
): BusyTimeItem => ({
	startTime: `2026-08-11T${startTime}:00Z`,
	endTime: `2026-08-11T${endTime}:00Z`,
	...extra,
});

describe("filterBusyTimesFromSchedule", () => {
	it("returns the schedule untouched when there are no busy times", () => {
		expect(filterBusyTimesFromSchedule({ schedule, busyTimes: [] })).toEqual(
			schedule,
		);
	});

	it("drops the busy slots and re-derives the day's boundaries", () => {
		const [day] = filterBusyTimesFromSchedule({
			schedule,
			busyTimes: [busy("10:10", "10:35")],
		});

		expect(day.slots).toEqual([slotAt("10:00"), slotAt("10:45")]);
		expect(day.openingTime).toEqual(slotAt("10:00"));
		expect(day.closingTime).toEqual(slotAt("10:45"));
		expect(day.firstAvailableSlot).toEqual(slotAt("10:00"));
	});

	it("treats a busy window as exclusive of its start and inclusive of its end", () => {
		const [day] = filterBusyTimesFromSchedule({
			schedule,
			busyTimes: [busy("10:00", "10:30")],
		});

		expect(day.slots).toEqual([slotAt("10:00"), slotAt("10:45")]);
	});

	it("drops a day once every slot in it is busy", () => {
		expect(
			filterBusyTimesFromSchedule({
				schedule,
				busyTimes: [busy("09:00", "17:00")],
			}),
		).toEqual([]);
	});

	it("leaves a category-scoped window alone when the cart cannot trigger it", () => {
		const busyTimes = [
			busy("09:00", "17:00", { threshold: { categoryIds: ["drinks"] } }),
		];

		expect(filterBusyTimesFromSchedule({ schedule, busyTimes })).toEqual(
			schedule,
		);
		expect(
			filterBusyTimesFromSchedule({
				schedule,
				busyTimes,
				cartCategoryIds: ["food"],
			}),
		).toEqual(schedule);
	});

	it("applies a category-scoped window when the cart carries that category", () => {
		expect(
			filterBusyTimesFromSchedule({
				schedule,
				busyTimes: [
					busy("09:00", "17:00", { threshold: { categoryIds: ["drinks"] } }),
				],
				cartCategoryIds: ["food", "drinks"],
			}),
		).toEqual([]);
	});

	describe("with malformed input", () => {
		it("returns an empty schedule for anything that is not one", () => {
			for (const value of [null, undefined, "schedule", 7]) {
				expect(
					filterBusyTimesFromSchedule({
						schedule: value as unknown as FulfillmentSchedule,
						busyTimes: [busy("10:10", "10:35")],
					}),
				).toEqual([]);
			}
		});

		it("returns the schedule when the busy times are not a list", () => {
			for (const value of [null, undefined, "busy"]) {
				expect(
					filterBusyTimesFromSchedule({
						schedule,
						busyTimes: value as unknown as BusyTimeItem[],
					}),
				).toEqual(schedule);
			}
		});

		it("ignores windows it cannot read a time from", () => {
			const [day] = filterBusyTimesFromSchedule({
				schedule,
				busyTimes: [
					null,
					{},
					{ startTime: "nonsense", endTime: "also nonsense" },
					busy("10:10", "10:35"),
				] as unknown as BusyTimeItem[],
			});

			expect(day.slots).toEqual([slotAt("10:00"), slotAt("10:45")]);
		});

		it("keeps a slot it cannot read a time from rather than calling it busy", () => {
			const withBadSlot = [
				daySchedule([new Date("nonsense"), slotAt("10:15"), slotAt("10:45")]),
			];

			const [day] = filterBusyTimesFromSchedule({
				schedule: withBadSlot,
				busyTimes: [busy("10:10", "10:35")],
			});

			expect(day.slots).toHaveLength(2);
			expect(day.slots[1]).toEqual(slotAt("10:45"));
		});

		it("drops days whose slots are missing or malformed", () => {
			const brokenSchedule = [
				null,
				{ slots: "10:00" },
				{ slots: [] },
			] as unknown as FulfillmentSchedule;

			expect(() =>
				filterBusyTimesFromSchedule({
					schedule: brokenSchedule,
					busyTimes: [busy("10:10", "10:35")],
				}),
			).not.toThrow();
			expect(
				filterBusyTimesFromSchedule({
					schedule: brokenSchedule,
					busyTimes: [busy("10:10", "10:35")],
				}),
			).toEqual([]);
		});
	});
});
