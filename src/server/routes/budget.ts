import { Hono } from "hono";
import { getQueries } from "../db/queries";
import { queryPrometheus } from "../services/prometheus";
import type { PrometheusResult } from "../../shared/types/prometheus";

export const budgetRoutes = new Hono();

// GET /api/budget - List all budgets
budgetRoutes.get("/", (c) => {
	const q = getQueries();
	const budgets = q.getAllBudgets.all();
	return c.json({ data: budgets });
});

// POST /api/budget - Create budget
budgetRoutes.post("/", async (c) => {
	const body = await c.req.json();
	const {
		profile = "all",
		period,
		amount_usd,
		alert_threshold_pct = 80,
		notify_method = "dashboard",
		notify_url,
	} = body;

	if (!period || !amount_usd) {
		return c.json({ error: "period and amount_usd are required" }, 400);
	}

	if (!["daily", "weekly", "monthly"].includes(period)) {
		return c.json({ error: "period must be daily, weekly, or monthly" }, 400);
	}

	if (typeof amount_usd !== "number" || amount_usd <= 0) {
		return c.json({ error: "amount_usd must be a positive number" }, 400);
	}

	const q = getQueries();
	const result = q.insertBudget.run(
		profile,
		period,
		amount_usd,
		alert_threshold_pct,
		notify_method,
		notify_url || null,
	);

	const budget = q.getBudgetById.get(result.lastInsertRowid);
	return c.json({ data: budget }, 201);
});

// PUT /api/budget/:id - Update budget
budgetRoutes.put("/:id", async (c) => {
	const id = c.req.param("id");
	const body = await c.req.json();
	const { amount_usd, alert_threshold_pct, notify_method, notify_url } = body;

	const q = getQueries();
	const existing = q.getBudgetById.get(id);
	if (!existing) {
		return c.json({ error: "Budget not found" }, 404);
	}

	q.updateBudget.run(
		amount_usd ?? null,
		alert_threshold_pct ?? null,
		notify_method ?? null,
		notify_url ?? null,
		id,
	);

	const budget = q.getBudgetById.get(id);
	return c.json({ data: budget });
});

// DELETE /api/budget/:id - Delete budget
budgetRoutes.delete("/:id", (c) => {
	const id = c.req.param("id");
	const q = getQueries();
	const result = q.deleteBudget.run(id);

	if (result.changes === 0) {
		return c.json({ error: "Budget not found" }, 404);
	}
	return c.json({ success: true });
});

// GET /api/budget/alerts - List recent alerts
budgetRoutes.get("/alerts", (c) => {
	const q = getQueries();
	const alerts = q.getAlertsWithBudgets.all();
	return c.json({ data: alerts });
});

// GET /api/budget/forecast - Forecast month-end cost
budgetRoutes.get("/forecast", async (c) => {
	const profile = c.req.query("profile") || "all";

	try {
		const now = new Date();
		const daysElapsed = now.getDate();
		const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
		const daysRemaining = daysInMonth - daysElapsed;

		const profileFilter = profile === "all" ? 'profile=~".+"' : `profile="${profile}"`;

		const [monthResult, weekResult] = await Promise.all([
			queryPrometheus(
				`sum(increase(claude_code_cost_usage_USD_total{${profileFilter}}[${daysElapsed}d]))`,
			),
			queryPrometheus(
				`sum(increase(claude_code_cost_usage_USD_total{${profileFilter}}[7d])) / 7`,
			),
		]);

		const monthTyped = monthResult as PrometheusResult | undefined;
		const weekTyped = weekResult as PrometheusResult | undefined;

		const currentMonthCost = Number.parseFloat(
			monthTyped?.data?.result?.[0]?.value?.[1] ?? "0",
		);
		const dailyAverage = Number.parseFloat(
			weekTyped?.data?.result?.[0]?.value?.[1] ?? "0",
		);

		const safeMonthCost = Number.isFinite(currentMonthCost) ? currentMonthCost : 0;
		const safeDailyAverage = Number.isFinite(dailyAverage) ? dailyAverage : 0;
		const forecastedMonthTotal = safeMonthCost + safeDailyAverage * daysRemaining;

		return c.json({
			data: {
				currentMonthCost: safeMonthCost,
				dailyAverage: safeDailyAverage,
				daysRemaining,
				forecastedMonthTotal,
			},
		});
	} catch (error) {
		return c.json({ error: String(error) }, 400);
	}
});
