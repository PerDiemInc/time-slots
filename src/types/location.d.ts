import type { BusinessHourInput } from "./business-hours";

export type FulfillmentPreference = "PICKUP" | "DELIVERY" | "CURBSIDE";
export type BusinessHourType = {
	day: number;
	start_time: string;
	end_time: string;
};
export interface LocationLike {
	location_id: string;
	id?: string;
	timezone: string;
	pickup_hours?: BusinessHourInput[];
	delivery_hours?: BusinessHourInput[];
	curbside_hours?: {
		use_pickup_hours?: boolean;
		times?: BusinessHourInput[];
	};
	catering?: {
		enabled: boolean | string;
		pickup: Omit<BusinessHourType, "day">;
		delivery: Omit<BusinessHourType, "day">;
	};
	[key: string]: unknown;
}
