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
	prepTimeFrequency?: number;
	openingBuffer?: number;
	closingBuffer?: number;
	/** For DELIVERY: added on top of the computed first slot on every day. */
	estimatedDeliveryMinutes?: number;
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
	openingBuffer?: number;
	closingBuffer?: number;
	estimatedDeliveryMinutes?: number;
}

export interface GetOpeningClosingTimeOnDateParams {
	date?: Date;
	businessHours?: BusinessHour[];
	businessHoursOverrides?: BusinessHoursOverrideOutput[];
	timeZone: string;
}

export interface GetOpeningClosingTimeParams {
	location: LocationLike;
	fulfillmentPreference: FulfillmentPreference;
	businessHoursOverrides?: Record<string, BusinessHoursOverrideOutput[]>;
	isCatering?: boolean;
}
