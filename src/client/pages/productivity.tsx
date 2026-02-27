import { useQuery } from "@tanstack/react-query";
import { ToolDistribution } from "../components/productivity/tool-distribution";
import { Header } from "../components/layout/header";
import { KpiCard } from "../components/overview/kpi-card";
import { useCacheSavings } from "../hooks/use-cache-savings";
import { useMetricQuery } from "../hooks/use-metrics-query";
import { api } from "../lib/api-client";
import { formatPercent, formatTokens, formatUSD } from "../lib/format";
import { cn } from "../lib/utils";
import { useProfileFilter } from "../stores/profile-filter";
import { useTimeRange } from "../stores/time-range";

// ── Model Comparison ──────────────────────────────────────────────────────────

interface ModelRow {
	model: string;
	totalCost: number;
	totalTokens: number;
	cacheReadTokens: number;
	costPerMToken: number;
}

interface ModelComparisonResponse {
	data: {
		models: ModelRow[];
	};
}

function useModelComparison(profile: string, range: string) {
	return useQuery({
		queryKey: ["model-comparison", profile, range],
		queryFn: () =>
			api.get<ModelComparisonResponse>(
				`/metrics/model-comparison?profile=${profile}&range=${range}`,
			),
		select: (res) => res?.data?.models ?? [],
		refetchInterval: 60_000,
	});
}

function ModelComparisonTable({ profile, range }: { profile: string; range: string }) {
	const { data: models, isLoading } = useModelComparison(profile, range);

	if (isLoading) {
		return (
			<div className="rounded-xl border bg-card p-4">
				<h3 className="mb-3 text-sm font-medium">모델 비교</h3>
				<div className="animate-pulse space-y-2">
					{[1, 2, 3].map((i) => (
						<div key={i} className="h-8 rounded bg-muted" />
					))}
				</div>
			</div>
		);
	}

	if (!models || models.length === 0) {
		return (
			<div className="rounded-xl border bg-card p-4">
				<h3 className="mb-3 text-sm font-medium">모델 비교</h3>
				<p className="text-sm text-muted-foreground">모델 데이터가 없습니다.</p>
			</div>
		);
	}

	return (
		<div className="rounded-xl border bg-card p-4">
			<h3 className="mb-3 text-sm font-medium">모델 비교</h3>
			<div className="overflow-x-auto">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b text-left text-xs text-muted-foreground">
							<th className="pb-2 pr-4 font-medium">모델</th>
							<th className="pb-2 pr-4 font-medium text-right">총 비용</th>
							<th className="pb-2 pr-4 font-medium text-right">총 토큰</th>
							<th className="pb-2 pr-4 font-medium text-right">비용/MTok</th>
							<th className="pb-2 font-medium text-right">캐시율</th>
						</tr>
					</thead>
					<tbody>
						{models.map((row) => {
							const cacheRate =
								row.totalTokens > 0 ? (row.cacheReadTokens / row.totalTokens) * 100 : 0;
							return (
								<tr key={row.model} className="border-b last:border-0">
									<td className="py-1.5 pr-4 font-medium">
										<span className="max-w-[200px] truncate block" title={row.model}>
											{row.model}
										</span>
									</td>
									<td className="py-1.5 pr-4 text-right">{formatUSD(row.totalCost)}</td>
									<td className="py-1.5 pr-4 text-right">{formatTokens(row.totalTokens)}</td>
									<td className="py-1.5 pr-4 text-right">{formatUSD(row.costPerMToken)}</td>
									<td
										className={cn(
											"py-1.5 text-right",
											cacheRate > 50 ? "text-chart-2" : "text-muted-foreground",
										)}
									>
										{formatPercent(cacheRate)}
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</div>
	);
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function ProductivityPage() {
	const { range, start, end } = useTimeRange();
	const { profile } = useProfileFilter();

	const { data: costPerHour, isLoading: costPerHourLoading } = useMetricQuery(
		"cost_per_hour",
		profile,
		range,
	);
	const { data: cacheSavingsData, isLoading: cacheSavingsLoading } = useCacheSavings(profile, range);
	const { data: editAcceptRatio, isLoading: editAcceptLoading } = useMetricQuery(
		"edit_accept_ratio",
		profile,
		range,
	);
	const { data: models, isLoading: modelsLoading } = useModelComparison(profile, range);

	const modelCount = models?.length ?? 0;

	return (
		<div className="space-y-6">
			<Header title="생산성" />

			<div className="grid gap-4 lg:grid-cols-4 md:grid-cols-2">
				<KpiCard
					title="시간당 비용"
					value={formatUSD(costPerHour ?? 0)}
					isLoading={costPerHourLoading}
				/>
				<KpiCard
					title="캐시 절감"
					value={
						cacheSavingsData
							? formatUSD(cacheSavingsData.data.totalSavings)
							: "-"
					}
					subtitle="추정치"
					isLoading={cacheSavingsLoading}
				/>
				<KpiCard
					title="편집 수락률"
					value={formatPercent((editAcceptRatio ?? 0) * 100)}
					isLoading={editAcceptLoading}
				/>
				<KpiCard
					title="사용 모델 수"
					value={String(modelCount)}
					isLoading={modelsLoading}
				/>
			</div>

			<ToolDistribution profile={profile} start={start} end={end} />

			<ModelComparisonTable profile={profile} range={range} />
		</div>
	);
}
