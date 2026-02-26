import { useMemo } from "react";
import type uPlot from "uplot";
import { useMetricRangeQuery } from "../../hooks/use-metrics-query";
import { buildAlignedData, getChartColors, withAlpha } from "../../lib/chart-utils";
import { ChartContainer } from "./chart-container";
import { UPlotWrapper } from "./uplot-wrapper";

interface TokenChartProps {
	start: string;
	end: string;
	step?: string;
	className?: string;
}

function formatTokenValue(v: number | null): string {
	if (v == null) return "-";
	if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
	if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
	return String(Math.round(v));
}

export function TokenChart({ start, end, step = "300", className }: TokenChartProps) {
	const { data: result, isLoading, isError } = useMetricRangeQuery("tokens", start, end, step);

	const chartData = useMemo(() => buildAlignedData(result ?? []), [result]);

	const options = useMemo((): Partial<uPlot.Options> => {
		const colors = getChartColors();
		return {
			height: 240,
			series: [
				{},
				{
					label: "토큰 수",
					stroke: colors.chart2,
					width: 2,
					fill: withAlpha(colors.chart2, 0.12),
					value: (_u, v) => formatTokenValue(v),
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
				x: { time: true },
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
			isEmpty={!result?.length}
			errorMessage="토큰 데이터를 불러오지 못했습니다."
			emptyMessage="표시할 토큰 데이터가 없습니다."
		>
			<div className={className}>
				<UPlotWrapper data={chartData} options={options} className="w-full" />
			</div>
		</ChartContainer>
	);
}
