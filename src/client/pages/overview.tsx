import { KpiCard } from "../components/overview/kpi-card";
import { useMetricQuery } from "../hooks/use-metrics-query";
import { formatPercent, formatTokens, formatUSD } from "../lib/format";

export function OverviewPage() {
	const { data: cost, isLoading: costLoading } = useMetricQuery("cost", "all", "24h");
	const { data: tokens, isLoading: tokensLoading } = useMetricQuery("tokens", "all", "24h");
	const { data: cacheRead, isLoading: cacheLoading } = useMetricQuery("cache_read", "all", "24h");
	const { data: cacheCreation } = useMetricQuery("cache_creation", "all", "24h");

	const cacheRate =
		cacheRead && cacheCreation ? (cacheRead / (cacheRead + cacheCreation)) * 100 : 0;

	return (
		<div className="space-y-6">
			<h1 className="text-2xl font-bold">개요</h1>

			<div className="grid gap-4 md:grid-cols-3">
				<KpiCard title="오늘 비용" value={formatUSD(cost ?? 0)} isLoading={costLoading} />
				<KpiCard title="오늘 토큰" value={formatTokens(tokens ?? 0)} isLoading={tokensLoading} />
				<KpiCard title="캐시 히트율" value={formatPercent(cacheRate)} isLoading={cacheLoading} />
			</div>

			<div className="rounded-xl border bg-card p-6">
				<p className="text-muted-foreground">차트는 Phase 2.4에서 uPlot으로 구현됩니다.</p>
			</div>
		</div>
	);
}
