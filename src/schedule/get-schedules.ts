import { differenceInDays } from "date-fns";
import { PREP_TIME_CADENCE } from "../constants";
import type {
	CartItem,
	FulfillmentSchedule,
	GetSchedulesParams,
	GetSchedulesResult,
	PreSaleConfig,
} from "../types";
import { getLocationsBusinessHoursOverrides } from "../utils/business-hours";
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

// ── Main ────────────────────────────────────────────────────────────────────

export function getSchedules({
	store,
	locations,
	cartItems,
	fulfillmentPreference,
	prepTimeSettings,
	currentLocation,
}: GetSchedulesParams): GetSchedulesResult {
	const {
		isAsapOrders,
		isSameDayOrders,
		max_future_order_days: daysCount = 7,
		weeklyPreSaleConfig,
		preSaleConfig,
	} = store;
	console.log("prepTimeSettings", prepTimeSettings);

	const cart = deriveCartInfo(cartItems);
	const {
		gapInMinutes,
		busyTimes: busyTimesByLocationId,
		prepTimeFrequency,
		prepTimeCadence,
	} = prepTimeSettings;

	const weekDayPrepTimes =
		prepTimeCadence === PREP_TIME_CADENCE.DAYS
			? {}
			: prepTimeSettings?.weekDayPrepTimes;
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
	if (cart.hasWeeklyPreSaleItem && weeklyPreSaleConfig.active) {
		const weeklyPickupDates = getPreSalePickupDates(
			weeklyPreSaleConfig.pickup_days,
			weeklyPreSaleConfig.ordering_days,
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
			});

			return {
				schedule: filterSchedule(schedule),
				isWeeklyPreSaleAvailable: true,
			};
		}
	}

	// ── Main schedule path ──────────────────────────────────────────────────
	const isPreSaleEnabled =
		(preSaleConfig?.active ?? false) && cart.hasPreSaleItem;
	const preSaleDates = resolvePreSaleDates(
		preSaleConfig,
		currentLocation.timezone,
	);
	const preSaleHoursOverride = getPreSaleHoursOverride(
		preSaleConfig,
		cart.hasPreSaleItem,
	);

	const schedule = generateLocationFulfillmentSchedule({
		startDate: resolveStartDate(preSaleDates.startDate, cart.hasPreSaleItem),
		prepTimeFrequency,
		prepTimeCadence,
		location: currentLocation,
		fulfillmentPreference,
		businessHoursOverrides,
		gapInMinutes,
		daysCount: isPreSaleEnabled
			? differenceInDays(preSaleDates.endDate, preSaleDates.startDate) + 1
			: !isAsapOrders && !isSameDayOrders
				? daysCount
				: 1,

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
