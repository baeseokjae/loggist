import { closeDB, initDB } from "@server/db/index";
import { budgetRoutes } from "@server/routes/budget";
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

function buildApp() {
	const app = new Hono();
	app.route("/api/budget", budgetRoutes);
	return app;
}

describe("budget routes", () => {
	beforeEach(() => {
		initDB(":memory:");
	});

	afterEach(() => {
		closeDB();
	});

	it("GET /api/budget returns empty list initially", async () => {
		const app = buildApp();
		const res = await app.request("/api/budget");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.data).toEqual([]);
	});

	it("POST /api/budget creates a new budget", async () => {
		const app = buildApp();
		const res = await app.request("/api/budget", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				profile: "work",
				period: "monthly",
				amount_usd: 50,
				alert_threshold_pct: 80,
				notify_method: "dashboard",
			}),
		});

		expect(res.status).toBe(201);
		const body = await res.json();
		expect(body.data.profile).toBe("work");
		expect(body.data.period).toBe("monthly");
		expect(body.data.amount_usd).toBe(50);
		expect(body.data.id).toBeGreaterThan(0);
	});

	it("POST /api/budget returns 400 when period is missing", async () => {
		const app = buildApp();
		const res = await app.request("/api/budget", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ amount_usd: 50 }),
		});

		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toContain("period");
	});

	it("POST /api/budget returns 400 when amount_usd is missing", async () => {
		const app = buildApp();
		const res = await app.request("/api/budget", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ period: "daily" }),
		});

		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toContain("amount_usd");
	});

	it("POST /api/budget returns 400 for invalid period value", async () => {
		const app = buildApp();
		const res = await app.request("/api/budget", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ period: "yearly", amount_usd: 100 }),
		});

		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toContain("period must be");
	});

	it("POST /api/budget returns 400 for non-positive amount_usd", async () => {
		const app = buildApp();
		const res = await app.request("/api/budget", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ period: "daily", amount_usd: -10 }),
		});

		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toContain("amount_usd");
	});

	it("GET /api/budget returns the created budgets", async () => {
		const app = buildApp();

		await app.request("/api/budget", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ period: "daily", amount_usd: 10 }),
		});

		await app.request("/api/budget", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ period: "monthly", amount_usd: 100 }),
		});

		const res = await app.request("/api/budget");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.data).toHaveLength(2);
	});

	it("PUT /api/budget/:id updates a budget", async () => {
		const app = buildApp();

		const createRes = await app.request("/api/budget", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ period: "monthly", amount_usd: 50 }),
		});
		const created = await createRes.json();
		const id: number = created.data.id;

		const updateRes = await app.request(`/api/budget/${id}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ amount_usd: 200, alert_threshold_pct: 90 }),
		});

		expect(updateRes.status).toBe(200);
		const updated = await updateRes.json();
		expect(updated.data.amount_usd).toBe(200);
		expect(updated.data.alert_threshold_pct).toBe(90);
	});

	it("PUT /api/budget/:id returns 404 for non-existent id", async () => {
		const app = buildApp();
		const res = await app.request("/api/budget/9999", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ amount_usd: 100 }),
		});

		expect(res.status).toBe(404);
		const body = await res.json();
		expect(body.error).toContain("not found");
	});

	it("DELETE /api/budget/:id deletes a budget", async () => {
		const app = buildApp();

		const createRes = await app.request("/api/budget", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ period: "weekly", amount_usd: 25 }),
		});
		const created = await createRes.json();
		const id: number = created.data.id;

		const deleteRes = await app.request(`/api/budget/${id}`, { method: "DELETE" });
		expect(deleteRes.status).toBe(200);
		const body = await deleteRes.json();
		expect(body.success).toBe(true);

		// Confirm it's gone
		const listRes = await app.request("/api/budget");
		const list = await listRes.json();
		expect(list.data).toHaveLength(0);
	});

	it("DELETE /api/budget/:id returns 404 for non-existent id", async () => {
		const app = buildApp();
		const res = await app.request("/api/budget/9999", { method: "DELETE" });

		expect(res.status).toBe(404);
		const body = await res.json();
		expect(body.error).toContain("not found");
	});

	it("GET /api/budget/alerts returns empty list when no alerts exist", async () => {
		const app = buildApp();
		// Mount the alerts route before the parameterized route
		const alertApp = new Hono();
		alertApp.get("/api/budget/alerts", budgetRoutes.fetch.bind(budgetRoutes));

		const res = await app.request("/api/budget/alerts");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.data).toEqual([]);
	});

	it("GET /api/budget/alerts returns alerts joined with budget info", async () => {
		const { getDB } = await import("@server/db/index");
		const app = buildApp();

		// Create a budget first
		const createRes = await app.request("/api/budget", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ period: "monthly", amount_usd: 100 }),
		});
		const created = await createRes.json();
		const budgetId: number = created.data.id;

		// Insert an alert directly via DB
		const db = getDB();
		db.prepare(
			"INSERT INTO budget_alerts (budget_id, current_amount_usd, threshold_pct) VALUES (?, ?, ?)",
		).run(budgetId, 85, 80);

		const res = await app.request("/api/budget/alerts");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.data).toHaveLength(1);
		expect(body.data[0].current_amount_usd).toBe(85);
		expect(body.data[0].amount_usd).toBe(100);
	});
});
