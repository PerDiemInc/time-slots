# Test cases (QA)

## Feature and how prep time works

**Feature:** The system generates a schedule of available **time slots** for ordering (pickup, delivery, or curbside). Each slot is a date + time when the order can be fulfilled.

**Prep time** is how long the store needs before the order is ready.

- **Prep time by minutes** (e.g. 30 min, 24 hours): First available slot = order time + prep time, but only during store hours. If that falls after closing, the first slot moves to the next open day at opening (or next slot after opening).
- **Prep time by days** (e.g. 1 day, 2 days): First available slot = the **next open day** after N full prep days, at **opening time** (plus a small buffer, e.g. 5 min). The exact clock time when the user orders today does not change the first slot time—only which day and “at opening.”

**What affects the schedule:**

- **Business hours** — Store open/close times per weekday.
- **Business overrides** — Specific dates closed or with different hours (e.g. holidays).
- **Pre-sale** — Orders only within a date range (and optionally only during certain hours).
- **Weekly pre-sale** — Only certain weekdays are valid for pickup (e.g. Mon/Wed/Fri).
- **ASAP / same-day** — Store may allow only today’s slots or only same-day orders (schedule shows 1 day only).

---

## Table format

Each section below uses this table:

| Order time | Prep time | Expected (first slot) | Reason |
|------------|-----------|------------------------|--------|
| When the user checks the schedule | Store’s prep rule | First slot shown | Why this result |

All times in examples are UTC unless noted. Store is **Mon–Sat 8:00–20:00, Sun closed** unless the section says otherwise.

---

## 1. Normal business hours

Store open Mon–Sat 8:00–20:00, Sun closed. No overrides, no pre-sale.

| Order time | Prep time | Expected (first slot) | Reason |
|------------|-----------|------------------------|--------|
| Any (e.g. Jan 1 midnight UTC) | — | **Schedule has 7 days**, each with slots | Store allows 7-day advance; no same-day/ASAP limit. |
| Monday 2:00 PM | 24 hours (by minutes) | Tuesday 2:00 PM | 24h after order time, still within Tuesday hours. |
| Monday 2:00 PM | 1 day | Tuesday 8:05 AM | Next open day after 1 day; first slot at opening + 5 min. |
| Monday 8:00 AM (just opened) | 1 day | Tuesday 8:05 AM | Same: next open day at opening. |
| Monday 7:59 PM (about to close) | 1 day | Tuesday 8:05 AM | Same: day cadence ignores exact time. |

---

## 2. Before or after store hours

Same business hours (Mon–Sat 8–20, Sun closed). Order time is before open or after close.

| Order time | Prep time | Expected (first slot) | Reason |
|------------|-----------|------------------------|--------|
| Monday 2:00 AM (before open) | 24 hours | Tuesday 8:00 AM | Order + 24h would be Tue 2am; store opens 8am, so first slot Tue 8am. |
| Monday 7:59 AM (before open) | 24 hours | Tuesday 8:00 AM | Same: first open moment after 24h is Tue 8am. |
| Monday 9:00 PM (after close) | 24 hours | Wednesday 8:00 AM | Tue 9pm is after close; next open is Wed 8am. |
| Monday 9:00 PM (after close) | 1 day | Wednesday 8:05 AM | After close = next “day” is Tue; 1 prep day → first slot Wed at opening. |
| Monday 11:59 PM | 1 day | Wednesday 8:05 AM | Same: past close, next open day after 1 prep day is Wed. |

---

## 3. Store closed on Sunday

Mon–Sat 8–20, **Sunday closed**.

| Order time | Prep time | Expected (first slot) | Reason |
|------------|-----------|------------------------|--------|
| Saturday 2:00 PM | 24 hours | Monday 8:00 AM | 24h later is Sunday; store closed → first slot Monday 8am. |
| Saturday 2:00 PM | 1 day | Monday 8:05 AM | Next open day after 1 day is Monday at opening. |
| Saturday 10:00 PM (after close) | 1 day | Tuesday 8:05 AM | Next day is Sunday (closed); day after is Monday; 1 more prep day → Tuesday. |
| Sunday 2:00 PM (store closed all day) | 1 day | Tuesday 8:05 AM | Sunday doesn’t count as open; next open is Monday; +1 prep day → Tuesday 8:05. |
| Sunday 2:00 AM | 1 day | Tuesday 8:05 AM | Same: Sunday closed; next open Monday; +1 day → Tuesday. |
| Friday 3:00 PM | 1 day | Saturday 8:05 AM | Next open day after Friday is Saturday at opening. |

---

## 4. Variable business hours by day

One or more weekdays have **different** hours (e.g. Sat shorter, Sun closed).

| Order time | Prep time | Expected (first slot) | Reason |
|------------|-----------|------------------------|--------|
| **Sat 10–18, Sun closed** | | | |
| Friday 2:00 PM | 24 hours | Saturday 2:00 PM | 24h later within Sat 10–18. |
| Friday 5:00 PM | 24 hours | Saturday 5:00 PM | Same. |
| Friday 7:00 PM | 24 hours | Monday 8:00 AM | 24h = Sat 7pm, after Sat close (18:00) → Mon 8am. |
| Saturday 11:00 AM | 24 hours | Monday 8:00 AM | 24h = Sun (closed) → first open Mon 8am. |
| Friday 2:00 PM | 1 day | Saturday 10:05 AM | Next open day = Sat; first slot at Sat opening 10:00 + 5 min. |
| Friday 8:00 PM | 1 day | Saturday 10:05 AM | Same: next open day Sat at 10:05. |
| Saturday 2:00 PM | 1 day | Monday 8:05 AM | Next open = Mon (Sun closed). |
| Saturday 7:00 PM (after Sat close) | 1 day | Tuesday 8:05 AM | After close → next day Sun (closed), then Mon; +1 prep day → Tue. |
| **Friday extended (8–22), Saturday 10–18** | | | |
| Friday 9:00 PM | 24 hours | Monday 8:00 AM | 24h = Sat 9pm, after Sat 18:00 close → Mon 8am. |
| **One day early closure (e.g. Tuesday closes early)** | | | |
| Tuesday 2:00 PM | 24 hours | Wednesday 2:00 PM | Normal: 24h later Wed 2pm. |
| **One day late opening (e.g. Wednesday 11:00)** | | | |
| Tuesday 9:00 AM | 24 hours | Wednesday 11:00 AM | 24h = Wed 9am; store opens 11am → first slot Wed 11am. |
| Tuesday 12:00 PM | 24 hours | Wednesday 12:00 PM | 24h = Wed 12pm, within hours. |
| Tuesday 2:00 PM | 1 day | Wednesday 11:05 AM | Next open day Wed; first slot at late opening 11:00 + 5 min. |
| Tuesday 10:00 PM (after close) | 1 day | Thursday 8:05 AM | Next day Wed (open 11–20); +1 prep day → Thu 8:05. |
| **Tuesday early closure** | | | |
| Tuesday 2:00 PM (before early close) | 1 day | Wednesday 8:05 AM | Next open day Wed. |
| Tuesday 4:00 PM (after store closed) | 1 day | Wednesday 8:05 AM | Same: next open Wed. |

---

## 5. Business overrides

Specific dates are **closed** or have **different hours** (e.g. holiday closed, special open). (e.g. holiday closed, special open).

| Scenario | Order time | Prep time | Expected | Reason |
|----------|------------|-----------|----------|--------|
| Certain dates closed (e.g. Sep 28 & Oct 1) | Sep 27 6:00 PM (timezone Asia/Karachi) | — | Next 7 available dates **skip** Sep 28 and Oct 1 | Overrides mark those days closed; they are excluded from “next available dates.” |
| Pre-sale with end date | Start Jan 1, end Jan 3 | — | No dates after Jan 3 | endDate caps the schedule. |

| Pre-sale with endDate; Jan 2 & 3 closed by override | Start Jan 1, end Jan 7 | Next 7 available dates = 1, 4, 5, 6, 7 (skip 2 & 3) | Closed overrides are still excluded inside the range. |
| No endDate; Jan 2 & 3 closed by override | Start Jan 1 | Next 7 dates = 1, 4, 5, 6, 7, 8, 9 (skip 2 & 3) | Same: closed dates never appear. |
| Store normally closed Sat–Sun; pre-sale with endDate, no override | Start Jan 1, end Jan 10 | All 10 calendar days (1–10) included | Pre-sale can include days that are normally closed. |
| Store normally closed Sat–Sun; override opens Jan 6 & 7 | Start Jan 1, end Jan 10 | All 10 days (1–10) included | Override opens normally closed days; they appear. |
| Store normally closed Sat–Sun; override closes Jan 6 & 7 (explicit closed) | Start Jan 1, no endDate | Next 7 dates exclude Jan 6 & 7 | Closed override removes those days. |

---

## 6. Pre-sale

Orders only within a **date range** (and optionally only during set hours). Schedule is limited to that range.

| Scenario | Order time | Expected | Reason |
|----------|------------|----------|--------|
| Pre-sale dates = e.g. 1st, 5th, 10th, 15th of month; pickup weekdays e.g. Mon/Wed/Fri | Jan 1 | Only dates that match (e.g. Jan 1, 5, 10, 15) and fall on pickup weekdays | Only pre-sale dates + weekday filter are shown. |
| Pre-sale dates don’t match any date in range | — | Empty schedule | No valid dates. |

---

## 7. Weekly pre-sale

Store allows orders only for **fixed pickup weekdays** (e.g. Mon/Wed/Fri). Schedule shows only those days.

| Scenario | Expected | Reason |
|----------|----------|--------|
| Weekly pre-sale active; pickup days e.g. Mon/Wed/Fri | Schedule shows only Mon, Wed, Fri (e.g. next 7 such days) | Weekly pre-sale restricts which weekdays appear. |
| Cart has weekly pre-sale item | `isWeeklyPreSaleAvailable: true` and schedule follows weekly pre-sale rules | Cart drives weekly pre-sale path. |

*(Add concrete “Order time / Prep time / Expected” rows when you have real weekly pre-sale scenarios to test.)*

---

## 8. ASAP and same-day orders

Store allows **ASAP** or **same-day only** (no future days).

| Scenario | Expected | Reason |
|----------|----------|--------|
| Same-day orders only | Schedule has **1 day only** (today), with slots for today | Store config limits to same day. |
| ASAP only | Schedule shows only today’s slots (or 1 day) | ASAP implies no advance days. |

---

## 9. Multi-day prep (48h, 72h, 2 days, 3 days)

Store Mon–Sat 8–20, Sun closed unless noted.

| Order time | Prep time | Expected (first slot) | Reason |
|------------|-----------|------------------------|--------|
| Monday 2:00 PM | 48 hours | Wednesday 8:00 AM | 48h = Wed 2pm; can show first slot at Wed opening 8am. |
| Monday 9:00 PM | 48 hours | Wednesday 8:00 AM | After close; 48h lands after Tue close → Wed 8am. |
| Friday 2:00 PM | 48 hours | Monday 8:00 AM | 48h = Sun (closed) → Mon 8am. |
| Saturday 10:00 AM | 48 hours | Monday 10:00 AM | 48h = Mon 10am, within hours. |
| Monday 2:00 PM | 72 hours | Wednesday 8:00 AM | 72h crosses into next open day at opening. |
| Friday 2:00 PM | 72 hours | Monday 8:00 AM | 72h spans weekend; first open Mon 8am. |
| **Prep by minutes: weekday has very large prep (e.g. 48h on Thu)** | Order Tue 5:55 PM | First slot on a later day at opening + offset | Prep “rolls” across days until it fits in opening hours. |
| **Same day, two shifts (e.g. Mon 8–10 and 14–20); prep 150 min on Mon** | Monday 8:00 AM | First slot **Monday 2:00 PM** | Prep carries into next shift same day; first slot at second shift start. |
| Monday 2:00 PM | 2 days | Wednesday 8:05 AM | Next open day after 2 prep days = Wed at opening. |
| Monday 9:00 PM | 2 days | Thursday 8:05 AM | After close; 2 prep days → Thu. |
| Friday 2:00 PM | 2 days | Monday 8:05 AM | Fri + 2 open days = Mon (Sat, Sun or Mon depending on config). |
| Saturday 2:00 PM | 2 days | Tuesday 8:05 AM | Sat → Sun (closed), Mon, Tue. |
| Monday 2:00 PM | 3 days | Thursday 8:05 AM | 3 prep days → Thu at opening. |
| Friday 2:00 PM | 3 days | Tuesday 8:05 AM | Fri + 3 open days. |

---

## 10. Exact boundary times

Order time **exactly at** open or close (or one second before/after). Store Mon–Sat 8–20, Sun closed.

| Order time | Prep time | Expected (first slot) | Reason |
|------------|-----------|------------------------|--------|
| Monday 8:00:00 AM (just opened) | 24 hours | Tuesday 8:00 AM | 24h = next day at open. |
| Monday 7:59:59 AM (one second before open) | 24 hours | Tuesday 8:00 AM | Before open → first slot next day at open. |
| Monday 8:00:00 PM (just closed) | 24 hours | Wednesday 8:00 AM | At close; next slot is day after next at open. |
| Monday 7:59:59 PM (one second before close) | 24 hours | Wednesday 8:00 AM | Still “before close” for that day; 24h = Tue 7:59pm, after Tue close → Wed 8am. |
| Monday 8:00:00 AM (exactly at open) | 1 day | Tuesday 8:05 AM | Next open day at opening + 5 min. |
| Monday 7:59:59 AM (before open) | 1 day | Tuesday 8:05 AM | Same. |
| Monday 8:00:00 PM (exactly at close) | 1 day | Tuesday 8:05 AM | Same: day cadence, next day at open. |
| 12:00:00 AM midnight (e.g. Tue) | 1 day | Next day 8:05 AM | Next open day at opening. |
| 11:59:59 PM (e.g. Monday) | 1 day | Wednesday 8:05 AM | Past close; next open day after 1 prep day = Wed. |

---

## 11. Day cadence: skip current date when past closing

When **day cadence** is used and “today” is already **past closing** in the store’s timezone, “next available dates” should **skip today** and start from the next open day.

| Scenario | Order time (in zone) | Expected | Reason |
|----------|----------------------|----------|--------|
| isDaysCadence = true; current time past closing in zone | e.g. Sep 29 02:00 in America/Halifax (past closing on Sep 28) | Next 7 available dates **do not include** “today” in zone; first date is next open day | When past closing, today is skipped so first slot is next day. |
| isDaysCadence = false (default) | Same | Next 7 dates **can include** today’s date in zone | Without day cadence, “today” is still listed. |

---

## 12. Menu time windows

Slots can be **filtered** by a menu’s active time window (e.g. brunch menu only 16:00–16:30 on certain days).

| Scenario | Expected | Reason |
|----------|----------|--------|
| Schedule has many slots; menu allows only 16:00–16:30 on that day | Filtered schedule for that day shows **only slots in 16:00–16:30** (e.g. 3 slots) | Menu time window narrows visible slots. |

---

## 13. Timezone and DST

“Next available dates” and first slot depend on the **store timezone**. Behaviour at **DST** (spring forward / fall back) should keep dates and times correct in that zone.

| Scenario | Expected | Reason |
|----------|----------|--------|
| Start date in one timezone (e.g. America/Halifax or America/New_York); request 7 days | 7 dates are the correct calendar days **in that timezone** | Dates are computed in store zone. |
| Start times around DST transition (e.g. Mar 9–10 or Oct 29 America/New_York) | No duplicate or skipped calendar days; times respect EDT/EST | DST transition handled in zone. |

*(All other examples in this doc use UTC. Adjust for your store timezone when testing.)*

---

*More cases can be added in the same table format per section.*
