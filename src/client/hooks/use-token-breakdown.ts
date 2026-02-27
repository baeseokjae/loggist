import { useMetricRangeQuery } from "./use-metrics-query"

export function useTokenBreakdown(start: string, end: string, step: string, profile: string) {
	const cacheRead = useMetricRangeQuery("cache_read", start, end, step, profile, "increase")
	const cacheCreation = useMetricRangeQuery("cache_creation", start, end, step, profile, "increase")
	const tokens = useMetricRangeQuery("tokens", start, end, step, profile, "increase")

	return { cacheRead, cacheCreation, tokens }
}
