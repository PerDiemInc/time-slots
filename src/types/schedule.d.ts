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
	defaultPrepTimeInMinutes?: number;
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
export interface GetNextAvailableDatesParams {
	startDate: Date;
	timeZone: string;
	businessHours: BusinessHour[];
	businessHoursOverrides?: BusinessHoursOverrideOutput[];
	datesCount?: number;
	preSaleDates?: Date[];
	endDate?: Date | null;
	isDaysCadence?: boolean;
}

export interface GenerateLocationFulfillmentScheduleParams {
	startDate?: Date;
	currentDate?: Date;
	prepTimeFrequency?: number;
	prepTimeCadence?: PrepTimeCadence;
	weekDayPrepTimes?: Record<number, number>;
	defaultPrepTimeInMinutes?: number;
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
	/** Allowed pickup dates (e.g. weekly pre-sale). Only these calendar days are returned. */
	preSaleDates?: Date[];
	endDate?: Date | null;
	isCatering?: boolean;
}

export interface GetOpeningClosingTimeOnDateParams {
	date?: Date;
	businessHours?: BusinessHour[];
	businessHoursOverrides?: BusinessHoursOverrideOutput[];
	timeZone: string;
}
