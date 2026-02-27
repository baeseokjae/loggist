import { useMemo } from "react";
import uPlot from "uplot";
import { tooltipPlugin } from "../../lib/chart-tooltip-plugin";
import { useMetricRangeQuery } from "../../hooks/use-metrics-query";
import { buildCumulativeModelData, getModelColor, withAlpha } from "../../lib/chart-utils";
import { useProfileFilter } from "../../stores/profile-filter";
import { ChartContainer } from "./chart-container";
import { UPlotWrapper } from "./uplot-wrapper";

interface CostChartProps {
	start: string;
	end: string;
	step?: string;
	className?: string;
}

function fmtUSD(v: number | null): string {
	if (v == null) return "-";
	if (v >= 1) return `$${v.toFixed(2)}`;
	if (v >= 0.01) return `$${v.toFixed(3)}`;
	return `$${v.toFixed(4)}`;
}

export function CostChart({ start, end, step = "300", className }: CostChartProps) {
	const { profile } = useProfileFilter();
	const {
		data: result,
		isLoading,
		isError,
	} = useMetricRangeQuery("cost_by_model", start, end, step, profile, "increase");

	const { data: chartData, models } = useMemo(() => buildCumulativeModelData(result ?? []), [result]);

	const hasData = models.length > 0 && chartData.length > 1 && (chartData[0] as number[]).length > 0;

	const options = useMemo((): Partial<uPlot.Options> => {
		// Stepped path builder for staircase lines (like Grafana)
		const stepped = (uPlot as unknown as { paths: { stepped: (opts: { align: number }) => uPlot.Series.PathBuilder } }).paths.stepped({ align: 1 });

		const series: uPlot.Series[] = [
			{}, // x-axis (timestamps)
			...models.map((model, i) => {
				const color = getModelColor(model, i);
				return {
					label: model,
					stroke: color,
					width: 2,
					fill: withAlpha(color, 0.05),
					paths: stepped,
					points: { show: false },
					value: (_u: uPlot, v: number | null) => fmtUSD(v),
				} satisfies uPlot.Series;
			}),
		];

		return {
			height: 280,
			series,
			axes: [
				{
					stroke: "#9ca3af",
					grid: { stroke: "rgba(255,255,255,0.07)", width: 1 },
					ticks: { show: false },
					gap: 8,
				},
				{
					label: "USD",
					stroke: "#9ca3af",
					size: 52,
					grid: { stroke: "rgba(255,255,255,0.07)", width: 1 },
					ticks: { show: false },
					gap: 8,
					values: (_u, vals) => vals.map((v) => (v != null ? `$${Number(v).toFixed(v >= 1 ? 0 : 2)}` : "")),
				},
			],
			scales: {
				x: { time: true, range: [Number(start), Number(end)] },
				y: {
					auto: true,
					range: (_u, min, max) => {
						const pad = (max - min) * 0.05 || 0.5;
						return [Math.max(0, min - pad), max + pad];
					},
				},
			},
			legend: { show: false },
			plugins: [tooltipPlugin((v) => fmtUSD(v ?? null))],
			cursor: {
				show: true,
				x: true,
				y: false,
				points: {
					show: true,
					size: 6,
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					fill: ((_u: uPlot, i: number) => (series[i]?.stroke as string) ?? "#fff") as any,
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					stroke: ((_u: uPlot, i: number) => (series[i]?.stroke as string) ?? "#fff") as any,
					width: 0,
				},
			},
			padding: [12, 12, 0, 0],
		};
	}, [models, start, end]);

	return (
		<ChartContainer
			isLoading={isLoading}
			isError={isError}
			isEmpty={!hasData}
			errorMessage="비용 데이터를 불러오지 못했습니다."
			emptyMessage="표시할 비용 데이터가 없습니다."
		>
			<div className={className}>
				<UPlotWrapper data={chartData} options={options} className="w-full" />
			</div>
		</ChartContainer>
	);
}
