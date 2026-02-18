export function parseTimeString(timeString: string | null | undefined): {
	hours: number;
	minutes: number;
} {
	if (!timeString) {
		return { hours: 0, minutes: 0 };
	}

	const [hours = 0, minutes = 0] = String(timeString).split(":");

	return { hours: Number(hours), minutes: Number(minutes) };
}

export function isTimeInRange(
	schedule: { start_time?: string; end_time?: string },
	time: { hours: number; minutes: number },
): boolean {
	const startTime = parseTimeString(schedule?.start_time);
	const endTime = parseTimeString(schedule?.end_time);

	if (time.hours < startTime.hours || time.hours > endTime.hours) {
		return false;
	}

	if (time.hours === startTime.hours) {
		if (time.minutes < startTime.minutes) {
			return false;
		}
	}

	if (time.hours === endTime.hours) {
		if (time.minutes > endTime.minutes) {
			return false;
		}
	}

	return true;
}
