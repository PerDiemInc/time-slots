import type { PLATFORM } from "../constants";
import type {
	BusinessHour,
	BusinessHoursOverrideOutput,
} from "./business-hours";
import type { FulfillmentPreference, LocationLike } from "./location";

export interface DaySchedule {
	date: Date;
	originalStoreOpeningTime: Date | null;
	originalStoreClosingTime: Date | null;
	remainingShifts: number;
	openingTime: Date;
	closingTime: Date;
	firstAvailableSlot: Date;
	slots: Date[];
	[key: string]: unknown;
}

export type FulfillmentSchedule = DaySchedule[];

export interface GenerateScheduleParams {
	currentDate?: Date;
	prepTimeBehaviour?: number;
	prepTimeInMinutes?: number;
	weekDayPrepTimes?: Record<number, number>;
	timeZone: string;
	dates?: Date[];
	businessHours?: BusinessHour[];
	businessHoursOverrides?: BusinessHoursOverrideOutput[];
	preSaleHoursOverride?: Array<{
		startTime: string;
		endTime: string;
		month?: number;
		day?: number;
	}> | null;
	gapInMinutes?: number;
	prepTimeCadence?: PrepTimeCadence;
}
export type Platform = (typeof PLATFORM)[keyof typeof PLATFORM];
export interface GetNextAvailableDatesParams {
	startDate: Date;
	timeZone: string;
	businessHours: BusinessHour[];
	businessHoursOverrides?: BusinessHoursOverrideOutput[];
	datesCount?: number;
	/** Allowed pickup dates: YYYY-MM-DD strings in the location timezone. */
	preSaleDates?: string[];
	presalePickupWeekDays?: number[];
	endDate?: Date | null;
	isDaysCadence?: boolean;
	/** Platform for timezone handling. Web uses @date-fns/tz; ios/android use timezone-support. Default "web". */
	platform?: Platform;
}

export interface GenerateLocationFulfillmentScheduleParams {
	startDate?: Date;
	currentDate?: Date;
	prepTimeFrequency?: number;
	prepTimeCadence?: PrepTimeCadence;
	weekDayPrepTimes?: Record<number, number>;
	location: LocationLike;
	fulfillmentPreference: FulfillmentPreference;
	/** Overrides for this location only (not keyed by location_id). */
	businessHoursOverrides?: BusinessHoursOverrideOutput[];
	preSaleHoursOverride?: Array<{
		startTime: string;
		endTime: string;
		month?: number;
		day?: number;
	}> | null;
	gapInMinutes?: number;
	daysCount?: number;
	/** Allowed pickup dates: YYYY-MM-DD strings in the location timezone. */
	preSaleDates?: string[];
	presalePickupWeekDays?: number[];
	endDate?: Date | null;
	platform?: Platform;
}

export interface GetOpeningClosingTimeOnDateParams {
	date?: Date;
	businessHours?: BusinessHour[];
	businessHoursOverrides?: BusinessHoursOverrideOutput[];
	timeZone: string;
}
