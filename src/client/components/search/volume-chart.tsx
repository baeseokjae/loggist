import { useMemo } from "react";
import uPlot from "uplot";
import { tooltipPlugin } from "../../lib/chart-tooltip-plugin";
import { buildAlignedData, buildStackedData, getChartColors } from "../../lib/chart-utils";
import { EVENT_TYPE_CONFIG } from "../../lib/constants";
import { ChartContainer } from "../charts/chart-container";
import { UPlotWrapper } from "../charts/uplot-wrapper";

interface VolumeChartProps {
	data: Array<{
		metric: { event_name: string };
		values: [number, string][];
	}>;
	isLoading: boolean;
	isError: boolean;
	start: string;
	end: string;
}

export function VolumeChart({ data, isLoading, isError, start, end }: VolumeChartProps) {
	const alignedData = useMemo(() => buildAlignedData(data ?? []), [data]);
	const { stackedData: chartData, bands } = useMemo(() => buildStackedData(alignedData), [alignedData]);

	const hasData = data.length > 0 && chartData.length > 1 && (chartData[0] as number[]).length > 0;

	const options = useMemo((): Partial<uPlot.Options> => {
		const colors = getChartColors();
		const series: uPlot.Series[] = [
			{}, // x-axis
			...data.map((s) => {
				const eventName = s.metric?.event_name ?? "unknown";
				const color = EVENT_TYPE_CONFIG[eventName]?.chartColor ?? "#888";
				return {
					label: EVENT_TYPE_CONFIG[eventName]?.label ?? eventName,
					stroke: color,
					fill: color + "CC",
					width: 1,
					paths: (u: uPlot, seriesIdx: number, idx0: number, idx1: number) => {
						return uPlot.paths.bars!({ size: [0.8, 64] })(u, seriesIdx, idx0, idx1);
					},
					points: { show: false },
					value: (_u: uPlot, v: number | null) => (v != null ? String(Math.round(v)) : "-"),
				} satisfies uPlot.Series;
			}),
		];

		return {
			height: 280,
			series,
			bands,
			axes: [
				{
					stroke: colors.foreground,
					grid: { stroke: colors.border, width: 1 },
					ticks: { stroke: colors.border, width: 1 },
					gap: 8,
				},
				{
					stroke: colors.foreground,
					size: 44,
					grid: { stroke: colors.border, width: 1 },
					ticks: { stroke: colors.border, width: 1 },
					gap: 8,
					values: (_u, vals) => vals.map((v) => (v != null ? String(Math.round(Number(v))) : "")),
				},
			],
			scales: {
				x: { time: true, range: [Number(start), Number(end)] },
				y: {
					auto: true,
					range: (_u, min, max) => {
						const pad = (max - min) * 0.1 || 1;
						return [0, max + pad];
					},
				},
			},
			legend: { show: true },
			plugins: [tooltipPlugin((v) => (v != null ? String(Math.round(v)) : "-"), alignedData)],
			cursor: {
				show: true,
				x: true,
				y: false,
				points: { show: false },
			},
			padding: [12, 12, 0, 0],
		};
	}, [data, start, end]);

	return (
		<ChartContainer
			isLoading={isLoading}
			isError={isError}
			isEmpty={!hasData}
			errorMessage="볼륨 데이터를 불러오지 못했습니다."
			emptyMessage="표시할 볼륨 데이터가 없습니다."
		>
			<UPlotWrapper data={chartData} options={options} className="w-full" />
		</ChartContainer>
	);
}
