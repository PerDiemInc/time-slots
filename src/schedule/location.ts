import { roundToNearestMinutes } from "date-fns";
import { MINUTES_PER_DAY, PREP_TIME_CADENCE } from "../constants";
import type {
	FulfillmentSchedule,
	GenerateLocationFulfillmentScheduleParams,
} from "../types";
import { getLocationBusinessHoursForFulfillment } from "../utils/business-hours";
import { getNextAvailableDates } from "./available-dates";
import { generateSchedule } from "./generate";

export function generateLocationFulfillmentSchedule({
	startDate,
	currentDate = new Date(),
	prepTimeFrequency = 0,
	prepTimeCadence = PREP_TIME_CADENCE.MINUTE,
	location,
	fulfillmentPreference,
	businessHoursOverrides = [],
	preSaleHoursOverride,
	gapInMinutes,
	daysCount = 1,
	preSaleDates = [],
	endDate = null,
	isCatering = false,
	openingBuffer = 0,
	closingBuffer = 0,
	estimatedDeliveryMinutes = 0,
}: GenerateLocationFulfillmentScheduleParams): FulfillmentSchedule {
	const isDaysCadence = prepTimeCadence === PREP_TIME_CADENCE.DAY;
	const businessHours = getLocationBusinessHoursForFulfillment(
		location,
		fulfillmentPreference,
		isCatering,
	);

	// DAY cadence: prepTimeFrequency is already in days.
	// MINUTE cadence: convert minutes - full days to skip, remainder applied on target day.
	const minuteCadenceDaysSkipped = !isDaysCadence
		? Math.floor(prepTimeFrequency / MINUTES_PER_DAY)
		: 0;
	const hasDaySkipping = isDaysCadence || minuteCadenceDaysSkipped > 0;

	const dates = getNextAvailableDates({
		startDate: startDate || currentDate,
		businessHours,
		businessHoursOverrides,
		timeZone: location.timezone,
		datesCount: daysCount,
		preSaleDates,
		endDate,
		isDaysCadence: hasDaySkipping,
	});

	const daysToSkip = isDaysCadence
		? prepTimeFrequency
		: minuteCadenceDaysSkipped;
	const availableDates = daysToSkip > 0 ? dates.slice(daysToSkip) : dates;

	// For minute cadence with day skipping, only pass the remaining minutes
	// so generateSchedule doesn't double-apply the skipped days as prep time.
	const effectivePrepFrequency =
		minuteCadenceDaysSkipped > 0
			? prepTimeFrequency % MINUTES_PER_DAY
			: prepTimeFrequency;

	return generateSchedule({
		currentDate: roundToNearestMinutes(currentDate),
		timeZone: location.timezone,
		dates: availableDates,
		businessHours,
		businessHoursOverrides,
		preSaleHoursOverride,
		gapInMinutes,
		prepTimeCadence,
		prepTimeFrequency: effectivePrepFrequency,
		minuteCadenceDaysSkipped,
		openingBuffer,
		closingBuffer,
		estimatedDeliveryMinutes,
	});
}
