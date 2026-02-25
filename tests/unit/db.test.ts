import { closeDB, getDB, initDB } from "@server/db/index";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("database", () => {
	beforeEach(() => {
		initDB(":memory:");
	});

	afterEach(() => {
		closeDB();
	});

	it("should initialize tables", () => {
		const db = getDB();
		const tables = db
			.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
			.all() as { name: string }[];
		const tableNames = tables.map((t) => t.name);
		expect(tableNames).toContain("budgets");
		expect(tableNames).toContain("budget_alerts");
		expect(tableNames).toContain("settings");
	});

	it("should create and read budgets", () => {
		const db = getDB();
		db.prepare("INSERT INTO budgets (period, amount_usd) VALUES (?, ?)").run("monthly", 100);

		interface BudgetRow {
			period: string;
			amount_usd: number;
			profile: string;
		}
		const budgets = db.prepare("SELECT * FROM budgets").all() as BudgetRow[];
		expect(budgets).toHaveLength(1);
		expect(budgets[0].period).toBe("monthly");
		expect(budgets[0].amount_usd).toBe(100);
		expect(budgets[0].profile).toBe("all");
	});

	it("should enforce period constraint", () => {
		const db = getDB();
		expect(() =>
			db.prepare("INSERT INTO budgets (period, amount_usd) VALUES (?, ?)").run("yearly", 100),
		).toThrow();
	});

	it("should cascade delete alerts", () => {
		const db = getDB();
		const result = db
			.prepare("INSERT INTO budgets (period, amount_usd) VALUES (?, ?)")
			.run("monthly", 100);

		db.prepare(
			"INSERT INTO budget_alerts (budget_id, current_amount_usd, threshold_pct) VALUES (?, ?, ?)",
		).run(result.lastInsertRowid, 85, 80);

		const alertsBefore = db.prepare("SELECT * FROM budget_alerts").all();
		expect(alertsBefore).toHaveLength(1);

		db.prepare("DELETE FROM budgets WHERE id = ?").run(result.lastInsertRowid);

		const alertsAfter = db.prepare("SELECT * FROM budget_alerts").all();
		expect(alertsAfter).toHaveLength(0);
	});
});
