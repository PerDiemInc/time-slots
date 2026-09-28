import { describe, expect, it } from "vitest";

import type { BusyTimeItem, LocationLike } from "../src/types";
import {
	getApplicableBusyTimes,
	getFirstUnblockedTime,
	mergeBusyRanges,
} from "../src/utils/busy-times";
import { getNextOrderableWindow } from "../src/utils/orderable-window";

// 2026-08-11 is a Tuesday; the location keeps 09:00–21:00 UTC every day.
const TUESDAY_AFTERNOON = new Date("2026-08-11T16:00:00Z").getTime();
const TUESDAY_CLOSE = "2026-08-11T21:00:00.000Z";
const WEDNESDAY_OPEN = "2026-08-12T09:00:00.000Z";
const THURSDAY_OPEN = "2026-08-13T09:00:00.000Z";

const location = {
	location_id: "loc-1",
	timezone: "UTC",
	pickup_hours: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
		day,
		start_time: "09:00",
		end_time: "21:00",
	})),
	delivery_hours: [],
} as unknown as LocationLike;

const busy = (
	startTime: string,
	endTime: string,
	extra: Partial<BusyTimeItem> = {},
): BusyTimeItem => ({ startTime, endTime, ...extra });

const nextWindow = (overrides: Record<string, unknown> = {}) =>
	getNextOrderableWindow({
		location,
		fulfillmentPreference: "PICKUP",
		businessHoursOverrides: {},
		now: TUESDAY_AFTERNOON,
		...overrides,
	});

describe("getApplicableBusyTimes", () => {
	it("keeps windows that are not scoped to categories", () => {
		const busyTimes = [busy("2026-08-11T17:00:00Z", "2026-08-11T18:00:00Z")];

		expect(getApplicableBusyTimes({ busyTimes })).toEqual(busyTimes);
	});

	it("keeps a scoped window only when the cart carries one of its categories", () => {
		const busyTimes = [
			busy("2026-08-11T17:00:00Z", "2026-08-11T18:00:00Z", {
				threshold: { categoryIds: ["drinks"] },
			}),
		];

		expect(getApplicableBusyTimes({ busyTimes })).toEqual([]);
		expect(
			getApplicableBusyTimes({ busyTimes, cartCategoryIds: ["food"] }),
		).toEqual([]);
		expect(
			getApplicableBusyTimes({ busyTimes, cartCategoryIds: ["drinks"] }),
		).toEqual(busyTimes);
	});
});

describe("mergeBusyRanges", () => {
	it("merges overlapping and adjacent windows", () => {
		const ranges = mergeBusyRanges([
			busy("2026-08-11T18:00:00Z", "2026-08-11T19:00:00Z"),
			busy("2026-08-11T17:00:00Z", "2026-08-11T18:00:00Z"),
			busy("2026-08-11T20:00:00Z", "2026-08-11T21:00:00Z"),
		]);

		expect(ranges).toEqual([
			[
				new Date("2026-08-11T17:00:00Z").getTime(),
				new Date("2026-08-11T19:00:00Z").getTime(),
			],
			[
				new Date("2026-08-11T20:00:00Z").getTime(),
				new Date("2026-08-11T21:00:00Z").getTime(),
			],
		]);
	});

	it("drops malformed and zero-length windows", () => {
		expect(
			mergeBusyRanges([
				busy("nonsense", "2026-08-11T21:00:00Z"),
				busy("2026-08-11T21:00:00Z", "2026-08-11T21:00:00Z"),
				busy("2026-08-11T22:00:00Z", "2026-08-11T21:00:00Z"),
			]),
		).toEqual([]);
	});
});

describe("getFirstUnblockedTime", () => {
	const busyRanges: [number, number][] = [
		[100, 200],
		[300, 400],
	];

	it("returns the instant itself when nothing covers it", () => {
		expect(getFirstUnblockedTime({ from: 50, busyRanges })).toBe(50);
		expect(getFirstUnblockedTime({ from: 200, busyRanges })).toBe(200);
		expect(getFirstUnblockedTime({ from: 250, busyRanges })).toBe(250);
	});

	it("jumps to the end of the window covering it", () => {
		expect(getFirstUnblockedTime({ from: 100, busyRanges })).toBe(200);
		expect(getFirstUnblockedTime({ from: 150, busyRanges })).toBe(200);
		expect(getFirstUnblockedTime({ from: 350, busyRanges })).toBe(400);
	});

	it("returns the instant when there are no windows", () => {
		expect(getFirstUnblockedTime({ from: 150, busyRanges: [] })).toBe(150);
		expect(getFirstUnblockedTime({ from: 150 })).toBe(150);
	});
});

describe("busy-time helpers with malformed input", () => {
	it("treats anything that is not an array of windows as no windows", () => {
		const notArrays = [null, undefined, "busy", 42, {}];

		for (const value of notArrays) {
			expect(
				getApplicableBusyTimes({
					busyTimes: value as unknown as BusyTimeItem[],
				}),
			).toEqual([]);
			expect(mergeBusyRanges(value as unknown as BusyTimeItem[])).toEqual([]);
		}
	});

	it("survives holes and junk inside the windows array", () => {
		const busyTimes = [
			null,
			undefined,
			"nonsense",
			{},
			{ startTime: null, endTime: null },
			busy("2026-08-11T17:00:00Z", "2026-08-11T18:00:00Z"),
		] as unknown as BusyTimeItem[];

		// unscoped entries are kept, then only the parseable one survives merging
		expect(() => getApplicableBusyTimes({ busyTimes })).not.toThrow();
		expect(mergeBusyRanges(getApplicableBusyTimes({ busyTimes }))).toEqual([
			[
				new Date("2026-08-11T17:00:00Z").getTime(),
				new Date("2026-08-11T18:00:00Z").getTime(),
			],
		]);
	});

	it("handles a threshold with no usable category ids", () => {
		const busyTimes = [
			busy("2026-08-11T17:00:00Z", "2026-08-11T18:00:00Z", {
				threshold: {},
			}),
			busy("2026-08-11T19:00:00Z", "2026-08-11T20:00:00Z", {
				threshold: { categoryIds: [] },
			}),
		];

		// nothing to scope by, so both apply to every order
		expect(getApplicableBusyTimes({ busyTimes })).toEqual(busyTimes);
	});

	it("ignores junk in the cart category list", () => {
		const busyTimes = [
			busy("2026-08-11T17:00:00Z", "2026-08-11T18:00:00Z", {
				threshold: { categoryIds: ["drinks"] },
			}),
		];

		expect(
			getApplicableBusyTimes({
				busyTimes,
				cartCategoryIds: [
					null,
					"",
					undefined,
					"drinks",
					"drinks",
				] as unknown as string[],
			}),
		).toEqual(busyTimes);
	});

	it("ignores a cart category list that is not a list", () => {
		const busyTimes = [
			busy("2026-08-11T17:00:00Z", "2026-08-11T18:00:00Z", {
				threshold: { categoryIds: ["drinks"] },
			}),
		];

		expect(
			getApplicableBusyTimes({
				busyTimes,
				cartCategoryIds: "drinks" as unknown as string[],
			}),
		).toEqual([]);
	});

	it("does not blow up on a missing or malformed range list", () => {
		expect(
			getFirstUnblockedTime({
				from: 100,
				busyRanges: null as unknown as [number, number][],
			}),
		).toBe(100);
		expect(getFirstUnblockedTime({ from: 100 })).toBe(100);
	});
});

describe("getNextOrderableWindow", () => {
	describe("with no blocked slots", () => {
		it("returns today's window and where it sits in the day", () => {
			const window = nextWindow();

			expect(window?.closingTime.toISOString()).toBe(TUESDAY_CLOSE);
			expect(window?.isFirstShift).toBe(true);
			expect(window?.isLastShift).toBe(true);
		});

		it("pulls the closing time back by the closing buffer", () => {
			expect(nextWindow({ closingBuffer: 45 })?.closingTime.toISOString()).toBe(
				"2026-08-11T20:15:00.000Z",
			);
		});

		it("pushes the opening time out by the opening buffer", () => {
			const window = nextWindow({
				now: new Date("2026-08-11T06:00:00Z").getTime(),
				openingBuffer: 15,
			});

			expect(window?.openingTime.toISOString()).toBe(
				"2026-08-11T09:15:00.000Z",
			);
		});

		it("moves to tomorrow once the closing buffer has passed today's cutoff", () => {
			const window = nextWindow({
				now: new Date("2026-08-11T20:55:00Z").getTime(),
				closingBuffer: 45,
			});

			expect(window?.openingTime.toISOString()).toBe(WEDNESDAY_OPEN);
		});
	});

	describe("when slots are blocked", () => {
		it("keeps today's window when only part of the day is blocked", () => {
			const window = nextWindow({
				busyTimes: [busy("2026-08-11T16:00:00Z", "2026-08-11T18:00:00Z")],
			});

			expect(window?.closingTime.toISOString()).toBe(TUESDAY_CLOSE);
		});

		it("starts ordering after a block covering the front of the day", () => {
			const window = nextWindow({
				now: new Date("2026-08-11T10:00:00Z").getTime(),
				busyTimes: [busy("2026-08-11T09:00:00Z", "2026-08-11T13:00:00Z")],
			});

			// still open until close, but nothing can be ordered before 13:00
			expect(window?.openingTime.toISOString()).toBe(
				"2026-08-11T13:00:00.000Z",
			);
			expect(window?.closingTime.toISOString()).toBe(TUESDAY_CLOSE);
		});

		it("leaves the opening time alone for a block in the middle of the day", () => {
			const window = nextWindow({
				now: new Date("2026-08-11T10:00:00Z").getTime(),
				busyTimes: [busy("2026-08-11T14:00:00Z", "2026-08-11T16:00:00Z")],
			});

			expect(window?.openingTime.toISOString()).toBe(
				"2026-08-11T09:00:00.000Z",
			);
		});

		it("pushes tomorrow's opening past a block on tomorrow morning", () => {
			const window = nextWindow({
				busyTimes: [
					busy("2026-08-11T15:00:00Z", "2026-08-11T21:00:00Z"),
					busy("2026-08-12T09:00:00Z", "2026-08-12T11:00:00Z"),
				],
			});

			expect(window?.openingTime.toISOString()).toBe(
				"2026-08-12T11:00:00.000Z",
			);
		});

		it("falls through to tomorrow when the rest of today is blocked", () => {
			const window = nextWindow({
				busyTimes: [busy("2026-08-11T15:00:00Z", "2026-08-11T21:00:00Z")],
			});

			expect(window?.openingTime.toISOString()).toBe(WEDNESDAY_OPEN);
		});

		it("counts the day as blocked once the closing buffer is applied", () => {
			const window = nextWindow({
				closingBuffer: 45,
				busyTimes: [busy("2026-08-11T15:00:00Z", "2026-08-11T20:15:00Z")],
			});

			expect(window?.openingTime.toISOString()).toBe(WEDNESDAY_OPEN);
		});

		it("keeps walking while consecutive days are blocked", () => {
			const window = nextWindow({
				busyTimes: [
					busy("2026-08-11T15:00:00Z", "2026-08-11T21:00:00Z"),
					busy("2026-08-12T09:00:00Z", "2026-08-12T21:00:00Z"),
				],
			});

			expect(window?.openingTime.toISOString()).toBe(THURSDAY_OPEN);
		});

		it("ignores a category-scoped block the cart cannot trigger", () => {
			const window = nextWindow({
				busyTimes: [
					busy("2026-08-11T15:00:00Z", "2026-08-11T21:00:00Z", {
						threshold: { categoryIds: ["drinks"] },
					}),
				],
			});

			expect(window?.closingTime.toISOString()).toBe(TUESDAY_CLOSE);
		});

		it("applies a category-scoped block when the cart carries that category", () => {
			const window = nextWindow({
				cartCategoryIds: ["drinks"],
				busyTimes: [
					busy("2026-08-11T15:00:00Z", "2026-08-11T21:00:00Z", {
						threshold: { categoryIds: ["drinks"] },
					}),
				],
			});

			expect(window?.openingTime.toISOString()).toBe(WEDNESDAY_OPEN);
		});

		it("returns null when nothing is orderable in the lookahead", () => {
			const window = nextWindow({
				busyTimes: [busy("2026-08-11T15:00:00Z", "2026-09-30T00:00:00Z")],
			});

			expect(window).toBeNull();
		});
	});

	describe("across a day with two shifts", () => {
		const splitShiftLocation = {
			location_id: "loc-2",
			timezone: "UTC",
			pickup_hours: [0, 1, 2, 3, 4, 5, 6].flatMap((day) => [
				{ day, start_time: "09:00", end_time: "12:00" },
				{ day, start_time: "14:00", end_time: "18:00" },
			]),
			delivery_hours: [],
		} as unknown as LocationLike;

		it("holds the closing buffer back for the morning shift", () => {
			const window = nextWindow({
				location: splitShiftLocation,
				now: new Date("2026-08-11T10:00:00Z").getTime(),
				closingBuffer: 30,
			});

			// the day still has an afternoon shift, so noon is not the last order time
			expect(window?.closingTime.toISOString()).toBe(
				"2026-08-11T12:00:00.000Z",
			);
			expect(window?.isLastShift).toBe(false);
		});

		it("applies the closing buffer to the afternoon shift", () => {
			const window = nextWindow({
				location: splitShiftLocation,
				now: new Date("2026-08-11T15:00:00Z").getTime(),
				closingBuffer: 30,
			});

			expect(window?.closingTime.toISOString()).toBe(
				"2026-08-11T17:30:00.000Z",
			);
			expect(window?.isFirstShift).toBe(false);
			expect(window?.isLastShift).toBe(true);
		});

		it("moves to the afternoon shift when the morning is blocked", () => {
			const window = nextWindow({
				location: splitShiftLocation,
				now: new Date("2026-08-11T10:00:00Z").getTime(),
				busyTimes: [busy("2026-08-11T09:00:00Z", "2026-08-11T12:00:00Z")],
			});

			expect(window?.openingTime.toISOString()).toBe(
				"2026-08-11T14:00:00.000Z",
			);
			expect(window?.closingTime.toISOString()).toBe(
				"2026-08-11T18:00:00.000Z",
			);
		});

		it("waits out the gap between shifts", () => {
			const window = nextWindow({
				location: splitShiftLocation,
				now: new Date("2026-08-11T13:00:00Z").getTime(),
			});

			expect(window?.openingTime.toISOString()).toBe(
				"2026-08-11T14:00:00.000Z",
			);
		});

		it("ends the day at the afternoon shift's close", () => {
			const window = nextWindow({
				location: splitShiftLocation,
				now: new Date("2026-08-11T10:00:00Z").getTime(),
				closingBuffer: 30,
			});

			expect(window?.dayClosingTime.toISOString()).toBe(
				"2026-08-11T17:30:00.000Z",
			);
		});

		it("ends the day with the window when it is the last shift", () => {
			const window = nextWindow({
				location: splitShiftLocation,
				now: new Date("2026-08-11T15:00:00Z").getTime(),
			});

			expect(window?.dayClosingTime).toEqual(window?.closingTime);
		});

		it("ends the day at the morning shift when the afternoon is blocked", () => {
			const window = nextWindow({
				location: splitShiftLocation,
				now: new Date("2026-08-11T10:00:00Z").getTime(),
				busyTimes: [busy("2026-08-11T14:00:00Z", "2026-08-11T18:00:00Z")],
			});

			expect(window?.dayClosingTime.toISOString()).toBe(
				"2026-08-11T12:00:00.000Z",
			);
		});
	});

	describe("the day's closing time", () => {
		// Every day: 07:00–10:00, 11:00–15:00 and 17:00–22:00
		const threeShiftLocation = {
			location_id: "loc-6",
			timezone: "UTC",
			pickup_hours: [0, 1, 2, 3, 4, 5, 6].flatMap((day) => [
				{ day, start_time: "07:00", end_time: "10:00" },
				{ day, start_time: "11:00", end_time: "15:00" },
				{ day, start_time: "17:00", end_time: "22:00" },
			]),
			delivery_hours: [],
		} as unknown as LocationLike;
		const TUESDAY_BREAKFAST = new Date("2026-08-11T08:00:00Z").getTime();
		const dayClosingTimeOf = (overrides: Record<string, unknown> = {}) =>
			nextWindow({
				location: threeShiftLocation,
				now: TUESDAY_BREAKFAST,
				closingBuffer: 30,
				...overrides,
			})?.dayClosingTime.toISOString();

		it("walks past every break to the last shift", () => {
			expect(dayClosingTimeOf()).toBe("2026-08-11T21:30:00.000Z");
		});

		it("walks past a blocked middle shift to an open last one", () => {
			expect(
				dayClosingTimeOf({
					busyTimes: [busy("2026-08-11T11:00:00Z", "2026-08-11T15:00:00Z")],
				}),
			).toBe("2026-08-11T21:30:00.000Z");
		});

		it("stops at the last shift busy times leave open", () => {
			// 15:00 is not the day's last shift, so it takes no closing buffer
			expect(
				dayClosingTimeOf({
					busyTimes: [busy("2026-08-11T17:00:00Z", "2026-08-11T22:00:00Z")],
				}),
			).toBe("2026-08-11T15:00:00.000Z");
		});

		it("counts a later shift that is only partly blocked", () => {
			expect(
				dayClosingTimeOf({
					busyTimes: [busy("2026-08-11T17:00:00Z", "2026-08-11T20:00:00Z")],
				}),
			).toBe("2026-08-11T21:30:00.000Z");
		});

		it("only lets a category-scoped block stop the day for that category", () => {
			const busyTimes = [
				busy("2026-08-11T17:00:00Z", "2026-08-11T22:00:00Z", {
					threshold: { categoryIds: ["drinks"] },
				}),
			];

			expect(dayClosingTimeOf({ busyTimes, cartCategoryIds: ["food"] })).toBe(
				"2026-08-11T21:30:00.000Z",
			);
			expect(dayClosingTimeOf({ busyTimes, cartCategoryIds: ["drinks"] })).toBe(
				"2026-08-11T15:00:00.000Z",
			);
		});

		it("follows a window that opens on a later day", () => {
			const window = nextWindow({
				location: threeShiftLocation,
				now: new Date("2026-08-11T23:00:00Z").getTime(),
			});

			expect(window?.openingTime.toISOString()).toBe(
				"2026-08-12T07:00:00.000Z",
			);
			expect(window?.dayClosingTime.toISOString()).toBe(
				"2026-08-12T22:00:00.000Z",
			);
		});

		it("is the window's own close on a day an override collapses", () => {
			const window = nextWindow({
				location: threeShiftLocation,
				now: TUESDAY_BREAKFAST,
				businessHoursOverrides: {
					"loc-6": [
						{ month: 8, day: 11, startTime: "08:00", endTime: "14:00" },
					],
				},
			});

			expect(window?.closingTime.toISOString()).toBe(
				"2026-08-11T14:00:00.000Z",
			);
			expect(window?.dayClosingTime).toEqual(window?.closingTime);
		});

		it("buffers an override that replaces split hours like any single window", () => {
			const window = nextWindow({
				location: threeShiftLocation,
				now: TUESDAY_BREAKFAST,
				openingBuffer: 15,
				closingBuffer: 30,
				businessHoursOverrides: {
					"loc-6": [
						{ month: 8, day: 11, startTime: "08:00", endTime: "14:00" },
					],
				},
			});

			expect(window?.isFirstShift).toBe(true);
			expect(window?.isLastShift).toBe(true);
			expect(window?.openingTime.toISOString()).toBe(
				"2026-08-11T08:15:00.000Z",
			);
			expect(window?.closingTime.toISOString()).toBe(
				"2026-08-11T13:30:00.000Z",
			);
			expect(window?.dayClosingTime).toEqual(window?.closingTime);
		});

		it("stays within the day when shifts overlap", () => {
			const overlappingLocation = {
				...threeShiftLocation,
				pickup_hours: [0, 1, 2, 3, 4, 5, 6].flatMap((day) => [
					{ day, start_time: "09:00", end_time: "12:00" },
					{ day, start_time: "10:00", end_time: "11:00" },
				]),
			} as unknown as LocationLike;

			expect(
				nextWindow({
					location: overlappingLocation,
					now: new Date("2026-08-11T09:30:00Z").getTime(),
				})?.dayClosingTime.toISOString(),
			).toBe("2026-08-11T12:00:00.000Z");
		});
	});

	describe("the day's closing time at the edges", () => {
		const locationWith = (
			pickupHours: { day: number; start_time: string; end_time: string }[],
			timezone = "America/New_York",
		) =>
			({
				location_id: "loc-7",
				store_id: "store-1",
				timezone,
				pickup_hours: pickupHours,
				delivery_hours: [],
			}) as unknown as LocationLike;
		const everyDay = (...shifts: [string, string][]) =>
			[0, 1, 2, 3, 4, 5, 6].flatMap((day) =>
				shifts.map(([start_time, end_time]) => ({ day, start_time, end_time })),
			);
		const lunchAndDinner = everyDay(["11:00", "15:00"], ["17:00", "22:00"]);
		const windowAt = (
			location: LocationLike,
			iso: string,
			overrides: Record<string, unknown> = {},
		) => nextWindow({ location, now: new Date(iso).getTime(), ...overrides });

		// Shift times on clock-change days are an hour out in setHmOnDate, an older
		// bug of its own, so these only check the walk reaches dinner's own close.
		it("reaches dinner's close on the day the clocks fall back", () => {
			const location = locationWith(lunchAndDinner);
			const atLunch = windowAt(location, "2026-11-01T17:30:00Z");
			const atDinner = windowAt(location, "2026-11-01T23:30:00Z");

			expect(atLunch?.isLastShift).toBe(false);
			expect(atLunch?.dayClosingTime).toEqual(atDinner?.closingTime);
		});

		it("reaches dinner's close on the day the clocks spring forward", () => {
			const location = locationWith(lunchAndDinner);
			const atLunch = windowAt(location, "2026-03-08T16:30:00Z");
			const atDinner = windowAt(location, "2026-03-08T22:30:00Z");

			expect(atLunch?.isLastShift).toBe(false);
			expect(atLunch?.dayClosingTime).toEqual(atDinner?.closingTime);
		});

		it("stops at lunch when the closing buffer swallows the dinner shift", () => {
			// 17:00–17:20 less a 30 minute buffer leaves nothing to order in
			const window = windowAt(
				locationWith(everyDay(["11:00", "15:00"], ["17:00", "17:20"])),
				"2026-10-07T16:30:00Z",
				{ closingBuffer: 30 },
			);

			expect(window?.dayClosingTime.toISOString()).toBe(
				"2026-10-07T19:00:00.000Z",
			);
		});

		it("walks on from a 00:00 shift when the night before closed earlier", () => {
			// Mon 05:00–17:00, so Tuesday's 00:00 opens a new day rather than ending a night
			const window = windowAt(
				locationWith([
					{ day: 1, start_time: "05:00", end_time: "17:00" },
					{ day: 2, start_time: "00:00", end_time: "01:00" },
					{ day: 2, start_time: "09:00", end_time: "23:59" },
				]),
				"2026-10-06T04:30:00Z", // Tue 00:30 EDT
			);

			expect(window?.dayClosingTime.toISOString()).toBe(
				"2026-10-07T03:59:00.000Z",
			);
		});

		describe("when the night before closes at 24:00", () => {
			// Mon 04:00–24:00, then Tue 00:00–02:59 and 04:00–13:59
			const location = locationWith(
				[
					{ day: 1, start_time: "04:00", end_time: "24:00" },
					{ day: 2, start_time: "00:00", end_time: "02:59" },
					{ day: 2, start_time: "04:00", end_time: "13:59" },
				],
				"UTC",
			);

			it("carries Monday's close into Tuesday's early hours", () => {
				const window = windowAt(location, "2026-10-05T23:00:00Z");

				expect(window?.dayClosingTime.toISOString()).toBe(
					"2026-10-06T02:59:00.000Z",
				);
			});

			it("closes the night at 02:59 rather than walking into Tuesday's day", () => {
				const window = windowAt(location, "2026-10-06T01:00:00Z");

				expect(window?.isLastShift).toBe(true);
				expect(window?.dayClosingTime.toISOString()).toBe(
					"2026-10-06T02:59:00.000Z",
				);
			});
		});

		it("closes the night at 02:00 when an override ran the night before to 23:59", () => {
			const window = windowAt(
				locationWith(
					[
						{ day: 1, start_time: "09:00", end_time: "17:00" },
						{ day: 2, start_time: "00:00", end_time: "02:00" },
						{ day: 2, start_time: "11:00", end_time: "15:00" },
					],
					"UTC",
				),
				"2026-10-06T01:00:00Z",
				{
					businessHoursOverrides: {
						"loc-7": [
							{ month: 10, day: 5, startTime: "18:00", endTime: "23:59" },
						],
					},
				},
			);

			expect(window?.dayClosingTime.toISOString()).toBe(
				"2026-10-06T02:00:00.000Z",
			);
		});

		it("keeps a lone 00:00 shift as the whole day, as the schedule does", () => {
			// Tue 18:00–23:59 then only Wed 00:00–02:00
			const window = windowAt(
				locationWith(
					[
						{ day: 2, start_time: "18:00", end_time: "23:59" },
						{ day: 3, start_time: "00:00", end_time: "02:00" },
					],
					"UTC",
				),
				"2026-08-12T01:00:00Z",
				{ openingBuffer: 15, closingBuffer: 30 },
			);

			expect(window?.openingTime.toISOString()).toBe(
				"2026-08-12T00:15:00.000Z",
			);
			expect(window?.closingTime.toISOString()).toBe(
				"2026-08-12T01:30:00.000Z",
			);
			expect(window?.dayClosingTime).toEqual(window?.closingTime);
		});
	});

	describe("for catering orders", () => {
		const cateringLocation = {
			location_id: "loc-3",
			timezone: "UTC",
			pickup_hours: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
				day,
				start_time: "09:00",
				end_time: "21:00",
			})),
			delivery_hours: [],
			catering: {
				enabled: true,
				pickup: { start_time: "11:00", end_time: "15:00" },
				delivery: { start_time: "11:00", end_time: "14:00" },
			},
		} as unknown as LocationLike;

		it("uses the catering window instead of the regular hours", () => {
			const window = nextWindow({
				location: cateringLocation,
				isCatering: true,
				now: new Date("2026-08-11T10:00:00Z").getTime(), // before it opens
			});

			expect(window?.openingTime.toISOString()).toBe(
				"2026-08-11T11:00:00.000Z",
			);
			expect(window?.closingTime.toISOString()).toBe(
				"2026-08-11T15:00:00.000Z",
			);
		});

		it("keeps the regular hours when the order is not catering", () => {
			const window = nextWindow({ location: cateringLocation });

			expect(window?.closingTime.toISOString()).toBe(TUESDAY_CLOSE);
		});

		it("moves to tomorrow's catering window once today's has closed", () => {
			const window = nextWindow({
				location: cateringLocation,
				isCatering: true,
				now: new Date("2026-08-11T16:00:00Z").getTime(),
			});

			expect(window?.openingTime.toISOString()).toBe(
				"2026-08-12T11:00:00.000Z",
			);
		});

		it("keeps catering to one window on a split-hours day", () => {
			const window = nextWindow({
				location: {
					...cateringLocation,
					pickup_hours: [0, 1, 2, 3, 4, 5, 6].flatMap((day) => [
						{ day, start_time: "09:00", end_time: "12:00" },
						{ day, start_time: "14:00", end_time: "21:00" },
					]),
				},
				isCatering: true,
				now: new Date("2026-08-11T11:30:00Z").getTime(),
			});

			expect(window?.closingTime.toISOString()).toBe(
				"2026-08-11T15:00:00.000Z",
			);
			expect(window?.dayClosingTime).toEqual(window?.closingTime);
		});

		it("returns null when catering is on but the location has no catering hours", () => {
			const window = nextWindow({
				location: { ...cateringLocation, catering: { enabled: true } },
				isCatering: true,
			});

			expect(window).toBeNull();
		});
	});

	describe("across a week with closed days", () => {
		// open Tuesday and Friday only
		const partWeekLocation = {
			location_id: "loc-4",
			timezone: "UTC",
			pickup_hours: [2, 5].map((day) => ({
				day,
				start_time: "09:00",
				end_time: "17:00",
			})),
			delivery_hours: [],
		} as unknown as LocationLike;

		it("skips the closed days to the next open one", () => {
			const window = nextWindow({
				location: partWeekLocation,
				now: new Date("2026-08-11T18:00:00Z").getTime(), // Tuesday, after close
			});

			// Wednesday and Thursday are closed
			expect(window?.openingTime.toISOString()).toBe(
				"2026-08-14T09:00:00.000Z",
			);
		});

		it("skips a blocked open day to the next open one", () => {
			const window = nextWindow({
				location: partWeekLocation,
				busyTimes: [busy("2026-08-11T09:00:00Z", "2026-08-11T17:00:00Z")],
			});

			expect(window?.openingTime.toISOString()).toBe(
				"2026-08-14T09:00:00.000Z",
			);
		});
	});

	describe("when the day runs past midnight", () => {
		// Tuesday 18:00 through Wednesday 02:00
		const lateNightLocation = {
			location_id: "loc-5",
			timezone: "UTC",
			pickup_hours: [
				{ day: 2, start_time: "18:00", end_time: "23:59" },
				{ day: 3, start_time: "00:00", end_time: "02:00" },
			],
			delivery_hours: [],
		} as unknown as LocationLike;

		const TUESDAY_EVENING = new Date("2026-08-11T20:00:00Z").getTime();

		it("carries the window through to the next day's closing time", () => {
			const window = nextWindow({
				location: lateNightLocation,
				now: TUESDAY_EVENING,
			});

			expect(window?.openingTime.toISOString()).toBe(
				"2026-08-11T18:00:00.000Z",
			);
			expect(window?.closingTime.toISOString()).toBe(
				"2026-08-12T02:00:00.000Z",
			);
		});

		it("takes the closing buffer off the far side of midnight", () => {
			const window = nextWindow({
				location: lateNightLocation,
				now: TUESDAY_EVENING,
				closingBuffer: 30,
			});

			expect(window?.closingTime.toISOString()).toBe(
				"2026-08-12T01:30:00.000Z",
			);
		});

		describe("with a split day after it", () => {
			// Tuesday 18:00 → Wednesday 02:00, then Wednesday 11:00–15:00 and
			// 18:00 → Thursday 02:00
			const lateNightSplitLocation = {
				...lateNightLocation,
				pickup_hours: [
					{ day: 2, start_time: "18:00", end_time: "23:59" },
					{ day: 3, start_time: "00:00", end_time: "02:00" },
					{ day: 3, start_time: "11:00", end_time: "15:00" },
					{ day: 3, start_time: "18:00", end_time: "23:59" },
					{ day: 4, start_time: "00:00", end_time: "02:00" },
				],
			} as unknown as LocationLike;
			const WEDNESDAY_1AM = new Date("2026-08-12T01:00:00Z").getTime();

			it("closes the night at 02:00, not at the end of Wednesday", () => {
				const window = nextWindow({
					location: lateNightSplitLocation,
					now: WEDNESDAY_1AM,
				});

				expect(window?.dayClosingTime.toISOString()).toBe(
					"2026-08-12T02:00:00.000Z",
				);
			});

			it("buffers the night the same way from either side of midnight", () => {
				const fromTuesday = nextWindow({
					location: lateNightSplitLocation,
					now: TUESDAY_EVENING,
					openingBuffer: 15,
					closingBuffer: 30,
				});
				const fromWednesday = nextWindow({
					location: lateNightSplitLocation,
					now: WEDNESDAY_1AM,
					openingBuffer: 15,
					closingBuffer: 30,
				});

				expect(fromTuesday?.closingTime.toISOString()).toBe(
					"2026-08-12T01:30:00.000Z",
				);
				// the store has been open since Tuesday, so 00:00 takes no opening buffer
				expect(fromWednesday?.openingTime.toISOString()).toBe(
					"2026-08-12T00:00:00.000Z",
				);
				expect(fromWednesday?.closingTime.toISOString()).toBe(
					"2026-08-12T01:30:00.000Z",
				);
			});

			it("opens Wednesday's own day at 11:00 with the opening buffer", () => {
				const window = nextWindow({
					location: lateNightSplitLocation,
					now: new Date("2026-08-12T05:00:00Z").getTime(),
					openingBuffer: 15,
				});

				expect(window?.openingTime.toISOString()).toBe(
					"2026-08-12T11:15:00.000Z",
				);
				expect(window?.dayClosingTime.toISOString()).toBe(
					"2026-08-13T02:00:00.000Z",
				);
			});
		});

		it("falls through when a busy window covers the rest of the night", () => {
			const window = nextWindow({
				location: lateNightLocation,
				now: TUESDAY_EVENING,
				busyTimes: [busy("2026-08-11T19:00:00Z", "2026-08-12T02:00:00Z")],
			});

			// nothing left tonight, and the next Tuesday evening is the next opening
			expect(window?.openingTime.toISOString()).toBe(
				"2026-08-18T18:00:00.000Z",
			);
		});
	});

	describe("with malformed input", () => {
		const malformedLocations = [
			{ label: "no location", value: null },
			{
				label: "no hours for the fulfillment type",
				value: { ...location, pickup_hours: [] },
			},
			{
				label: "hours missing entirely",
				value: { location_id: "x", timezone: "UTC" },
			},
			{ label: "no timezone", value: { ...location, timezone: undefined } },
			{
				label: "unknown timezone",
				value: { ...location, timezone: "Mars/Olympus" },
			},
			{
				label: "a hole in the hours array",
				value: { ...location, pickup_hours: [null, undefined] },
			},
		];

		for (const { label, value } of malformedLocations) {
			it(`returns null rather than throwing: ${label}`, () => {
				expect(() =>
					nextWindow({ location: value as unknown as LocationLike }),
				).not.toThrow();
				expect(
					nextWindow({ location: value as unknown as LocationLike }),
				).toBeNull();
			});
		}

		it("ignores an unknown fulfillment preference", () => {
			expect(nextWindow({ fulfillmentPreference: "TELEPORT" })).toBeNull();
		});

		it("treats unusable buffers as no buffer", () => {
			for (const buffer of ["45", null, undefined, Number.NaN, "abc", {}]) {
				const window = nextWindow({ closingBuffer: buffer });

				expect(window?.closingTime.toISOString()).toBe(
					buffer === "45" ? "2026-08-11T20:15:00.000Z" : TUESDAY_CLOSE,
				);
			}
		});

		it("falls back to the current time when `now` is not a number", () => {
			for (const value of [null, undefined, Number.NaN, "now"]) {
				expect(() => nextWindow({ now: value })).not.toThrow();
			}
		});

		it("survives junk in the busy times", () => {
			const window = nextWindow({
				busyTimes: [null, "nope", {}, { startTime: "x", endTime: "y" }],
			});

			expect(window?.closingTime.toISOString()).toBe(TUESDAY_CLOSE);
		});

		it("survives junk in the business hours overrides", () => {
			expect(() =>
				nextWindow({ businessHoursOverrides: { "loc-1": [null, {}] } }),
			).not.toThrow();
		});
	});
});
