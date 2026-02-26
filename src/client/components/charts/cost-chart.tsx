import { useMemo } from "react";
import type uPlot from "uplot";
import { useMetricRangeQuery } from "../../hooks/use-metrics-query";
import { buildAlignedData, getChartColors } from "../../lib/chart-utils";
import { ChartContainer } from "./chart-container";
import { UPlotWrapper } from "./uplot-wrapper";

interface CostChartProps {
	start: string;
	end: string;
	step?: string;
	className?: string;
}

export function CostChart({ start, end, step = "300", className }: CostChartProps) {
	const { data: result, isLoading, isError } = useMetricRangeQuery("cost", start, end, step);

	const chartData = useMemo(() => buildAlignedData(result ?? []), [result]);

	const options = useMemo((): Partial<uPlot.Options> => {
		const colors = getChartColors();
		return {
			height: 240,
			series: [
				{},
				{
					label: "비용 (USD)",
					stroke: colors.chart1,
					width: 2,
					fill: `${colors.chart1}20`,
					value: (_u, v) => (v != null ? `$${v.toFixed(4)}` : "-"),
				},
			],
			axes: [
				{
					stroke: colors.foreground,
					grid: { stroke: colors.border, width: 1 },
					ticks: { stroke: colors.border, width: 1 },
				},
				{
					label: "USD",
					stroke: colors.foreground,
					grid: { stroke: colors.border, width: 1 },
					ticks: { stroke: colors.border, width: 1 },
					values: (_u, vals) => vals.map((v) => (v != null ? `$${v.toFixed(3)}` : "")),
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
			errorMessage="비용 데이터를 불러오지 못했습니다."
			emptyMessage="표시할 비용 데이터가 없습니다."
		>
			<div className={className}>
				<UPlotWrapper data={chartData} options={options} className="w-full" />
			</div>
		</ChartContainer>
	);
}
