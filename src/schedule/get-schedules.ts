import { differenceInDays, differenceInMinutes } from "date-fns";
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
	PrepTimeImpact,
	PrepTimeSettings,
	PreSaleConfig,
} from "../types";
import { getLocationsBusinessHoursOverrides } from "../utils/business-hours";
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
}: {
	preSaleStartDate: Date;
	hasPreSaleItem: boolean;
}): Date {
	if (hasPreSaleItem) {
		return new Date(Math.max(preSaleStartDate.getTime(), Date.now()));
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

/** Earliest slot the schedule can offer, across every day in it. */
function findEarliestSlot(schedule: FulfillmentSchedule): Date | undefined {
	return schedule.find((day) => day.firstAvailableSlot)?.firstAvailableSlot;
}

/**
 * Impact for a schedule that never had prep time applied: it already is the
 * prep-free schedule, so its earliest slot is the honest answer and nothing
 * was delayed.
 */
function noPrepTimeImpact(schedule: FulfillmentSchedule): PrepTimeImpact {
	return {
		earliestSlotWithoutPrepTime: findEarliestSlot(schedule),
		delayInMinutes: 0,
	};
}

/**
 * Compare the earliest slot of the real schedule against one generated with
 * prep neutralized. Everything else (hours, buffers, busy times) is identical
 * in both, so what is left is prep time's own contribution.
 */
function buildPrepTimeImpact(
	scheduleWithPrepTime: FulfillmentSchedule,
	scheduleWithoutPrepTime: FulfillmentSchedule,
): PrepTimeImpact {
	const earliestSlot = findEarliestSlot(scheduleWithPrepTime);
	const earliestSlotWithoutPrepTime = findEarliestSlot(scheduleWithoutPrepTime);

	if (!earliestSlot || !earliestSlotWithoutPrepTime) {
		return { earliestSlotWithoutPrepTime, delayInMinutes: 0 };
	}

	return {
		earliestSlotWithoutPrepTime,
		delayInMinutes: Math.max(
			0,
			differenceInMinutes(earliestSlot, earliestSlotWithoutPrepTime),
		),
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
	const resolvedPrepTime = getPrepTimeCadenceAndFrequency(prepTimeSettings);

	const {
		gapInMinutes,
		busyTimes: busyTimesByLocationId,
		prepTimeFrequency: rawPrepTimeFrequency,
		prepTimeCadence,
		openingBuffer = 0,
		closingBuffer = 0,
	} = resolvedPrepTime;

	const prepTimeFrequency = rawPrepTimeFrequency ?? 0;

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
	if (weeklyPreSaleConfig?.active && !isCateringFlow) {
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
					// Weekly pre-sale slots are generated without prep time.
					prepTimeImpact: noPrepTimeImpact(filteredSchedule),
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

	const needMultiDay = !isAsapOrders && !isSameDayOrders;
	const effectiveDaysCount = isPreSaleEnabled
		? differenceInDays(preSaleDates.endDate, preSaleDates.startDate) + 1
		: needMultiDay
			? daysCount
			: 1;

	const scheduleParams = {
		currentDate: resolveStartDate({
			preSaleStartDate: preSaleDates.startDate,
			hasPreSaleItem: cart.hasPreSaleItem,
		}),
		prepTimeFrequency: isPreSaleEnabled ? 0 : prepTimeFrequency,
		prepTimeCadence: isPreSaleEnabled ? undefined : prepTimeCadence,
		location: currentLocation,
		fulfillmentPreference,
		businessHoursOverrides,
		gapInMinutes,
		daysCount: effectiveDaysCount,
		isCatering: isCateringFlow,
		openingBuffer: isPreSaleEnabled ? 0 : openingBuffer,
		closingBuffer: isPreSaleEnabled ? 0 : closingBuffer,
		estimatedDeliveryMinutes,
		...(preSaleHoursOverride && { preSaleHoursOverride }),
		...(isPreSaleEnabled && { endDate: preSaleDates.endDate }),
	};

	const filteredSchedule = filterSchedule(
		generateLocationFulfillmentSchedule(scheduleParams),
	);

	// `prepTimeFrequency: 0` is how this module already expresses "no prep time"
	// (see the pre-sale branch above), so the second schedule differs from the
	// first by prep time and nothing else. With no prep there is nothing to
	// neutralize, so the schedule is its own prep-free counterpart.
	const scheduleWithoutPrepTime = scheduleParams.prepTimeFrequency
		? filterSchedule(
				generateLocationFulfillmentSchedule({
					...scheduleParams,
					prepTimeFrequency: 0,
				}),
			)
		: filteredSchedule;

	return {
		schedule: filteredSchedule,
		isWeeklyPreSaleAvailable,
		prepTimeImpact: buildPrepTimeImpact(
			filteredSchedule,
			scheduleWithoutPrepTime,
		),
	};
}
