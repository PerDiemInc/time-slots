import type { PrepTimeCadence } from "../constants";
import type {
	BusinessHoursOverrideInput,
	BusinessHoursOverrideOutput,
} from "./business-hours";
import type { BusyTimeItem } from "./common";
import type { FulfillmentPreference, LocationLike } from "./location";
import type { FulfillmentSchedule } from "./schedule";

// ── High-level input objects ────────────────────────────────────────────────

export interface PreSaleConfig {
	active: boolean;
	due_start_date?: string | Date;
	due_end_date?: string | Date;
	use_store_hours_due?: boolean;
	due_start_time?: string | null;
	due_end_time?: string | null;
}

export interface WeeklyPreSaleConfig {
	active: boolean;
	pickup_days: number[];
	ordering_days: number[];
}

export interface StoreConfig {
	isAsapOrders: boolean;
	isSameDayOrders: boolean;
	max_future_order_days?: number;
	businessHoursOverrides: BusinessHoursOverrideInput[];
	preSaleConfig?: PreSaleConfig;
	weeklyPreSaleConfig: WeeklyPreSaleConfig;
}

export interface CartItem {
	preSale?: boolean;
	weeklyPreSale?: boolean;
	internalCategoryId?: string;
}
export interface PrepTimeSettings {
	prepTimeInMinutes: number;
	weekDayPrepTimes: Record<number, number>;
	gapInMinutes: number;
	busyTimes: Record<string, BusyTimeItem[]>;
	prepTimeFrequency: number;
	prepTimeCadence: PrepTimeCadence;
}

// ── getSchedules params / result ────────────────────────────────────────────

export interface GetSchedulesParams {
	store: StoreConfig;
	locations: LocationLike[];
	cartItems: CartItem[];
	fulfillmentPreference: FulfillmentPreference;
	prepTimeSettings: PrepTimeSettings;
	currentLocation: LocationLike;
}

export interface GetSchedulesResult {
	schedule: FulfillmentSchedule;
	isWeeklyPreSaleAvailable: boolean;
}

// ── Legacy flat params (kept for backward-compat if needed) ─────────────────

export interface InitScheduleParams {
	isAsapOrders: boolean;
	isSameDayOrders: boolean;
	preSalePickupDays: number[];
	isWeeklyPreSaleActive: boolean;
	preSaleOrderingDays: number[];
	locations: LocationLike[];
	daysCount?: number;
	fulfillmentPreference: FulfillmentPreference;
	prepTimeInMinutes: number;
	weekDayPrepTimes: Record<number, number>;
	hasCartWeeklyPreSaleItem: boolean;
	busyTimes: BusyTimeItem[];
	cartCategoryIds: string[];
	gapInMinutes: number;
	businessHoursOverrides: Record<string, BusinessHoursOverrideOutput[]>;
	currentLocation: LocationLike;
}

export interface InitScheduleResult {
	businessHoursOverrides: Record<string, BusinessHoursOverrideOutput[]>;
	locationId: string;
	fulfillmentPreference: FulfillmentPreference;
	schedule: FulfillmentSchedule;
	isWeeklyPreSaleAvailable: boolean;
}
