/**
 * Fulfillment types for pickup, delivery, curbside.
 */
export const FULFILLMENT_TYPES = {
	PICKUP: "PICKUP",
	DELIVERY: "DELIVERY",
	CURBSIDE: "CURBSIDE",
} as const;

export type FulfillmentType =
	(typeof FULFILLMENT_TYPES)[keyof typeof FULFILLMENT_TYPES];

export const DEFAULT_GAP_IN_MINUTES = 15;
export const DEFAULT_PREP_TIME_IN_MINUTES = 5;

/**
 * Prep time behaviour when computing first available slot.
 */
export const PrepTimeBehaviour = Object.freeze({
	FIRST_SHIFT: 0,
	EVERY_SHIFT: 1,
	ROLL_FROM_FIRST_SHIFT: 2,
});

export type PrepTimeBehaviourType =
	(typeof PrepTimeBehaviour)[keyof typeof PrepTimeBehaviour];

export const PREP_TIME_CADENCE = {
	MINUTES: "minutes",
	DAYS: "days",
	HOURS: "hours",
} as const;

export type PrepTimeCadence =
	(typeof PREP_TIME_CADENCE)[keyof typeof PREP_TIME_CADENCE];
