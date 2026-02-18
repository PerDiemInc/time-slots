import type { BusyTimeItem } from "./common";
import type { FulfillmentSchedule } from "./schedule";

export interface MenuTimeConfig {
	all_day?: boolean;
	start_time?: string;
	end_time?: string;
}

export interface MenuWithTimes {
	times: Record<string, MenuTimeConfig>;
}

export interface FilterBusyTimesFromScheduleParams {
	schedule: FulfillmentSchedule;
	busyTimes?: BusyTimeItem[];
	cartCategoryIds?: string[];
}
