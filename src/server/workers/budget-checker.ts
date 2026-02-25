import { getDB } from "../db/index";
import { queryPrometheus } from "../services/prometheus";

const BUDGET_CHECK_INTERVAL = 60_000;

interface Budget {
	id: number;
	profile: string;
	period: string;
	amount_usd: number;
	alert_threshold_pct: number;
	notify_method: string;
	notify_url: string | null;
}

export function startBudgetChecker() {
	async function check() {
		try {
			const db = getDB();
			const budgets = db.prepare("SELECT * FROM budgets").all() as Budget[];

			for (const budget of budgets) {
				try {
					const currentSpend = await getCurrentSpend(budget.profile, budget.period);
					const pct = (currentSpend / budget.amount_usd) * 100;

					const thresholds = [budget.alert_threshold_pct, 100];
					for (const threshold of thresholds) {
						if (pct >= threshold) {
							const existing = db
								.prepare(
									`SELECT 1 FROM budget_alerts
                   WHERE budget_id = ? AND threshold_pct = ?
                   AND triggered_at > datetime('now', '-1 day')`,
								)
								.get(budget.id, threshold);

							if (!existing) {
								db.prepare(
									`INSERT INTO budget_alerts (budget_id, current_amount_usd, threshold_pct)
                   VALUES (?, ?, ?)`,
								).run(budget.id, currentSpend, threshold);

								console.log(
									`[Budget Alert] ${budget.period} budget: $${currentSpend.toFixed(2)} / $${budget.amount_usd} (${pct.toFixed(1)}%) - threshold ${threshold}%`,
								);
							}
						}
					}
				} catch (error) {
					console.error(`[Budget Checker] Error checking budget ${budget.id}:`, error);
				}
			}
		} catch (error) {
			console.error("[Budget Checker] Error:", error);
		}
	}

	const interval = setInterval(check, BUDGET_CHECK_INTERVAL);
	check();

	return () => clearInterval(interval);
}

async function getCurrentSpend(profile: string, period: string): Promise<number> {
	const rangeMap: Record<string, string> = { daily: "24h", weekly: "7d", monthly: "30d" };
	const range = rangeMap[period] || "30d";

	const profileFilter = profile === "all" ? "" : `{profile="${profile}"}`;
	const query = `sum(increase(claude_code_cost_usage_USD_total${profileFilter}[${range}]))`;

	try {
		const result = await queryPrometheus(query);
		const typedResult = result as { data?: { result?: Array<{ value?: [number, string] }> } };
		return Number.parseFloat(typedResult?.data?.result?.[0]?.value?.[1] ?? "0");
	} catch {
		return 0;
	}
}
