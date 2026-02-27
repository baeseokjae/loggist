import { BudgetGauge } from "../components/budget/budget-gauge";
import { BudgetHistory } from "../components/budget/budget-history";
import { useBudgetForecast, useBudgets, useCurrentSpend } from "../hooks/use-budget";
import { formatUSD } from "../lib/format";

export function BudgetPage() {
	const { data: budgets, isLoading } = useBudgets();
	const { data: dailySpend } = useCurrentSpend("all", "24h");
	const { data: monthlySpend } = useCurrentSpend("all", "30d");
	const { data: forecast, isLoading: forecastLoading } = useBudgetForecast("all");

	if (isLoading) {
		return (
			<div className="space-y-6">
				<h1 className="text-2xl font-bold">비용 예산</h1>
				<p className="text-muted-foreground">불러오는 중...</p>
			</div>
		);
	}

	const dailyBudget = budgets?.find((b) => b.period === "daily");
	const monthlyBudget = budgets?.find((b) => b.period === "monthly");

	return (
		<div className="space-y-6">
			<h1 className="text-2xl font-bold">비용 예산</h1>

			<div className="grid gap-4 md:grid-cols-2">
				<div className="rounded-xl border bg-card p-6">
					<h3 className="text-sm font-medium text-muted-foreground">월말 예상 비용</h3>
					{forecastLoading ? (
						<div className="mt-2 h-8 w-24 animate-pulse rounded bg-muted" />
					) : (
						<p className="mt-1 text-2xl font-bold">
							{forecast ? formatUSD(forecast.forecastedMonthTotal) : "-"}
						</p>
					)}
					<p className="mt-0.5 text-xs text-muted-foreground">7일 평균 기준</p>
				</div>
				<div className="rounded-xl border bg-card p-6">
					<h3 className="text-sm font-medium text-muted-foreground">월간 예산</h3>
					<p className="mt-1 text-2xl font-bold">
						{monthlyBudget ? formatUSD(monthlyBudget.amount_usd) : "미설정"}
					</p>
					{monthlyBudget && monthlySpend != null && (
						<p className="mt-0.5 text-xs text-muted-foreground">
							현재 {formatUSD(monthlySpend)} 사용
						</p>
					)}
				</div>
			</div>

			<div className="grid gap-4 md:grid-cols-2">
				{dailyBudget && (
					<BudgetGauge current={dailySpend ?? 0} budget={dailyBudget.amount_usd} period="daily" />
				)}
				{monthlyBudget && (
					<BudgetGauge
						current={monthlySpend ?? 0}
						budget={monthlyBudget.amount_usd}
						period="monthly"
					/>
				)}
			</div>

			<BudgetHistory dailyBudget={dailyBudget?.amount_usd} />
		</div>
	);
}
