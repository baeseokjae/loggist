import { useMemo } from "react"
import type uPlot from "uplot"
import { useTokenBreakdown } from "../../hooks/use-token-breakdown"
import { getChartColors, withAlpha } from "../../lib/chart-utils"
import { useProfileFilter } from "../../stores/profile-filter"
import { ChartContainer } from "./chart-container"
import { UPlotWrapper } from "./uplot-wrapper"

interface TokenBreakdownChartProps {
	start: string
	end: string
	step?: string
	className?: string
}

function formatTokenValue(v: number | null): string {
	if (v == null) return "-"
	if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`
	if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
	if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`
	return String(Math.round(v))
}

type SeriesResult = Array<{ metric: Record<string, string>; values?: [number, string][] }>

function buildTokenBreakdownData(
	cacheReadResult: SeriesResult,
	cacheCreationResult: SeriesResult,
	tokensResult: SeriesResult,
): uPlot.AlignedData {
	// Collect all unique timestamps across all three series
	const tsSet = new Set<number>()
	for (const series of cacheReadResult) {
		for (const [ts] of series.values ?? []) {
			tsSet.add(ts)
		}
	}
	for (const series of cacheCreationResult) {
		for (const [ts] of series.values ?? []) {
			tsSet.add(ts)
		}
	}
	for (const series of tokensResult) {
		for (const [ts] of series.values ?? []) {
			tsSet.add(ts)
		}
	}

	if (tsSet.size === 0) {
		return [[], [], [], []]
	}

	const timestamps = Array.from(tsSet).sort((a, b) => a - b)
	const tsIndex = new Map(timestamps.map((ts, i) => [ts, i]))

	// Aggregate each metric into a per-timestamp map
	const cacheReadMap = new Map<number, number>()
	for (const series of cacheReadResult) {
		for (const [ts, valStr] of series.values ?? []) {
			const prev = cacheReadMap.get(ts) ?? 0
			cacheReadMap.set(ts, prev + Number.parseFloat(valStr))
		}
	}

	const cacheCreationMap = new Map<number, number>()
	for (const series of cacheCreationResult) {
		for (const [ts, valStr] of series.values ?? []) {
			const prev = cacheCreationMap.get(ts) ?? 0
			cacheCreationMap.set(ts, prev + Number.parseFloat(valStr))
		}
	}

	const tokensMap = new Map<number, number>()
	for (const series of tokensResult) {
		for (const [ts, valStr] of series.values ?? []) {
			const prev = tokensMap.get(ts) ?? 0
			tokensMap.set(ts, prev + Number.parseFloat(valStr))
		}
	}

	// Build aligned arrays
	const cacheReadArr: (number | null)[] = new Array(timestamps.length).fill(null)
	const cacheCreationArr: (number | null)[] = new Array(timestamps.length).fill(null)
	const netTokensArr: (number | null)[] = new Array(timestamps.length).fill(null)

	for (const ts of timestamps) {
		const idx = tsIndex.get(ts)
		if (idx === undefined) continue

		const read = cacheReadMap.get(ts) ?? 0
		const creation = cacheCreationMap.get(ts) ?? 0
		const total = tokensMap.get(ts) ?? 0
		const net = Math.max(0, total - read - creation)

		cacheReadArr[idx] = read > 0 ? read : null
		cacheCreationArr[idx] = creation > 0 ? creation : null
		netTokensArr[idx] = net > 0 ? net : null
	}

	return [timestamps, cacheReadArr, cacheCreationArr, netTokensArr] as uPlot.AlignedData
}

export function TokenBreakdownChart({ start, end, step = "300", className }: TokenBreakdownChartProps) {
	const { profile } = useProfileFilter()
	const { cacheRead, cacheCreation, tokens } = useTokenBreakdown(start, end, step, profile)

	const isLoading = cacheRead.isLoading || cacheCreation.isLoading || tokens.isLoading
	const isError = cacheRead.isError || cacheCreation.isError || tokens.isError

	const chartData = useMemo(
		() => buildTokenBreakdownData(cacheRead.data ?? [], cacheCreation.data ?? [], tokens.data ?? []),
		[cacheRead.data, cacheCreation.data, tokens.data],
	)

	// hasData: any non-null value in the three value series
	const hasData = [1, 2, 3].some((i) =>
		(chartData[i] as (number | null)[])?.some((v) => v != null),
	)

	const options = useMemo((): Partial<uPlot.Options> => {
		const colors = getChartColors()
		return {
			height: 240,
			series: [
				{},
				{
					label: "캐시 읽기",
					stroke: colors.chart1,
					width: 2,
					fill: withAlpha(colors.chart1, 0.35),
					value: (_u, v) => formatTokenValue(v),
					points: { show: false },
				},
				{
					label: "캐시 생성",
					stroke: colors.chart3,
					width: 2,
					fill: withAlpha(colors.chart3, 0.35),
					value: (_u, v) => formatTokenValue(v),
					points: { show: false },
				},
				{
					label: "기타 토큰",
					stroke: colors.chart2,
					width: 2,
					fill: withAlpha(colors.chart2, 0.35),
					value: (_u, v) => formatTokenValue(v),
					points: { show: false },
				},
			],
			axes: [
				{
					stroke: colors.foreground,
					grid: { stroke: colors.border, width: 1 },
					ticks: { stroke: colors.border, width: 1 },
				},
				{
					label: "토큰",
					stroke: colors.foreground,
					grid: { stroke: colors.border, width: 1 },
					ticks: { stroke: colors.border, width: 1 },
					values: (_u, vals) => vals.map((v) => formatTokenValue(v as number | null)),
				},
			],
			scales: {
				x: { time: true, range: [Number(start), Number(end)] },
			},
			legend: { show: true },
			cursor: { show: true },
			padding: [8, 8, 8, 8],
		}
	}, [start, end])

	return (
		<ChartContainer
			isLoading={isLoading}
			isError={isError}
			isEmpty={!hasData}
			errorMessage="토큰 데이터를 불러오지 못했습니다."
			emptyMessage="표시할 토큰 데이터가 없습니다."
		>
			<div className={className}>
				<UPlotWrapper data={chartData} options={options} className="w-full" />
			</div>
		</ChartContainer>
	)
}
