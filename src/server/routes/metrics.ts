import { Hono } from "hono";
import { downsample } from "../services/downsampler";
import { queryPrometheus, queryPrometheusRange } from "../services/prometheus";
import { buildPromQLQuery } from "../services/query-builder";
import type { PrometheusResult } from "../../shared/types/prometheus";

export const metricsRoutes = new Hono();

function computeStep(startSec: number, endSec: number, maxPoints = 500): string {
	const rangeSec = endSec - startSec;
	const step = Math.max(60, Math.ceil(rangeSec / maxPoints));
	return String(step);
}

// Preset-based metric queries (no raw PromQL from client)
metricsRoutes.get("/query", async (c) => {
	const preset = c.req.query("preset");
	const profile = c.req.query("profile") || "all";
	const range = c.req.query("range") || "24h";

	try {
		const query = buildPromQLQuery({
			metric: getMetricForPreset(preset || "cost"),
			profile,
			range,
		});
		const result = await queryPrometheus(query);
		return c.json(result);
	} catch (error) {
		return c.json({ error: String(error) }, 400);
	}
});

metricsRoutes.get("/query_range", async (c) => {
	const preset = c.req.query("preset");
	const profile = c.req.query("profile") || "all";
	const start = c.req.query("start");
	const end = c.req.query("end");
	const clientStep = c.req.query("step");
	const maxPointsRaw = c.req.query("maxPoints");
	const maxPoints = Math.min(
		maxPointsRaw !== undefined ? Math.max(1, Number(maxPointsRaw)) : 300,
		2000,
	);

	if (!start || !end) {
		return c.json({ error: "start and end are required" }, 400);
	}

	const startSec = Number(start);
	const endSec = Number(end);
	const rangeSec = endSec - startSec;

	// Use computed step when no explicit step provided, or when range is large (>1h) and client step would produce too many points
	const step =
		!clientStep || (rangeSec > 3600 && Number(clientStep) * maxPoints < rangeSec)
			? computeStep(startSec, endSec, maxPoints)
			: clientStep;

	try {
		const metric = getMetricForPreset(preset || "cost");
		const query = buildPromQLQuery({
			metric,
			profile,
			range: "5m",
			aggregation: "sum",
			by: preset === "cost_by_model" ? ["model"] : undefined,
		});
		// For range query, we use rate instead of increase
		const rateQuery = query.replace("increase(", "rate(");
		const result = await queryPrometheusRange(rateQuery, start, end, step);

		// Apply LTTB downsampling to each series in the result.
		const typedResult = result as PrometheusResult | undefined;
		if (typedResult?.data?.result && Array.isArray(typedResult.data.result)) {
			for (const series of typedResult.data.result) {
				if (Array.isArray(series.values)) {
					series.values = downsample(series.values, maxPoints);
				}
			}
		}

		return c.json(result);
	} catch (error) {
		return c.json({ error: String(error) }, 400);
	}
});

function getMetricForPreset(preset: string): string {
	const presets: Record<string, string> = {
		cost: "claude_code_cost_usage_USD_total",
		cost_by_model: "claude_code_cost_usage_USD_total",
		tokens: "claude_code_token_usage_tokens_total",
		cache_read: "claude_code_cache_read_input_tokens_total",
		cache_creation: "claude_code_cache_creation_input_tokens_total",
		active_time: "claude_code_active_time_seconds_total",
		sessions: "claude_code_session_count_total",
	};

	const metric = presets[preset];
	if (!metric) throw new Error(`Unknown preset: ${preset}`);
	return metric;
}
