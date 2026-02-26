import { useMemo } from "react";
import type uPlot from "uplot";
import { useMetricRangeQuery } from "../../hooks/use-metrics-query";
import { getChartColors } from "../../lib/chart-utils";
import { ChartContainer } from "./chart-container";
import { UPlotWrapper } from "./uplot-wrapper";

interface CacheChartProps {
	start: string;
	end: string;
	step?: string;
	className?: string;
}

function buildCacheAlignedData(
	readResult: Array<{ metric: Record<string, string>; values?: [number, string][] }>,
	creationResult: Array<{ metric: Record<string, string>; values?: [number, string][] }>,
): uPlot.AlignedData {
	// Collect all unique timestamps across both series
	const tsSet = new Set<number>();
	for (const series of readResult) {
		for (const [ts] of series.values ?? []) {
			tsSet.add(ts);
		}
	}
	for (const series of creationResult) {
		for (const [ts] of series.values ?? []) {
			tsSet.add(ts);
		}
	}

	if (tsSet.size === 0) {
		return [[], []];
	}

	const timestamps = Array.from(tsSet).sort((a, b) => a - b);
	const tsIndex = new Map(timestamps.map((ts, i) => [ts, i]));

	// Build per-timestamp maps for read and creation values
	const readMap = new Map<number, number>();
	for (const series of readResult) {
		for (const [ts, valStr] of series.values ?? []) {
			const prev = readMap.get(ts) ?? 0;
			readMap.set(ts, prev + Number.parseFloat(valStr));
		}
	}

	const creationMap = new Map<number, number>();
	for (const series of creationResult) {
		for (const [ts, valStr] of series.values ?? []) {
			const prev = creationMap.get(ts) ?? 0;
			creationMap.set(ts, prev + Number.parseFloat(valStr));
		}
	}

	// Compute cache hit ratio percentage at each timestamp
	const ratioArr: (number | null)[] = new Array(timestamps.length).fill(null);
	for (const ts of timestamps) {
		const idx = tsIndex.get(ts);
		if (idx === undefined) continue;
		const read = readMap.get(ts) ?? 0;
		const creation = creationMap.get(ts) ?? 0;
		const total = read + creation;
		ratioArr[idx] = total > 0 ? (read / total) * 100 : null;
	}

	return [timestamps, ratioArr] as uPlot.AlignedData;
}

export function CacheChart({ start, end, step = "300", className }: CacheChartProps) {
	const {
		data: readResult,
		isLoading: readLoading,
		isError: readError,
	} = useMetricRangeQuery("cache_read", start, end, step);

	const {
		data: creationResult,
		isLoading: creationLoading,
		isError: creationError,
	} = useMetricRangeQuery("cache_creation", start, end, step);

	const isLoading = readLoading || creationLoading;
	const isError = readError || creationError;

	const chartData = useMemo(
		() => buildCacheAlignedData(readResult ?? [], creationResult ?? []),
		[readResult, creationResult],
	);

	const hasData = (chartData[1] as (number | null)[]).some((v) => v != null);

	const options = useMemo((): Partial<uPlot.Options> => {
		const colors = getChartColors();
		return {
			height: 240,
			series: [
				{},
				{
					label: "캐시 히트율",
					stroke: colors.chart3,
					width: 2,
					fill: `${colors.chart3}20`,
					value: (_u, v) => (v != null ? `${v.toFixed(1)}%` : "-"),
				},
			],
			axes: [
				{
					stroke: colors.foreground,
					grid: { stroke: colors.border, width: 1 },
					ticks: { stroke: colors.border, width: 1 },
				},
				{
					label: "%",
					stroke: colors.foreground,
					grid: { stroke: colors.border, width: 1 },
					ticks: { stroke: colors.border, width: 1 },
					values: (_u, vals) => vals.map((v) => (v != null ? `${(v as number).toFixed(0)}%` : "")),
				},
			],
			scales: {
				x: { time: true },
				y: { range: [0, 100] },
			},
			legend: { show: true },
			cursor: { show: true },
			padding: [8, 8, 8, 8],
		};
	}, []);

	return (
		<ChartContainer
			isLoading={isLoading}
			isError={isError}
			isEmpty={!hasData}
			errorMessage="캐시 데이터를 불러오지 못했습니다."
			emptyMessage="표시할 캐시 데이터가 없습니다."
		>
			<div className={className}>
				<UPlotWrapper data={chartData} options={options} className="w-full" />
			</div>
		</ChartContainer>
	);
}
