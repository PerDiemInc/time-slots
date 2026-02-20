import type { Schedule, ScheduleContext, ScheduleTransform } from "./types";

export function pipe(...transforms: ScheduleTransform[]): ScheduleTransform {
	return (schedule, ctx) =>
		transforms.reduce((acc, fn) => fn(acc, ctx), schedule);
}

export function applyTransforms(
	schedule: Schedule,
	ctx: ScheduleContext,
	transforms: ScheduleTransform[],
): Schedule {
	return transforms.reduce((acc, fn) => fn(acc, ctx), schedule);
}
