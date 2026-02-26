import { CacheLatencyChart } from "../components/charts/cache-latency-chart";
import { CostChart } from "../components/charts/cost-chart";
import { TokenChart } from "../components/charts/token-chart";
import { Header } from "../components/layout/header";
import { KpiCard } from "../components/overview/kpi-card";
import { RecentErrors } from "../components/overview/recent-errors";
import { useMetricQuery } from "../hooks/use-metrics-query";
import { formatPercent, formatTokens, formatUSD } from "../lib/format";
import { useProfileFilter } from "../stores/profile-filter";
import { useTimeRange } from "../stores/time-range";

export function OverviewPage() {
	const { range, start, end, step, label } = useTimeRange();
	const { profile } = useProfileFilter();

	const { data: cost, isLoading: costLoading } = useMetricQuery("cost", profile, range);
	const { data: tokens, isLoading: tokensLoading } = useMetricQuery("tokens", profile, range);
	const { data: cacheRead, isLoading: cacheLoading } = useMetricQuery(
		"cache_read",
		profile,
		range,
	);
	const { data: cacheCreation } = useMetricQuery("cache_creation", profile, range);

	const cacheRate =
		cacheRead && cacheCreation ? (cacheRead / (cacheRead + cacheCreation)) * 100 : 0;

	return (
		<div className="space-y-6">
			<Header title="개요" />

			<div className="grid gap-4 md:grid-cols-3">
				<KpiCard title={`${label} 비용`} value={formatUSD(cost ?? 0)} isLoading={costLoading} />
				<KpiCard
					title={`${label} 토큰`}
					value={formatTokens(tokens ?? 0)}
					isLoading={tokensLoading}
				/>
				<KpiCard title="캐시 히트율" value={formatPercent(cacheRate)} isLoading={cacheLoading} />
			</div>

			<div className="rounded-xl border bg-card p-6">
				<h2 className="mb-4 text-base font-semibold">비용 추이 ({label})</h2>
				<CostChart start={start} end={end} step={step} />
			</div>

			<div className="rounded-xl border bg-card p-6">
				<h2 className="mb-4 text-base font-semibold">토큰 사용량 ({label})</h2>
				<TokenChart start={start} end={end} step={step} />
			</div>

			<div className="rounded-xl border bg-card p-6">
				<h2 className="mb-4 text-base font-semibold">캐시 히트율 / API 지연 ({label})</h2>
				<CacheLatencyChart start={start} end={end} step={step} />
			</div>

			<RecentErrors />
		</div>
	);
}
