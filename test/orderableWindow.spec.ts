import { describe, expect, it } from "vitest";

import type { BusyTimeItem, LocationLike } from "../src/types";
import {
	getApplicableBusyTimes,
	isRangeFullyBlocked,
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

describe("isRangeFullyBlocked", () => {
	const busyRanges: [number, number][] = [[100, 200]];

	it("is true only when a busy range covers the whole range", () => {
		expect(isRangeFullyBlocked({ start: 120, end: 180, busyRanges })).toBe(
			true,
		);
		expect(isRangeFullyBlocked({ start: 90, end: 180, busyRanges })).toBe(
			false,
		);
		expect(isRangeFullyBlocked({ start: 120, end: 220, busyRanges })).toBe(
			false,
		);
	});

	it("treats an empty range as blocked — nothing is orderable in it", () => {
		expect(isRangeFullyBlocked({ start: 200, end: 200, busyRanges })).toBe(
			true,
		);
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
			isRangeFullyBlocked({
				start: 100,
				end: 200,
				busyRanges: null as unknown as [number, number][],
			}),
		).toBe(false);
		expect(isRangeFullyBlocked({ start: 100, end: 200 })).toBe(false);
	});

	it("reports a range it cannot make sense of as blocked", () => {
		const busyRanges: [number, number][] = [[100, 200]];

		expect(
			isRangeFullyBlocked({ start: Number.NaN, end: 200, busyRanges }),
		).toBe(true);
		expect(isRangeFullyBlocked({ start: 300, end: 200, busyRanges })).toBe(
			true,
		);
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
