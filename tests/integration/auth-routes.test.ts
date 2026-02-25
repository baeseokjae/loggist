import { closeDB, initDB } from "@server/db/index";
import { authMiddleware } from "@server/middleware/auth";
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("auth routes", () => {
	beforeEach(() => {
		process.env.LOGGIST_JWT_SECRET = "test-secret-for-auth-routes-32chars!";
		process.env.NODE_ENV = "test";
		initDB(":memory:");
	});

	afterEach(() => {
		process.env.LOGGIST_JWT_SECRET = undefined;
		closeDB();
	});

	async function buildApp() {
		const { authRoutes } = await import("@server/routes/auth");
		const app = new Hono();
		app.use("*", authMiddleware);
		app.route("/api/auth", authRoutes);
		return app;
	}

	it("GET /api/auth/check returns needsSetup: true when no password configured", async () => {
		const app = await buildApp();
		const res = await app.request("/api/auth/check");

		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body.authenticated).toBe(false);
		expect(body.needsSetup).toBe(true);
	});

	it("POST /api/auth/setup sets password and returns 200", async () => {
		const app = await buildApp();
		const res = await app.request("/api/auth/setup", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ password: "mypassword" }),
		});

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.success).toBe(true);
	});

	it("POST /api/auth/setup returns 403 if password already configured", async () => {
		const app = await buildApp();

		await app.request("/api/auth/setup", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ password: "mypassword" }),
		});

		const res = await app.request("/api/auth/setup", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ password: "anotherpassword" }),
		});

		expect(res.status).toBe(403);
		const body = await res.json();
		expect(body.error).toBe("Password already configured");
	});

	it("POST /api/auth/setup returns 400 if password is too short", async () => {
		const app = await buildApp();
		const res = await app.request("/api/auth/setup", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ password: "abc" }),
		});

		expect(res.status).toBe(400);
	});

	it("POST /api/auth/login returns 200 and sets cookie after setup", async () => {
		const app = await buildApp();

		await app.request("/api/auth/setup", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ password: "supersecret" }),
		});

		const res = await app.request("/api/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ password: "supersecret" }),
		});

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.success).toBe(true);

		const setCookie = res.headers.get("set-cookie");
		expect(setCookie).toContain("loggist_token=");
		expect(setCookie).toContain("HttpOnly");
	});

	it("POST /api/auth/login returns 401 with wrong password", async () => {
		const app = await buildApp();

		await app.request("/api/auth/setup", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ password: "supersecret" }),
		});

		const res = await app.request("/api/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ password: "wrongpassword" }),
		});

		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body.error).toBe("Invalid password");
	});

	it("POST /api/auth/login returns 401 when no password is configured", async () => {
		const app = await buildApp();
		const res = await app.request("/api/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ password: "anypassword" }),
		});

		expect(res.status).toBe(401);
	});

	it("POST /api/auth/logout returns 200 and clears cookie", async () => {
		const app = await buildApp();
		const res = await app.request("/api/auth/logout", { method: "POST" });

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.success).toBe(true);

		const setCookie = res.headers.get("set-cookie");
		expect(setCookie).toContain("loggist_token=;");
		expect(setCookie).toContain("Max-Age=0");
	});

	it("GET /api/auth/check returns 401 when no cookie is set", async () => {
		const app = await buildApp();

		await app.request("/api/auth/setup", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ password: "supersecret" }),
		});

		const res = await app.request("/api/auth/check");

		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body.authenticated).toBe(false);
		expect(body.needsSetup).toBe(false);
	});

	it("GET /api/auth/check returns 401 for invalid token in cookie", async () => {
		const app = await buildApp();

		await app.request("/api/auth/setup", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ password: "supersecret" }),
		});

		const res = await app.request("/api/auth/check", {
			headers: { cookie: "loggist_token=badtoken" },
		});

		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body.authenticated).toBe(false);
	});

	it("GET /api/auth/check returns 200 for valid token in cookie", async () => {
		const app = await buildApp();

		await app.request("/api/auth/setup", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ password: "supersecret" }),
		});

		const loginRes = await app.request("/api/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ password: "supersecret" }),
		});
		const setCookie = loginRes.headers.get("set-cookie") ?? "";
		const tokenMatch = setCookie.match(/loggist_token=([^;]+)/);
		expect(tokenMatch).not.toBeNull();
		const token = tokenMatch?.[1];

		const checkRes = await app.request("/api/auth/check", {
			headers: { cookie: `loggist_token=${token}` },
		});

		expect(checkRes.status).toBe(200);
		const body = await checkRes.json();
		expect(body.authenticated).toBe(true);
		expect(body.needsSetup).toBe(false);
	});

	it("POST /api/auth/change-password changes password successfully", async () => {
		const app = await buildApp();

		await app.request("/api/auth/setup", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ password: "oldpassword" }),
		});

		const loginRes = await app.request("/api/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ password: "oldpassword" }),
		});
		const setCookie = loginRes.headers.get("set-cookie") ?? "";
		const tokenMatch = setCookie.match(/loggist_token=([^;]+)/);
		const token = tokenMatch?.[1];

		const changeRes = await app.request("/api/auth/change-password", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				cookie: `loggist_token=${token}`,
			},
			body: JSON.stringify({ currentPassword: "oldpassword", newPassword: "newpassword" }),
		});

		expect(changeRes.status).toBe(200);
		const body = await changeRes.json();
		expect(body.success).toBe(true);

		const loginWithNewRes = await app.request("/api/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ password: "newpassword" }),
		});
		expect(loginWithNewRes.status).toBe(200);

		const loginWithOldRes = await app.request("/api/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ password: "oldpassword" }),
		});
		expect(loginWithOldRes.status).toBe(401);
	});

	it("POST /api/auth/change-password returns 401 with wrong current password", async () => {
		const app = await buildApp();

		await app.request("/api/auth/setup", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ password: "oldpassword" }),
		});

		const loginRes = await app.request("/api/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ password: "oldpassword" }),
		});
		const setCookie = loginRes.headers.get("set-cookie") ?? "";
		const tokenMatch = setCookie.match(/loggist_token=([^;]+)/);
		const token = tokenMatch?.[1];

		const changeRes = await app.request("/api/auth/change-password", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				cookie: `loggist_token=${token}`,
			},
			body: JSON.stringify({ currentPassword: "wrongpassword", newPassword: "newpassword" }),
		});

		expect(changeRes.status).toBe(401);
	});

	it("POST /api/auth/change-password returns 400 if new password is too short", async () => {
		const app = await buildApp();

		await app.request("/api/auth/setup", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ password: "oldpassword" }),
		});

		const loginRes = await app.request("/api/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ password: "oldpassword" }),
		});
		const setCookie = loginRes.headers.get("set-cookie") ?? "";
		const tokenMatch = setCookie.match(/loggist_token=([^;]+)/);
		const token = tokenMatch?.[1];

		const changeRes = await app.request("/api/auth/change-password", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				cookie: `loggist_token=${token}`,
			},
			body: JSON.stringify({ currentPassword: "oldpassword", newPassword: "ab" }),
		});

		expect(changeRes.status).toBe(400);
	});
});
