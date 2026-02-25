import { Hono } from "hono";
import { getDB } from "../db/index";

export const budgetRoutes = new Hono();

// GET /api/budget - List all budgets
budgetRoutes.get("/", (c) => {
	const db = getDB();
	const budgets = db.prepare("SELECT * FROM budgets ORDER BY created_at DESC").all();
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

	const db = getDB();
	const result = db
		.prepare(
			`INSERT INTO budgets (profile, period, amount_usd, alert_threshold_pct, notify_method, notify_url)
     VALUES (?, ?, ?, ?, ?, ?)`,
		)
		.run(profile, period, amount_usd, alert_threshold_pct, notify_method, notify_url || null);

	const budget = db.prepare("SELECT * FROM budgets WHERE id = ?").get(result.lastInsertRowid);
	return c.json({ data: budget }, 201);
});

// PUT /api/budget/:id - Update budget
budgetRoutes.put("/:id", async (c) => {
	const id = c.req.param("id");
	const body = await c.req.json();
	const { amount_usd, alert_threshold_pct, notify_method, notify_url } = body;

	const db = getDB();
	const existing = db.prepare("SELECT * FROM budgets WHERE id = ?").get(id);
	if (!existing) {
		return c.json({ error: "Budget not found" }, 404);
	}

	db.prepare(
		`UPDATE budgets SET
       amount_usd = COALESCE(?, amount_usd),
       alert_threshold_pct = COALESCE(?, alert_threshold_pct),
       notify_method = COALESCE(?, notify_method),
       notify_url = COALESCE(?, notify_url),
       updated_at = datetime('now')
     WHERE id = ?`,
	).run(
		amount_usd ?? null,
		alert_threshold_pct ?? null,
		notify_method ?? null,
		notify_url ?? null,
		id,
	);

	const budget = db.prepare("SELECT * FROM budgets WHERE id = ?").get(id);
	return c.json({ data: budget });
});

// DELETE /api/budget/:id - Delete budget
budgetRoutes.delete("/:id", (c) => {
	const id = c.req.param("id");
	const db = getDB();
	const result = db.prepare("DELETE FROM budgets WHERE id = ?").run(id);

	if (result.changes === 0) {
		return c.json({ error: "Budget not found" }, 404);
	}
	return c.json({ success: true });
});

// GET /api/budget/alerts - List recent alerts
budgetRoutes.get("/alerts", (c) => {
	const db = getDB();
	const alerts = db
		.prepare(
			`SELECT ba.*, b.profile, b.period, b.amount_usd
     FROM budget_alerts ba
     JOIN budgets b ON ba.budget_id = b.id
     ORDER BY ba.triggered_at DESC
     LIMIT 50`,
		)
		.all();
	return c.json({ data: alerts });
});
