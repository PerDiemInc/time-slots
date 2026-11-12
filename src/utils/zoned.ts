import { TZDate, tzOffset } from "@date-fns/tz";

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

const checkedTimeZones = new Set<string>();

/**
 * Callers rely on an absent or unknown zone throwing, the way `findTimeZone` did;
 * `TZDate` would quietly fall back to the host's own zone instead.
 */
function assertTimeZone(timeZone: string): string {
	if (!timeZone) {
		throw new RangeError("A time zone is required");
	}

	if (!checkedTimeZones.has(timeZone)) {
		Intl.DateTimeFormat(undefined, { timeZone });
		checkedTimeZones.add(timeZone);
	}

	return timeZone;
}

export interface ZonedParts {
	year: number;
	month: number;
	day: number;
	dayOfWeek: number;
	hours: number;
	minutes: number;
	seconds: number;
	milliseconds: number;
}

/**
 * Calendar fields of `date` in `timeZone`: month is 1-12 and dayOfWeek is 0-6 from
 * Sunday, the shape the schedule code reads.
 *
 * Every zone conversion in this package goes through here and `zonedPartsToDate`, so
 * that one time zone database decides them all. Mixing two is what shipped Alberta,
 * British Columbia and Manitoba a day-ahead schedule (SUP-987).
 */
export function getZonedParts(
	date: Date | number | string,
	timeZone: string,
): ZonedParts {
	const zoned = new TZDate(new Date(date), assertTimeZone(timeZone));

	return {
		year: zoned.getFullYear(),
		month: zoned.getMonth() + 1,
		day: zoned.getDate(),
		dayOfWeek: zoned.getDay(),
		hours: zoned.getHours(),
		minutes: zoned.getMinutes(),
		seconds: zoned.getSeconds(),
		milliseconds: zoned.getMilliseconds(),
	};
}

/**
 * The instant those calendar fields name in `timeZone`.
 *
 * A wall clock time the clocks skip moves forward (02:30 -> 03:30), and one they
 * repeat takes the first pass.
 *
 * `new TZDate(y, m, d, ...)` can't do this: around a transition it resolves the wall
 * clock against the host's own offset, so the same store time came out an hour apart
 * on a device in another zone.
 */
export function zonedPartsToDate(
	{
		year,
		month,
		day,
		hours = 0,
		minutes = 0,
		seconds = 0,
		milliseconds = 0,
	}: Omit<ZonedParts, "dayOfWeek" | "hours" | "minutes"> &
		Partial<Pick<ZonedParts, "hours" | "minutes">>,
	timeZone: string,
): Date {
	const zone = assertTimeZone(timeZone);
	const asUTC = Date.UTC(
		year,
		month - 1,
		day,
		hours,
		minutes,
		seconds,
		milliseconds,
	);
	const before = tzOffset(zone, new Date(asUTC - DAY_MS));
	const after = tzOffset(zone, new Date(asUTC + DAY_MS));

	let earliest: number | undefined;

	for (const offset of before === after ? [before] : [before, after]) {
		const candidate = asUTC - offset * MINUTE_MS;

		if (
			tzOffset(zone, new Date(candidate)) === offset &&
			(earliest === undefined || candidate < earliest)
		) {
			earliest = candidate;
		}
	}

	// Neither offset holds only inside the gap a spring-forward leaves, where this wall
	// clock never happens; the offset from before the change carries it past the gap.
	return new Date(earliest ?? asUTC - before * MINUTE_MS);
}
