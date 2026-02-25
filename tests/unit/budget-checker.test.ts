import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The budget-checker module uses a setInterval. We use fake timers and
// vi.runOnlyPendingTimersAsync() to fire only the pending timers once,
// avoiding an infinite loop.
//
// Because vi.resetModules() causes all dynamic imports to use fresh module
// instances, we always import db/index dynamically within each test so the
// same module instance is shared with the worker.

describe("startBudgetChecker", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.resetModules();
	});

	afterEach(async () => {
		vi.useRealTimers();
		vi.restoreAllMocks();
		// Close DB through the same module instance that was used in the test
		const { closeDB } = await import("@server/db/index");
		closeDB();
	});

	async function setupDB() {
		const { initDB, getDB } = await import("@server/db/index");
		initDB(":memory:");
		return getDB();
	}

	it("returns a cleanup function that clears the interval", async () => {
		await setupDB();
		vi.doMock("@server/services/prometheus", () => ({
			queryPrometheus: vi.fn().mockResolvedValue({ data: { result: [] } }),
		}));

		const { startBudgetChecker } = await import("@server/workers/budget-checker");
		const stop = startBudgetChecker();
		expect(typeof stop).toBe("function");
		stop();
	});

	it("does not create alerts when there are no budgets", async () => {
		const db = await setupDB();
		vi.doMock("@server/services/prometheus", () => ({
			queryPrometheus: vi.fn().mockResolvedValue({ data: { result: [] } }),
		}));

		const { startBudgetChecker } = await import("@server/workers/budget-checker");
		const stop = startBudgetChecker();

		// Run only the immediate check() call, not the recurring interval
		await vi.runOnlyPendingTimersAsync();

		const alerts = db.prepare("SELECT * FROM budget_alerts").all();
		expect(alerts).toHaveLength(0);

		stop();
	});

	it("creates an alert when spend exceeds the threshold", async () => {
		const db = await setupDB();

		// Insert a budget: $100 monthly, 80% threshold
		db.prepare(
			"INSERT INTO budgets (profile, period, amount_usd, alert_threshold_pct, notify_method) VALUES (?, ?, ?, ?, ?)",
		).run("all", "monthly", 100, 80, "dashboard");

		// Prometheus returns $85 – above 80% threshold
		vi.doMock("@server/services/prometheus", () => ({
			queryPrometheus: vi.fn().mockResolvedValue({
				data: { result: [{ value: [0, "85"] }] },
			}),
		}));

		const { startBudgetChecker } = await import("@server/workers/budget-checker");
		const stop = startBudgetChecker();

		// Allow the immediate check() to settle
		await vi.runOnlyPendingTimersAsync();

		const alerts = db.prepare("SELECT * FROM budget_alerts").all();
		expect(alerts.length).toBeGreaterThanOrEqual(1);

		stop();
	});

	it("does not duplicate alerts within 1 day", async () => {
		const db = await setupDB();
		db.prepare(
			"INSERT INTO budgets (profile, period, amount_usd, alert_threshold_pct, notify_method) VALUES (?, ?, ?, ?, ?)",
		).run("all", "monthly", 100, 80, "dashboard");

		vi.doMock("@server/services/prometheus", () => ({
			queryPrometheus: vi.fn().mockResolvedValue({
				data: { result: [{ value: [0, "85"] }] },
			}),
		}));

		const { startBudgetChecker } = await import("@server/workers/budget-checker");
		const stop = startBudgetChecker();

		// Run the initial immediate check
		await vi.runOnlyPendingTimersAsync();

		// Advance 60 seconds to make the interval fire once more
		vi.advanceTimersByTime(60_000);
		await vi.runOnlyPendingTimersAsync();

		// Should still have only 1 alert per threshold (not duplicated)
		const alerts = db.prepare("SELECT * FROM budget_alerts WHERE threshold_pct = 80").all();
		expect(alerts).toHaveLength(1);

		stop();
	});

	it("handles Prometheus errors gracefully without crashing", async () => {
		const db = await setupDB();
		db.prepare(
			"INSERT INTO budgets (profile, period, amount_usd, alert_threshold_pct, notify_method) VALUES (?, ?, ?, ?, ?)",
		).run("all", "daily", 10, 80, "dashboard");

		vi.doMock("@server/services/prometheus", () => ({
			queryPrometheus: vi.fn().mockRejectedValue(new Error("Prometheus down")),
		}));

		const { startBudgetChecker } = await import("@server/workers/budget-checker");
		const stop = startBudgetChecker();

		// Should not throw
		await vi.runOnlyPendingTimersAsync();

		// No alerts created since spend defaults to 0 on error
		const alerts = db.prepare("SELECT * FROM budget_alerts").all();
		expect(alerts).toHaveLength(0);

		stop();
	});
});
