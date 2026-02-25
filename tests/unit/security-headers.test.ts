import { securityHeaders } from "@server/middleware/security-headers";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";

function buildApp() {
	const app = new Hono();
	app.use("*", securityHeaders);
	app.get("/test", (c) => c.json({ ok: true }));
	return app;
}

describe("securityHeaders middleware", () => {
	it("sets X-Content-Type-Options to nosniff", async () => {
		const res = await buildApp().request("/test");
		expect(res.headers.get("x-content-type-options")).toBe("nosniff");
	});

	it("sets X-Frame-Options to DENY", async () => {
		const res = await buildApp().request("/test");
		expect(res.headers.get("x-frame-options")).toBe("DENY");
	});

	it("sets X-XSS-Protection", async () => {
		const res = await buildApp().request("/test");
		expect(res.headers.get("x-xss-protection")).toBe("1; mode=block");
	});

	it("sets Referrer-Policy", async () => {
		const res = await buildApp().request("/test");
		expect(res.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
	});

	it("sets Strict-Transport-Security", async () => {
		const res = await buildApp().request("/test");
		expect(res.headers.get("strict-transport-security")).toBe(
			"max-age=31536000; includeSubDomains",
		);
	});

	it("sets Content-Security-Policy", async () => {
		const res = await buildApp().request("/test");
		const csp = res.headers.get("content-security-policy");
		expect(csp).toContain("default-src 'self'");
		expect(csp).toContain("script-src 'self'");
	});

	it("does not break the response body", async () => {
		const res = await buildApp().request("/test");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.ok).toBe(true);
	});
});
