import { formatPercent, formatUSD } from "../../lib/format";
import { cn } from "../../lib/utils";

interface BudgetGaugeProps {
	current: number;
	budget: number;
	period: string;
	className?: string;
}

export function BudgetGauge({ current, budget, period, className }: BudgetGaugeProps) {
	const pct = budget > 0 ? (current / budget) * 100 : 0;
	const clampedPct = Math.min(pct, 100);
	const isWarning = pct >= 80;
	const isDanger = pct >= 100;

	const periodLabel = { daily: "일일", weekly: "주간", monthly: "월간" }[period] || period;

	return (
		<div className={cn("rounded-xl border bg-card p-6", className)}>
			<div className="mb-4 flex items-center justify-between">
				<h3 className="text-sm font-medium text-muted-foreground">{periodLabel} 예산</h3>
				<span
					className={cn(
						"rounded-full px-2 py-0.5 text-xs font-medium",
						isDanger
							? "bg-destructive/10 text-destructive"
							: isWarning
								? "bg-chart-4/10 text-chart-4"
								: "bg-chart-2/10 text-chart-2",
					)}
				>
					{formatPercent(pct)}
				</span>
			</div>

			<div className="mb-2 flex items-end gap-1">
				<span className="text-3xl font-bold">{formatUSD(current)}</span>
				<span className="mb-1 text-sm text-muted-foreground">/ {formatUSD(budget)}</span>
			</div>

			<div className="h-3 overflow-hidden rounded-full bg-muted">
				<div
					className={cn(
						"h-full rounded-full transition-all duration-500",
						isDanger ? "bg-destructive" : isWarning ? "bg-chart-4" : "bg-chart-2",
					)}
					style={{ width: `${clampedPct}%` }}
				/>
			</div>
		</div>
	);
}
