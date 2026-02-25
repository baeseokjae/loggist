import { type FormEvent, useState } from "react";
import { useCreateBudget, useDeleteBudget } from "../../hooks/use-budget";
import { formatUSD } from "../../lib/format";
import { cn } from "../../lib/utils";

interface Budget {
	id: number;
	profile: string;
	period: string;
	amount_usd: number;
	alert_threshold_pct: number;
}

interface BudgetSettingsProps {
	budgets: Budget[];
}

export function BudgetSettings({ budgets }: BudgetSettingsProps) {
	const [showForm, setShowForm] = useState(false);

	return (
		<div className="rounded-xl border bg-card p-6">
			<div className="mb-4 flex items-center justify-between">
				<h3 className="text-lg font-semibold">예산 설정</h3>
				<button
					type="button"
					onClick={() => setShowForm(!showForm)}
					className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
				>
					{showForm ? "취소" : "추가"}
				</button>
			</div>

			{showForm && <BudgetForm onSuccess={() => setShowForm(false)} />}

			<div className="space-y-3">
				{budgets.length === 0 && (
					<p className="text-sm text-muted-foreground">설정된 예산이 없습니다.</p>
				)}
				{budgets.map((budget) => (
					<BudgetItem key={budget.id} budget={budget} />
				))}
			</div>
		</div>
	);
}

function BudgetForm({ onSuccess }: { onSuccess: () => void }) {
	const [period, setPeriod] = useState("monthly");
	const [amount, setAmount] = useState("");
	const [threshold, setThreshold] = useState("80");
	const createBudget = useCreateBudget();

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault();
		await createBudget.mutateAsync({
			period,
			amount_usd: Number(amount),
			alert_threshold_pct: Number(threshold),
		});
		onSuccess();
	};

	return (
		<form onSubmit={handleSubmit} className="mb-4 space-y-3 rounded-lg border bg-muted/50 p-4">
			<div className="grid grid-cols-3 gap-3">
				<div>
					<label htmlFor="period" className="mb-1 block text-xs font-medium">
						기간
					</label>
					<select
						id="period"
						value={period}
						onChange={(e) => setPeriod(e.target.value)}
						className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
					>
						<option value="daily">일일</option>
						<option value="weekly">주간</option>
						<option value="monthly">월간</option>
					</select>
				</div>
				<div>
					<label htmlFor="amount" className="mb-1 block text-xs font-medium">
						예산 ($)
					</label>
					<input
						id="amount"
						type="number"
						step="0.01"
						min="0.01"
						value={amount}
						onChange={(e) => setAmount(e.target.value)}
						className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
						placeholder="100.00"
						required
					/>
				</div>
				<div>
					<label htmlFor="threshold" className="mb-1 block text-xs font-medium">
						알림 임계값 (%)
					</label>
					<input
						id="threshold"
						type="number"
						min="1"
						max="100"
						value={threshold}
						onChange={(e) => setThreshold(e.target.value)}
						className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
						required
					/>
				</div>
			</div>
			<button
				type="submit"
				disabled={createBudget.isPending}
				className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
			>
				{createBudget.isPending ? "저장 중..." : "예산 추가"}
			</button>
		</form>
	);
}

function BudgetItem({ budget }: { budget: Budget }) {
	const deleteBudget = useDeleteBudget();
	const periodLabel =
		{ daily: "일일", weekly: "주간", monthly: "월간" }[budget.period] || budget.period;

	return (
		<div className="flex items-center justify-between rounded-lg border px-4 py-3">
			<div>
				<span className="font-medium">{periodLabel}</span>
				<span className="ml-2 text-muted-foreground">{formatUSD(budget.amount_usd)}</span>
				<span className="ml-2 text-xs text-muted-foreground">
					(알림: {budget.alert_threshold_pct}%)
				</span>
			</div>
			<button
				type="button"
				onClick={() => deleteBudget.mutate(budget.id)}
				className={cn(
					"text-sm text-muted-foreground hover:text-destructive",
					deleteBudget.isPending && "opacity-50",
				)}
				disabled={deleteBudget.isPending}
			>
				삭제
			</button>
		</div>
	);
}
