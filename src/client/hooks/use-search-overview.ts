import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api-client";

interface EventCountsResponse {
	data: {
		counts: Record<string, number>;
	};
}

interface VolumeResponse {
	data: {
		result: Array<{
			metric: { event_name: string };
			values: [number, string][];
		}>;
	};
}

export function useEventCounts(profile: string, start: string, end: string) {
	return useQuery({
		queryKey: ["event-counts", profile, start, end],
		queryFn: () => {
			const params = new URLSearchParams({ profile, start, end });
			return api.get<EventCountsResponse>(`/logs/event-counts?${params}`);
		},
		select: (res) => res?.data?.counts ?? {},
		staleTime: 2 * 60 * 1000,
	});
}

export function useVolumeData(profile: string, start: string, end: string, step: string) {
	return useQuery({
		queryKey: ["volume", profile, start, end, step],
		queryFn: () => {
			const params = new URLSearchParams({ profile, start, end, step });
			return api.get<VolumeResponse>(`/logs/volume?${params}`);
		},
		select: (res) => res?.data?.result ?? [],
		staleTime: 2 * 60 * 1000,
	});
}
