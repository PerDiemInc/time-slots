import { PREP_TIME_CADENCE } from "../constants";
import type {
	CateringPrepTimeResult,
	GetCateringPrepTimeParams,
} from "../types";

const getTotalCateringPrepTimeInHours = (
	prepTimeCadence: CateringPrepTimeResult["prepTimeCadence"],
	prepTimeFrequency: number,
) => {
	if (prepTimeCadence === PREP_TIME_CADENCE.MINUTE) {
		return Math.floor(prepTimeFrequency / 60);
	}
	if (prepTimeCadence === PREP_TIME_CADENCE.HOUR) {
		return prepTimeFrequency;
	}
	return prepTimeFrequency * 24;
};
/**
 * Catering prep time is applied to the first slot only (not weekDayPrepTimes).
 */
function buildCateringPrepTimeResult(
	prepTimeCadence: CateringPrepTimeResult["prepTimeCadence"],
	prepTimeFrequency: number,
): CateringPrepTimeResult {
	return {
		prepTimeCadence: "minute",
		prepTimeFrequency: 0,
		weekDayPrepTimes: {},
		totalCateringPrepTimeInHours: getTotalCateringPrepTimeInHours(
			prepTimeCadence,
			prepTimeFrequency,
		),
	};
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
	const { items } = params;

	if (items.length === 0) {
		return buildCateringPrepTimeResult(
			params.prepTimeCadence ?? PREP_TIME_CADENCE.HOUR,
			params.prepTimeFrequency ?? 1,
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
		);
	}

	if (hourFrequencies.length > 0) {
		return buildCateringPrepTimeResult(
			PREP_TIME_CADENCE.HOUR,
			Math.max(...hourFrequencies),
		);
	}

	return buildCateringPrepTimeResult(
		params.prepTimeCadence ?? PREP_TIME_CADENCE.HOUR,
		params.prepTimeFrequency ?? 1,
	);
}
