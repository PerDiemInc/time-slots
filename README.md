# @perdieminc/time-slots

Generate time slots for scheduling—pickup, delivery, and curbside—with timezone-aware business hours, prep time, and optional pre-sale / catering rules.

## Requirements

- **Node.js** ≥ 20
- **TypeScript** (consumers can use the package from source or your built output)

## Install

```bash
npm install @perdieminc/time-slots
```

## Overview

This library helps you:

- Build **fulfillment schedules** (days and time slots) for a given location and fulfillment type (pickup, delivery, curbside).
- Respect **business hours** and overrides (e.g. holidays, special hours).
- Apply **prep time** (per shift or per day) and **slot gaps** to compute the first available slot and generate slots.
- Support **pre-sale** windows (date range and optional custom hours) and **weekly pre-sale** (fixed pickup/ordering days).
- Support **catering** flows with cart-derived prep time (by minute, hour, or day).
- Filter slots by **busy times** and optional **menu/category** rules.

All date/time logic is timezone-aware (e.g. `America/New_York`). The package supports multiple platforms for timezone handling: **web** (default, uses `@date-fns/tz`) and **ios/android** (uses `timezone-support`).

## Main API

### `getSchedules(params): GetSchedulesResult`

Builds the schedule for the current location and fulfillment preference.

**Parameters (`GetSchedulesParams`):**

| Field | Description |
|-------|-------------|
| `store` | Store config: ASAP/same-day flags, max future days, business hour overrides, pre-sale and weekly pre-sale config. |
| `locations` | List of locations (with `location_id`, `timezone`, and business hours). |
| `cartItems` | Cart items (used for pre-sale, weekly pre-sale, catering prep time, and category-based filtering). |
| `fulfillmentPreference` | `"PICKUP"` \| `"DELIVERY"` \| `"CURBSIDE"`. |
| `prepTimeSettings` | Prep time in minutes, gap, busy times, **fulfillAtBusinessDayStart** (when true, prep is treated as whole days; when false, as raw minutes), opening/closing buffers, and optional `estimatedDeliveryMinutes` for delivery. |
| `currentLocation` | The location to generate the schedule for. |
| `isCateringFlow` | If `true`, business hours come from `location.catering.pickup` / `location.catering.delivery` instead of `pickup_hours` / `delivery_hours`. |

**Returns:** `{ schedule: FulfillmentSchedule, isWeeklyPreSaleAvailable: boolean }`.

- **`schedule`** is an array of **day schedules**, each with `date`, `openingTime`, `closingTime`, `firstAvailableSlot`, and `slots` (array of `Date`).

### Types and constants

- **Fulfillment:** `FULFILLMENT_TYPES`, `FulfillmentType`, `FulfillmentSchedule`, `DaySchedule`.
- **Prep time:** `DEFAULT_PREP_TIME_IN_MINUTES`, `DEFAULT_GAP_IN_MINUTES`, `MINUTES_PER_DAY`, `PrepTimeSettings`, `PrepTimeCadence` (minute / hour / day).
- **Store / cart:** `StoreConfig`, `PreSaleConfig`, `WeeklyPreSaleConfig`, `CartItem`.
- **Location / hours:** `LocationLike`, `BusinessHour`, `BusinessHoursOverrideInput` / `Output`, `getLocationsBusinessHoursOverrides`, `getOpeningClosingTime`.

## Utilities (exported)

- **`getPreSalePickupDates(pickupDays, orderingDays)`** – Dates when weekly pre-sale pickup is allowed.
- **`isTodayInTimeZone(date, timezone)`** / **`isTomorrowInTimeZone(date, timezone)`** – Date checks in a given timezone.
- **`overrideTimeZoneOnUTC(utcDate, timezone)`** – Interpret a UTC date in a store timezone.
- **`filterBusyTimesFromSchedule({ schedule, busyTimes, cartCategoryIds })`** – Remove busy blocks from a schedule.
- **`filterMenusFromSchedule`** – Filter schedule by menu type.
- **`getOpeningClosingTime(params)`** – Opening/closing time for a given date and business hours.

Internal schedule generation uses **`getNextAvailableDates`**-style logic (timezone-aware "next N open days") and slot generation with configurable prep time and gap.

## Prep time

Prep time controls **when the first available slot lands** relative to "now." It runs in one of two cadences, picked by `fulfillAtBusinessDayStart`:

| Cadence  | When                                 | Treats `prepTimeInMinutes` as | First-slot rule on landing day                          |
| -------- | ------------------------------------ | ----------------------------- | ------------------------------------------------------- |
| MINUTE   | `fulfillAtBusinessDayStart: false`   | raw minutes                   | `max(now + prep, opening + openingBuffer)`              |
| DAY      | `fulfillAtBusinessDayStart: true`    | whole days (`/ 1440`)         | `opening + openingBuffer` (time-of-day ignored)         |

Buffers (`openingBuffer`, `closingBuffer`) trim the slot window from either end. `estimatedDeliveryMinutes` adds on top for delivery.

### Same-day, no day skipping (MINUTE cadence, prep < 1 day)

Most common case. The first slot is whichever is later: store open (with buffer) or `now + prep`.

```
            now+prep
              │
opening ─────┼─────────────────── close
             ▼
        first slot
```

If `now + prep` falls past today's close, today is dropped and the schedule starts at tomorrow's open.

### Day skipping (prep ≥ 1 day OR DAY cadence)

When prep crosses a full-day boundary, the schedule **skips entire business days** before placing the first slot.

**The algorithm:**

1. **Build a list of upcoming open business days.** Today is included unless the store is closed today, *or* `now` is past today's closing time.
2. **Slice off the first N entries.** N depends on cadence:
   - **DAY cadence:** `N = prepTimeInMinutes / 1440`
   - **MINUTE cadence:** `N = floor(prepTimeInMinutes / 1440)`; the leftover minutes (`prepTimeInMinutes % 1440`) are applied as prep on the landing day.
3. **The first remaining entry is the landing day.** Place the first slot using the cadence's first-slot rule.

**Note on closed days:** they are never in the dates list, so they don't count toward N. A closed weekday in the middle of the week is automatically "skipped over."

### MINUTE cadence projects time-of-day; DAY cadence doesn't

This is the key behavioral difference once you're skipping days.

- **DAY cadence:** every landing day starts at `opening + openingBuffer`. The user's order time doesn't matter.
- **MINUTE cadence:** the time-of-day from `now` is **projected** onto the landing day, then any leftover minutes are added. If the projected time falls past the landing day's close, that day is dropped and the schedule spills to the next open day.

```
MINUTE cadence projection:

  now = Mon 10:00,  prep = 1500 min  =  1 day + 60 min
                                        │       │
                              skip 1 day│       │ remainder
                                        ▼       ▼
                          land on Tue, then Tue 10:00 + 60 = Tue 11:00
```

### Worked example — 1-day prep, three different `now` values

Setup: store open Mon–Fri 09:00–17:00, `prepTimeInMinutes: 1440`.

```
Case A — now = Mon 07:00 (before opening)
   Mon stays in the list  →  dates = [Mon, Tue, ...]  →  slice(1) = [Tue, ...]
   DAY:    Tue 09:00     ◀── opening + buffer
   MINUTE: Tue 09:00     ◀── projected 07:00 < open, clamps up to opening

Case B — now = Mon 10:00 (mid-day)
   Mon stays in the list  →  dates = [Mon, Tue, ...]  →  slice(1) = [Tue, ...]
   DAY:    Tue 09:00     ◀── opening + buffer (time-of-day ignored)
   MINUTE: Tue 10:00     ◀── projected from now's 10:00

Case C — now = Mon 18:00 (after closing)
   Mon dropped (past close)  →  dates = [Tue, Wed, ...]  →  slice(1) = [Wed, ...]
   DAY:    Wed 09:00     ◀── opening + buffer
   MINUTE: Thu 09:00     ◀── projected Wed 18:00 is past Wed close → spill to Thu
```

The Case C divergence is intentional: late-day MINUTE-cadence orders can lose an extra day because the projected ready time falls outside business hours. DAY cadence sidesteps this by anchoring to "business day start" instead of the wall clock.

### Catering

Set `isCateringFlow: true`. The schedule pipeline is identical, but business hours come from `location.catering.pickup.{start_time,end_time}` (or `.delivery` for delivery) and apply uniformly across every weekday that has a `pickup_hours` entry. All prep time, day-skipping, and buffer rules above behave the same way.

QA-friendly test cases (Given / When / Expected) are in [docs/TEST-CASES.md](docs/TEST-CASES.md).

## Scripts

```bash
npm run build        # Compile TypeScript
npm run test         # Run tests
npm run test:coverage
npm run lint         # Lint with Biome
npm run format       # Format with Biome
```

## License

MIT © Per Diem Subscriptions Inc.

## Repository

- **Homepage:** [time-slots](https://github.com/PerDiemInc/time-slots#readme)
- **Issues:** [time-slots/issues](https://github.com/PerDiemInc/time-slots/issues)
