import { differenceInDays } from "date-fns";
import {
	DEFAULT_TIMEZONE,
	FULFILLMENT_TYPES,
	MINUTES_PER_DAY,
	PLATFORM,
	PREP_TIME_CADENCE,
} from "../constants";
import type {
	CartItem,
	FulfillmentSchedule,
	GetSchedulesParams,
	GetSchedulesResult,
	PrepTimeSettings,
	PreSaleConfig,
} from "../types";
import { getLocationsBusinessHoursOverrides } from "../utils/business-hours";
import { getCateringPrepTimeConfig } from "../utils/catering";
import { getPreSalePickupDates, overrideTimeZoneOnUTC } from "../utils/date";
import { filterBusyTimesFromSchedule } from "../utils/schedule-filter";
import { generateLocationFulfillmentSchedule } from "./location";

// ── Helpers ─────────────────────────────────────────────────────────────────

function deriveCartInfo(cartItems: CartItem[]) {
	return {
		hasPreSaleItem: cartItems.some((item) => item.preSale),
		hasWeeklyPreSaleItem: cartItems.some((item) => item.weeklyPreSale),
		categoryIds: Array.from(
			new Set(
				cartItems
					.map((item) => item.internalCategoryId)
					.filter((id): id is string => Boolean(id)),
			),
		),
	};
}

function resolvePreSaleDates(
	preSaleConfig: PreSaleConfig | undefined,
	timezone: string,
) {
	return {
		startDate: preSaleConfig?.due_start_date
			? overrideTimeZoneOnUTC(preSaleConfig.due_start_date, timezone)
			: new Date(),
		endDate: preSaleConfig?.due_end_date
			? overrideTimeZoneOnUTC(preSaleConfig.due_end_date, timezone)
			: new Date(),
	};
}

function getPreSaleHoursOverride(
	preSaleConfig: PreSaleConfig | undefined,
	hasPreSaleItem: boolean,
) {
	if (
		preSaleConfig &&
		!preSaleConfig.use_store_hours_due &&
		hasPreSaleItem &&
		preSaleConfig.due_start_time &&
		preSaleConfig.due_end_time
	) {
		return [
			{
				startTime: preSaleConfig.due_start_time,
				endTime: preSaleConfig.due_end_time,
			},
		];
	}
	return null;
}

function resolveStartDate(
	zonedDueStartDate: Date,
	hasPreSaleItem: boolean,
): Date {
	if (hasPreSaleItem) {
		return new Date(Math.max(zonedDueStartDate.getTime(), Date.now()));
	}
	return new Date();
}
const WEEKDAY_KEYS = [0, 1, 2, 3, 4, 5, 6] as const;

function addEstimatedDeliveryToWeekDays(
	weekDayPrepTimes: Record<number, number>,
	estimatedDeliveryMinutes: number,
): Record<number, number> {
	const result: Record<number, number> = {};
	for (const day of WEEKDAY_KEYS) {
		result[day] = (weekDayPrepTimes[day] ?? 0) + estimatedDeliveryMinutes;
	}
	return result;
}

/**
 * Returns prep time cadence and frequency for schedule generation.
 * If prepTimeCadence and prepTimeFrequency exist on settings (e.g. from catering), returns them.
 * Otherwise derives from fulfillAtBusinessDayStart and prepTimeInMinutes (days = prepTimeInMinutes / MINUTES_PER_DAY).
 */
function getPrepTimeCadenceAndFrequency(
	settings: PrepTimeSettings,
): PrepTimeSettings {
	const hasCadence =
		settings.prepTimeCadence != null && settings.prepTimeFrequency != null;
	if (hasCadence) {
		return settings;
	}
	const fulfillAtBusinessDayStart = settings.fulfillAtBusinessDayStart;
	return {
		...settings,
		prepTimeCadence: fulfillAtBusinessDayStart
			? PREP_TIME_CADENCE.DAY
			: PREP_TIME_CADENCE.MINUTE,
		prepTimeFrequency: fulfillAtBusinessDayStart
			? Math.floor(settings.prepTimeInMinutes / MINUTES_PER_DAY)
			: (settings?.prepTimeInMinutes ?? 0),
	};
}

/**
 * Resolves prep time config: for catering flow uses cart-derived cadence/frequency;
 * when fulfillment is DELIVERY, adds estimatedDeliveryMinutes to all weekday prep times.
 */
function resolvePrepTimeConfig(
	prepTimeSettings: PrepTimeSettings,
	cartItems: CartItem[],
	isCateringFlow: boolean,
	fulfillmentPreference: "PICKUP" | "DELIVERY" | "CURBSIDE",
	timezone: string = DEFAULT_TIMEZONE,
): PrepTimeSettings {
	let resolved: PrepTimeSettings;

	if (!isCateringFlow) {
		const isDayCadence =
			prepTimeSettings.prepTimeCadence === PREP_TIME_CADENCE.DAY;
		resolved = {
			...prepTimeSettings,
			...(isDayCadence && { weekDayPrepTimes: {} }),
		};
	} else {
		const cateringPrepTimeConfig = getCateringPrepTimeConfig({
			items: cartItems,
			prepTimeCadence: prepTimeSettings.prepTimeCadence,
			prepTimeFrequency: prepTimeSettings.prepTimeFrequency,
			timezone,
		});
		resolved = {
			...prepTimeSettings,
			...cateringPrepTimeConfig,
		};
	}
	const { estimatedDeliveryMinutes = 0 } = prepTimeSettings;
	if (
		fulfillmentPreference === FULFILLMENT_TYPES.DELIVERY &&
		estimatedDeliveryMinutes > 0
	) {
		const baseWeekDays = resolved.weekDayPrepTimes ?? {};
		resolved = {
			...resolved,
			weekDayPrepTimes: addEstimatedDeliveryToWeekDays(
				baseWeekDays,
				prepTimeSettings.estimatedDeliveryMinutes ?? 0,
			),
		};
	}

	return resolved;
}

// ── Main ────────────────────────────────────────────────────────────────────

export function getSchedules({
	store,
	locations,
	cartItems,
	fulfillmentPreference,
	prepTimeSettings,
	currentLocation,
	isCateringFlow = false,
	platform = PLATFORM.WEB,
}: GetSchedulesParams): GetSchedulesResult {
	const {
		isAsapOrders,
		isSameDayOrders,
		max_future_order_days: daysCount = 7,
		weeklyPreSaleConfig,
		preSaleConfig,
	} = store;

	const cart = deriveCartInfo(cartItems);
	const resolvedPrepTime = resolvePrepTimeConfig(
		getPrepTimeCadenceAndFrequency(prepTimeSettings),
		cartItems,
		isCateringFlow,
		fulfillmentPreference,
		currentLocation?.timezone,
	);
	const {
		gapInMinutes,
		busyTimes: busyTimesByLocationId,
		prepTimeFrequency,
		prepTimeCadence,
		weekDayPrepTimes,
	} = resolvedPrepTime;

	const busyTimes = busyTimesByLocationId?.[currentLocation.location_id] ?? [];

	const businessHoursOverrides =
		getLocationsBusinessHoursOverrides(store.businessHoursOverrides, locations)[
			currentLocation.location_id
		] ?? [];

	const filterSchedule = (schedule: FulfillmentSchedule) =>
		filterBusyTimesFromSchedule({
			schedule,
			busyTimes,
			cartCategoryIds: cart.categoryIds,
		});

	// ── Weekly pre-sale path (early return) ─────────────────────────────────
	if (
		cart.hasWeeklyPreSaleItem &&
		weeklyPreSaleConfig?.active &&
		!isCateringFlow
	) {
		const weeklyPickupDates = getPreSalePickupDates(
			weeklyPreSaleConfig?.pickup_days,
			weeklyPreSaleConfig?.ordering_days,
		);

		if (weeklyPickupDates.length > 0) {
			const schedule = generateLocationFulfillmentSchedule({
				startDate: weeklyPickupDates[0],
				location: currentLocation,
				fulfillmentPreference,
				businessHoursOverrides,
				gapInMinutes,
				daysCount: 7,
				preSaleDates: weeklyPickupDates.map((d) => d.getDate()),
				presalePickupWeekDays: weeklyPreSaleConfig.pickup_days,
				platform,
			});

			return {
				schedule: filterSchedule(schedule),
				isWeeklyPreSaleAvailable: true,
			};
		}
	}

	// ── Main schedule path ──────────────────────────────────────────────────
	const isPreSaleEnabled =
		(preSaleConfig?.active ?? false) && cart.hasPreSaleItem && !isCateringFlow;
	const preSaleDates = resolvePreSaleDates(
		preSaleConfig,
		currentLocation.timezone,
	);
	const preSaleHoursOverride = getPreSaleHoursOverride(
		preSaleConfig,
		cart.hasPreSaleItem,
	);

	const needMultiDay = (!isAsapOrders && !isSameDayOrders) || isCateringFlow;
	const effectiveDaysCount = isPreSaleEnabled
		? differenceInDays(preSaleDates.endDate, preSaleDates.startDate) + 1
		: needMultiDay
			? daysCount
			: 1;

	const schedule = generateLocationFulfillmentSchedule({
		startDate: resolveStartDate(preSaleDates.startDate, cart.hasPreSaleItem),
		prepTimeFrequency,
		prepTimeCadence,
		location: currentLocation,
		fulfillmentPreference,
		businessHoursOverrides,
		gapInMinutes,
		daysCount: effectiveDaysCount,
		platform,
		...(!isPreSaleEnabled && {
			weekDayPrepTimes,
		}),
		...(preSaleHoursOverride && { preSaleHoursOverride }),
		...(isPreSaleEnabled && { endDate: preSaleDates.endDate }),
	});

	return {
		schedule: filterSchedule(schedule),
		isWeeklyPreSaleAvailable: false,
	};
}
