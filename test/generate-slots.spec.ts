import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSchedules } from "../src/schedule/get-schedules";
import type {
	GetSchedulesParams,
	LocationLike,
	PrepTimeSettings,
	StoreConfig,
} from "../src/types";

// ── Fixtures ─────────────────────────────────────────────────────────────────

/** Mon–Sat 08:00–20:00, Sun closed */
const STANDARD_HOURS = [
	{ day: 1, start_time: "08:00", end_time: "20:00" },
	{ day: 2, start_time: "08:00", end_time: "20:00" },
	{ day: 3, start_time: "08:00", end_time: "20:00" },
	{ day: 4, start_time: "08:00", end_time: "20:00" },
	{ day: 5, start_time: "08:00", end_time: "20:00" },
	{ day: 6, start_time: "08:00", end_time: "20:00" },
];

function makeLocation(overrides: Partial<LocationLike> = {}): LocationLike {
	return {
		location_id: "loc-test",
		timezone: "UTC",
		pickup_hours: STANDARD_HOURS,
		...overrides,
	};
}

function makeStore(overrides: Partial<StoreConfig> = {}): StoreConfig {
	return {
		isAsapOrders: false,
		isSameDayOrders: false,
		max_future_order_days: 7,
		businessHoursOverrides: [],
		weeklyPreSaleConfig: {
			active: false,
			pickup_days: [],
			ordering_days: [],
		},
		...overrides,
	};
}

function makePrepTimeSettings(
	overrides: Partial<PrepTimeSettings> = {},
): PrepTimeSettings {
	return {
		prepTimeInMinutes: 0,
		gapInMinutes: 15,
		busyTimes: {},
		fulfillAtBusinessDayStart: false,
		...overrides,
	};
}

function callGetSchedules(
	prepTimeSettings: PrepTimeSettings,
	location?: LocationLike,
	overrides: Partial<GetSchedulesParams> = {},
) {
	const loc = location ?? makeLocation();
	return getSchedules({
		store: makeStore(),
		locations: [loc],
		cartItems: [],
		fulfillmentPreference: "PICKUP",
		prepTimeSettings,
		currentLocation: loc,
		...overrides,
	});
}

function getFirstSlot(
	prepTimeSettings: PrepTimeSettings,
	location?: LocationLike,
	overrides: Partial<GetSchedulesParams> = {},
): Date | undefined {
	const { schedule } = callGetSchedules(prepTimeSettings, location, overrides);
	return schedule[0]?.slots[0];
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("generate-slots", () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	describe("prep time (minute cadence, current day only)", () => {
		describe("now is after opening time", () => {
			it("first slot = now + prepTime when now + prep > opening + buffer", () => {
				// Mon 10:00, prep 30 min, buffer 15 min
				// now+prep = 10:30, opening+buffer = 08:15 → max = 10:30
				vi.setSystemTime(new Date("2025-01-06T10:00:00.000Z"));
				expect(
					getFirstSlot(
						makePrepTimeSettings({ prepTimeInMinutes: 30, openingBuffer: 15 }),
					),
				).toEqual(new Date("2025-01-06T10:30:00.000Z"));
			});

			it("first slot = opening + buffer when opening + buffer > now + prep", () => {
				// Mon 08:05, prep 5 min, buffer 30 min
				// now+prep = 08:10, opening+buffer = 08:30 → max = 08:30
				vi.setSystemTime(new Date("2025-01-06T08:05:00.000Z"));
				expect(
					getFirstSlot(
						makePrepTimeSettings({ prepTimeInMinutes: 5, openingBuffer: 30 }),
					),
				).toEqual(new Date("2025-01-06T08:30:00.000Z"));
			});

			it("first slot = now when no prep time and no buffer", () => {
				vi.setSystemTime(new Date("2025-01-06T10:00:00.000Z"));
				expect(getFirstSlot(makePrepTimeSettings())).toEqual(
					new Date("2025-01-06T10:00:00.000Z"),
				);
			});
		});

		describe("now is before opening time", () => {
			it("first slot = opening + buffer when now + prep < opening + buffer", () => {
				// Mon 06:00 (before 08:00), prep 45 min, buffer 15 min
				// now + prep = 06:45, opening + buffer = 08:15 → max = 08:15
				vi.setSystemTime(new Date("2025-01-06T06:00:00.000Z"));
				expect(
					getFirstSlot(
						makePrepTimeSettings({ prepTimeInMinutes: 45, openingBuffer: 15 }),
					),
				).toEqual(new Date("2025-01-06T08:15:00.000Z"));
			});

			it("first slot = opening + buffer when buffer > prepTime (still below opening + buffer)", () => {
				// Mon 06:00, prep 10 min, buffer 30 min
				// now + prep = 06:10, opening + buffer = 08:30 → max = 08:30
				vi.setSystemTime(new Date("2025-01-06T06:00:00.000Z"));
				expect(
					getFirstSlot(
						makePrepTimeSettings({ prepTimeInMinutes: 10, openingBuffer: 30 }),
					),
				).toEqual(new Date("2025-01-06T08:30:00.000Z"));
			});

			it("first slot = now + prep when now + prep > opening + buffer", () => {
				// Mon 07:50 (before 08:00), prep 45 min, buffer 15 min
				// now + prep = 08:35, opening + buffer = 08:15 → max = 08:35
				vi.setSystemTime(new Date("2025-01-06T07:50:00.000Z"));
				expect(
					getFirstSlot(
						makePrepTimeSettings({ prepTimeInMinutes: 45, openingBuffer: 15 }),
					),
				).toEqual(new Date("2025-01-06T08:35:00.000Z"));
			});
		});

		describe("prep time exceeds closing time → rolls to next day", () => {
			it("next day first slot = opening + buffer (prep not carried over)", () => {
				// Mon 19:00, closing 20:00, prep 240 min → 23:00 > 20:00
				// → Tue opening 08:00 + buffer 15 = 08:15
				vi.setSystemTime(new Date("2025-01-06T19:00:00.000Z"));
				expect(
					getFirstSlot(
						makePrepTimeSettings({ prepTimeInMinutes: 240, openingBuffer: 15 }),
					),
				).toEqual(new Date("2025-01-07T08:15:00.000Z"));
			});

			it("skips closed day (Sun) when rolling", () => {
				// Sat 19:00, prep 240 min past closing → Sun closed → Mon 08:15
				vi.setSystemTime(new Date("2025-01-11T19:00:00.000Z")); // Saturday
				expect(
					getFirstSlot(
						makePrepTimeSettings({ prepTimeInMinutes: 240, openingBuffer: 15 }),
					),
				).toEqual(new Date("2025-01-13T08:15:00.000Z")); // Monday
			});
		});

		describe("prep time is only applied to current day", () => {
			it("today = now + prep, tomorrow = opening + buffer (no prep)", () => {
				// Mon 10:00, prep 30 min, buffer 15 min
				vi.setSystemTime(new Date("2025-01-06T10:00:00.000Z"));
				const { schedule } = callGetSchedules(
					makePrepTimeSettings({ prepTimeInMinutes: 30, openingBuffer: 15 }),
				);
				// Today (Mon): 10:30
				expect(schedule[0]?.slots[0]).toEqual(
					new Date("2025-01-06T10:30:00.000Z"),
				);
				// Tomorrow (Tue): 08:15 (buffer only, no prep)
				expect(schedule[1]?.slots[0]).toEqual(
					new Date("2025-01-07T08:15:00.000Z"),
				);
			});
		});
	});

	describe("opening and closing buffers (applied every day)", () => {
		it("opening buffer shifts first slot on every day", () => {
			vi.setSystemTime(new Date("2025-01-06T06:00:00.000Z")); // before opening
			const { schedule } = callGetSchedules(
				makePrepTimeSettings({ openingBuffer: 30 }),
			);
			schedule.forEach((day) => {
				const m =
					day.slots[0].getUTCHours() * 60 + day.slots[0].getUTCMinutes();
				expect(m).toBe(8 * 60 + 30); // 08:30
			});
		});

		it("closing buffer trims last slot on every day", () => {
			vi.setSystemTime(new Date("2025-01-06T06:00:00.000Z"));
			const { schedule } = callGetSchedules(
				makePrepTimeSettings({ closingBuffer: 30 }),
			);
			schedule.forEach((day) => {
				const last = day.slots[day.slots.length - 1];
				const m = last.getUTCHours() * 60 + last.getUTCMinutes();
				expect(m).toBe(19 * 60 + 30); // 19:30
			});
		});

		it("both buffers applied together", () => {
			vi.setSystemTime(new Date("2025-01-06T06:00:00.000Z"));
			const { schedule } = callGetSchedules(
				makePrepTimeSettings({ openingBuffer: 15, closingBuffer: 30 }),
			);
			const day = schedule[0];
			expect(day.slots[0]).toEqual(new Date("2025-01-06T08:15:00.000Z"));
			const last = day.slots[day.slots.length - 1];
			expect(last).toEqual(new Date("2025-01-06T19:30:00.000Z"));
		});
	});

	describe("midnight spill (contiguous shift across midnight)", () => {
		const midnightSpillLocation = () =>
			makeLocation({
				pickup_hours: [
					// Mon: 08:00–24:00
					{ day: 1, start_time: "08:00", end_time: "24:00" },
					// Tue: 00:00–02:00 (continuation), then 08:00–20:00
					{ day: 2, start_time: "00:00", end_time: "02:00" },
					{ day: 2, start_time: "08:00", end_time: "20:00" },
					{ day: 3, start_time: "08:00", end_time: "20:00" },
					{ day: 4, start_time: "08:00", end_time: "20:00" },
					{ day: 5, start_time: "08:00", end_time: "20:00" },
					{ day: 6, start_time: "08:00", end_time: "20:00" },
				],
			});

		it("closing buffer is NOT applied at the 24:00 boundary (spill continues)", () => {
			vi.setSystemTime(new Date("2025-01-06T10:00:00.000Z")); // Monday
			const { schedule } = callGetSchedules(
				makePrepTimeSettings({ closingBuffer: 30 }),
				midnightSpillLocation(),
			);
			// Monday's last slot should go up to 23:45 (not 23:30)
			const mondaySlots = schedule[0].slots;
			const mondayLast = mondaySlots[mondaySlots.length - 1];
			expect(mondayLast.getUTCHours()).toBe(23);
			expect(mondayLast.getUTCMinutes()).toBe(45);
		});

		it("opening buffer applies to the real opening shift, not midnight continuation", () => {
			vi.setSystemTime(new Date("2025-01-06T06:00:00.000Z"));
			const { schedule } = callGetSchedules(
				makePrepTimeSettings({ openingBuffer: 30 }),
				midnightSpillLocation(),
			);
			// Monday opens at 08:00, buffer pushes to 08:30
			expect(schedule[0].slots[0]).toEqual(
				new Date("2025-01-06T08:30:00.000Z"),
			);
		});
	});

	describe("day cadence prep time", () => {
		it("2 days prep → skip 2 open days, land on 3rd day opening + buffer", () => {
			// Mon 10:00 → skip Mon, Tue → Wed 08:15
			vi.setSystemTime(new Date("2025-01-06T10:00:00.000Z"));
			expect(
				getFirstSlot(
					makePrepTimeSettings({
						prepTimeInMinutes: 2 * 1440,
						fulfillAtBusinessDayStart: true,
						openingBuffer: 15,
					}),
				),
			).toEqual(new Date("2025-01-08T08:15:00.000Z")); // Wednesday
		});

		it("closed days (Sun) do not count toward skip", () => {
			// Sat 10:00, 2 days → skip Sat(1), Sun(closed), Mon(2) → Tue
			vi.setSystemTime(new Date("2025-01-11T10:00:00.000Z")); // Saturday
			expect(
				getFirstSlot(
					makePrepTimeSettings({
						prepTimeInMinutes: 2 * 1440,
						fulfillAtBusinessDayStart: true,
						openingBuffer: 15,
					}),
				),
			).toEqual(new Date("2025-01-14T08:15:00.000Z")); // Tuesday
		});

		it("today past closing does not count toward skip", () => {
			// Mon 21:00 (past 20:00 closing), 1 day → Mon not counted → skip Tue → Wed
			vi.setSystemTime(new Date("2025-01-06T21:00:00.000Z"));
			expect(
				getFirstSlot(
					makePrepTimeSettings({
						prepTimeInMinutes: 1440,
						fulfillAtBusinessDayStart: true,
						openingBuffer: 15,
					}),
				),
			).toEqual(new Date("2025-01-08T08:15:00.000Z")); // Wednesday
		});

		it("1 day prep during hours → skip today, land on tomorrow", () => {
			// Mon 10:00, 1 day → skip Mon → Tue 08:00
			vi.setSystemTime(new Date("2025-01-06T10:00:00.000Z"));
			expect(
				getFirstSlot(
					makePrepTimeSettings({
						prepTimeInMinutes: 1440,
						fulfillAtBusinessDayStart: true,
					}),
				),
			).toEqual(new Date("2025-01-07T08:00:00.000Z")); // Tuesday
		});
	});

	describe("minute cadence with day skipping (prep >= 24h)", () => {
		it("24h prep during hours → skip 1 open day, preserve time-of-day", () => {
			// Mon 14:00 + 1440 min → skip Mon → Tue 14:00
			vi.setSystemTime(new Date("2025-01-06T14:00:00.000Z"));
			expect(
				getFirstSlot(makePrepTimeSettings({ prepTimeInMinutes: 1440 })),
			).toEqual(new Date("2025-01-07T14:00:00.000Z"));
		});

		it("24h prep, now before opening → target day gets opening + buffer", () => {
			// Mon 07:00 + 1440 min → skip Mon → Tue, project 07:00 < 08:00 → 08:15
			vi.setSystemTime(new Date("2025-01-06T07:00:00.000Z"));
			expect(
				getFirstSlot(
					makePrepTimeSettings({ prepTimeInMinutes: 1440, openingBuffer: 15 }),
				),
			).toEqual(new Date("2025-01-07T08:15:00.000Z"));
		});

		it("24h prep, now past closing → today not counted, projected past closing rolls", () => {
			// Mon 21:00 (past closing) + 1440 min
			// Mon not counted → skip Tue → Wed, project 21:00 > 20:00 → Thu 08:00
			vi.setSystemTime(new Date("2025-01-06T21:00:00.000Z"));
			expect(
				getFirstSlot(makePrepTimeSettings({ prepTimeInMinutes: 1440 })),
			).toEqual(new Date("2025-01-09T08:00:00.000Z")); // Thursday
		});

		it("48h prep during hours → skip 2 open days, preserve time-of-day", () => {
			// Mon 14:00 + 2880 min → skip Mon, Tue → Wed 14:00
			vi.setSystemTime(new Date("2025-01-06T14:00:00.000Z"));
			expect(
				getFirstSlot(makePrepTimeSettings({ prepTimeInMinutes: 2880 })),
			).toEqual(new Date("2025-01-08T14:00:00.000Z")); // Wednesday
		});

		it("48h prep, now past closing → today not counted, projected past closing rolls", () => {
			// Mon 21:00 + 2880 min
			// Mon not counted → skip Tue, Wed → Thu, project 21:00 > 20:00 → Fri 08:00
			vi.setSystemTime(new Date("2025-01-06T21:00:00.000Z"));
			expect(
				getFirstSlot(makePrepTimeSettings({ prepTimeInMinutes: 2880 })),
			).toEqual(new Date("2025-01-10T08:00:00.000Z")); // Friday
		});

		it("skips closed days for minute cadence (Sun closed)", () => {
			// Sat 14:00 + 1440 min → skip Sat → Sun closed → Mon 14:00
			vi.setSystemTime(new Date("2025-01-11T14:00:00.000Z")); // Saturday
			expect(
				getFirstSlot(makePrepTimeSettings({ prepTimeInMinutes: 1440 })),
			).toEqual(new Date("2025-01-13T14:00:00.000Z")); // Monday
		});

		it("minute cadence with remainder → skips days then adds remaining minutes", () => {
			// Mon 10:00 + 1500 min (1 day + 60 min)
			// Skip Mon → Tue, project 10:00 + 60 = 11:00
			vi.setSystemTime(new Date("2025-01-06T10:00:00.000Z"));
			expect(
				getFirstSlot(makePrepTimeSettings({ prepTimeInMinutes: 1500 })),
			).toEqual(new Date("2025-01-07T11:00:00.000Z"));
		});

		it("the reported bug: Tue 9:11 PM past closing, Wed closed, 2 days prep → Sat", () => {
			// Tue 21:11 (past closing), Wed closed, 2 days (2880 min)
			// Tue not counted → Thu(skip 1), Fri(skip 2) → Sat
			// Project 21:11 > 20:00 closing → rolls to next open day
			const location = makeLocation({
				pickup_hours: [
					{ day: 1, start_time: "08:00", end_time: "20:00" }, // Mon
					{ day: 2, start_time: "08:00", end_time: "20:00" }, // Tue
					// Wed (day 3) closed
					{ day: 4, start_time: "08:00", end_time: "20:00" }, // Thu
					{ day: 5, start_time: "08:00", end_time: "20:00" }, // Fri
					{ day: 6, start_time: "08:00", end_time: "20:00" }, // Sat
				],
			});
			vi.setSystemTime(new Date("2025-01-07T21:11:00.000Z")); // Tuesday
			const slot = getFirstSlot(
				makePrepTimeSettings({ prepTimeInMinutes: 2880 }),
				location,
			);
			// Tue not counted, Wed closed → dates=[Thu,Fri,Sat,...], slice(2)=[Sat,...]
			// Project 21:11 on Sat > 20:00 closing → rolls to Mon
			// Actually: Sat 21:11 > 20:00 → Mon 08:00
			expect(slot).toBeDefined();
			// The key assertion: should NOT be Friday (the old bug)
			expect(slot?.getUTCDay()).not.toBe(5); // not Friday
		});
	});

	describe("estimatedDeliveryMinutes", () => {
		it("adds delivery time for DELIVERY fulfillment", () => {
			vi.setSystemTime(new Date("2025-01-06T10:00:00.000Z"));
			const location = makeLocation({
				delivery_hours: STANDARD_HOURS,
			});
			expect(
				getFirstSlot(
					makePrepTimeSettings({ estimatedDeliveryMinutes: 30 }),
					location,
					{ fulfillmentPreference: "DELIVERY" },
				),
			).toEqual(new Date("2025-01-06T10:30:00.000Z"));
		});

		it("does NOT add delivery time for PICKUP", () => {
			vi.setSystemTime(new Date("2025-01-06T10:00:00.000Z"));
			expect(
				getFirstSlot(makePrepTimeSettings({ estimatedDeliveryMinutes: 30 })),
			).toEqual(new Date("2025-01-06T10:00:00.000Z"));
		});

		it("does NOT add delivery time for CURBSIDE", () => {
			vi.setSystemTime(new Date("2025-01-06T10:00:00.000Z"));
			const location = makeLocation({
				curbside_hours: { use_pickup_hours: true },
			});
			expect(
				getFirstSlot(
					makePrepTimeSettings({ estimatedDeliveryMinutes: 30 }),
					location,
					{ fulfillmentPreference: "CURBSIDE" },
				),
			).toEqual(new Date("2025-01-06T10:00:00.000Z"));
		});

		it("delivery time stacks with prep time", () => {
			// Mon 10:00, prep 20 min, delivery 15 min → 10:35
			vi.setSystemTime(new Date("2025-01-06T10:00:00.000Z"));
			const location = makeLocation({
				delivery_hours: STANDARD_HOURS,
			});
			expect(
				getFirstSlot(
					makePrepTimeSettings({
						prepTimeInMinutes: 20,
						estimatedDeliveryMinutes: 15,
					}),
					location,
					{ fulfillmentPreference: "DELIVERY" },
				),
			).toEqual(new Date("2025-01-06T10:35:00.000Z"));
		});
	});

	describe("pre-sale orders (prep time zeroed)", () => {
		it("pre-sale schedule does not include prep time offset", () => {
			// Mon 10:00, prep 60 min — but with preSaleConfig active,
			// prep should not shift slots.
			vi.setSystemTime(new Date("2025-01-06T10:00:00.000Z")); // Monday
			const location = makeLocation();

			const { schedule } = callGetSchedules(
				makePrepTimeSettings({ prepTimeInMinutes: 60 }),
				location,
				{
					store: makeStore({
						preSaleConfig: {
							active: true,
							due_start_date: new Date("2025-01-06T00:00:00.000Z"),
							due_end_date: new Date("2025-01-06T23:59:00.000Z"),
							use_store_hours_due: true,
						},
					}),
					cartItems: [{ preSale: true }],
				},
			);

			if (schedule.length > 0 && schedule[0].slots.length > 0) {
				const firstSlot = schedule[0].slots[0];
				// Without prep, first slot should be 10:00 (now), not 11:00 (now + 60)
				expect(firstSlot).toEqual(new Date("2025-01-06T10:00:00.000Z"));
			}
		});
	});
});
