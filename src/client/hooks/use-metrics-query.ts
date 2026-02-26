import { useQuery } from "@tanstack/react-query";
import type { PrometheusResult } from "../../shared/types/prometheus";
import { api } from "../lib/api-client";

export function useMetricQuery(preset: string, profile = "all", range = "24h") {
	return useQuery({
		queryKey: ["metric", preset, profile, range],
		queryFn: () =>
			api.get<PrometheusResult>(
				`/metrics/query?preset=${preset}&profile=${profile}&range=${range}`,
			),
		select: (res) => {
			const value = res?.data?.result?.[0]?.value?.[1];
			return value ? Number.parseFloat(value) : 0;
		},
		refetchInterval: 30_000,
	});
}

export function useMetricRangeQuery(
	preset: string,
	start: string,
	end: string,
	step = "60",
	profile = "all",
	mode: "rate" | "increase" = "rate",
) {
	return useQuery({
		queryKey: ["metric-range", preset, profile, start, end, step, mode],
		queryFn: () =>
			api.get<PrometheusResult>(
				`/metrics/query_range?preset=${preset}&profile=${profile}&start=${start}&end=${end}&step=${step}&mode=${mode}`,
			),
		select: (res) => res?.data?.result || [],
		enabled: !!start && !!end,
	});
}
