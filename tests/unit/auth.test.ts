import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("auth middleware", () => {
	beforeEach(() => {
		process.env.LOGGIST_JWT_SECRET = "test-secret-for-auth-tests-only-32chars!";
		process.env.NODE_ENV = "test";
	});

	afterEach(() => {
		process.env.LOGGIST_JWT_SECRET = undefined;
	});

	it("createToken() returns a non-empty JWT string", async () => {
		const { createToken } = await import("@server/middleware/auth");
		const token = await createToken();
		expect(typeof token).toBe("string");
		expect(token.split(".")).toHaveLength(3);
	});

	it("verifyToken() resolves for a token created by createToken()", async () => {
		const { createToken, verifyToken } = await import("@server/middleware/auth");
		const token = await createToken();
		const result = await verifyToken(token);
		expect(result.payload.role).toBe("admin");
	});

	it("authMiddleware passes through public auth paths without a token", async () => {
		const { authMiddleware } = await import("@server/middleware/auth");
		const app = new Hono();
		app.use("*", authMiddleware);
		app.post("/api/auth/login", (c) => c.json({ ok: true }));

		const res = await app.request("/api/auth/login", { method: "POST" });
		expect(res.status).toBe(200);
	});

	it("authMiddleware passes through /api/auth/setup without a token", async () => {
		const { authMiddleware } = await import("@server/middleware/auth");
		const app = new Hono();
		app.use("*", authMiddleware);
		app.post("/api/auth/setup", (c) => c.json({ ok: true }));

		const res = await app.request("/api/auth/setup", { method: "POST" });
		expect(res.status).toBe(200);
	});

	it("authMiddleware passes through /api/auth/logout without a token", async () => {
		const { authMiddleware } = await import("@server/middleware/auth");
		const app = new Hono();
		app.use("*", authMiddleware);
		app.post("/api/auth/logout", (c) => c.json({ ok: true }));

		const res = await app.request("/api/auth/logout", { method: "POST" });
		expect(res.status).toBe(200);
	});

	it("authMiddleware passes through /api/auth/check without a token", async () => {
		const { authMiddleware } = await import("@server/middleware/auth");
		const app = new Hono();
		app.use("*", authMiddleware);
		app.get("/api/auth/check", (c) => c.json({ ok: true }));

		const res = await app.request("/api/auth/check");
		expect(res.status).toBe(200);
	});

	it("authMiddleware passes through /api/health without a token", async () => {
		const { authMiddleware } = await import("@server/middleware/auth");
		const app = new Hono();
		app.use("*", authMiddleware);
		app.get("/api/health", (c) => c.json({ ok: true }));

		const res = await app.request("/api/health");
		expect(res.status).toBe(200);
	});

	it("authMiddleware returns 401 when no cookie is present on protected route", async () => {
		const { authMiddleware } = await import("@server/middleware/auth");
		const app = new Hono();
		app.use("*", authMiddleware);
		app.get("/api/protected", (c) => c.json({ secret: true }));

		const res = await app.request("/api/protected");
		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body.error).toBe("Unauthorized");
	});

	it("authMiddleware returns 401 for an invalid token", async () => {
		const { authMiddleware } = await import("@server/middleware/auth");
		const app = new Hono();
		app.use("*", authMiddleware);
		app.get("/api/protected", (c) => c.json({ secret: true }));

		const res = await app.request("/api/protected", {
			headers: { cookie: "loggist_token=not-a-real-jwt" },
		});
		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body.error).toBe("Invalid or expired token");
	});

	it("authMiddleware allows request with a valid token in cookie", async () => {
		const { authMiddleware, createToken } = await import("@server/middleware/auth");
		const token = await createToken();

		const app = new Hono();
		app.use("*", authMiddleware);
		app.get("/api/protected", (c) => c.json({ secret: true }));

		const res = await app.request("/api/protected", {
			headers: { cookie: `loggist_token=${token}` },
		});
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.secret).toBe(true);
	});
});
