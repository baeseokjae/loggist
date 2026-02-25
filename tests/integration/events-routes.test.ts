import { eventsRoutes } from "@server/routes/events";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";

function buildApp() {
	const app = new Hono();
	app.route("/api/events", eventsRoutes);
	return app;
}

describe("events routes", () => {
	it("GET /api/events/status returns connection count", async () => {
		const app = buildApp();
		const res = await app.request("/api/events/status");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(typeof body.connections).toBe("number");
		expect(body.connections).toBeGreaterThanOrEqual(0);
	});

	it("GET /api/events/stream returns an SSE response", async () => {
		const app = buildApp();
		const controller = new AbortController();
		const res = await app.request("/api/events/stream", {
			signal: controller.signal,
		});

		// Abort the stream immediately so the connection is cleaned up
		controller.abort();

		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/event-stream");
	});
});
