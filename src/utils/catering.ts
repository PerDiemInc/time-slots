import { PREP_TIME_CADENCE } from "../constants";
import type {
	CateringPrepTimeResult,
	GetCateringPrepTimeParams,
} from "../types";

/**
 * Catering prep time is applied to the first slot only.
 * DAY cadence is preserved so it flows through the same business-day-skip
 * logic (dates.slice) as non-catering orders.
 * HOUR cadence is converted to minutes so the standard minute-cadence
 * rollover logic handles it.
 */
function buildCateringPrepTimeResult(
	prepTimeCadence: CateringPrepTimeResult["prepTimeCadence"],
	prepTimeFrequency: number,
): CateringPrepTimeResult {
	if (prepTimeCadence === PREP_TIME_CADENCE.DAY) {
		return {
			prepTimeCadence: PREP_TIME_CADENCE.DAY,
			prepTimeFrequency,
		};
	}

	// Convert HOUR → minutes so the existing minute-cadence rollover logic
	// in generateSchedule handles it uniformly.
	const frequencyInMinutes =
		prepTimeCadence === PREP_TIME_CADENCE.HOUR
			? prepTimeFrequency * 60
			: prepTimeFrequency;

	return {
		prepTimeCadence: PREP_TIME_CADENCE.MINUTE,
		prepTimeFrequency: frequencyInMinutes,
	};
}

/**
 * Derives prep time config (cadence, frequency) from cart items for catering flow.
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
