export interface BusyTimeItem {
	startTime: string;
	endTime: string;
	threshold?: { categoryIds?: string[] };
}
