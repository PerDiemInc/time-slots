import type { BusyTimeItem } from "./common";
import type { FulfillmentSchedule } from "./schedule";
export type MenuTimeSlot = {
	all_day: boolean;
	end_time: string | null;
	start_time: string | null;
};

export type MenuType = {
	menu_id: string;
	store_id: string;
	location_id: string | null;
	all_locations: boolean;
	display_name: string;
	description: string | null;
	times: Record<string, MenuTimeSlot>;
	category_ids: string[];
	last_modified_by: string;
	created_at: string;
	updated_at: string;
};

export interface FilterBusyTimesFromScheduleParams {
	schedule: FulfillmentSchedule;
	busyTimes?: BusyTimeItem[];
	cartCategoryIds?: string[];
}
