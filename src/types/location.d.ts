import type { BusinessHourInput } from "./business-hours";

export type FulfillmentPreference = "PICKUP" | "DELIVERY" | "CURBSIDE";

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
	[key: string]: unknown;
}
