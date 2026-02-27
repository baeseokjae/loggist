import { useMemo } from "react";
import uPlot from "uplot";
import { useMetricRangeQuery } from "../../hooks/use-metrics-query";
import { buildAlignedData, getChartColors, withAlpha } from "../../lib/chart-utils";
import { ChartContainer } from "../charts/chart-container";
import { UPlotWrapper } from "../charts/uplot-wrapper";

interface BudgetHistoryProps {
	dailyBudget?: number;
}

function buildOptions(dailyBudget: number | undefined): Partial<uPlot.Options> {
	const colors = getChartColors();

	const series: uPlot.Series[] = [
		{},
		{
			label: "일일 비용 (USD)",
			stroke: colors.chart1,
			fill: (u: uPlot) => {
				const { top, height } = u.bbox;
				if (!Number.isFinite(top) || !Number.isFinite(height)) return withAlpha(colors.chart1, 0.2);
				const ctx = u.ctx;
				const grad = ctx.createLinearGradient(0, top, 0, top + height);
				grad.addColorStop(0, withAlpha(colors.chart1, 0.6));
				grad.addColorStop(1, withAlpha(colors.chart1, 0.07));
				return grad;
			},
			width: 0,
			paths: uPlot.paths.bars?.({ size: [0.6, 100] }),
			value: (_u, v) => (v != null ? `$${v.toFixed(4)}` : "-"),
			points: { show: false },
		},
	];

	const hooks: uPlot.Hooks.Arrays = {};

	if (dailyBudget != null) {
		hooks.draw = [
			(u: uPlot) => {
				const ctx = u.ctx;
				const x0 = u.bbox.left;
				const x1 = u.bbox.left + u.bbox.width;
				const yPos = u.valToPos(dailyBudget, "y", true);

				ctx.save();
				ctx.beginPath();
				ctx.setLineDash([6, 4]);
				ctx.strokeStyle = colors.chart4;
				ctx.lineWidth = 1.5;
				ctx.moveTo(x0, yPos);
				ctx.lineTo(x1, yPos);
				ctx.stroke();

				ctx.setLineDash([]);
				ctx.fillStyle = colors.chart4;
				ctx.font = "11px sans-serif";
				ctx.fillText(`예산 $${dailyBudget.toFixed(2)}`, x0 + 4, yPos - 4);
				ctx.restore();
			},
		];
	}

	return {
		height: 240,
		series,
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
				values: (_u, vals) => vals.map((v) => (v != null ? `$${v.toFixed(2)}` : "")),
			},
		],
		scales: {
			x: { time: true },
		},
		legend: { show: true },
		cursor: { show: true },
		padding: [16, 8, 8, 8],
		hooks,
	};
}

export function BudgetHistory({ dailyBudget }: BudgetHistoryProps) {
	const { start, end } = useMemo(() => {
		const KST_OFFSET_SEC = 9 * 3600;
		const nowSec = Math.floor(Date.now() / 1000);
		// Align start to KST midnight 14 days ago
		const nowKST = nowSec + KST_OFFSET_SEC;
		const todayMidnightKST = Math.floor(nowKST / 86400) * 86400 - KST_OFFSET_SEC;
		return {
			start: String(todayMidnightKST - 14 * 86400),
			end: String(nowSec),
		};
	}, []);

	const { data: result, isLoading, isError } = useMetricRangeQuery("cost", start, end, "86400", "all", "increase");

	const chartData = useMemo(() => buildAlignedData(result ?? []), [result]);
	const options = useMemo(() => buildOptions(dailyBudget), [dailyBudget]);

	return (
		<ChartContainer
			isLoading={isLoading}
			isError={isError}
			isEmpty={!result?.length}
			errorMessage="비용 이력 데이터를 불러오지 못했습니다."
			emptyMessage="표시할 비용 이력이 없습니다."
		>
			<div className="rounded-xl border bg-card p-4">
				<h3 className="mb-3 text-sm font-medium text-muted-foreground">최근 14일 일별 비용</h3>
				<UPlotWrapper data={chartData} options={options} className="w-full" />
			</div>
		</ChartContainer>
	);
}
