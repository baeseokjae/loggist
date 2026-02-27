import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("../../src/server/services/prometheus", () => ({
	queryPrometheus: vi.fn(),
}));

vi.mock("../../src/server/services/loki", () => ({
	queryLoki: vi.fn(),
}));

// Mock DB: getDB() returns an object with a chainable prepare().get()/all()/run()
const mockGet = vi.fn();
const mockAll = vi.fn();
const mockRun = vi.fn();
const mockPrepare = vi.fn(() => ({ get: mockGet, all: mockAll, run: mockRun }));

vi.mock("../../src/server/db/index", () => ({
	getDB: vi.fn(() => ({
		prepare: mockPrepare,
	})),
}));

import { queryPrometheus } from "../../src/server/services/prometheus";
import { queryLoki } from "../../src/server/services/loki";
import { SIGNAL_RULES } from "../../src/server/workers/signal-evaluator";

// Helper: build a prometheus-style single-value response
function promResult(value: string) {
	return { data: { result: [{ value: [1_234_567_890, value] }] } };
}

// Helper: empty prometheus result (no series)
function promEmpty() {
	return { data: { result: [] } };
}

// Helper: prometheus result with N placeholder entries (used for "results exist" checks)
function promResultN(n: number) {
	return {
		data: {
			result: Array.from({ length: n }, (_, i) => ({
				value: [1_234_567_890, String(i)],
			})),
		},
	};
}

describe("SIGNAL_RULES structure", () => {
	it("exports exactly 5 rules", () => {
		expect(SIGNAL_RULES).toHaveLength(5);
	});

	it("each rule has id, name, description, and evaluate function", () => {
		for (const rule of SIGNAL_RULES) {
			expect(typeof rule.id).toBe("string");
			expect(rule.id.length).toBeGreaterThan(0);

			expect(typeof rule.name).toBe("string");
			expect(rule.name.length).toBeGreaterThan(0);

			expect(typeof rule.description).toBe("string");
			expect(rule.description.length).toBeGreaterThan(0);

			expect(typeof rule.evaluate).toBe("function");
		}
	});

	it("has the expected rule ids in order", () => {
		const ids = SIGNAL_RULES.map((r) => r.id);
		expect(ids).toEqual([
			"query_failure",
			"cost_spike",
			"api_error_burst",
			"data_collection_stopped",
			"cache_efficiency_drop",
		]);
	});
});

// ---------------------------------------------------------------------------
// Individual rule evaluation
// ---------------------------------------------------------------------------

describe("cost_spike rule", () => {
	const rule = SIGNAL_RULES.find((r) => r.id === "cost_spike")!;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns fired: false when current cost is at or below $2", async () => {
		(queryPrometheus as Mock).mockResolvedValueOnce(promResult("1.5"));

		const result = await rule.evaluate("all");

		expect(result.fired).toBe(false);
		expect(result.currentCost).toBe(1.5);
		// Should not query historical data when cost is below threshold
		expect(queryPrometheus as Mock).toHaveBeenCalledTimes(1);
	});

	it("returns fired: true when current cost > $2 AND > 3x historical max", async () => {
		// First call: current cost
		(queryPrometheus as Mock).mockResolvedValueOnce(promResult("10"));
		// Second call: historical max
		(queryPrometheus as Mock).mockResolvedValueOnce(promResult("2"));

		const result = await rule.evaluate("all");

		expect(result.fired).toBe(true);
		expect(result.currentCost).toBe(10);
		expect(result.historicalMax).toBe(2);
		// 10 / 2 = 5, which is > 3
		expect((result.ratio as number)).toBeCloseTo(5);
	});

	it("returns fired: false when current cost > $2 but NOT > 3x historical max", async () => {
		// Current cost = $5, historical max = $4  →  ratio 1.25  →  not a spike
		(queryPrometheus as Mock).mockResolvedValueOnce(promResult("5"));
		(queryPrometheus as Mock).mockResolvedValueOnce(promResult("4"));

		const result = await rule.evaluate("all");

		expect(result.fired).toBe(false);
	});

	it("returns fired: false when historical max is 0 (no history)", async () => {
		(queryPrometheus as Mock).mockResolvedValueOnce(promResult("10"));
		(queryPrometheus as Mock).mockResolvedValueOnce(promResult("0"));

		const result = await rule.evaluate("all");

		expect(result.fired).toBe(false);
	});

	it("returns fired: false and an error field when prometheus throws", async () => {
		(queryPrometheus as Mock).mockRejectedValueOnce(new Error("Prometheus down"));

		const result = await rule.evaluate("all");

		expect(result.fired).toBe(false);
		expect(typeof result.error).toBe("string");
	});
});

describe("api_error_burst rule", () => {
	const rule = SIGNAL_RULES.find((r) => r.id === "api_error_burst")!;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns fired: true when server errors >= 5", async () => {
		// First loki call: server errors count = 5
		(queryLoki as Mock).mockResolvedValueOnce(promResult("5"));
		// Second loki call: rate limit errors count = 0
		(queryLoki as Mock).mockResolvedValueOnce(promResult("0"));

		const result = await rule.evaluate("all");

		expect(result.fired).toBe(true);
		expect(result.serverErrors).toBe(5);
	});

	it("returns fired: true when rate limit errors >= 20", async () => {
		// First loki call: server errors count = 0
		(queryLoki as Mock).mockResolvedValueOnce(promResult("0"));
		// Second loki call: rate limit errors count = 20
		(queryLoki as Mock).mockResolvedValueOnce(promResult("20"));

		const result = await rule.evaluate("all");

		expect(result.fired).toBe(true);
		expect(result.rateLimitErrors).toBe(20);
	});

	it("returns fired: false when both counts are below threshold", async () => {
		(queryLoki as Mock).mockResolvedValueOnce(promResult("4"));
		(queryLoki as Mock).mockResolvedValueOnce(promResult("19"));

		const result = await rule.evaluate("all");

		expect(result.fired).toBe(false);
		expect(result.serverErrors).toBe(4);
		expect(result.rateLimitErrors).toBe(19);
	});

	it("returns fired: false when loki returns empty results", async () => {
		(queryLoki as Mock).mockResolvedValueOnce(promEmpty());
		(queryLoki as Mock).mockResolvedValueOnce(promEmpty());

		const result = await rule.evaluate("all");

		expect(result.fired).toBe(false);
	});

	it("returns fired: false and an error field when loki throws", async () => {
		(queryLoki as Mock).mockRejectedValueOnce(new Error("Loki unavailable"));

		const result = await rule.evaluate("all");

		expect(result.fired).toBe(false);
		expect(typeof result.error).toBe("string");
	});
});

describe("data_collection_stopped rule", () => {
	const rule = SIGNAL_RULES.find((r) => r.id === "data_collection_stopped")!;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns fired: true when up{job='otel-collector'} == 0 returns results", async () => {
		// One down instance found
		(queryPrometheus as Mock).mockResolvedValueOnce(promResultN(1));

		const result = await rule.evaluate("all");

		expect(result.fired).toBe(true);
		expect(result.downInstances).toBe(1);
	});

	it("returns fired: false when no results (collector is up)", async () => {
		(queryPrometheus as Mock).mockResolvedValueOnce(promEmpty());

		const result = await rule.evaluate("all");

		expect(result.fired).toBe(false);
		expect(result.downInstances).toBe(0);
	});

	it("returns fired: true when multiple instances are down", async () => {
		(queryPrometheus as Mock).mockResolvedValueOnce(promResultN(3));

		const result = await rule.evaluate("all");

		expect(result.fired).toBe(true);
		expect(result.downInstances).toBe(3);
	});

	it("returns fired: false and an error field when prometheus throws", async () => {
		(queryPrometheus as Mock).mockRejectedValueOnce(new Error("timeout"));

		const result = await rule.evaluate("all");

		expect(result.fired).toBe(false);
		expect(typeof result.error).toBe("string");
	});
});

describe("cache_efficiency_drop rule", () => {
	const rule = SIGNAL_RULES.find((r) => r.id === "cache_efficiency_drop")!;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns fired: true when cache hit ratio < 0.3", async () => {
		// cacheRead = 20, totalTokens = 100  →  ratio = 0.2  →  below threshold
		(queryPrometheus as Mock).mockResolvedValueOnce(promResult("20"));
		(queryPrometheus as Mock).mockResolvedValueOnce(promResult("100"));

		const result = await rule.evaluate("all");

		expect(result.fired).toBe(true);
		expect((result.ratio as number)).toBeCloseTo(0.2);
	});

	it("returns fired: false when cache hit ratio >= 0.3", async () => {
		// cacheRead = 50, totalTokens = 100  →  ratio = 0.5  →  above threshold
		(queryPrometheus as Mock).mockResolvedValueOnce(promResult("50"));
		(queryPrometheus as Mock).mockResolvedValueOnce(promResult("100"));

		const result = await rule.evaluate("all");

		expect(result.fired).toBe(false);
		expect((result.ratio as number)).toBeCloseTo(0.5);
	});

	it("returns fired: false when ratio is exactly 0.3 (boundary)", async () => {
		(queryPrometheus as Mock).mockResolvedValueOnce(promResult("30"));
		(queryPrometheus as Mock).mockResolvedValueOnce(promResult("100"));

		const result = await rule.evaluate("all");

		expect(result.fired).toBe(false);
		expect((result.ratio as number)).toBeCloseTo(0.3);
	});

	it("returns fired: false when total tokens = 0 (no data, not a real drop)", async () => {
		(queryPrometheus as Mock).mockResolvedValueOnce(promResult("0"));
		(queryPrometheus as Mock).mockResolvedValueOnce(promResult("0"));

		const result = await rule.evaluate("all");

		expect(result.fired).toBe(false);
		expect(result.ratio).toBeNull();
	});

	it("returns fired: false and an error field when prometheus throws", async () => {
		(queryPrometheus as Mock).mockRejectedValueOnce(new Error("network error"));

		const result = await rule.evaluate("all");

		expect(result.fired).toBe(false);
		expect(typeof result.error).toBe("string");
	});
});

