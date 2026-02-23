export interface Shift {
	day: number;
	start: string;
	end: string;
}

export interface DateOverride {
	month: number;
	day: number;
	shifts?: Pick<Shift, "start" | "end">[] | null;
}

export interface DaySlots {
	date: Date;
	slots: Date[];
}

export type Schedule = DaySlots[];

export interface ScheduleContext {
	timeZone: string;
	now: Date;
	intervalMinutes: number;
	shifts: Shift[];
}

export interface ShiftContext {
	date: Date;
	start: Date;
	end: Date;
	isOvernight: boolean;
	timeZone: string;
	now: Date;
}

export type ScheduleTransform = (
	schedule: Schedule,
	ctx: ScheduleContext,
) => Schedule;

export type ShiftTransform = (slots: Date[], ctx: ShiftContext) => Date[];

export interface CreateScheduleConfig {
	timeZone: string;
	now?: Date;
	startDate?: Date;
	daysAhead: number;
	intervalMinutes?: number;
	shifts: Shift[];
	overrides?: DateOverride[];
	shiftTransforms?: ShiftTransform[];
	transforms?: ScheduleTransform[];
}
