/** Raw business-hour record from the API (snake_case keys). */
export interface BusinessHourInput {
	day: number;
	start_time: string;
	end_time: string;
}

/** Normalised business-hour used internally (camelCase keys). */
export interface BusinessHour {
	day: number;
	startTime: string;
	endTime: string;
}

/** Raw business-hours override coming from the API. */
export interface BusinessHoursOverrideInput {
	all_locations?: boolean;
	location_ids?: string[];
	month: number;
	day: number;
	start_time: string | null;
	end_time: string | null;
	is_open?: boolean;
}

/** Normalised business-hours override. */
export interface BusinessHoursOverrideOutput {
	month: number;
	day: number;
	startTime: string | null;
	endTime: string | null;
}
