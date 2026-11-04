import { findTimeZone as findBundledTimeZone } from "timezone-support";

import { TIME_ZONE_CORRECTIONS } from "./timezone-corrections";

/**
 * Use this rather than timezone-support's own `findTimeZone`. Its bundled tz data is out of
 * date, so zones whose rules have since changed are an hour out, and newer zones throw.
 * The package also serves mobile, so corrected tables ship as data rather than using Intl.
 */
export function findTimeZone(
	timeZone: string,
): ReturnType<typeof findBundledTimeZone> {
	return Object.hasOwn(TIME_ZONE_CORRECTIONS, timeZone)
		? TIME_ZONE_CORRECTIONS[timeZone]
		: findBundledTimeZone(timeZone);
}
