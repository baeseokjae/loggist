import { useBudgetAlerts } from "../../hooks/use-budget";
import { formatUSD } from "../../lib/format";
import { cn } from "../../lib/utils";

export function BudgetAlerts() {
	const { data: alerts, isLoading } = useBudgetAlerts();

	if (isLoading) {
		return (
			<div className="rounded-xl border bg-card p-6">
				<h3 className="mb-4 text-lg font-semibold">최근 알림</h3>
				<p className="text-sm text-muted-foreground">불러오는 중...</p>
			</div>
		);
	}

	return (
		<div className="rounded-xl border bg-card p-6">
			<h3 className="mb-4 text-lg font-semibold">최근 알림</h3>
			{!alerts || alerts.length === 0 ? (
				<p className="text-sm text-muted-foreground">최근 알림이 없습니다.</p>
			) : (
				<div className="space-y-2">
					{alerts.slice(0, 10).map((alert) => {
						const periodLabel =
							{ daily: "일일", weekly: "주간", monthly: "월간" }[alert.period] || alert.period;
						return (
							<div
								key={alert.id}
								className={cn(
									"flex items-center justify-between rounded-lg border px-4 py-2 text-sm",
									alert.threshold_pct >= 100
										? "border-destructive/30 bg-destructive/5"
										: "border-chart-4/30 bg-chart-4/5",
								)}
							>
								<div>
									<span className="font-medium">
										{periodLabel} 예산 {alert.threshold_pct}% 도달
									</span>
									<span className="ml-2 text-muted-foreground">
										{formatUSD(alert.current_amount_usd)} / {formatUSD(alert.amount_usd)}
									</span>
								</div>
								<span className="text-xs text-muted-foreground">
									{new Date(alert.triggered_at).toLocaleString("ko-KR")}
								</span>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
