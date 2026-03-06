import { BudgetGauge } from "../components/budget/budget-gauge";
import { BudgetHistory } from "../components/budget/budget-history";
import { Header } from "../components/layout/header";
import { useBudgetForecast, useBudgets, useCurrentSpend } from "../hooks/use-budget";
import { formatUSD } from "../lib/format";
import { useProfileFilter } from "../stores/profile-filter";

export function BudgetPage() {
	const { profile } = useProfileFilter();
	const { data: budgets, isLoading } = useBudgets(profile);
	const { data: dailySpend } = useCurrentSpend(profile, "24h");
	const { data: forecast, isLoading: forecastLoading } = useBudgetForecast(profile);

	if (isLoading) {
		return (
			<div className="space-y-6">
				<h1 className="text-2xl font-bold">비용 예산</h1>
				<p className="text-muted-foreground">불러오는 중...</p>
			</div>
		);
	}

	const filteredBudgets = budgets?.filter(
		(b) => profile === "all" || b.profile === profile || b.profile === "all",
	);
	const dailyBudget = filteredBudgets?.find((b) => b.period === "daily");
	const monthlyBudget = filteredBudgets?.find((b) => b.period === "monthly");

	return (
		<div className="space-y-6">
			<Header title="비용 예산" refreshKeys={[["budgets"], ["current-spend"], ["budget-forecast"], ["budget-alerts"]]} />

			<div className="grid gap-4 md:grid-cols-2">
				<div className="rounded-xl border bg-card p-6">
					<h3 className="text-sm font-medium text-muted-foreground">이번 달 예측 비용</h3>
					{forecastLoading ? (
						<div className="mt-2 h-8 w-24 animate-pulse rounded bg-muted" />
					) : (
						<p className="mt-1 text-2xl font-bold">
							{forecast ? formatUSD(forecast.forecastedMonthTotal) : "-"}
						</p>
					)}
					<p className="mt-0.5 text-xs text-muted-foreground">최근 7일 사용 패턴 기준 추정</p>
				</div>
				{monthlyBudget ? (
					<BudgetGauge
						current={forecast?.currentMonthCost ?? 0}
						budget={monthlyBudget.amount_usd}
						period="monthly"
					/>
				) : (
					<div className="rounded-xl border bg-card p-6">
						<h3 className="text-sm font-medium text-muted-foreground">이번 달 사용</h3>
						{forecastLoading ? (
							<div className="mt-2 h-8 w-24 animate-pulse rounded bg-muted" />
						) : (
							<p className="mt-1 text-2xl font-bold">
								{forecast ? formatUSD(forecast.currentMonthCost) : "-"}
							</p>
						)}
						<p className="mt-0.5 text-xs text-muted-foreground">
							일평균 {forecast ? formatUSD(forecast.dailyAverage) : "-"}
						</p>
					</div>
				)}
			</div>

			{dailyBudget && (
				<BudgetGauge current={dailySpend ?? 0} budget={dailyBudget.amount_usd} period="daily" />
			)}

			<BudgetHistory dailyBudget={dailyBudget?.amount_usd} profile={profile} />
		</div>
	);
}
