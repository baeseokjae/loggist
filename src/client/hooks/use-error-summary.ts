import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api-client";

interface ErrorSummaryResponse {
	data: {
		errors: Array<{
			statusCode: string;
			count: number;
		}>;
	};
}

export function useErrorSummary(profile: string, range: string) {
	return useQuery({
		queryKey: ["error-summary", profile, range],
		queryFn: () =>
			api.get<ErrorSummaryResponse>(
				`/metrics/error-summary?profile=${profile}&range=${range}`,
			),
		refetchInterval: 60_000,
	});
}
