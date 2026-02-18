import { roundToNearestMinutes } from "date-fns";
import { PREP_TIME_CADENCE } from "../constants";
import type {
	FulfillmentSchedule,
	GenerateLocationFulfillmentScheduleParams,
} from "../types";
import { getLocationBusinessHoursForFulfillment } from "../utils/business-hours";
import { getNextAvailableDates } from "./available-dates";
import { generateSchedule } from "./generate";

export function generateLocationFulfillmentSchedule({
	startDate,
	prepTimeFrequency = 0,
	prepTimeCadence = PREP_TIME_CADENCE.MINUTES,
	weekDayPrepTimes,
	location,
	fulfillmentPreference,
	businessHoursOverrides = [],
	preSaleHoursOverride,
	gapInMinutes,
	daysCount = 1,
	preSaleDates = [],
	presalePickupWeekDays = [],
	endDate = null,
}: GenerateLocationFulfillmentScheduleParams): FulfillmentSchedule {
	const businessHours = getLocationBusinessHoursForFulfillment(
		location,
		fulfillmentPreference,
	);

	const dates = getNextAvailableDates({
		startDate,
		businessHours,
		businessHoursOverrides,
		timeZone: location.timezone,
		datesCount: daysCount,
		preSaleDates,
		endDate,
		presalePickupWeekDays,
	});
	// If prepTimeCadence is days, we need to skip opening days by prepTimeFrequency
	const availableDates =
		prepTimeCadence === PREP_TIME_CADENCE.DAYS
			? dates.slice(prepTimeFrequency)
			: dates;
	return generateSchedule({
		currentDate: roundToNearestMinutes(startDate),
		weekDayPrepTimes,
		timeZone: location.timezone,
		dates: availableDates,
		businessHours,
		businessHoursOverrides,
		preSaleHoursOverride,
		gapInMinutes,
		prepTimeCadence,
	});
}
