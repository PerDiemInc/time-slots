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
| `prepTimeSettings` | Prep time in minutes, per-weekday overrides, gap, busy times, cadence (minute/hour/day), frequency, and optional delivery buffer. |
| `currentLocation` | The location to generate the schedule for. |
| `isCateringFlow` | If `true`, prep time is derived from cart catering config. |
| `platform` | `"web"` \| `"ios"` \| `"android"` for timezone handling (default `"web"`). |

**Returns:** `{ schedule: FulfillmentSchedule, isWeeklyPreSaleAvailable: boolean }`.

- **`schedule`** is an array of **day schedules**, each with `date`, `openingTime`, `closingTime`, `firstAvailableSlot`, and `slots` (array of `Date`).

### Types and constants

- **Fulfillment:** `FULFILLMENT_TYPES`, `FulfillmentType`, `FulfillmentSchedule`, `DaySchedule`.
- **Prep time:** `PrepTimeBehaviour` (first shift / every shift / roll), `DEFAULT_PREP_TIME_IN_MINUTES`, `DEFAULT_GAP_IN_MINUTES`, `PrepTimeSettings`, `PrepTimeCadence` (minute / hour / day).
- **Store / cart:** `StoreConfig`, `PreSaleConfig`, `WeeklyPreSaleConfig`, `CartItem`, `PrepTimeSettings`, `CateringPrepTimeResult`.
- **Location / hours:** `LocationLike`, `BusinessHour`, `BusinessHoursOverrideInput` / `Output`, `getLocationsBusinessHoursOverrides`, `getOpeningClosingTime`.
- **Platform:** `PLATFORM` (web, ios, android).

## Utilities (exported)

- **`getCateringPrepTimeConfig(params)`** – Derives prep time cadence and frequency from cart items for catering.
- **`getPreSalePickupDates(pickupDays, orderingDays)`** – Dates when weekly pre-sale pickup is allowed.
- **`isTodayInTimeZone(date, timezone)`** / **`isTomorrowInTimeZone(date, timezone)`** – Date checks in a given timezone.
- **`overrideTimeZoneOnUTC(utcDate, timezone)`** – Interpret a UTC date in a store timezone.
- **`filterBusyTimesFromSchedule({ schedule, busyTimes, cartCategoryIds })`** – Remove busy blocks from a schedule.
- **`filterMenusFromSchedule`** – Filter schedule by menu type.
- **`getOpeningClosingTime(params)`** – Opening/closing time for a given date and business hours.

Internal schedule generation uses **`getNextAvailableDates`**-style logic (timezone-aware “next N open days”) and slot generation with configurable prep time behaviour and gap.

## Prep time (high level)

Prep time can be applied in different ways (see `PrepTimeBehaviour` and `PrepTimeSettings`):

- **Cadence:** by **minute**, **hour**, or **day** (e.g. “first slot after 2 days”).
- **Per weekday:** different prep minutes per day via `weekDayPrepTimes`.
- **Catering:** when `isCateringFlow` is true, cadence and frequency are derived from cart items via `getCateringPrepTimeConfig`.
- **Delivery:** optional `estimatedDeliveryMinutes` added to weekday prep times for delivery.

Detailed behaviour and edge cases are covered by the test suite. QA-friendly test cases (Given / When / Expected) are in [docs/TEST-CASES.md](docs/TEST-CASES.md).

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
