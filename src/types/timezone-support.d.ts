declare module "timezone-support" {
	export function findTimeZone(timezone: string): string;
	export function getUnixTime(time: {
		zone: string;
		year: number;
		month: number;
		day: number;
		hours: number | string;
		minutes: number | string;
		seconds: number | string;
		milliseconds: number | string;
	}): number;
	export function getZonedTime(
		date: Date | number,
		timezone: string,
	): {
		zone: string;
		year: number;
		month: number;
		day: number;
		hours: number | string;
		minutes: number | string;
		seconds: number | string;
		milliseconds: number | string;
		dayOfWeek: number;
	};
	export function toZonedTime(
		date: Date | number | string,
		timezone: string,
	): Date;
}
