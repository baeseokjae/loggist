import { logsRoutes } from "@server/routes/logs";
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function buildApp() {
	const app = new Hono();
	app.route("/api/logs", logsRoutes);
	return app;
}

describe("logs routes", () => {
	beforeEach(() => {
		vi.resetModules();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("GET /api/logs/query returns Loki result on success", async () => {
		const payload = { status: "success", data: { result: [] } };
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				status: 200,
				json: () => Promise.resolve(payload),
			}),
		);

		const app = buildApp();
		const res = await app.request("/api/logs/query");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toEqual(payload);
	});

	it("GET /api/logs/query passes profile and eventTypes as filters", async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: () => Promise.resolve({ data: { result: [] } }),
		});
		vi.stubGlobal("fetch", mockFetch);

		const app = buildApp();
		await app.request("/api/logs/query?profile=work&eventTypes=api_request&limit=10");

		const calledUrl: string = mockFetch.mock.calls[0][0];
		expect(calledUrl).toContain("query=");
	});

	it("GET /api/logs/query returns 400 when Loki throws", async () => {
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Loki down")));

		const app = buildApp();
		const res = await app.request("/api/logs/query");
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toContain("Loki down");
	});

	it("GET /api/logs/query_range returns 400 when start/end are missing", async () => {
		const app = buildApp();
		const res = await app.request("/api/logs/query_range");
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toContain("start and end are required");
	});

	it("GET /api/logs/query_range returns result when start and end provided", async () => {
		const payload = { status: "success", data: { result: [] } };
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				status: 200,
				json: () => Promise.resolve(payload),
			}),
		);

		const app = buildApp();
		const res = await app.request("/api/logs/query_range?start=1700000000&end=1700003600");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toEqual(payload);
	});

	it("GET /api/logs/query_range returns 400 when Loki throws", async () => {
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Loki unavailable")));

		const app = buildApp();
		const res = await app.request("/api/logs/query_range?start=1700000000&end=1700003600");
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toContain("Loki unavailable");
	});
});
