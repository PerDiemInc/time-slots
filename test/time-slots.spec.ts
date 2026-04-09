import { findTimeZone, getUnixTime } from "timezone-support";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
	CartItem,
	FulfillmentPreference,
	GetSchedulesParams,
	LocationLike,
	PrepTimeSettings,
	StoreConfig,
} from "../src/index";
import { getSchedules } from "../src/index";

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns a function that creates a UTC Date from a readable **local-time** string.
 * Set the timezone once per describe block, then write all times in the store's local time.
 *
 * @example
 * const local = localTime("America/New_York");
 * local("Mon 2026-01-05 09:30")  // → 09:30 NYC time (14:30 UTC in winter)
 * local("2026-01-05 09:30")      // → same, day name is optional
 * local("2026-01-05")            // → midnight in that timezone
 */
function localTime(timeZone: string) {
	const tz = findTimeZone(timeZone);

	return (readable: string): Date => {
		const cleaned = readable.replace(/^[A-Za-z]{3}\s+/, "");
		const [datePart, timePart] = cleaned.split(" ");
		const [year, month, day] = datePart.split("-").map(Number);
		const [hours, minutes] = timePart
			? timePart.split(":").map(Number)
			: [0, 0];

		return new Date(
			getUnixTime(
				{ year, month, day, hours, minutes, seconds: 0, milliseconds: 0 },
				tz,
			),
		);
	};
}

interface TestCaseConfig {
	/** Fulfillment type. Default: "PICKUP". */
	fulfillment?: FulfillmentPreference;
	/** Location overrides (pickup_hours, delivery_hours, timezone, etc.). */
	location?: Partial<LocationLike>;
	/** Store config overrides. */
	store?: Partial<StoreConfig>;
	/** Prep-time overrides. */
	prepTime?: Partial<PrepTimeSettings>;
	/** Cart items. Default: []. */
	cartItems?: CartItem[];
	/** Whether this is a catering flow. */
	isCateringFlow?: boolean;
}

/**
 * Build the full `GetSchedulesParams` from a minimal, readable config.
 * Every test case can specify only the parts it cares about.
 */
function buildParams(
	timezone: string,
	cfg: TestCaseConfig,
): GetSchedulesParams {
	const location: LocationLike = {
		location_id: "loc-test",
		timezone,
		pickup_hours: [
			{ day: 0, start_time: "09:00", end_time: "17:00" },
			{ day: 1, start_time: "09:00", end_time: "17:00" },
			{ day: 2, start_time: "09:00", end_time: "17:00" },
			{ day: 3, start_time: "09:00", end_time: "17:00" },
			{ day: 4, start_time: "09:00", end_time: "17:00" },
			{ day: 5, start_time: "09:00", end_time: "17:00" },
			{ day: 6, start_time: "09:00", end_time: "17:00" },
		],
		...cfg.location,
	};

	const store: StoreConfig = {
		isAsapOrders: false,
		isSameDayOrders: false,
		max_future_order_days: 7,
		businessHoursOverrides: [],
		weeklyPreSaleConfig: { active: false, pickup_days: [], ordering_days: [] },
		...cfg.store,
	};

	const prepTimeSettings: PrepTimeSettings = {
		prepTimeInMinutes: 0,
		gapInMinutes: 15,
		busyTimes: {},
		fulfillAtBusinessDayStart: false,
		...cfg.prepTime,
	};

	return {
		store,
		locations: [location],
		cartItems: cfg.cartItems ?? [],
		fulfillmentPreference: cfg.fulfillment ?? "PICKUP",
		prepTimeSettings,
		currentLocation: location,
		isCateringFlow: cfg.isCateringFlow,
	};
}

describe("time-slots", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("schedule generation", () => {
		const TIMEZONE = "UTC";
		const local = localTime(TIMEZONE);

		it("basic 7-day schedule with default hours", () => {
			vi.setSystemTime(local("Mon 2026-01-05 12:00"));

			const { schedule } = getSchedules(
				buildParams(TIMEZONE, {
					location: {
						pickup_hours: [
							{ day: 0, start_time: "09:00", end_time: "17:00" },
							{ day: 1, start_time: "09:00", end_time: "17:00" },
							{ day: 2, start_time: "09:00", end_time: "17:00" },
							{ day: 3, start_time: "09:00", end_time: "17:00" },
							{ day: 4, start_time: "09:00", end_time: "17:00" },
							{ day: 5, start_time: "09:00", end_time: "17:00" },
							{ day: 6, start_time: "09:00", end_time: "17:00" },
						],
					},
				}),
			);

			expect(schedule).toHaveLength(7);
			schedule.forEach((day) => {
				expect(day.slots.length).toBeGreaterThan(0);
			});
		});

		it("weekdays open late, weekends open early", () => {
			vi.setSystemTime(local("Mon 2026-01-05 08:00"));

			const { schedule } = getSchedules(
				buildParams(TIMEZONE, {
					location: {
						pickup_hours: [
							{ day: 0, start_time: "07:00", end_time: "13:00" }, // Sun
							{ day: 1, start_time: "11:00", end_time: "21:00" }, // Mon
							{ day: 2, start_time: "11:00", end_time: "21:00" }, // Tue
							{ day: 3, start_time: "11:00", end_time: "21:00" }, // Wed
							{ day: 4, start_time: "11:00", end_time: "21:00" }, // Thu
							{ day: 5, start_time: "11:00", end_time: "23:00" }, // Fri
							{ day: 6, start_time: "07:00", end_time: "13:00" }, // Sat
						],
					},
				}),
			);

			expect(schedule).toHaveLength(7);
			const mondayFirstSlot = schedule[0].slots[0] as Date;
			expect(mondayFirstSlot.getUTCHours()).toBeGreaterThanOrEqual(11);
		});

		it("handles split shift with lunch break", () => {
			vi.setSystemTime(local("Mon 2026-01-05 09:00"));

			const { schedule } = getSchedules(
				buildParams(TIMEZONE, {
					location: {
						pickup_hours: [
							{ day: 1, start_time: "09:00", end_time: "12:00" }, // Mon morning
							{ day: 1, start_time: "13:00", end_time: "17:00" }, // Mon afternoon
							{ day: 2, start_time: "09:00", end_time: "12:00" }, // Tue morning
							{ day: 2, start_time: "13:00", end_time: "17:00" }, // Tue afternoon
							{ day: 3, start_time: "09:00", end_time: "17:00" }, // Wed: no break
							{ day: 4, start_time: "09:00", end_time: "17:00" }, // Thu: no break
							{ day: 5, start_time: "09:00", end_time: "12:00" }, // Fri morning
							{ day: 5, start_time: "13:00", end_time: "17:00" }, // Fri afternoon
						],
					},
				}),
			);

			expect(schedule.length).toBeGreaterThan(0);
			expect(schedule[0].slots.length).toBeGreaterThan(0);
			// No slots should fall in the 12:15–12:59 gap on Monday (inside the break)
			const mondaySlots = schedule[0].slots as Date[];
			const slotsInGap = mondaySlots.filter(
				(s) => s.getUTCHours() === 12 && s.getUTCMinutes() >= 15,
			);
			expect(slotsInGap).toHaveLength(0);
		});
	});

	describe("buffer times", () => {
		const TIMEZONE = "UTC";
		const local = localTime(TIMEZONE);

		// ── Opening buffer ───────────────────────────────────────────────────

		it("opening buffer pushes the first slot forward from store open", () => {
			// Store opens 09:00, 30min opening buffer → first slot at 09:30
			vi.setSystemTime(local("Mon 2026-01-05 07:00"));

			const { schedule } = getSchedules(
				buildParams(TIMEZONE, {
					location: {
						pickup_hours: [
							{ day: 1, start_time: "09:00", end_time: "17:00" },
							{ day: 2, start_time: "09:00", end_time: "17:00" },
						],
					},
					prepTime: { openingBuffer: 30 },
				}),
			);

			const tuesdayFirstSlot = schedule[1].slots[0] as Date;
			expect(tuesdayFirstSlot).toEqual(local("Tue 2026-01-06 09:30"));
		});

		it("opening buffer combined with prep time — first slot is the later of the two (prep wins)", () => {
			// Store opens 09:00, 30min buffer (→ 09:30), now is 09:10 + 45min prep (→ 09:55)
			// First slot should be 09:55 (prep wins)
			vi.setSystemTime(local("Mon 2026-01-05 09:10"));

			const { schedule } = getSchedules(
				buildParams(TIMEZONE, {
					location: {
						pickup_hours: [{ day: 1, start_time: "09:00", end_time: "17:00" }],
					},
					prepTime: { openingBuffer: 30, prepTimeInMinutes: 45 },
				}),
			);

			const firstSlot = schedule[0].slots[0] as Date;
			expect(firstSlot).toEqual(local("Mon 2026-01-05 09:55"));
		});

		it("opening buffer combined with prep time — first slot is the later of the two (buffer wins)", () => {
			// Store opens 09:00, 60min buffer (→ 10:00), now is 09:10 + 10min prep (→ 09:20)
			// First slot should be 10:00 (buffer wins)
			vi.setSystemTime(local("Mon 2026-01-05 09:10"));

			const { schedule } = getSchedules(
				buildParams(TIMEZONE, {
					location: {
						pickup_hours: [{ day: 1, start_time: "09:00", end_time: "17:00" }],
					},
					prepTime: { openingBuffer: 60, prepTimeInMinutes: 10 },
				}),
			);

			const firstSlot = schedule[0].slots[0] as Date;
			expect(firstSlot).toEqual(local("Mon 2026-01-05 10:00"));
		});

		// ── Closing buffer ──────────────────────────────────────────────────

		it("closing buffer pulls the last slot back from store close", () => {
			// Store closes 17:00, 30min closing buffer → last slot no later than 16:30
			vi.setSystemTime(local("Mon 2026-01-05 07:00"));

			const { schedule } = getSchedules(
				buildParams(TIMEZONE, {
					location: {
						pickup_hours: [
							{ day: 1, start_time: "09:00", end_time: "17:00" },
							{ day: 2, start_time: "09:00", end_time: "17:00" },
						],
					},
					prepTime: { closingBuffer: 30 },
				}),
			);

			const tuesdaySlots = schedule[1].slots as Date[];
			const lastSlot = tuesdaySlots[tuesdaySlots.length - 1];
			expect(lastSlot).toEqual(local("Tue 2026-01-06 16:30"));
		});

		it("closing buffer applies only to the last shift of a split-shift day", () => {
			// Mon: morning 09:00-12:00, afternoon 13:00-17:00
			// 30min closing buffer → morning ends at 12:00 (untouched), afternoon ends at 16:30
			vi.setSystemTime(local("Mon 2026-01-05 07:00"));

			const { schedule } = getSchedules(
				buildParams(TIMEZONE, {
					location: {
						pickup_hours: [
							{ day: 1, start_time: "09:00", end_time: "12:00" }, // Mon morning
							{ day: 1, start_time: "13:00", end_time: "17:00" }, // Mon afternoon
							{ day: 2, start_time: "09:00", end_time: "17:00" }, // Tue
						],
					},
					prepTime: { closingBuffer: 30 },
				}),
			);

			const mondaySlots = schedule[0].slots as Date[];

			// Morning shift should still have a slot at 12:00 (no buffer on non-last shift)
			const hasNoonSlot = mondaySlots.some(
				(s) => s.getTime() === local("Mon 2026-01-05 12:00").getTime(),
			);
			expect(hasNoonSlot).toBe(true);

			// Last slot of the day should be exactly 16:30 (17:00 - 30min buffer)
			const lastSlot = mondaySlots[mondaySlots.length - 1];
			expect(lastSlot).toEqual(local("Mon 2026-01-05 16:30"));
		});

		// ── Both buffers ────────────────────────────────────────────────────

		it("opening + closing buffer combined narrows the slot window from both sides", () => {
			// Store 09:00-17:00, 30min each side → slots only 09:30–16:30
			vi.setSystemTime(local("Mon 2026-01-05 07:00"));

			const { schedule } = getSchedules(
				buildParams(TIMEZONE, {
					location: {
						pickup_hours: [
							{ day: 1, start_time: "09:00", end_time: "17:00" },
							{ day: 2, start_time: "09:00", end_time: "17:00" },
						],
					},
					prepTime: { openingBuffer: 30, closingBuffer: 30 },
				}),
			);

			const tuesdaySlots = schedule[1].slots as Date[];
			const firstSlot = tuesdaySlots[0];
			const lastSlot = tuesdaySlots[tuesdaySlots.length - 1];

			expect(firstSlot).toEqual(local("Tue 2026-01-06 09:30"));
			expect(lastSlot).toEqual(local("Tue 2026-01-06 16:30"));
		});

		it("buffers larger than the available window produce at most a single boundary slot", () => {
			// Store 10:00-12:00 (2hr window), 1hr buffer each side → opening pushes to 11:00, closing pulls to 11:00
			// The code inserts a single slot at the exact meeting point (11:00)
			vi.setSystemTime(local("Mon 2026-01-05 07:00"));

			const { schedule } = getSchedules(
				buildParams(TIMEZONE, {
					location: {
						pickup_hours: [
							{ day: 1, start_time: "10:00", end_time: "12:00" }, // Mon: 2hr window
							{ day: 2, start_time: "09:00", end_time: "17:00" }, // Tue: normal
						],
					},
					prepTime: { openingBuffer: 60, closingBuffer: 60 },
				}),
			);

			const mondayDay = schedule.find(
				(day) => day.date.getTime() === local("Mon 2026-01-05").getTime(),
			);
			expect(mondayDay?.slots).toHaveLength(1);
			expect(mondayDay?.slots[0]).toEqual(local("Mon 2026-01-05 11:00"));
		});

		// ── Midnight spill ──────────────────────────────────────────────────

		it("midnight spill: closing buffer and opening buffer with continuation shift", () => {
			// Day 1 (Mon): 09:00-24:00
			// Day 2 (Tue): 00:00-02:00 (continuation of Mon), 08:00-17:00 (regular shift)
			// With 30min opening + closing buffer:
			//
			//   Mon:  09:30 – 24:00  (opening buffer, no closing buffer at midnight boundary)
			//   Tue continuation: 00:00 – 01:30  (closing buffer applied — end of Mon's shift)
			//   Tue regular: 08:30 – 16:30  (opening buffer on real first shift + closing buffer)
			vi.setSystemTime(local("Mon 2026-01-05 07:00"));

			const { schedule } = getSchedules(
				buildParams(TIMEZONE, {
					location: {
						pickup_hours: [
							{ day: 1, start_time: "09:00", end_time: "24:00" }, // Mon
							{ day: 2, start_time: "00:00", end_time: "02:00" }, // Tue midnight spill
							{ day: 2, start_time: "08:00", end_time: "17:00" }, // Tue regular
							{ day: 3, start_time: "09:00", end_time: "17:00" }, // Wed
						],
					},
					prepTime: { openingBuffer: 30, closingBuffer: 30 },
				}),
			);

			// ── Monday ──
			const mondaySlots = schedule[0].slots as Date[];
			const mondayFirst = mondaySlots[0];
			const mondayLast = mondaySlots[mondaySlots.length - 1];

			// Opening buffer: 09:00 + 30min = 09:30
			expect(mondayFirst).toEqual(local("Mon 2026-01-05 09:30"));
			// No closing buffer at 24:00 (midnight spill) — slots go up to end of day
			expect(mondayLast).toEqual(local("Mon 2026-01-05 23:45"));

			// ── Tuesday ──
			const tuesdaySlots = schedule[1].slots as Date[];

			// Midnight continuation starts at 00:00 (no opening buffer on continuation)
			expect(tuesdaySlots[0]).toEqual(local("Tue 2026-01-06 00:00"));

			// Closing buffer on the continuation: 02:00 - 30min = 01:30
			const continuationSlots = tuesdaySlots.filter(
				(s) => s.getTime() < local("Tue 2026-01-06 03:00").getTime(),
			);
			const continuationLast = continuationSlots[continuationSlots.length - 1];
			expect(continuationLast).toEqual(local("Tue 2026-01-06 01:30"));

			// Regular Tue shift: opening buffer 08:00 + 30min = 08:30
			const regularSlots = tuesdaySlots.filter(
				(s) => s.getTime() >= local("Tue 2026-01-06 08:00").getTime(),
			);
			expect(regularSlots[0]).toEqual(local("Tue 2026-01-06 08:30"));

			// Regular Tue shift: closing buffer 17:00 - 30min = 16:30
			const regularLast = regularSlots[regularSlots.length - 1];
			expect(regularLast).toEqual(local("Tue 2026-01-06 16:30"));
		});

		it("midnight spill with multiple shifts: buffers only on first real shift and last shift", () => {
			// Day 2 (Tue): 00:00-02:00 (continuation), 08:00-12:00, 13:00-17:00
			// With 30min opening + closing buffer:
			//
			//   Tue continuation: 00:00 – 01:30  (closing buffer — end of Mon's spill)
			//   Tue shift 1:     08:30 – 12:00  (opening buffer on real first shift, no closing buffer)
			//   Tue shift 2:     13:00 – 16:30  (no opening buffer, closing buffer on last shift)
			vi.setSystemTime(local("Mon 2026-01-05 07:00"));

			const { schedule } = getSchedules(
				buildParams(TIMEZONE, {
					location: {
						pickup_hours: [
							{ day: 1, start_time: "09:00", end_time: "24:00" }, // Mon
							{ day: 2, start_time: "00:00", end_time: "02:00" }, // Tue midnight spill
							{ day: 2, start_time: "08:00", end_time: "12:00" }, // Tue morning
							{ day: 2, start_time: "13:00", end_time: "17:00" }, // Tue afternoon
							{ day: 3, start_time: "09:00", end_time: "17:00" }, // Wed
						],
					},
					prepTime: { openingBuffer: 30, closingBuffer: 30 },
				}),
			);

			const tuesdaySlots = schedule[1].slots as Date[];

			// ── Continuation (00:00-02:00) ──
			// No opening buffer (it's a continuation), closing buffer applied: 02:00 - 30min = 01:30
			const continuationSlots = tuesdaySlots.filter(
				(s) => s.getTime() < local("Tue 2026-01-06 03:00").getTime(),
			);
			expect(continuationSlots[0]).toEqual(local("Tue 2026-01-06 00:00"));
			expect(continuationSlots[continuationSlots.length - 1]).toEqual(
				local("Tue 2026-01-06 01:30"),
			);

			// ── Morning shift (08:00-12:00) ──
			// Opening buffer on the real first shift: 08:00 + 30min = 08:30
			// No closing buffer (not the last shift)
			const morningSlots = tuesdaySlots.filter(
				(s) =>
					s.getTime() >= local("Tue 2026-01-06 08:00").getTime() &&
					s.getTime() <= local("Tue 2026-01-06 12:00").getTime(),
			);
			expect(morningSlots[0]).toEqual(local("Tue 2026-01-06 08:30"));
			expect(morningSlots[morningSlots.length - 1]).toEqual(
				local("Tue 2026-01-06 12:00"),
			);

			// ── Afternoon shift (13:00-17:00) ──
			// No opening buffer (not the real first shift)
			// Closing buffer on last shift: 17:00 - 30min = 16:30
			const afternoonSlots = tuesdaySlots.filter(
				(s) => s.getTime() >= local("Tue 2026-01-06 13:00").getTime(),
			);
			expect(afternoonSlots[0]).toEqual(local("Tue 2026-01-06 13:00"));
			expect(afternoonSlots[afternoonSlots.length - 1]).toEqual(
				local("Tue 2026-01-06 16:30"),
			);
		});

		// ── Edge / zero cases ───────────────────────────────────────────────

		it("no buffers set (undefined) — slots use the full business hours window", () => {
			vi.setSystemTime(local("Mon 2026-01-05 07:00"));

			const { schedule } = getSchedules(
				buildParams(TIMEZONE, {
					location: {
						pickup_hours: [
							{ day: 1, start_time: "09:00", end_time: "17:00" },
							{ day: 2, start_time: "09:00", end_time: "17:00" },
						],
					},
				}),
			);

			const tuesdaySlots = schedule[1].slots as Date[];
			expect(tuesdaySlots[0]).toEqual(local("Tue 2026-01-06 09:00"));
			expect(tuesdaySlots[tuesdaySlots.length - 1]).toEqual(
				local("Tue 2026-01-06 17:00"),
			);
		});

		it("buffer applies to every day of the week", () => {
			// 7-day schedule, all days 09:00-17:00, 30min opening + closing buffer
			// Every day should start at 09:30 and end at 16:30
			vi.setSystemTime(local("Mon 2026-01-05 07:00"));

			const { schedule } = getSchedules(
				buildParams(TIMEZONE, {
					location: {
						pickup_hours: [
							{ day: 0, start_time: "09:00", end_time: "17:00" },
							{ day: 1, start_time: "09:00", end_time: "17:00" },
							{ day: 2, start_time: "09:00", end_time: "17:00" },
							{ day: 3, start_time: "09:00", end_time: "17:00" },
							{ day: 4, start_time: "09:00", end_time: "17:00" },
							{ day: 5, start_time: "09:00", end_time: "17:00" },
							{ day: 6, start_time: "09:00", end_time: "17:00" },
						],
					},
					prepTime: { openingBuffer: 30, closingBuffer: 30 },
				}),
			);

			// Skip first day (today) since prep time / "now" logic affects it differently
			const futureDays = schedule.slice(1);
			expect(futureDays.length).toBeGreaterThanOrEqual(6);
			for (const day of futureDays) {
				const slots = day.slots as Date[];
				const first = slots[0];
				const last = slots[slots.length - 1];

				// Every future day: first slot at 09:30, last slot at 16:30
				expect(first.getUTCHours() * 60 + first.getUTCMinutes()).toBe(
					9 * 60 + 30,
				);
				expect(last.getUTCHours() * 60 + last.getUTCMinutes()).toBe(
					16 * 60 + 30,
				);
			}
		});

		it("pre-sale orders do not apply buffer", () => {
			// Pre-sale active with buffers set — buffers should be ignored
			vi.setSystemTime(local("Mon 2026-01-05 07:00"));

			const { schedule } = getSchedules(
				buildParams(TIMEZONE, {
					location: {
						pickup_hours: [
							{ day: 1, start_time: "09:00", end_time: "17:00" },
							{ day: 2, start_time: "09:00", end_time: "17:00" },
						],
					},
					store: {
						preSaleConfig: {
							active: true,
							due_start_date: local("Mon 2026-01-05"),
							due_end_date: local("Mon 2026-01-05 23:59"),
							use_store_hours_due: true,
						},
					},
					prepTime: { openingBuffer: 30, closingBuffer: 30 },
					cartItems: [{ preSale: true }],
				}),
			);

			expect(schedule.length).toBeGreaterThan(0);
			const firstDaySlots = schedule[0].slots as Date[];

			// Buffers should NOT apply — first slot at 09:00, not 09:30
			expect(firstDaySlots[0]).toEqual(local("Mon 2026-01-05 09:00"));
			// Last slot at 17:00, not 16:30
			expect(firstDaySlots[firstDaySlots.length - 1]).toEqual(
				local("Mon 2026-01-05 17:00"),
			);
		});

		it("buffer of 0 behaves the same as no buffer", () => {
			vi.setSystemTime(local("Mon 2026-01-05 07:00"));

			const { schedule } = getSchedules(
				buildParams(TIMEZONE, {
					location: {
						pickup_hours: [
							{ day: 1, start_time: "09:00", end_time: "17:00" },
							{ day: 2, start_time: "09:00", end_time: "17:00" },
						],
					},
					prepTime: { openingBuffer: 0, closingBuffer: 0 },
				}),
			);

			const tuesdaySlots = schedule[1].slots as Date[];
			expect(tuesdaySlots[0]).toEqual(local("Tue 2026-01-06 09:00"));
			expect(tuesdaySlots[tuesdaySlots.length - 1]).toEqual(
				local("Tue 2026-01-06 17:00"),
			);
		});
	});

	describe("prep time", () => {
		const TIMEZONE = "UTC";
		const local = localTime(TIMEZONE);

		// ── Basic MINUTE cadence ─────────────────────────────────────────────

		it("no prep time → first slot at store open", () => {
			// now = Mon 07:00, store 09:00-17:00, prep = 0
			vi.setSystemTime(local("Mon 2026-01-05 07:00"));

			const { schedule } = getSchedules(
				buildParams(TIMEZONE, {
					location: {
						pickup_hours: [
							{ day: 1, start_time: "09:00", end_time: "17:00" },
						],
					},
					prepTime: { prepTimeInMinutes: 0 },
				}),
			);

			const mondaySlots = schedule[0].slots as Date[];
			expect(mondaySlots[0]).toEqual(local("Mon 2026-01-05 09:00"));
		});

		it("now is before store open + 30min prep → first slot = open + 30", () => {
			// now = Mon 07:00 (before open), store 09:00-17:00, prep = 30
			// First slot = Mon 09:30
			vi.setSystemTime(local("Mon 2026-01-05 07:00"));

			const { schedule } = getSchedules(
				buildParams(TIMEZONE, {
					location: {
						pickup_hours: [
							{ day: 1, start_time: "09:00", end_time: "17:00" },
						],
					},
					prepTime: { prepTimeInMinutes: 30 },
				}),
			);

			const mondaySlots = schedule[0].slots as Date[];
			expect(mondaySlots[0]).toEqual(local("Mon 2026-01-05 09:30"));
		});

		it("now is after store open + 30min prep → first slot = now + 30", () => {
			// now = Mon 09:10, store 09:00-17:00, prep = 30
			// First slot = Mon 09:40 (not grid-aligned — unshifted ahead of the grid)
			vi.setSystemTime(local("Mon 2026-01-05 09:10"));

			const { schedule } = getSchedules(
				buildParams(TIMEZONE, {
					location: {
						pickup_hours: [
							{ day: 1, start_time: "09:00", end_time: "17:00" },
						],
					},
					prepTime: { prepTimeInMinutes: 30 },
				}),
			);

			const mondaySlots = schedule[0].slots as Date[];
			expect(mondaySlots[0]).toEqual(local("Mon 2026-01-05 09:40"));
			// Rest of the slots stay on the 15-min grid
			expect(mondaySlots[1]).toEqual(local("Mon 2026-01-05 09:45"));
			expect(mondaySlots[2]).toEqual(local("Mon 2026-01-05 10:00"));
		});

		it("prep time does not apply to future days", () => {
			// now = Mon 10:00, store 09:00-17:00, prep = 60
			// Mon first slot: 11:00 (now + 60)
			// Tue first slot: 09:00 (no prep on future days)
			vi.setSystemTime(local("Mon 2026-01-05 10:00"));

			const { schedule } = getSchedules(
				buildParams(TIMEZONE, {
					location: {
						pickup_hours: [
							{ day: 1, start_time: "09:00", end_time: "17:00" },
							{ day: 2, start_time: "09:00", end_time: "17:00" },
						],
					},
					prepTime: { prepTimeInMinutes: 60 },
				}),
			);

			const mondaySlots = schedule[0].slots as Date[];
			const tuesdaySlots = schedule[1].slots as Date[];
			expect(mondaySlots[0]).toEqual(local("Mon 2026-01-05 11:00"));
			expect(tuesdaySlots[0]).toEqual(local("Tue 2026-01-06 09:00"));
		});

		// ── Spillover ────────────────────────────────────────────────────────

		it("prep time pushes past today's close → today dropped, first slot = tomorrow open", () => {
			// now = Mon 16:30, store 09:00-17:00, prep = 60
			// Mon: 17:30 > 17:00 → today has no slots; schedule starts at Tue 09:00
			vi.setSystemTime(local("Mon 2026-01-05 16:30"));

			const { schedule } = getSchedules(
				buildParams(TIMEZONE, {
					location: {
						pickup_hours: [
							{ day: 1, start_time: "09:00", end_time: "17:00" },
							{ day: 2, start_time: "09:00", end_time: "17:00" },
						],
					},
					prepTime: { prepTimeInMinutes: 60 },
				}),
			);

			// Monday dropped entirely
			expect(schedule[0].date).toEqual(local("Tue 2026-01-06"));
			expect((schedule[0].slots as Date[])[0]).toEqual(
				local("Tue 2026-01-06 09:00"),
			);
		});

		it("prep time spills from morning shift into afternoon shift same day", () => {
			// Mon morning 09:00-12:00, afternoon 13:00-17:00
			// now = Mon 11:00, prep = 150 → 13:30 (past morning close)
			// Morning: skipped; afternoon first slot = 13:30
			vi.setSystemTime(local("Mon 2026-01-05 11:00"));

			const { schedule } = getSchedules(
				buildParams(TIMEZONE, {
					location: {
						pickup_hours: [
							{ day: 1, start_time: "09:00", end_time: "12:00" },
							{ day: 1, start_time: "13:00", end_time: "17:00" },
						],
					},
					prepTime: { prepTimeInMinutes: 150 },
				}),
			);

			const mondaySlots = schedule[0].slots as Date[];
			// No morning slots survive — first slot of the day is the spilled 13:30
			expect(mondaySlots[0]).toEqual(local("Mon 2026-01-05 13:30"));
			expect(mondaySlots[1]).toEqual(local("Mon 2026-01-05 13:45"));
		});

		it("large MINUTE prep (>1 day) skips full days and applies remainder on landing day", () => {
			// prep = 1680 (28h = 1 day + 4h), now = Mon 10:00, store 09:00-17:00
			// Skip 1 day → land on Tue; projected now = Tue 10:00 + 240min = Tue 14:00
			vi.setSystemTime(local("Mon 2026-01-05 10:00"));

			const { schedule } = getSchedules(
				buildParams(TIMEZONE, {
					location: {
						pickup_hours: [
							{ day: 1, start_time: "09:00", end_time: "17:00" },
							{ day: 2, start_time: "09:00", end_time: "17:00" },
							{ day: 3, start_time: "09:00", end_time: "17:00" },
						],
					},
					prepTime: { prepTimeInMinutes: 1680 },
				}),
			);

			// Monday dropped (skipped via dates.slice)
			expect(schedule[0].date).toEqual(local("Tue 2026-01-06"));
			expect((schedule[0].slots as Date[])[0]).toEqual(
				local("Tue 2026-01-06 14:00"),
			);
			// Wednesday is unaffected: starts at open
			expect((schedule[1].slots as Date[])[0]).toEqual(
				local("Wed 2026-01-07 09:00"),
			);
		});

		// ── DAY cadence (fulfillAtBusinessDayStart) ──────────────────────────

		it("DAY cadence 1 day → skip today, first slot at tomorrow's open", () => {
			// prep = 1440 (1 day), fulfillAtBusinessDayStart → DAY cadence, frequency = 1
			// now = Mon 10:00 → first slot = Tue 09:00
			vi.setSystemTime(local("Mon 2026-01-05 10:00"));

			const { schedule } = getSchedules(
				buildParams(TIMEZONE, {
					location: {
						pickup_hours: [
							{ day: 1, start_time: "09:00", end_time: "17:00" },
							{ day: 2, start_time: "09:00", end_time: "17:00" },
							{ day: 3, start_time: "09:00", end_time: "17:00" },
						],
					},
					prepTime: {
						prepTimeInMinutes: 1440,
						fulfillAtBusinessDayStart: true,
					},
				}),
			);

			expect(schedule[0].date).toEqual(local("Tue 2026-01-06"));
			expect((schedule[0].slots as Date[])[0]).toEqual(
				local("Tue 2026-01-06 09:00"),
			);
		});

		it("DAY cadence 2 days → skip 2 days, first slot at day-3 open", () => {
			// prep = 2880 (2 days), now = Mon 10:00 → first slot = Wed 09:00
			vi.setSystemTime(local("Mon 2026-01-05 10:00"));

			const { schedule } = getSchedules(
				buildParams(TIMEZONE, {
					location: {
						pickup_hours: [
							{ day: 1, start_time: "09:00", end_time: "17:00" },
							{ day: 2, start_time: "09:00", end_time: "17:00" },
							{ day: 3, start_time: "09:00", end_time: "17:00" },
							{ day: 4, start_time: "09:00", end_time: "17:00" },
						],
					},
					prepTime: {
						prepTimeInMinutes: 2880,
						fulfillAtBusinessDayStart: true,
					},
				}),
			);

			expect(schedule[0].date).toEqual(local("Wed 2026-01-07"));
			expect((schedule[0].slots as Date[])[0]).toEqual(
				local("Wed 2026-01-07 09:00"),
			);
		});

		it("DAY cadence with opening buffer → first slot = landing day open + buffer", () => {
			// prep = 1440 (1 day), opening buffer = 30 → Tue 09:30
			vi.setSystemTime(local("Mon 2026-01-05 10:00"));

			const { schedule } = getSchedules(
				buildParams(TIMEZONE, {
					location: {
						pickup_hours: [
							{ day: 1, start_time: "09:00", end_time: "17:00" },
							{ day: 2, start_time: "09:00", end_time: "17:00" },
						],
					},
					prepTime: {
						prepTimeInMinutes: 1440,
						fulfillAtBusinessDayStart: true,
						openingBuffer: 30,
					},
				}),
			);

			expect(schedule[0].date).toEqual(local("Tue 2026-01-06"));
			expect((schedule[0].slots as Date[])[0]).toEqual(
				local("Tue 2026-01-06 09:30"),
			);
		});

		// ── Day skipping edge cases ──────────────────────────────────────────

		it("DAY cadence: a closed day in the middle of the week is skipped over", () => {
			// Mon/Wed/Thu/Fri open, Tue closed, prep = 1 day, now = Mon 10:00
			// dates = [Mon, Wed, Thu, Fri, ...] → slice(1) = [Wed, ...]
			// First slot = Wed 09:00 (Tue is skipped because there are no hours)
			vi.setSystemTime(local("Mon 2026-01-05 10:00"));

			const { schedule } = getSchedules(
				buildParams(TIMEZONE, {
					location: {
						pickup_hours: [
							{ day: 1, start_time: "09:00", end_time: "17:00" }, // Mon
							{ day: 3, start_time: "09:00", end_time: "17:00" }, // Wed
							{ day: 4, start_time: "09:00", end_time: "17:00" }, // Thu
							{ day: 5, start_time: "09:00", end_time: "17:00" }, // Fri
						],
					},
					prepTime: {
						prepTimeInMinutes: 1440,
						fulfillAtBusinessDayStart: true,
					},
				}),
			);

			expect(schedule[0].date).toEqual(local("Wed 2026-01-07"));
			expect((schedule[0].slots as Date[])[0]).toEqual(
				local("Wed 2026-01-07 09:00"),
			);
		});

		it("DAY cadence: today is closed → today excluded, skip starts from first open day", () => {
			// Mondays closed, Tue-Fri open, prep = 1 day, now = Mon 10:00
			// dates = [Tue, Wed, Thu, Fri, ...] → slice(1) = [Wed, ...]
			// First slot = Wed 09:00
			vi.setSystemTime(local("Mon 2026-01-05 10:00"));

			const { schedule } = getSchedules(
				buildParams(TIMEZONE, {
					location: {
						pickup_hours: [
							{ day: 2, start_time: "09:00", end_time: "17:00" }, // Tue
							{ day: 3, start_time: "09:00", end_time: "17:00" }, // Wed
							{ day: 4, start_time: "09:00", end_time: "17:00" }, // Thu
							{ day: 5, start_time: "09:00", end_time: "17:00" }, // Fri
						],
					},
					prepTime: {
						prepTimeInMinutes: 1440,
						fulfillAtBusinessDayStart: true,
					},
				}),
			);

			expect(schedule[0].date).toEqual(local("Wed 2026-01-07"));
			expect((schedule[0].slots as Date[])[0]).toEqual(
				local("Wed 2026-01-07 09:00"),
			);
		});

		it("DAY cadence: now is BEFORE today's opening → today counts toward the skip", () => {
			// now = Mon 07:00 (store opens 09:00), prep = 1 day → first slot = Tue 09:00
			vi.setSystemTime(local("Mon 2026-01-05 07:00"));

			const { schedule } = getSchedules(
				buildParams(TIMEZONE, {
					location: {
						pickup_hours: [
							{ day: 1, start_time: "09:00", end_time: "17:00" },
							{ day: 2, start_time: "09:00", end_time: "17:00" },
							{ day: 3, start_time: "09:00", end_time: "17:00" },
						],
					},
					prepTime: {
						prepTimeInMinutes: 1440,
						fulfillAtBusinessDayStart: true,
					},
				}),
			);

			expect(schedule[0].date).toEqual(local("Tue 2026-01-06"));
			expect((schedule[0].slots as Date[])[0]).toEqual(
				local("Tue 2026-01-06 09:00"),
			);
		});

		it("DAY cadence: now is DURING today's hours → today counts toward the skip (same as before-open)", () => {
			// now = Mon 12:00 (mid-day), prep = 1 day → first slot = Tue 09:00
			vi.setSystemTime(local("Mon 2026-01-05 12:00"));

			const { schedule } = getSchedules(
				buildParams(TIMEZONE, {
					location: {
						pickup_hours: [
							{ day: 1, start_time: "09:00", end_time: "17:00" },
							{ day: 2, start_time: "09:00", end_time: "17:00" },
							{ day: 3, start_time: "09:00", end_time: "17:00" },
						],
					},
					prepTime: {
						prepTimeInMinutes: 1440,
						fulfillAtBusinessDayStart: true,
					},
				}),
			);

			expect(schedule[0].date).toEqual(local("Tue 2026-01-06"));
			expect((schedule[0].slots as Date[])[0]).toEqual(
				local("Tue 2026-01-06 09:00"),
			);
		});

		it("DAY cadence: now is AFTER today's close → today excluded (one extra day skipped)", () => {
			// now = Mon 18:00 (after Mon close 17:00), prep = 1 day
			// requestTime > shiftEnd → Mon excluded from dates entirely
			// dates = [Tue, Wed, ...] → slice(1) = [Wed, ...] → first slot = Wed 09:00
			vi.setSystemTime(local("Mon 2026-01-05 18:00"));

			const { schedule } = getSchedules(
				buildParams(TIMEZONE, {
					location: {
						pickup_hours: [
							{ day: 1, start_time: "09:00", end_time: "17:00" },
							{ day: 2, start_time: "09:00", end_time: "17:00" },
							{ day: 3, start_time: "09:00", end_time: "17:00" },
						],
					},
					prepTime: {
						prepTimeInMinutes: 1440,
						fulfillAtBusinessDayStart: true,
					},
				}),
			);

			expect(schedule[0].date).toEqual(local("Wed 2026-01-07"));
			expect((schedule[0].slots as Date[])[0]).toEqual(
				local("Wed 2026-01-07 09:00"),
			);
		});

		it("MINUTE cadence with day skipping: closed middle day is skipped (parity with DAY cadence)", () => {
			// prep = 1500 (1 day + 60min), Tue closed, now = Mon 10:00
			// minuteCadenceDaysSkipped = 1, effectivePrepMinutes = 60
			// dates = [Mon, Wed, Thu, ...] → slice(1) = [Wed, ...]
			// Wed: projectedNow = Wed 10:00 + 60min = Wed 11:00
			vi.setSystemTime(local("Mon 2026-01-05 10:00"));

			const { schedule } = getSchedules(
				buildParams(TIMEZONE, {
					location: {
						pickup_hours: [
							{ day: 1, start_time: "09:00", end_time: "17:00" }, // Mon
							{ day: 3, start_time: "09:00", end_time: "17:00" }, // Wed
							{ day: 4, start_time: "09:00", end_time: "17:00" }, // Thu
							{ day: 5, start_time: "09:00", end_time: "17:00" }, // Fri
						],
					},
					prepTime: { prepTimeInMinutes: 1500 },
				}),
			);

			expect(schedule[0].date).toEqual(local("Wed 2026-01-07"));
			expect((schedule[0].slots as Date[])[0]).toEqual(
				local("Wed 2026-01-07 11:00"),
			);
		});

		it("MINUTE cadence with day skipping: now after close projects time-of-day forward (differs from DAY cadence)", () => {
			// prep = 1500 (1 day + 60min), now = Mon 18:00 (after close), all days open
			// Mon excluded by requestTime check → dates = [Tue, Wed, ...] → slice(1) = [Wed, ...]
			// For Wed: projectedNow = Wed 18:00 (Mon's time-of-day projected) + 60 = Wed 19:00
			// 19:00 > Wed close 17:00 → Wed skipped, spills to Thu
			// Thu (future day branch): first slot = Thu 09:00
			//
			// Contrast: DAY cadence with same now would give Wed 09:00 — MINUTE projection
			// re-applies the original time-of-day, which can push past the landing day's close.
			vi.setSystemTime(local("Mon 2026-01-05 18:00"));

			const { schedule } = getSchedules(
				buildParams(TIMEZONE, {
					location: {
						pickup_hours: [
							{ day: 1, start_time: "09:00", end_time: "17:00" },
							{ day: 2, start_time: "09:00", end_time: "17:00" },
							{ day: 3, start_time: "09:00", end_time: "17:00" },
							{ day: 4, start_time: "09:00", end_time: "17:00" },
						],
					},
					prepTime: { prepTimeInMinutes: 1500 },
				}),
			);

			expect(schedule[0].date).toEqual(local("Thu 2026-01-08"));
			expect((schedule[0].slots as Date[])[0]).toEqual(
				local("Thu 2026-01-08 09:00"),
			);
		});

		it("MINUTE cadence: multi-day prep (>2 days) skips multiple full days, remainder applied on landing day", () => {
			// prep = 4400 (3 days + 80min), now = Mon 10:00
			// minuteCadenceDaysSkipped = 3, effectivePrepMinutes = 80
			// dates = [Mon, Tue, Wed, Thu, Fri, Sat, Sun] → slice(3) = [Thu, Fri, ...]
			// Thu: projectedNow = Thu 10:00 + 80 = Thu 11:20
			vi.setSystemTime(local("Mon 2026-01-05 10:00"));

			const { schedule } = getSchedules(
				buildParams(TIMEZONE, {
					location: {
						pickup_hours: [
							{ day: 0, start_time: "09:00", end_time: "17:00" },
							{ day: 1, start_time: "09:00", end_time: "17:00" },
							{ day: 2, start_time: "09:00", end_time: "17:00" },
							{ day: 3, start_time: "09:00", end_time: "17:00" },
							{ day: 4, start_time: "09:00", end_time: "17:00" },
							{ day: 5, start_time: "09:00", end_time: "17:00" },
							{ day: 6, start_time: "09:00", end_time: "17:00" },
						],
					},
					prepTime: { prepTimeInMinutes: 4400 },
				}),
			);

			expect(schedule[0].date).toEqual(local("Thu 2026-01-08"));
			expect((schedule[0].slots as Date[])[0]).toEqual(
				local("Thu 2026-01-08 11:20"),
			);
		});

		// ── Catering prep time from cart items ───────────────────────────────

		it("catering HOUR cadence from cart item → first slot = now + hours (in minutes)", () => {
			// now = Mon 09:00, cart item { cadence: hour, frequency: 2 }, catering flow
			// cateringShiftMinutes = 120 → first slot = Mon 11:00
			vi.setSystemTime(local("Mon 2026-01-05 09:00"));

			const { schedule } = getSchedules(
				buildParams(TIMEZONE, {
					location: {
						pickup_hours: [
							{ day: 1, start_time: "09:00", end_time: "17:00" },
						],
						catering: {
							enabled: true,
							pickup: { start_time: "09:00", end_time: "17:00" },
							delivery: { start_time: "09:00", end_time: "17:00" },
						},
					},
					cartItems: [
						{
							cateringService: {
								min_quantity: 1,
								max_quantity: 100,
								serve_count: 1,
								prep_time: { cadence: "hour", frequency: 2 },
							},
						},
					],
					isCateringFlow: true,
				}),
			);

			const mondaySlots = schedule[0].slots as Date[];
			expect(mondaySlots[0]).toEqual(local("Mon 2026-01-05 11:00"));
		});

		it("catering DAY cadence from cart item → skips full days", () => {
			// now = Mon 10:00, cart item { cadence: day, frequency: 1 }, catering flow
			// First slot = Tue 09:00
			vi.setSystemTime(local("Mon 2026-01-05 10:00"));

			const { schedule } = getSchedules(
				buildParams(TIMEZONE, {
					location: {
						pickup_hours: [
							{ day: 1, start_time: "09:00", end_time: "17:00" },
							{ day: 2, start_time: "09:00", end_time: "17:00" },
						],
						catering: {
							enabled: true,
							pickup: { start_time: "09:00", end_time: "17:00" },
							delivery: { start_time: "09:00", end_time: "17:00" },
						},
					},
					cartItems: [
						{
							cateringService: {
								min_quantity: 1,
								max_quantity: 100,
								serve_count: 1,
								prep_time: { cadence: "day", frequency: 1 },
							},
						},
					],
					isCateringFlow: true,
				}),
			);

			expect(schedule[0].date).toEqual(local("Tue 2026-01-06"));
			expect((schedule[0].slots as Date[])[0]).toEqual(
				local("Tue 2026-01-06 09:00"),
			);
		});

		// ── Delivery ─────────────────────────────────────────────────────────

		it("delivery: prep time + estimated delivery minutes both added on top", () => {
			// now = Mon 08:00 (before open), delivery_hours 09:00-17:00
			// prep = 30, estimatedDeliveryMinutes = 20
			// First slot = open + 30 (prep) + 20 (delivery) = 09:50
			vi.setSystemTime(local("Mon 2026-01-05 08:00"));

			const { schedule } = getSchedules(
				buildParams(TIMEZONE, {
					fulfillment: "DELIVERY",
					location: {
						delivery_hours: [
							{ day: 1, start_time: "09:00", end_time: "17:00" },
						],
					},
					prepTime: {
						prepTimeInMinutes: 30,
						estimatedDeliveryMinutes: 20,
					},
				}),
			);

			const mondaySlots = schedule[0].slots as Date[];
			expect(mondaySlots[0]).toEqual(local("Mon 2026-01-05 09:50"));
		});
	});
});
