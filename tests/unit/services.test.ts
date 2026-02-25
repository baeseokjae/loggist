import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeOkFetch(payload: unknown) {
	return vi.fn().mockResolvedValue({
		ok: true,
		status: 200,
		json: () => Promise.resolve(payload),
	});
}

function makeFailFetch(status: number) {
	return vi.fn().mockResolvedValue({
		ok: false,
		status,
		json: () => Promise.resolve({ error: "server error" }),
	});
}

// ---------------------------------------------------------------------------
// Loki service
// ---------------------------------------------------------------------------

describe("queryLoki", () => {
	beforeEach(() => {
		vi.resetModules();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns parsed JSON on a successful response", async () => {
		const payload = { status: "success", data: { result: [] } };
		vi.stubGlobal("fetch", makeOkFetch(payload));

		const { queryLoki } = await import("@server/services/loki");
		const result = await queryLoki('{service_name="claude-code"}');
		expect(result).toEqual(payload);
	});

	it("throws when the response is not ok", async () => {
		vi.stubGlobal("fetch", makeFailFetch(500));

		const { queryLoki } = await import("@server/services/loki");
		await expect(queryLoki('{service_name="claude-code"}')).rejects.toThrow(
			"Loki query failed: 500",
		);
	});
});

describe("queryLokiRange", () => {
	beforeEach(() => {
		vi.resetModules();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns parsed JSON on a successful response", async () => {
		const payload = { status: "success", data: { result: [] } };
		vi.stubGlobal("fetch", makeOkFetch(payload));

		const { queryLokiRange } = await import("@server/services/loki");
		const result = await queryLokiRange('{service_name="claude-code"}', "1700000000", "1700003600");
		expect(result).toEqual(payload);
	});

	it("throws when the response is not ok", async () => {
		vi.stubGlobal("fetch", makeFailFetch(503));

		const { queryLokiRange } = await import("@server/services/loki");
		await expect(
			queryLokiRange('{service_name="claude-code"}', "1700000000", "1700003600"),
		).rejects.toThrow("Loki range query failed: 503");
	});

	it("passes direction parameter to the URL", async () => {
		const payload = { data: { result: [] } };
		const mockFetch = makeOkFetch(payload);
		vi.stubGlobal("fetch", mockFetch);

		const { queryLokiRange } = await import("@server/services/loki");
		await queryLokiRange('{service_name="claude-code"}', "0", "1", 50, "forward");

		const calledUrl: string = mockFetch.mock.calls[0][0];
		expect(calledUrl).toContain("direction=forward");
		expect(calledUrl).toContain("limit=50");
	});
});

// ---------------------------------------------------------------------------
// Prometheus service
// ---------------------------------------------------------------------------

describe("queryPrometheus", () => {
	beforeEach(() => {
		vi.resetModules();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns parsed JSON on a successful response", async () => {
		const payload = { status: "success", data: { resultType: "vector", result: [] } };
		vi.stubGlobal("fetch", makeOkFetch(payload));

		const { queryPrometheus } = await import("@server/services/prometheus");
		const result = await queryPrometheus("up");
		expect(result).toEqual(payload);
	});

	it("includes optional time parameter in the URL", async () => {
		const payload = { data: { result: [] } };
		const mockFetch = makeOkFetch(payload);
		vi.stubGlobal("fetch", mockFetch);

		const { queryPrometheus } = await import("@server/services/prometheus");
		await queryPrometheus("up", "1700000000");

		const calledUrl: string = mockFetch.mock.calls[0][0];
		expect(calledUrl).toContain("time=1700000000");
	});

	it("throws when the response is not ok", async () => {
		vi.stubGlobal("fetch", makeFailFetch(500));

		const { queryPrometheus } = await import("@server/services/prometheus");
		await expect(queryPrometheus("up")).rejects.toThrow("Prometheus query failed: 500");
	});
});

describe("queryPrometheusRange", () => {
	beforeEach(() => {
		vi.resetModules();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns parsed JSON on a successful response", async () => {
		const payload = { status: "success", data: { resultType: "matrix", result: [] } };
		vi.stubGlobal("fetch", makeOkFetch(payload));

		const { queryPrometheusRange } = await import("@server/services/prometheus");
		const result = await queryPrometheusRange("up", "1700000000", "1700003600", "60");
		expect(result).toEqual(payload);
	});

	it("throws when the response is not ok", async () => {
		vi.stubGlobal("fetch", makeFailFetch(503));

		const { queryPrometheusRange } = await import("@server/services/prometheus");
		await expect(queryPrometheusRange("up", "1700000000", "1700003600", "60")).rejects.toThrow(
			"Prometheus range query failed: 503",
		);
	});

	it("passes all parameters to the URL", async () => {
		const payload = { data: { result: [] } };
		const mockFetch = makeOkFetch(payload);
		vi.stubGlobal("fetch", mockFetch);

		const { queryPrometheusRange } = await import("@server/services/prometheus");
		await queryPrometheusRange("up", "1700000000", "1700003600", "30");

		const calledUrl: string = mockFetch.mock.calls[0][0];
		expect(calledUrl).toContain("start=1700000000");
		expect(calledUrl).toContain("end=1700003600");
		expect(calledUrl).toContain("step=30");
	});
});
