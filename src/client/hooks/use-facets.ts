import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api-client";

export interface FacetValue {
	value: string;
	count: number;
}

export interface FacetData {
	event_name: FacetValue[];
	model: FacetValue[];
	tool_name: FacetValue[];
	success: FacetValue[];
}

export function useFacets(profile: string, start: string, end: string) {
	return useQuery({
		queryKey: ["facets", profile, start, end],
		queryFn: () => {
			const params = new URLSearchParams({ profile, start, end });
			return api.get<{ data: FacetData }>(`/logs/facets?${params}`);
		},
		select: (res) => res?.data,
		staleTime: 5 * 60 * 1000,
	});
}
