import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLokiPayload(streams: Array<{ values: [string, string][] }>): {
	data: { result: typeof streams };
} {
	return { data: { result: streams } };
}

function makeLogLine(overrides: Record<string, unknown> = {}): string {
	return JSON.stringify({
		event_name: "api_request",
		model: "claude-opus-4-6",
		cost_usd: 0.005,
		input_tokens: 100,
		output_tokens: 50,
		cache_read_input_tokens: 0,
		duration_ms: 1200,
		session_id: "session-abc",
		...overrides,
	});
}

// ---------------------------------------------------------------------------
// App factory – the loki service is mocked per-test
// ---------------------------------------------------------------------------

async function buildApp() {
	const { sessionsRoutes } = await import("@server/routes/sessions");
	const app = new Hono();
	app.route("/api/sessions", sessionsRoutes);
	return app;
}

// ---------------------------------------------------------------------------
// GET /api/sessions
// ---------------------------------------------------------------------------

describe("GET /api/sessions", () => {
	beforeEach(() => {
		vi.resetModules();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns empty data when Loki returns no streams", async () => {
		vi.doMock("@server/services/loki", () => ({
			queryLokiRange: vi.fn().mockResolvedValue(makeLokiPayload([])),
		}));

		const app = await buildApp();
		const res = await app.request("/api/sessions");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.data).toEqual([]);
	});

	it("returns grouped session summaries", async () => {
		const ts1 = "1700000000000000000";
		const ts2 = "1700000001000000000";
		vi.doMock("@server/services/loki", () => ({
			queryLokiRange: vi.fn().mockResolvedValue(
				makeLokiPayload([
					{
						values: [
							[ts1, makeLogLine({ session_id: "sess-1", cost_usd: 0.01 })],
							[ts2, makeLogLine({ session_id: "sess-1", cost_usd: 0.02 })],
						],
					},
				]),
			),
		}));

		const app = await buildApp();
		const res = await app.request("/api/sessions");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.data).toHaveLength(1);
		expect(body.data[0].sessionId).toBe("sess-1");
		expect(body.data[0].apiCalls).toBe(2);
		expect(body.data[0].totalCost).toBeCloseTo(0.03);
	});

	it("respects the limit query parameter", async () => {
		// Create 5 distinct sessions
		const streams = Array.from({ length: 5 }, (_, i) => ({
			values: [
				[`170000000${i}000000000`, makeLogLine({ session_id: `sess-${i}`, cost_usd: 0.001 })] as [
					string,
					string,
				],
			],
		}));

		vi.doMock("@server/services/loki", () => ({
			queryLokiRange: vi.fn().mockResolvedValue(makeLokiPayload(streams)),
		}));

		const app = await buildApp();
		const res = await app.request("/api/sessions?limit=2");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.data.length).toBeLessThanOrEqual(2);
	});

	it("returns 500 when Loki throws", async () => {
		vi.doMock("@server/services/loki", () => ({
			queryLokiRange: vi.fn().mockRejectedValue(new Error("Loki unavailable")),
		}));

		const app = await buildApp();
		const res = await app.request("/api/sessions");
		expect(res.status).toBe(500);
		const body = await res.json();
		expect(body.error).toContain("Loki unavailable");
	});
});

// ---------------------------------------------------------------------------
// GET /api/sessions/:id
// ---------------------------------------------------------------------------

describe("GET /api/sessions/:id", () => {
	beforeEach(() => {
		vi.resetModules();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns session events and summary for a known session", async () => {
		const ts = "1700000000000000000";
		vi.doMock("@server/services/loki", () => ({
			queryLokiRange: vi.fn().mockResolvedValue(
				makeLokiPayload([
					{
						values: [[ts, makeLogLine({ session_id: "sess-detail", cost_usd: 0.007 })]],
					},
				]),
			),
		}));

		const app = await buildApp();
		const res = await app.request("/api/sessions/sess-detail");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.data.sessionId).toBe("sess-detail");
		expect(body.data.summary.apiCalls).toBe(1);
		expect(body.data.summary.totalCost).toBeCloseTo(0.007);
		expect(body.data.events).toHaveLength(1);
	});

	it("returns 500 when Loki throws", async () => {
		vi.doMock("@server/services/loki", () => ({
			queryLokiRange: vi.fn().mockRejectedValue(new Error("connection refused")),
		}));

		const app = await buildApp();
		const res = await app.request("/api/sessions/sess-xyz");
		expect(res.status).toBe(500);
		const body = await res.json();
		expect(body.error).toContain("connection refused");
	});

	it("handles malformed log lines gracefully", async () => {
		const ts = "1700000000000000000";
		vi.doMock("@server/services/loki", () => ({
			queryLokiRange: vi.fn().mockResolvedValue(
				makeLokiPayload([
					{
						values: [[ts, "not-valid-json"]],
					},
				]),
			),
		}));

		const app = await buildApp();
		const res = await app.request("/api/sessions/sess-broken");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.data.events).toHaveLength(1);
		expect(body.data.events[0].event_name).toBe("unknown");
	});

	it("counts tool_result events and failures in summary", async () => {
		const ts1 = "1700000000000000000";
		const ts2 = "1700000001000000000";
		const ts3 = "1700000002000000000";
		vi.doMock("@server/services/loki", () => ({
			queryLokiRange: vi.fn().mockResolvedValue(
				makeLokiPayload([
					{
						values: [
							[ts1, makeLogLine({ event_name: "api_request", session_id: "s1" })],
							[
								ts2,
								makeLogLine({
									event_name: "tool_result",
									session_id: "s1",
									success: true,
								}),
							],
							[
								ts3,
								makeLogLine({
									event_name: "tool_result",
									session_id: "s1",
									success: false,
								}),
							],
						],
					},
				]),
			),
		}));

		const app = await buildApp();
		const res = await app.request("/api/sessions/s1");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.data.summary.toolCalls).toBe(2);
		expect(body.data.summary.toolFailures).toBe(1);
	});
});
