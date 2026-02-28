import { Hono } from "hono";
import { ALLOWED_PERIODS, ALLOWED_PROFILES } from "../../shared/constants";
import { getQueries } from "../db/queries";
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

const GAUGE_PRESETS = new Set(["cache_hit_ratio", "cost_per_hour", "edit_accept_ratio"]);

// Presets that require an extra type label filter on claude_code_token_usage_tokens_total
const PRESET_TYPE_FILTER: Record<string, string> = {
	cache_read: "cacheRead",
	cache_creation: "cacheCreation",
};

// Preset-based metric queries (no raw PromQL from client)
metricsRoutes.get("/query", async (c) => {
	const preset = c.req.query("preset") || "cost";
	const profile = c.req.query("profile") || "all";
	const range = c.req.query("range") || "24h";

	try {
		const metric = getMetricForPreset(preset);

		if (preset === "cache_hit_ratio") {
			// Use avg_over_time on the recording rule so the KPI reflects the full selected range
			// Filter profile=~".+" to exclude label-less series that contain NaN
			const labels: string[] = ['profile=~".+"'];
			if (profile && profile !== "all") labels.push(`profile="${profile}"`);
			const labelStr = `{${labels.join(",")}}`;
			const query = `avg(avg_over_time(${metric}${labelStr}[${range}]))`;
			const result = await queryPrometheus(query);
			return c.json(result);
		}

		const query = buildPromQLQuery({ metric, profile, range });
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

	const mode = c.req.query("mode") || "rate"; // "rate" | "increase"

	try {
		const metric = getMetricForPreset(preset || "cost");
		let finalQuery: string;

		if (GAUGE_PRESETS.has(preset || "cost")) {
			const labels: string[] = [];
			if (profile && profile !== "all") labels.push(`profile="${profile}"`);
			const labelStr = labels.length > 0 ? `{${labels.join(",")}}` : "";
			finalQuery = `avg(${metric}${labelStr})`;
		} else if (mode === "increase") {
			// For absolute totals (e.g., daily cost), use increase() with step-sized window
			const labels: string[] = [];
			if (profile && profile !== "all") labels.push(`profile="${profile}"`);
			const typeFilter = PRESET_TYPE_FILTER[preset || ""];
			if (typeFilter) labels.push(`type="${typeFilter}"`);
			const labelStr = labels.length > 0 ? `{${labels.join(",")}}` : "";
			const byClause = preset === "cost_by_model" ? " by (model)" : "";
			finalQuery = `sum${byClause}(increase(${metric}${labelStr}[${step}s]))`;
		} else {
			// For time-series rate charts, use rate() with fixed 5m window
			const typeFilter = PRESET_TYPE_FILTER[preset || ""];
			const extraLabels = typeFilter ? { type: typeFilter } : undefined;
			const query = buildPromQLQuery({
				metric,
				profile,
				range: "5m",
				aggregation: "sum",
				by: preset === "cost_by_model" ? ["model"] : undefined,
				extraLabels,
			});
			finalQuery = query.replace("increase(", "rate(");
		}

		const result = await queryPrometheusRange(finalQuery, start, end, step);

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

metricsRoutes.get("/cache-savings", async (c) => {
	const profile = c.req.query("profile") || "all";
	const range = c.req.query("range") || "24h";

	if (!(ALLOWED_PROFILES as readonly string[]).includes(profile)) {
		return c.json({ error: "Invalid profile" }, 400);
	}
	if (!(ALLOWED_PERIODS as readonly string[]).includes(range)) {
		return c.json({ error: "Invalid range" }, 400);
	}

	try {
		const profileFilter = profile === "all" ? 'profile=~".+"' : `profile="${profile}"`;
		const query = `sum by (model) (increase(claude_code_token_usage_tokens_total{type="cacheRead",${profileFilter}}[${range}]))`;
		const prometheusResult = (await queryPrometheus(query)) as PrometheusResult;

		const pricingRows = getQueries().getAllModelPricing.all() as Array<{
			model: string;
			input_price_per_mtok: number;
			cache_read_price_per_mtok: number;
			output_price_per_mtok: number;
		}>;
		const pricingMap = new Map(pricingRows.map((r) => [r.model, r]));

		// Default pricing for common Claude models when model_pricing table has no match
		const DEFAULT_PRICING: Record<string, { input: number; cache_read: number }> = {
			sonnet: { input: 3.0, cache_read: 0.3 },
			opus: { input: 15.0, cache_read: 1.5 },
			haiku: { input: 0.8, cache_read: 0.08 },
		};

		function findPricing(model: string) {
			// Exact match first
			const exact = pricingMap.get(model);
			if (exact) return { input: exact.input_price_per_mtok, cache_read: exact.cache_read_price_per_mtok };
			// Partial match on model_pricing table
			for (const [key, row] of pricingMap) {
				if (model.includes(key) || key.includes(model)) {
					return { input: row.input_price_per_mtok, cache_read: row.cache_read_price_per_mtok };
				}
			}
			// Fallback to default pricing by model family
			const modelLower = model.toLowerCase();
			for (const [family, prices] of Object.entries(DEFAULT_PRICING)) {
				if (modelLower.includes(family)) return prices;
			}
			return null;
		}

		const byModel: Array<{ model: string; tokens: number; savings: number }> = [];
		let totalSavings = 0;

		for (const series of prometheusResult?.data?.result ?? []) {
			const model = series.metric?.model ?? "unknown";
			const tokens = Number(series.value?.[1] ?? 0);
			if (!Number.isFinite(tokens) || tokens <= 0) continue;

			const pricing = findPricing(model);
			if (!pricing) continue;

			const savings =
				(tokens * (pricing.input - pricing.cache_read)) /
				1_000_000;
			totalSavings += savings;
			byModel.push({ model, tokens, savings });
		}

		byModel.sort((a, b) => b.savings - a.savings);

		return c.json({ data: { totalSavings, byModel } });
	} catch (error) {
		return c.json({ error: String(error) }, 400);
	}
});

metricsRoutes.get("/model-comparison", async (c) => {
	const profile = c.req.query("profile") || "all";
	const range = c.req.query("range") || "24h";

	if (!(ALLOWED_PROFILES as readonly string[]).includes(profile)) {
		return c.json({ error: "Invalid profile" }, 400);
	}
	if (!(ALLOWED_PERIODS as readonly string[]).includes(range)) {
		return c.json({ error: "Invalid range" }, 400);
	}

	try {
		const profileFilter = profile === "all" ? 'profile=~".+"' : `profile="${profile}"`;

		const [costResult, tokensResult, cacheResult] = await Promise.all([
			queryPrometheus(
				`sum by (model) (increase(claude_code_cost_usage_USD_total{${profileFilter}}[${range}]))`,
			),
			queryPrometheus(
				`sum by (model) (increase(claude_code_token_usage_tokens_total{${profileFilter}}[${range}]))`,
			),
			queryPrometheus(
				`sum by (model) (increase(claude_code_token_usage_tokens_total{type="cacheRead",${profileFilter}}[${range}]))`,
			),
		]);

		const costTyped = costResult as PrometheusResult | undefined;
		const tokensTyped = tokensResult as PrometheusResult | undefined;
		const cacheTyped = cacheResult as PrometheusResult | undefined;

		const modelMap = new Map<
			string,
			{ totalCost: number; totalTokens: number; cacheReadTokens: number }
		>();

		for (const entry of costTyped?.data?.result ?? []) {
			const model = entry.metric.model ?? "unknown";
			const value = Number.parseFloat(entry.value?.[1] ?? "0");
			if (!modelMap.has(model)) {
				modelMap.set(model, { totalCost: 0, totalTokens: 0, cacheReadTokens: 0 });
			}
			// biome-ignore lint/style/noNonNullAssertion: key was just inserted
			modelMap.get(model)!.totalCost = value;
		}

		for (const entry of tokensTyped?.data?.result ?? []) {
			const model = entry.metric.model ?? "unknown";
			const value = Number.parseFloat(entry.value?.[1] ?? "0");
			if (!modelMap.has(model)) {
				modelMap.set(model, { totalCost: 0, totalTokens: 0, cacheReadTokens: 0 });
			}
			// biome-ignore lint/style/noNonNullAssertion: key was just inserted
			modelMap.get(model)!.totalTokens = value;
		}

		for (const entry of cacheTyped?.data?.result ?? []) {
			const model = entry.metric.model ?? "unknown";
			const value = Number.parseFloat(entry.value?.[1] ?? "0");
			if (!modelMap.has(model)) {
				modelMap.set(model, { totalCost: 0, totalTokens: 0, cacheReadTokens: 0 });
			}
			// biome-ignore lint/style/noNonNullAssertion: key was just inserted
			modelMap.get(model)!.cacheReadTokens = value;
		}

		const models = Array.from(modelMap.entries()).map(([model, stats]) => {
			const totalMTokens = stats.totalTokens / 1_000_000;
			const costPerMToken = totalMTokens > 0 ? stats.totalCost / totalMTokens : 0;
			return {
				model,
				totalCost: stats.totalCost,
				totalTokens: stats.totalTokens,
				cacheReadTokens: stats.cacheReadTokens,
				costPerMToken,
			};
		});

		return c.json({ data: { models } });
	} catch (error) {
		return c.json({ error: String(error) }, 400);
	}
});

metricsRoutes.get("/profiles", async (c) => {
	try {
		const result = (await queryPrometheus(
			`group by (profile) (claude_code_cost_usage_USD_total)`,
		)) as PrometheusResult;

		const profileSet = new Set<string>();
		for (const series of result?.data?.result ?? []) {
			const profile = series.metric?.profile;
			if (profile && typeof profile === "string" && profile.length > 0) {
				profileSet.add(profile);
			}
		}

		const profiles = Array.from(profileSet).sort();
		return c.json({ data: { profiles } });
	} catch (error) {
		return c.json({ error: String(error) }, 400);
	}
});

metricsRoutes.get("/error-summary", async (c) => {
	const profile = c.req.query("profile") || "all";
	const range = c.req.query("range") || "24h";

	if (!(ALLOWED_PROFILES as readonly string[]).includes(profile)) {
		return c.json({ error: "Invalid profile" }, 400);
	}
	if (!(ALLOWED_PERIODS as readonly string[]).includes(range)) {
		return c.json({ error: "Invalid range" }, 400);
	}

	try {
		const profileFilter = profile === "all" ? 'profile=~".+"' : `profile="${profile}"`;
		const query = `sum by (http_status_code) (increase(claude_code_api_requests_total{${profileFilter},http_status_code=~"4..|5.."}[${range}]))`;
		const prometheusResult = (await queryPrometheus(query)) as PrometheusResult;

		const errors: Array<{ statusCode: string; count: number }> = [];

		for (const series of prometheusResult?.data?.result ?? []) {
			const statusCode = series.metric?.http_status_code ?? series.metric?.["http_status_code"];
			if (!statusCode) continue;
			const count = Number.parseFloat(series.value?.[1] ?? "0");
			if (!Number.isFinite(count) || count <= 0) continue;
			errors.push({ statusCode: String(statusCode), count: Math.round(count) });
		}

		errors.sort((a, b) => b.count - a.count);

		return c.json({ data: { errors } });
	} catch (error) {
		return c.json({ error: String(error) }, 400);
	}
});

function getMetricForPreset(preset: string): string {
	const presets: Record<string, string> = {
		cost: "claude_code_cost_usage_USD_total",
		cost_by_model: "claude_code_cost_usage_USD_total",
		tokens: "claude_code_token_usage_tokens_total",
		cache_read: "claude_code_token_usage_tokens_total",
		cache_creation: "claude_code_token_usage_tokens_total",
		cache_hit_ratio: "claude_code:cache_hit_ratio",
		cost_per_hour: "claude_code:cost_per_hour",
		edit_accept_ratio: "claude_code:code_edit_accept_ratio",
		active_time: "claude_code_active_time_seconds_total",
		sessions: "claude_code_session_count_total",
	};

	const metric = presets[preset];
	if (!metric) throw new Error(`Unknown preset: ${preset}`);
	return metric;
}
