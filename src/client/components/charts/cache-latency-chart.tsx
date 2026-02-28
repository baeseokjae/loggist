import { useMemo } from "react";
import type uPlot from "uplot";
import { useMetricRangeQuery } from "../../hooks/use-metrics-query";
import { getChartColors, withAlpha } from "../../lib/chart-utils";
import { ChartContainer } from "./chart-container";
import { UPlotWrapper } from "./uplot-wrapper";

interface CacheLatencyChartProps {
	start: string;
	end: string;
	step?: string;
	className?: string;
}

type MetricSeries = Array<{ metric: Record<string, string>; values?: [number, string][] }>;

function buildCacheLatencyAlignedData(
	cacheRatioResult: MetricSeries,
	latencyResult: MetricSeries,
): uPlot.AlignedData {
	// Collect all unique timestamps across all series
	const tsSet = new Set<number>();
	for (const series of [...cacheRatioResult, ...latencyResult]) {
		for (const [ts] of series.values ?? []) {
			tsSet.add(ts);
		}
	}

	if (tsSet.size === 0) {
		return [[], [], []];
	}

	const timestamps = Array.from(tsSet).sort((a, b) => a - b);
	const tsIndex = new Map(timestamps.map((ts, i) => [ts, i]));
	const len = timestamps.length;

	// Cache hit ratio (recording rule returns 0-1, convert to percentage)
	const cacheArr: (number | null)[] = new Array(len).fill(null);
	for (const series of cacheRatioResult) {
		for (const [ts, valStr] of series.values ?? []) {
			const idx = tsIndex.get(ts);
			if (idx === undefined) continue;
			const val = Number.parseFloat(valStr);
			cacheArr[idx] = Number.isFinite(val) ? val * 100 : null;
		}
	}

	// Latency series
	const latencyMap = new Map<number, number>();
	for (const series of latencyResult) {
		for (const [ts, valStr] of series.values ?? []) {
			latencyMap.set(ts, (latencyMap.get(ts) ?? 0) + Number.parseFloat(valStr));
		}
	}

	const latencyArr: (number | null)[] = new Array(len).fill(null);
	for (const ts of timestamps) {
		const idx = tsIndex.get(ts);
		if (idx === undefined) continue;
		const val = latencyMap.get(ts);
		latencyArr[idx] = val != null ? val : null;
	}

	return [timestamps, cacheArr, latencyArr] as uPlot.AlignedData;
}

export function CacheLatencyChart({ start, end, step = "300", className }: CacheLatencyChartProps) {
	const {
		data: cacheRatioResult,
		isLoading: cacheLoading,
		isError: cacheError,
	} = useMetricRangeQuery("cache_hit_ratio", start, end, step);

	const {
		data: latencyResult,
		isLoading: latencyLoading,
		isError: latencyError,
	} = useMetricRangeQuery("active_time", start, end, step);

	const isLoading = cacheLoading || latencyLoading;
	const isError = cacheError || latencyError;

	const chartData = useMemo(
		() => buildCacheLatencyAlignedData(cacheRatioResult ?? [], latencyResult ?? []),
		[cacheRatioResult, latencyResult],
	);

	const hasData =
		(chartData[1] as (number | null)[]).some((v) => v != null) ||
		(chartData[2] as (number | null)[]).some((v) => v != null);

	const options = useMemo((): Partial<uPlot.Options> => {
		const colors = getChartColors();
		return {
			height: 240,
			scales: {
				x: { time: true, range: [Number(start), Number(end)] },
				cache: { range: [0, 100] },
				latency: { auto: true },
			},
			series: [
				{},
				{
					scale: "cache",
					label: "캐시 히트율",
					stroke: colors.chart3,
					width: 2,
					fill: withAlpha(colors.chart3, 0.12),
					value: (_u, v) => (v != null ? `${v.toFixed(1)}%` : "-"),
				},
				{
					scale: "latency",
					label: "API 지연",
					stroke: colors.chart4,
					width: 2,
					fill: withAlpha(colors.chart4, 0.12),
					value: (_u, v) => (v != null ? `${v.toFixed(2)}s` : "-"),
				},
			],
			axes: [
				{
					stroke: colors.foreground,
					grid: { stroke: colors.border, width: 1 },
					ticks: { stroke: colors.border, width: 1 },
				},
				{
					scale: "cache",
					label: "캐시 (%)",
					side: 3,
					stroke: colors.foreground,
					grid: { stroke: colors.border, width: 1 },
					ticks: { stroke: colors.border, width: 1 },
					values: (_u, vals) => vals.map((v) => (v != null ? `${(v as number).toFixed(0)}%` : "")),
				},
				{
					scale: "latency",
					label: "지연 (s)",
					side: 1,
					stroke: colors.foreground,
					grid: { show: false },
					ticks: { stroke: colors.border, width: 1 },
					values: (_u, vals) => vals.map((v) => (v != null ? `${(v as number).toFixed(1)}s` : "")),
				},
			],
			legend: { show: false },
			cursor: { show: true },
			padding: [8, 72, 8, 8],
		};
	}, [start, end]);

	return (
		<ChartContainer
			isLoading={isLoading}
			isError={isError}
			isEmpty={!hasData}
			errorMessage="차트 데이터를 불러오지 못했습니다."
			emptyMessage="표시할 데이터가 없습니다."
		>
			<div className={className}>
				<UPlotWrapper data={chartData} options={options} className="w-full" />
			</div>
		</ChartContainer>
	);
}
