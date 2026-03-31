import { addMinutes, differenceInDays } from "date-fns";
import {
	FULFILLMENT_TYPES,
	MINUTES_PER_DAY,
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
		cartItemsCount: cartItems.length,
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

function resolveStartDate({
	preSaleStartDate,
	hasPreSaleItem,
	cateringShiftMinutes = 0,
}: {
	preSaleStartDate: Date;
	hasPreSaleItem: boolean;
	cateringShiftMinutes?: number;
}): Date {
	if (hasPreSaleItem) {
		return new Date(Math.max(preSaleStartDate.getTime(), Date.now()));
	}
	if (cateringShiftMinutes > 0) {
		return addMinutes(new Date(), cateringShiftMinutes);
	}
	return new Date();
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
 * Resolves prep time config: for catering flow uses cart-derived cadence/frequency.
 * estimatedDeliveryMinutes is now passed directly to generateSchedule rather than
 * being baked into prep time, so it is always additive on top of prep time.
 */
function resolvePrepTimeConfig(
	prepTimeSettings: PrepTimeSettings,
	cartItems: CartItem[],
	isCateringFlow: boolean,
): PrepTimeSettings {
	if (!isCateringFlow) {
		return prepTimeSettings;
	}

	const cateringPrepTimeConfig = getCateringPrepTimeConfig({
		items: cartItems,
		prepTimeCadence: prepTimeSettings.prepTimeCadence,
		prepTimeFrequency: prepTimeSettings.prepTimeFrequency,
	});
	return {
		...prepTimeSettings,
		...cateringPrepTimeConfig,
	};
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
	);

	const {
		gapInMinutes,
		busyTimes: busyTimesByLocationId,
		prepTimeFrequency: rawPrepTimeFrequency,
		prepTimeCadence,
		openingBuffer = 0,
		closingBuffer = 0,
	} = resolvedPrepTime;

	const isDayCadence = prepTimeCadence === PREP_TIME_CADENCE.DAY;
	const cateringShiftMinutes =
		isCateringFlow && !isDayCadence ? (rawPrepTimeFrequency ?? 0) : 0;
	const prepTimeFrequency =
		cateringShiftMinutes > 0 ? 0 : (rawPrepTimeFrequency ?? 0);

	const isDelivery = fulfillmentPreference === FULFILLMENT_TYPES.DELIVERY;
	const estimatedDeliveryMinutes = isDelivery
		? (resolvedPrepTime.estimatedDeliveryMinutes ?? 0)
		: 0;

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
	let isWeeklyPreSaleAvailable = false;
	// ── Weekly pre-sale path (early return) ─────────────────────────────────
	if (
		(cart.hasWeeklyPreSaleItem || !cart.cartItemsCount) &&
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
				preSaleDates: weeklyPickupDates,
				openingBuffer,
				closingBuffer,
				estimatedDeliveryMinutes,
			});
			const filteredSchedule = filterSchedule(schedule);
			if (cart.hasWeeklyPreSaleItem) {
				return {
					schedule: filteredSchedule,
					isWeeklyPreSaleAvailable: filteredSchedule.length > 0,
				};
			} else {
				isWeeklyPreSaleAvailable = filteredSchedule.length > 0;
			}
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
		currentDate: resolveStartDate({
			preSaleStartDate: preSaleDates.startDate,
			hasPreSaleItem: cart.hasPreSaleItem,
			cateringShiftMinutes,
		}),
		prepTimeFrequency,
		prepTimeCadence,
		location: currentLocation,
		fulfillmentPreference,
		businessHoursOverrides,
		gapInMinutes,
		daysCount: effectiveDaysCount,
		isCatering: isCateringFlow,
		openingBuffer,
		closingBuffer,
		estimatedDeliveryMinutes,
		...(preSaleHoursOverride && { preSaleHoursOverride }),
		...(isPreSaleEnabled && { endDate: preSaleDates.endDate }),
	});

	return {
		schedule: filterSchedule(schedule),
		isWeeklyPreSaleAvailable,
	};
}
