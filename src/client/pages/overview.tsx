import { CacheLatencyChart } from "../components/charts/cache-latency-chart";
import { CostChart } from "../components/charts/cost-chart";
import { TokenBreakdownChart } from "../components/charts/token-breakdown-chart";
import { Header } from "../components/layout/header";
import { KpiCard } from "../components/overview/kpi-card";
import { RecentErrors } from "../components/overview/recent-errors";
import { useCacheSavings } from "../hooks/use-cache-savings";
import { useMetricQuery } from "../hooks/use-metrics-query";
import { formatPercent, formatTokens, formatUSD } from "../lib/format";
import { useProfileFilter } from "../stores/profile-filter";
import { useTimeRange } from "../stores/time-range";

export function OverviewPage() {
	const { range, start, end, step, label } = useTimeRange();
	const { profile } = useProfileFilter();

	const { data: cost, isLoading: costLoading } = useMetricQuery("cost", profile, range);
	const { data: tokens, isLoading: tokensLoading } = useMetricQuery("tokens", profile, range);
	const { data: cacheHitRatio, isLoading: cacheLoading } = useMetricQuery(
		"cache_hit_ratio",
		profile,
		range,
	);
	const { data: cacheSavingsData, isLoading: isCacheSavingsLoading } = useCacheSavings(
		profile,
		range,
	);

	const cacheRate = (cacheHitRatio ?? 0) * 100;

	return (
		<div className="space-y-6">
			<Header title="개요" />

			<div className="grid gap-4 lg:grid-cols-4 md:grid-cols-2">
				<KpiCard title={`${label} 비용`} value={formatUSD(cost ?? 0)} isLoading={costLoading} />
				<KpiCard
					title={`${label} 토큰`}
					value={formatTokens(tokens ?? 0)}
					isLoading={tokensLoading}
				/>
				<KpiCard title={`${label} 캐시 히트율`} value={formatPercent(cacheRate)} isLoading={cacheLoading} />
				<KpiCard
					title={`${label} 캐시 절감`}
					value={cacheSavingsData ? `$${Number(cacheSavingsData.data.totalSavings).toFixed(2)}` : "-"}
					subtitle="추정치"
					isLoading={isCacheSavingsLoading}
				/>
			</div>

			<div className="grid gap-4 lg:grid-cols-2">
				<div className="rounded-xl border bg-card p-6">
					<h2 className="mb-4 text-base font-semibold">누적 비용 ({label})</h2>
					<CostChart start={start} end={end} step={step} variant="cumulative" />
				</div>
				<div className="rounded-xl border bg-card p-6">
					<h2 className="mb-4 text-base font-semibold">구간별 비용 ({label})</h2>
					<CostChart start={start} end={end} step={step} variant="per-step" />
				</div>
			</div>

			<div className="rounded-xl border bg-card p-6">
				<h2 className="mb-4 text-base font-semibold">토큰 사용량 ({label})</h2>
				<TokenBreakdownChart start={start} end={end} step={step} />
			</div>

			<div className="rounded-xl border bg-card p-6">
				<h2 className="mb-4 text-base font-semibold">캐시 히트율 / API 지연 ({label})</h2>
				<CacheLatencyChart start={start} end={end} step={step} className="overflow-hidden" />
			</div>

			<RecentErrors />
		</div>
	);
}
