import { metricsRoutes } from "@server/routes/metrics";
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function buildApp() {
	const app = new Hono();
	app.route("/api/metrics", metricsRoutes);
	return app;
}

function makeOkFetch(payload: unknown) {
	return vi.fn().mockResolvedValue({
		ok: true,
		status: 200,
		json: () => Promise.resolve(payload),
	});
}

describe("metrics routes", () => {
	beforeEach(() => {
		vi.resetModules();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("GET /api/metrics/query returns Prometheus result for known preset", async () => {
		const payload = { status: "success", data: { resultType: "vector", result: [] } };
		vi.stubGlobal("fetch", makeOkFetch(payload));

		const app = buildApp();
		const res = await app.request("/api/metrics/query?preset=cost");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toEqual(payload);
	});

	it("GET /api/metrics/query returns 400 for unknown preset", async () => {
		const app = buildApp();
		const res = await app.request("/api/metrics/query?preset=bogus");
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toContain("Unknown preset");
	});

	it("GET /api/metrics/query returns 400 when Prometheus throws", async () => {
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Prometheus down")));

		const app = buildApp();
		const res = await app.request("/api/metrics/query?preset=tokens");
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toContain("Prometheus down");
	});

	it("GET /api/metrics/query supports all known presets", async () => {
		const presets = [
			"cost",
			"cost_by_model",
			"tokens",
			"cache_read",
			"cache_creation",
			"active_time",
			"sessions",
		];
		for (const preset of presets) {
			vi.stubGlobal("fetch", makeOkFetch({ data: { result: [] } }));
			const app = buildApp();
			const res = await app.request(`/api/metrics/query?preset=${preset}&profile=all&range=7d`);
			expect(res.status).toBe(200);
			vi.restoreAllMocks();
		}
	});

	it("GET /api/metrics/query_range returns 400 when start/end are missing", async () => {
		const app = buildApp();
		const res = await app.request("/api/metrics/query_range?preset=cost");
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toContain("start and end are required");
	});

	it("GET /api/metrics/query_range returns result when start and end provided", async () => {
		const payload = { status: "success", data: { resultType: "matrix", result: [] } };
		vi.stubGlobal("fetch", makeOkFetch(payload));

		const app = buildApp();
		const res = await app.request(
			"/api/metrics/query_range?preset=cost&start=1700000000&end=1700003600",
		);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toEqual(payload);
	});

	it("GET /api/metrics/query_range uses cost_by_model grouping", async () => {
		const mockFetch = makeOkFetch({ data: { result: [] } });
		vi.stubGlobal("fetch", mockFetch);

		const app = buildApp();
		await app.request(
			"/api/metrics/query_range?preset=cost_by_model&start=1700000000&end=1700003600",
		);

		const calledUrl: string = mockFetch.mock.calls[0][0];
		// URL-encoded form: "by(model)" or "by+%28model%29" – check for the model keyword
		expect(calledUrl).toContain("model");
	});

	it("GET /api/metrics/query_range returns 400 when Prometheus throws", async () => {
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Prometheus error")));

		const app = buildApp();
		const res = await app.request(
			"/api/metrics/query_range?preset=tokens&start=1700000000&end=1700003600",
		);
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toContain("Prometheus error");
	});

	it("GET /api/metrics/query_range returns 400 for unknown preset", async () => {
		const app = buildApp();
		const res = await app.request(
			"/api/metrics/query_range?preset=nope&start=1700000000&end=1700003600",
		);
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toContain("Unknown preset");
	});
});
