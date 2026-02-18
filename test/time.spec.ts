import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	getNextDateForDayOfWeek,
	getPreSalePickupDates,
	isSameDateInTimeZone,
	isTodayInTimeZone,
	isTomorrowInTimeZone,
} from "../src/utils/date";
import { isTimeInRange, parseTimeString } from "../src/utils/time";

describe("isTodayInTimeZone", () => {
	const timezone = "America/New_York";

	beforeEach(() => {
		vi.spyOn(Date, "now").mockImplementation(() =>
			new Date("2024-03-15T12:00:00Z").getTime(),
		);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should return false when date is null", () => {
		expect(isTodayInTimeZone(null as unknown as Date, timezone)).toBe(false);
	});

	describe("when date is today in the specified timezone", () => {
		it("should return true for same day and month", () => {
			const todayInNewYork = new Date("2024-03-15T15:00:00Z");
			expect(isTodayInTimeZone(todayInNewYork, timezone)).toBe(true);
		});

		it("should return true for late night edge case", () => {
			const lateNightInNewYork = new Date("2024-03-16T03:59:59Z");
			expect(isTodayInTimeZone(lateNightInNewYork, timezone)).toBe(true);
		});
	});

	describe("when date is tomorrow in the specified timezone", () => {
		it("should return false", () => {
			const tomorrowInNewYork = new Date("2024-03-16T15:00:00Z");
			expect(isTodayInTimeZone(tomorrowInNewYork, timezone)).toBe(false);
		});
	});

	describe("when date is yesterday in the specified timezone", () => {
		it("should return false", () => {
			const yesterdayInNewYork = new Date("2024-03-14T15:00:00Z");
			expect(isTodayInTimeZone(yesterdayInNewYork, timezone)).toBe(false);
		});
	});

	describe("when date is same day but different month", () => {
		it("should return false", () => {
			const sameDay = new Date("2024-04-15T15:00:00Z");
			expect(isTodayInTimeZone(sameDay, timezone)).toBe(false);
		});
	});

	describe("when using different timezones", () => {
		it("should work with Los Angeles timezone", () => {
			const laTimezone = "America/Los_Angeles";
			const dateInLA = new Date("2024-03-15T15:00:00Z");
			expect(isTodayInTimeZone(dateInLA, laTimezone)).toBe(true);
		});

		it("should handle timezone date boundary differences", () => {
			const tokyoTimezone = "Asia/Tokyo";
			const dateInTokyo = new Date("2024-03-15T15:00:00Z");
			expect(isTodayInTimeZone(dateInTokyo, tokyoTimezone)).toBe(false);
		});
	});
});

describe("isTomorrowInTimeZone", () => {
	const timezone = "America/New_York";

	beforeEach(() => {
		vi.spyOn(Date, "now").mockImplementation(() =>
			new Date("2024-03-15T12:00:00Z").getTime(),
		);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("when date is tomorrow in the specified timezone", () => {
		it("should return true for same month", () => {
			const tomorrowInNewYork = new Date("2024-03-16T15:00:00Z");
			expect(isTomorrowInTimeZone(tomorrowInNewYork, timezone)).toBe(true);
		});

		it("should return true for late night edge case", () => {
			const lateNightInNewYork = new Date("2024-03-17T03:59:59Z");
			expect(isTomorrowInTimeZone(lateNightInNewYork, timezone)).toBe(true);
		});

		describe("when tomorrow is in the next month", () => {
			beforeEach(() => {
				vi.spyOn(Date, "now").mockImplementation(() =>
					new Date("2024-03-31T12:00:00Z").getTime(),
				);
			});

			it("should return true for next month (March 31 -> April 1)", () => {
				const tomorrowNextMonth = new Date("2024-04-01T15:00:00Z");
				expect(isTomorrowInTimeZone(tomorrowNextMonth, timezone)).toBe(true);
			});

			it("should return true for late night edge case across months", () => {
				const lateNightNextMonth = new Date("2024-04-02T03:59:59Z");
				expect(isTomorrowInTimeZone(lateNightNextMonth, timezone)).toBe(true);
			});
		});
	});

	describe("when date is today in the specified timezone", () => {
		it("should return false", () => {
			const todayInNewYork = new Date("2024-03-15T15:00:00Z");
			expect(isTomorrowInTimeZone(todayInNewYork, timezone)).toBe(false);
		});
	});

	describe("when date is day after tomorrow in the specified timezone", () => {
		it("should return false", () => {
			const dayAfterTomorrowInNewYork = new Date("2024-03-17T15:00:00Z");
			expect(isTomorrowInTimeZone(dayAfterTomorrowInNewYork, timezone)).toBe(
				false,
			);
		});
	});

	describe("when date is same day next month", () => {
		it("should return false", () => {
			const sameDayNextMonth = new Date("2024-04-16T15:00:00Z");
			expect(isTomorrowInTimeZone(sameDayNextMonth, timezone)).toBe(false);
		});
	});

	describe("when using different timezones", () => {
		it("should work with Los Angeles timezone", () => {
			const laTimezone = "America/Los_Angeles";
			const tomorrowInLA = new Date("2024-03-16T15:00:00Z");
			expect(isTomorrowInTimeZone(tomorrowInLA, laTimezone)).toBe(true);
		});

		it("should handle timezone date boundary differences", () => {
			const tokyoTimezone = "Asia/Tokyo";
			const dateInTokyo = new Date("2024-03-16T15:00:00Z");
			expect(isTomorrowInTimeZone(dateInTokyo, tokyoTimezone)).toBe(false);
		});
	});
});

describe("isSameDateInTimeZone", () => {
	const timezone = "America/New_York";

	describe("when both dates are the same in the specified timezone", () => {
		it("should return true", () => {
			const date1 = new Date("2024-03-15T15:00:00Z");
			const date2 = new Date("2024-03-15T12:00:00Z");
			expect(isSameDateInTimeZone(date1, date2, timezone)).toBe(true);
		});
	});

	describe("when both dates are different in the specified timezone", () => {
		it("should return false", () => {
			const date1 = new Date("2024-03-15T15:00:00Z");
			const date2 = new Date("2024-03-16T12:00:00Z");
			expect(isSameDateInTimeZone(date1, date2, timezone)).toBe(false);
		});
	});

	describe("when working with different timezones", () => {
		it("should return true", () => {
			const laTimezone = "America/Los_Angeles";
			const date1 = new Date("2024-03-15T15:00:00Z");
			const date2 = new Date("2024-03-15T12:00:00Z");
			expect(isSameDateInTimeZone(date1, date2, laTimezone)).toBe(true);
		});
	});
});

describe("parseTimeString", () => {
	describe("when input is null or empty", () => {
		it("should return default time", () => {
			expect(parseTimeString(null)).toEqual({ hours: 0, minutes: 0 });
			expect(parseTimeString("")).toEqual({ hours: 0, minutes: 0 });
		});
	});

	describe("when input is in HH:MM format", () => {
		it("should return correct time", () => {
			expect(parseTimeString("12:34")).toEqual({ hours: 12, minutes: 34 });
			expect(parseTimeString("01:02")).toEqual({ hours: 1, minutes: 2 });
			expect(parseTimeString("00:00")).toEqual({ hours: 0, minutes: 0 });
		});
	});
});

describe("isTimeInRange", () => {
	const schedule = {
		start_time: "09:00",
		end_time: "17:00",
	};

	describe("when time is within the schedule", () => {
		it("should return true", () => {
			const time = { hours: 12, minutes: 30 };
			expect(isTimeInRange(schedule, time)).toBe(true);
		});
	});

	describe("when time is outside the schedule", () => {
		describe("when time is before the schedule", () => {
			it("should return false", () => {
				const time = { hours: 8, minutes: 30 };
				expect(isTimeInRange(schedule, time)).toBe(false);
			});
		});

		describe("when time is after the schedule", () => {
			it("should return false", () => {
				const time = { hours: 18, minutes: 30 };
				expect(isTimeInRange(schedule, time)).toBe(false);
			});
		});
	});

	describe("when time is at schedule boundaries", () => {
		describe("when time is the same as the start time", () => {
			it("should return true", () => {
				const time = { hours: 9, minutes: 0 };
				expect(isTimeInRange(schedule, time)).toBe(true);
			});
		});

		describe("when time is the same as the end time", () => {
			it("should return true", () => {
				const time = { hours: 17, minutes: 0 };
				expect(isTimeInRange(schedule, time)).toBe(true);
			});
		});

		describe("when time is between the start and end time", () => {
			it("should return true", () => {
				const time = { hours: 12, minutes: 30 };
				expect(isTimeInRange(schedule, time)).toBe(true);
			});
		});
	});
});

describe("getNextDateForDayOfWeek", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2024-03-15T12:00:00Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("when target day is in the future", () => {
		it("should return the next occurrence of that day", () => {
			const nextSunday = getNextDateForDayOfWeek(0);
			expect(nextSunday.getDay()).toBe(0);
			expect(nextSunday.toISOString()).toBe("2024-03-17T12:00:00.000Z");
		});

		it("should return the next occurrence when target is multiple days ahead", () => {
			const nextWednesday = getNextDateForDayOfWeek(3);
			expect(nextWednesday.getDay()).toBe(3);
			expect(nextWednesday.toISOString()).toBe("2024-03-20T12:00:00.000Z");
		});
	});

	describe("when target day is in the past", () => {
		it("should return the next occurrence in the following week", () => {
			const nextWednesday = getNextDateForDayOfWeek(3);
			expect(nextWednesday.getDay()).toBe(3);
			expect(nextWednesday.toISOString()).toBe("2024-03-20T12:00:00.000Z");
		});
	});

	describe("when target day is the same as current day", () => {
		it("should return the current day", () => {
			const nextFriday = getNextDateForDayOfWeek(5);
			expect(nextFriday.getDay()).toBe(5);
			expect(nextFriday.toISOString()).toBe("2024-03-15T12:00:00.000Z");
		});
	});

	describe("when passing a reference date", () => {
		it("should calculate next day from the reference date", () => {
			const referenceDate = new Date("2024-03-10T12:00:00Z");
			const nextWednesday = getNextDateForDayOfWeek(3, referenceDate);
			expect(nextWednesday.getDay()).toBe(3);
			expect(nextWednesday.toISOString()).toBe("2024-03-13T12:00:00.000Z");
		});
	});
});

describe("getPreSalePickupDates", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2024-03-15T12:00:00Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("when no parameters are provided", () => {
		it("should return an empty array", () => {
			const result = getPreSalePickupDates();
			expect(result).toEqual([]);
		});
	});

	describe("when today is a pickup day", () => {
		it("should return an empty array", () => {
			const result = getPreSalePickupDates([5], [5]);
			expect(result).toEqual([]);
		});
	});

	describe("when today is not an ordering day", () => {
		it("should return an empty array", () => {
			const result = getPreSalePickupDates([0, 2, 4], [1]);
			expect(result).toEqual([]);
		});
	});

	describe("when today is an ordering day but not a pickup day", () => {
		it("should return next available pickup dates sorted", () => {
			const result = getPreSalePickupDates([0, 3], [5]);

			expect(result).toHaveLength(2);
			expect(result[0].getDay()).toBe(0);
			expect(result[1].getDay()).toBe(3);
			expect(result[0].toISOString()).toBe("2024-03-17T12:00:00.000Z");
			expect(result[1].toISOString()).toBe("2024-03-20T12:00:00.000Z");
		});
	});

	describe("when multiple pickup days are available", () => {
		it("should return all pickup dates in chronological order", () => {
			const result = getPreSalePickupDates([6, 0, 3], [5]);

			expect(result).toHaveLength(3);
			expect(result[0].getDay()).toBe(6);
			expect(result[1].getDay()).toBe(0);
			expect(result[2].getDay()).toBe(3);
			expect(result[0].toISOString()).toBe("2024-03-16T12:00:00.000Z");
			expect(result[1].toISOString()).toBe("2024-03-17T12:00:00.000Z");
			expect(result[2].toISOString()).toBe("2024-03-20T12:00:00.000Z");
		});
	});
});
