import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api-client";

interface CacheSavingsResponse {
	data: {
		totalSavings: number;
		byModel: Array<{
			model: string;
			tokens: number;
			savings: number;
		}>;
	};
}

export function useCacheSavings(profile: string, range: string) {
	return useQuery({
		queryKey: ["cache-savings", profile, range],
		queryFn: () =>
			api.get<CacheSavingsResponse>(
				`/metrics/cache-savings?profile=${profile}&range=${range}`,
			),
		refetchInterval: 60_000,
	});
}
