import { closeDB, getDB, initDB } from "@server/db/index";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("Budget API (DB integration)", () => {
	beforeEach(() => {
		initDB(":memory:");
	});

	afterEach(() => {
		closeDB();
	});

	it("should create a budget", () => {
		const db = getDB();
		const result = db
			.prepare(
				"INSERT INTO budgets (profile, period, amount_usd, alert_threshold_pct) VALUES (?, ?, ?, ?)",
			)
			.run("all", "monthly", 100, 80);

		expect(result.lastInsertRowid).toBeGreaterThan(0);

		const budget = db
			.prepare("SELECT * FROM budgets WHERE id = ?")
			.get(result.lastInsertRowid) as Record<string, unknown>;
		expect(budget.profile).toBe("all");
		expect(budget.period).toBe("monthly");
		expect(budget.amount_usd).toBe(100);
	});

	it("should list budgets", () => {
		const db = getDB();
		db.prepare("INSERT INTO budgets (period, amount_usd) VALUES (?, ?)").run("daily", 10);
		db.prepare("INSERT INTO budgets (period, amount_usd) VALUES (?, ?)").run("monthly", 100);

		const budgets = db.prepare("SELECT * FROM budgets ORDER BY created_at DESC").all();
		expect(budgets).toHaveLength(2);
	});

	it("should update a budget", () => {
		const db = getDB();
		const result = db
			.prepare("INSERT INTO budgets (period, amount_usd) VALUES (?, ?)")
			.run("monthly", 100);

		db.prepare("UPDATE budgets SET amount_usd = ?, updated_at = datetime('now') WHERE id = ?").run(
			200,
			result.lastInsertRowid,
		);

		const budget = db
			.prepare("SELECT * FROM budgets WHERE id = ?")
			.get(result.lastInsertRowid) as Record<string, unknown>;
		expect(budget.amount_usd).toBe(200);
	});

	it("should delete a budget", () => {
		const db = getDB();
		const result = db
			.prepare("INSERT INTO budgets (period, amount_usd) VALUES (?, ?)")
			.run("monthly", 100);

		db.prepare("DELETE FROM budgets WHERE id = ?").run(result.lastInsertRowid);

		const budget = db.prepare("SELECT * FROM budgets WHERE id = ?").get(result.lastInsertRowid);
		expect(budget).toBeUndefined();
	});

	it("should create and list alerts", () => {
		const db = getDB();
		const budgetResult = db
			.prepare("INSERT INTO budgets (period, amount_usd) VALUES (?, ?)")
			.run("monthly", 100);

		db.prepare(
			"INSERT INTO budget_alerts (budget_id, current_amount_usd, threshold_pct) VALUES (?, ?, ?)",
		).run(budgetResult.lastInsertRowid, 85, 80);

		const alerts = db
			.prepare(
				`SELECT ba.*, b.profile, b.period, b.amount_usd
         FROM budget_alerts ba
         JOIN budgets b ON ba.budget_id = b.id`,
			)
			.all() as Record<string, unknown>[];

		expect(alerts).toHaveLength(1);
		expect(alerts[0].current_amount_usd).toBe(85);
		expect(alerts[0].amount_usd).toBe(100);
	});
});
