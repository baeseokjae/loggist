import { BudgetAlerts } from "../components/budget/budget-alerts";
import { BudgetGauge } from "../components/budget/budget-gauge";
import { BudgetSettings } from "../components/budget/budget-settings";
import { useBudgets, useCurrentSpend } from "../hooks/use-budget";

export function BudgetPage() {
	const { data: budgets, isLoading } = useBudgets();
	const { data: dailySpend } = useCurrentSpend("all", "24h");
	const { data: monthlySpend } = useCurrentSpend("all", "30d");

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
				{!dailyBudget && !monthlyBudget && (
					<div className="col-span-2 rounded-xl border bg-card p-6 text-center">
						<p className="text-muted-foreground">
							아직 예산이 설정되지 않았습니다. 아래에서 예산을 추가하세요.
						</p>
					</div>
				)}
			</div>

			<div className="grid gap-6 lg:grid-cols-2">
				<BudgetSettings budgets={budgets ?? []} />
				<BudgetAlerts />
			</div>
		</div>
	);
}
