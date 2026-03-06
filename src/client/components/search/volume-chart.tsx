import { useMemo } from "react";
import uPlot from "uplot";
import { tooltipPlugin } from "../../lib/chart-tooltip-plugin";
import { buildAlignedData } from "../../lib/chart-utils";
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
	const chartData = useMemo(() => buildAlignedData(data ?? []), [data]);

	const hasData = data.length > 0 && chartData.length > 1 && (chartData[0] as number[]).length > 0;

	const options = useMemo((): Partial<uPlot.Options> => {
		const series: uPlot.Series[] = [
			{}, // x-axis
			...data.map((s) => {
				const eventName = s.metric?.event_name ?? "unknown";
				const color = EVENT_TYPE_CONFIG[eventName]?.chartColor ?? "#888";
				return {
					label: EVENT_TYPE_CONFIG[eventName]?.label ?? eventName,
					stroke: color,
					fill: color + "80",
					width: 0,
					paths: (u: uPlot, seriesIdx: number, idx0: number, idx1: number) => {
						return uPlot.paths.bars!({ size: [0.8, 64] })(u, seriesIdx, idx0, idx1);
					},
					points: { show: false },
					value: (_u: uPlot, v: number | null) => (v != null ? String(Math.round(v)) : "-"),
				} satisfies uPlot.Series;
			}),
		];

		return {
			height: 200,
			series,
			axes: [
				{
					stroke: "#9ca3af",
					grid: { stroke: "rgba(255,255,255,0.07)", width: 1 },
					ticks: { show: false },
					gap: 8,
				},
				{
					stroke: "#9ca3af",
					size: 44,
					grid: { stroke: "rgba(255,255,255,0.07)", width: 1 },
					ticks: { show: false },
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
			legend: { show: false },
			plugins: [tooltipPlugin((v) => (v != null ? String(Math.round(v)) : "-"))],
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
