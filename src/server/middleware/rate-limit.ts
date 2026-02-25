import { createMiddleware } from "hono/factory";

class TokenBucket {
	private tokens: number;
	private lastRefill: number;

	constructor(
		private maxTokens: number,
		private refillRate: number,
	) {
		this.tokens = maxTokens;
		this.lastRefill = Date.now();
	}

	consume(): boolean {
		this.refill();
		if (this.tokens > 0) {
			this.tokens--;
			return true;
		}
		return false;
	}

	private refill() {
		const now = Date.now();
		const elapsed = (now - this.lastRefill) / 1000;
		this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
		this.lastRefill = now;
	}

	getRemainingTokens(): number {
		this.refill();
		return Math.floor(this.tokens);
	}
}

const buckets = new Map<string, TokenBucket>();

export function createRateLimiter(maxTokens = 60, refillRate = 1) {
	return createMiddleware(async (c, next) => {
		const ip =
			c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
			c.req.header("x-real-ip") ||
			"unknown";

		if (!buckets.has(ip)) {
			buckets.set(ip, new TokenBucket(maxTokens, refillRate));
		}

		// biome-ignore lint/style/noNonNullAssertion: bucket is always set above
		const bucket = buckets.get(ip)!;
		if (!bucket.consume()) {
			c.header("Retry-After", "60");
			return c.json({ error: "Rate limit exceeded" }, 429);
		}

		c.header("X-RateLimit-Remaining", String(bucket.getRemainingTokens()));
		return next();
	});
}

// Export class for testing
export { TokenBucket };
