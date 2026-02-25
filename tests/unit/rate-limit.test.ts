import { TokenBucket, createRateLimiter } from "@server/middleware/rate-limit";
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("createRateLimiter middleware", () => {
	it("allows a request when tokens are available", async () => {
		const app = new Hono();
		app.use("*", createRateLimiter(5, 1));
		app.get("/test", (c) => c.json({ ok: true }));

		const res = await app.request("/test", {
			headers: { "x-forwarded-for": "1.2.3.100" },
		});
		expect(res.status).toBe(200);
		expect(res.headers.get("x-ratelimit-remaining")).not.toBeNull();
	});

	it("returns 429 after bucket is exhausted", async () => {
		const app = new Hono();
		// Only 2 tokens available
		app.use("*", createRateLimiter(2, 0));
		app.get("/test", (c) => c.json({ ok: true }));

		const ip = "1.2.3.200";
		await app.request("/test", { headers: { "x-forwarded-for": ip } });
		await app.request("/test", { headers: { "x-forwarded-for": ip } });

		const res = await app.request("/test", { headers: { "x-forwarded-for": ip } });
		expect(res.status).toBe(429);
		const body = await res.json();
		expect(body.error).toBe("Rate limit exceeded");
		expect(res.headers.get("retry-after")).toBe("60");
	});

	it("uses x-real-ip as fallback when x-forwarded-for is absent", async () => {
		const app = new Hono();
		app.use("*", createRateLimiter(5, 1));
		app.get("/test", (c) => c.json({ ok: true }));

		const res = await app.request("/test", {
			headers: { "x-real-ip": "9.8.7.6" },
		});
		expect(res.status).toBe(200);
	});

	it("falls back to 'unknown' ip when no ip headers present", async () => {
		const app = new Hono();
		app.use("*", createRateLimiter(5, 1));
		app.get("/no-ip", (c) => c.json({ ok: true }));

		const res = await app.request("/no-ip");
		expect(res.status).toBe(200);
	});
});

describe("TokenBucket", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("should start with max tokens", () => {
		const bucket = new TokenBucket(60, 1);
		expect(bucket.getRemainingTokens()).toBe(60);
	});

	it("consume() should decrease token count", () => {
		const bucket = new TokenBucket(60, 1);
		bucket.consume();
		expect(bucket.getRemainingTokens()).toBe(59);
	});

	it("consume() should return true when tokens are available", () => {
		const bucket = new TokenBucket(5, 1);
		expect(bucket.consume()).toBe(true);
	});

	it("consume() should return false when bucket is empty", () => {
		const bucket = new TokenBucket(3, 1);
		bucket.consume();
		bucket.consume();
		bucket.consume();
		expect(bucket.consume()).toBe(false);
	});

	it("should not exceed maxTokens when refilling", () => {
		const bucket = new TokenBucket(10, 1);
		// Advance time by 100 seconds – refill would give 100 tokens but cap is 10
		vi.advanceTimersByTime(100_000);
		expect(bucket.getRemainingTokens()).toBe(10);
	});

	it("should refill tokens over time", () => {
		const bucket = new TokenBucket(10, 2); // 2 tokens per second
		// Drain all tokens
		for (let i = 0; i < 10; i++) bucket.consume();
		expect(bucket.getRemainingTokens()).toBe(0);

		// Advance 3 seconds → should gain 6 tokens
		vi.advanceTimersByTime(3_000);
		expect(bucket.getRemainingTokens()).toBe(6);
	});

	it("consume() should allow requests again after refill", () => {
		const bucket = new TokenBucket(1, 1);
		bucket.consume(); // empty bucket
		expect(bucket.consume()).toBe(false);

		// Advance 2 seconds to refill 2 tokens (but capped at 1)
		vi.advanceTimersByTime(2_000);
		expect(bucket.consume()).toBe(true);
	});

	it("getRemainingTokens() should return floored integer", () => {
		const bucket = new TokenBucket(10, 1);
		// Drain all tokens
		for (let i = 0; i < 10; i++) bucket.consume();

		// Advance 0.7 seconds → 0.7 tokens refilled, floor → 0
		vi.advanceTimersByTime(700);
		expect(bucket.getRemainingTokens()).toBe(0);

		// Advance another 0.5 seconds → total 1.2 tokens refilled, floor → 1
		vi.advanceTimersByTime(500);
		expect(bucket.getRemainingTokens()).toBe(1);
	});
});
