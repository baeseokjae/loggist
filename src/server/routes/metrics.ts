import { Hono } from "hono";
import { queryPrometheus, queryPrometheusRange } from "../services/prometheus";
import { buildPromQLQuery } from "../services/query-builder";

export const metricsRoutes = new Hono();

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
	const step = c.req.query("step") || "60";

	if (!start || !end) {
		return c.json({ error: "start and end are required" }, 400);
	}

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
