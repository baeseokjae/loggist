import { getDB } from "../db/index";
import { queryPrometheus } from "../services/prometheus";
import { queryLoki } from "../services/loki";
import { notify } from "../services/notifier";
import { parseScalarValue, parseResultCount } from "../utils/prometheus-parser";

const SIGNAL_CHECK_INTERVAL = 60_000;
const QUERY_FAILURE_THRESHOLD = 3;
const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

interface SignalResult {
	fired: boolean;
	[key: string]: unknown;
}

interface EvaluatorRule {
	id: string;
	name: string;
	description: string;
	evaluate: (profile: string) => Promise<SignalResult>;
}

// Track consecutive query failures per rule
const queryFailureCounts = new Map<string, number>();
let lastCleanup = Date.now();

function trackQueryFailure(ruleId: string, error: unknown): SignalResult {
	const key = ruleId;
	const count = (queryFailureCounts.get(key) ?? 0) + 1;
	queryFailureCounts.set(key, count);
	console.error(`[Signal Evaluator] ${ruleId} query failure (${count}/${QUERY_FAILURE_THRESHOLD}):`, error);
	return { fired: false, error: String(error), consecutiveFailures: count };
}

function clearQueryFailure(ruleId: string) {
	if (queryFailureCounts.has(ruleId)) {
		queryFailureCounts.delete(ruleId);
	}
}

// Rule 0: Query failure - fires when any rule's queries fail consecutively
async function evaluateQueryFailure(_profile: string): Promise<SignalResult> {
	const failingRules: string[] = [];
	queryFailureCounts.forEach((count, ruleId) => {
		if (count >= QUERY_FAILURE_THRESHOLD) {
			failingRules.push(ruleId);
		}
	});
	if (failingRules.length === 0) {
		return { fired: false };
	}
	return {
		fired: true,
		failingRules,
		message: `Rules with ${QUERY_FAILURE_THRESHOLD}+ consecutive query failures: ${failingRules.join(", ")}`,
	};
}

// Rule 1: Cost spike - current 1h cost > $2 AND > 3x historical max from past 7d
async function evaluateCostSpike(profile: string): Promise<SignalResult> {
	const profileFilter = profile === "all" ? "" : `{profile="${profile}"}`;

	try {
		const currentResult = await queryPrometheus(
			`sum(increase(claude_code_cost_usage_USD_total${profileFilter}[1h]))`,
		);
		const currentCost = parseScalarValue(currentResult);

		if (currentCost <= 2) {
			return { fired: false, currentCost };
		}

		const historicalResult = await queryPrometheus(
			`max_over_time(sum(increase(claude_code_cost_usage_USD_total${profileFilter}[1h]))[7d:1h])`,
		);
		const historicalMax = parseScalarValue(historicalResult);

		const fired = historicalMax > 0 && currentCost > historicalMax * 3;
		clearQueryFailure("cost_spike");
		return { fired, currentCost, historicalMax, ratio: historicalMax > 0 ? currentCost / historicalMax : null };
	} catch (error) {
		return trackQueryFailure("cost_spike", error);
	}
}

// Rule 2: API error burst - 5+ server errors (>=500) or 20+ rate limits (429) in 5min
async function evaluateApiErrorBurst(profile: string): Promise<SignalResult> {
	const profileFilter = profile === "all" ? "" : `, profile="${profile}"`;

	try {
		const serverErrorResult = await queryLoki(
			`count_over_time({service_name="claude-code"${profileFilter}} | http_status_code >= 500 [5m])`,
			1,
		);
		const serverErrors = parseScalarValue(serverErrorResult);

		const rateLimitResult = await queryLoki(
			`count_over_time({service_name="claude-code"${profileFilter}} | http_status_code = "429" [5m])`,
			1,
		);
		const rateLimitErrors = parseScalarValue(rateLimitResult);

		const fired = serverErrors >= 5 || rateLimitErrors >= 20;
		clearQueryFailure("api_error_burst");
		return { fired, serverErrors, rateLimitErrors };
	} catch (error) {
		return trackQueryFailure("api_error_burst", error);
	}
}

// Rule 3: Data collection stopped - OTel collector down
async function evaluateDataCollectionStopped(_profile: string): Promise<SignalResult> {
	try {
		const result = await queryPrometheus(`up{job="otel-collector"} == 0`);
		const downInstances = parseResultCount(result);
		const fired = downInstances > 0;
		clearQueryFailure("data_collection_stopped");
		return { fired, downInstances };
	} catch (error) {
		return trackQueryFailure("data_collection_stopped", error);
	}
}

// Rule 4: Cache efficiency drop - cache hit ratio < 0.3 for 15 min
async function evaluateCacheEfficiencyDrop(profile: string): Promise<SignalResult> {
	const profileFilter = profile === "all" ? "" : `{profile="${profile}"}`;
	const cacheReadFilter = profile === "all" ? '{type="cacheRead"}' : `{type="cacheRead",profile="${profile}"}`;

	try {
		const cacheReadResult = await queryPrometheus(
			`sum(increase(claude_code_token_usage_tokens_total${cacheReadFilter}[15m]))`,
		);
		const cacheRead = parseScalarValue(cacheReadResult);

		const totalTokensResult = await queryPrometheus(
			`sum(increase(claude_code_token_usage_tokens_total${profileFilter}[15m]))`,
		);
		const totalTokens = parseScalarValue(totalTokensResult);

		if (totalTokens === 0) {
			return { fired: false, cacheRead, totalTokens, ratio: null };
		}

		const ratio = cacheRead / totalTokens;
		const fired = ratio < 0.3;
		clearQueryFailure("cache_efficiency_drop");
		return {
			fired,
			cacheRead,
			totalTokens,
			ratio,
			cache_hit_ratio: ratio,
			threshold: 0.3,
		};
	} catch (error) {
		return trackQueryFailure("cache_efficiency_drop", error);
	}
}

export const SIGNAL_RULES: EvaluatorRule[] = [
	{
		id: "query_failure",
		name: "쿼리 실패",
		description: `One or more signal rules have failed ${QUERY_FAILURE_THRESHOLD}+ consecutive query attempts`,
		evaluate: evaluateQueryFailure,
	},
	{
		id: "cost_spike",
		name: "비용 급증",
		description: "Current 1h cost exceeds $2 and is more than 3x the historical max from the past 7 days",
		evaluate: evaluateCostSpike,
	},
	{
		id: "api_error_burst",
		name: "API 오류 급증",
		description: "5+ server errors (HTTP >=500) or 20+ rate limit errors (HTTP 429) in the last 5 minutes",
		evaluate: evaluateApiErrorBurst,
	},
	{
		id: "data_collection_stopped",
		name: "데이터 수집 중단",
		description: "OTel collector is reporting as down (up{job='otel-collector'} == 0)",
		evaluate: evaluateDataCollectionStopped,
	},
	{
		id: "cache_efficiency_drop",
		name: "캐시 효율 저하",
		description: "Cache hit ratio has been below 0.3 for the past 15 minutes",
		evaluate: evaluateCacheEfficiencyDrop,
	},
];

async function getActiveProfiles(): Promise<string[]> {
	try {
		const result = await queryPrometheus(
			`group by (profile) (claude_code_cost_usage_USD_total)`,
		);
		const typed = result as {
			data?: { result?: Array<{ metric?: { profile?: string } }> };
		};
		const profiles = (typed?.data?.result ?? [])
			.map((r) => r.metric?.profile)
			.filter((p): p is string => typeof p === "string" && p.length > 0);

		return profiles.length > 0 ? profiles : ["all"];
	} catch {
		return ["all"];
	}
}

export function startSignalEvaluator() {
	async function evaluate() {
		try {
			const db = getDB();
			const profiles = await getActiveProfiles();

			// Auto-cleanup: delete signal events older than 30 days (once per 24h)
			if (Date.now() - lastCleanup > CLEANUP_INTERVAL) {
				try {
					const deleted = db.prepare(
						`DELETE FROM signal_events WHERE fired_at < datetime('now', '-30 days')`,
					).run();
					if (deleted.changes > 0) {
						console.log(`[Signal Evaluator] Cleaned up ${deleted.changes} old signal events`);
					}
					lastCleanup = Date.now();
				} catch (err) {
					console.error("[Signal Evaluator] Cleanup error:", err);
				}
			}

			for (const rule of SIGNAL_RULES) {
				// query_failure and data_collection_stopped are profile-agnostic; evaluate once under "all"
				const rulProfiles = (rule.id === "data_collection_stopped" || rule.id === "query_failure") ? ["all"] : profiles;

				for (const profile of rulProfiles) {
					try {
						// Deduplication: skip if same rule+profile fired within the last hour
						const recent = db
							.prepare(
								`SELECT 1 FROM signal_events
                 WHERE rule_id = ? AND profile = ?
                 AND fired_at > datetime('now', '-1 hour')
                 AND acknowledged = 0`,
							)
							.get(rule.id, profile);

						if (recent) continue;

						const result = await rule.evaluate(profile);

						if (result.fired) {
							const { fired: _fired, ...extra } = result;
							db.prepare(
								`INSERT INTO signal_events (rule_id, profile, data)
                 VALUES (?, ?, ?)`,
							).run(rule.id, profile, JSON.stringify(extra));

							console.log(
								`[Signal Evaluator] Rule fired: ${rule.id} / profile=${profile}`,
								extra,
							);

							// Notify via default webhook if configured
							try {
								const setting = db
									.prepare(`SELECT value FROM settings WHERE key = 'notify_webhook_url'`)
									.get() as { value: string } | undefined;

								if (setting?.value) {
									notify({
										method: "webhook",
										url: setting.value,
										title: `Signal: ${rule.name} (${profile})`,
										message: rule.description,
										severity: "warning",
									}).catch((err) =>
										console.error("[Signal Evaluator] notify() failed:", err),
									);
								}
							} catch (err) {
								console.error("[Signal Evaluator] Failed to read notify_webhook_url setting:", err);
							}
						}
					} catch (error) {
						console.error(
							`[Signal Evaluator] Error evaluating rule ${rule.id} for profile ${profile}:`,
							error,
						);
					}
				}
			}
		} catch (error) {
			console.error("[Signal Evaluator] Error:", error);
		}
	}

	const interval = setInterval(evaluate, SIGNAL_CHECK_INTERVAL);
	evaluate();

	return () => clearInterval(interval);
}
