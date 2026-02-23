import { findTimeZone, getZonedTime } from "timezone-support";
import { DEFAULT_TIMEZONE, PREP_TIME_CADENCE } from "../constants";
import type {
	CateringPrepTimeResult,
	GetCateringPrepTimeParams,
} from "../types";

function buildCateringPrepTimeResult(
	prepTimeCadence: CateringPrepTimeResult["prepTimeCadence"],
	prepTimeFrequency: number,
	timezone: string = DEFAULT_TIMEZONE,
): CateringPrepTimeResult {
	const result: CateringPrepTimeResult = {
		prepTimeCadence,
		prepTimeFrequency,
	};
	if (prepTimeCadence === PREP_TIME_CADENCE.DAY) {
		result.weekDayPrepTimes = {};
	} else {
		result.weekDayPrepTimes = {
			[getZonedTime(new Date(), findTimeZone(timezone)).dayOfWeek]:
				prepTimeCadence === PREP_TIME_CADENCE.HOUR
					? prepTimeFrequency * 60
					: prepTimeFrequency,
		};
	}
	return result;
}

/**
 * Derives prep time config (cadence, frequency, weekDayPrepTimes) from cart items for catering flow.
 * DAY cadence has priority; if any item uses days, returns max day frequency.
 * Otherwise returns HOUR cadence with max hour frequency across items.
 * When items are empty or have no catering prep time, falls back to params (e.g. from prepTimeSettings).
 */
export function getCateringPrepTimeConfig(
	params: GetCateringPrepTimeParams,
): CateringPrepTimeResult {
	const { items, timezone = DEFAULT_TIMEZONE } = params;

	if (items.length === 0) {
		return buildCateringPrepTimeResult(
			params.prepTimeCadence ?? PREP_TIME_CADENCE.HOUR,
			params.prepTimeFrequency ?? 1,
			timezone,
		);
	}

	const dayFrequencies: number[] = [];
	const hourFrequencies: number[] = [];

	for (const item of items) {
		const cadence = item.cateringService?.prep_time?.cadence;
		const frequency = item.cateringService?.prep_time?.frequency;
		if (cadence == null || frequency == null) continue;

		if (cadence === PREP_TIME_CADENCE.DAY) {
			dayFrequencies.push(frequency);
		} else if (cadence === PREP_TIME_CADENCE.HOUR) {
			hourFrequencies.push(frequency);
		}
	}

	if (dayFrequencies.length > 0) {
		return buildCateringPrepTimeResult(
			PREP_TIME_CADENCE.DAY,
			Math.max(...dayFrequencies),
			timezone,
		);
	}

	if (hourFrequencies.length > 0) {
		return buildCateringPrepTimeResult(
			PREP_TIME_CADENCE.HOUR,
			Math.max(...hourFrequencies),
			timezone,
		);
	}

	return buildCateringPrepTimeResult(
		params.prepTimeCadence ?? PREP_TIME_CADENCE.HOUR,
		params.prepTimeFrequency ?? 1,
		timezone,
	);
}
