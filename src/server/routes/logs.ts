import { Hono } from "hono";
import { queryLoki, queryLokiMetricRange, queryLokiRange } from "../services/loki";
import { buildLogQLQuery } from "../services/query-builder";
import type { LokiQueryResult } from "../../shared/types/loki";
import { ALLOWED_EVENT_TYPES } from "../../shared/constants";

export const logsRoutes = new Hono();

// In-memory cache for tool distribution results
interface ToolDistributionCache {
	data: ToolDistributionResult;
	timestamp: number;
}

interface ToolDistributionResult {
	tools: Array<{
		name: string;
		totalCalls: number;
		successCount: number;
		failureCount: number;
		successRate: number;
		topFailureReasons: Array<{ message: string; count: number }>;
	}>;
}

const toolDistributionCache = new Map<string, ToolDistributionCache>();
const TOOL_DISTRIBUTION_TTL_MS = 5 * 60 * 1000; // 5 minutes

logsRoutes.get("/tool-distribution", async (c) => {
	const profile = c.req.query("profile") || "all";
	const start = c.req.query("start");
	const end = c.req.query("end");

	if (!start || !end) {
		return c.json({ error: "start and end are required" }, 400);
	}

	const cacheKey = `${profile}:${start}:${end}`;
	const cached = toolDistributionCache.get(cacheKey);
	if (cached && Date.now() - cached.timestamp < TOOL_DISTRIBUTION_TTL_MS) {
		return c.json({ data: cached.data });
	}

	try {
		const profileFilter = profile === "all" ? "" : `, profile="${profile}"`;
		const query = `{service_name="claude-code"${profileFilter}} | event_name = "tool_result"`;
		const result = await queryLokiRange(query, start, end, 5000);

		const r = result as LokiQueryResult;
		const toolMap = new Map<string, {
			totalCalls: number;
			successCount: number;
			failureCount: number;
			errorMessages: Map<string, number>;
		}>();

		for (const stream of r?.data?.result ?? []) {
			const labels = stream.stream || {};
			for (const [, line] of stream.values || []) {
				let toolName: string | undefined;
				let success: boolean | undefined;
				let errorMessage: string | undefined;

				// Try stream labels first (OTel Collector path)
				if (labels.tool_name) {
					toolName = labels.tool_name;
					success = labels.success !== undefined ? labels.success === "true" : undefined;
					errorMessage = labels.error;
				} else {
					// Fallback: parse JSON log line
					try {
						const parsed = JSON.parse(line) as Record<string, unknown>;
						const body = parsed.body as Record<string, unknown> | undefined;
						const rawName = parsed.tool_name || body?.tool_name;
						toolName = rawName ? String(rawName) : undefined;
						const rawSuccess = parsed.success ?? body?.success;
						success = rawSuccess !== undefined ? Boolean(rawSuccess) : undefined;
						const rawError = parsed.error ?? body?.error;
						errorMessage = rawError ? String(rawError) : undefined;
					} catch {
						// skip unparseable lines
					}
				}

				if (!toolName) continue;
				const normalized = toolName.toLowerCase();

				const existing = toolMap.get(normalized) ?? { totalCalls: 0, successCount: 0, failureCount: 0, errorMessages: new Map() };
				existing.totalCalls += 1;
				if (success === false) {
					existing.failureCount += 1;
					const errKey = errorMessage || "알 수 없는 오류";
					existing.errorMessages.set(errKey, (existing.errorMessages.get(errKey) ?? 0) + 1);
				} else {
					existing.successCount += 1;
				}
				toolMap.set(normalized, existing);
			}
		}

		const tools = Array.from(toolMap.entries())
			.map(([name, stats]) => ({
				name,
				totalCalls: stats.totalCalls,
				successCount: stats.successCount,
				failureCount: stats.failureCount,
				successRate: stats.totalCalls > 0 ? stats.successCount / stats.totalCalls : 1,
				topFailureReasons: Array.from(stats.errorMessages.entries())
					.sort((a, b) => b[1] - a[1])
					.slice(0, 5)
					.map(([message, count]) => ({ message, count })),
			}))
			.sort((a, b) => b.totalCalls - a.totalCalls);

		const data: ToolDistributionResult = { tools };
		toolDistributionCache.set(cacheKey, { data, timestamp: Date.now() });

		return c.json({ data });
	} catch (error) {
		return c.json({ error: String(error) }, 400);
	}
});

// 이벤트 타입별 총 발생 횟수를 캐시하는 구조체
interface EventCountsCache {
	data: Record<string, number>;
	timestamp: number;
}
const eventCountsCache = new Map<string, EventCountsCache>();
const EVENT_COUNTS_TTL_MS = 2 * 60 * 1000; // 2분

// 이벤트 타입별 카운트를 병렬로 조회하는 엔드포인트
logsRoutes.get("/event-counts", async (c) => {
	const profile = c.req.query("profile") || "all";
	const start = c.req.query("start");
	const end = c.req.query("end");

	if (!start || !end) {
		return c.json({ error: "start and end are required" }, 400);
	}

	const cacheKey = `${profile}:${start}:${end}`;
	const cached = eventCountsCache.get(cacheKey);
	if (cached && Date.now() - cached.timestamp < EVENT_COUNTS_TTL_MS) {
		return c.json({ data: { counts: cached.data } });
	}

	try {
		const profileFilter = profile === "all" ? "" : `, profile="${profile}"`;
		const rangeSec = Number(end) - Number(start);

		// 각 이벤트 타입별 집계 쿼리를 병렬 실행
		const results = await Promise.all(
			ALLOWED_EVENT_TYPES.map(async (type) => {
				const query = `sum(count_over_time({service_name="claude-code"${profileFilter}} | event_name = "${type}" [${rangeSec}s]))`;
				const result = await queryLoki(query) as { data?: { result?: Array<{ value?: [number, string] }> } };
				const raw = result?.data?.result?.[0]?.value?.[1];
				return [type, raw ? Number(raw) : 0] as const;
			}),
		);

		const counts = Object.fromEntries(results) as Record<string, number>;
		eventCountsCache.set(cacheKey, { data: counts, timestamp: Date.now() });

		return c.json({ data: { counts } });
	} catch (error) {
		return c.json({ error: String(error) }, 400);
	}
});

// 이벤트 타입별 시계열 볼륨을 병렬로 조회하는 엔드포인트
logsRoutes.get("/volume", async (c) => {
	const profile = c.req.query("profile") || "all";
	const start = c.req.query("start");
	const end = c.req.query("end");
	const step = c.req.query("step");

	if (!start || !end || !step) {
		return c.json({ error: "start, end, and step are required" }, 400);
	}

	try {
		const profileFilter = profile === "all" ? "" : `, profile="${profile}"`;

		// 각 이벤트 타입별 시계열 데이터를 병렬 조회
		const seriesList = await Promise.all(
			ALLOWED_EVENT_TYPES.map(async (type) => {
				const query = `sum(count_over_time({service_name="claude-code"${profileFilter}} | event_name = "${type}" [${step}s]))`;
				const result = await queryLokiMetricRange(query, start, end, step) as {
					data?: { result?: Array<{ values?: [number, string][] }> };
				};
				return {
					metric: { event_name: type },
					values: result?.data?.result?.[0]?.values || [],
				};
			}),
		);

		return c.json({ data: { result: seriesList } });
	} catch (error) {
		return c.json({ error: String(error) }, 400);
	}
});

logsRoutes.get("/query", async (c) => {
	const profile = c.req.query("profile");
	const eventTypes = c.req.query("eventTypes")?.split(",");
	const keyword = c.req.query("keyword");
	const sessionId = c.req.query("sessionId");
	const model = c.req.query("model")?.split(",");
	const toolName = c.req.query("toolName")?.split(",");
	const success = c.req.query("success");
	const limit = Number(c.req.query("limit")) || 100;

	// start/end 없으면 24h 폴백
	const defaultEnd = String(Math.floor(Date.now() / 1000));
	const defaultStart = String(Number(defaultEnd) - 86400);
	const end = c.req.query("end") || defaultEnd;
	const start = c.req.query("start") || defaultStart;

	try {
		const query = buildLogQLQuery({ profile, eventTypes, keyword, sessionId, model, toolName, success });

		// 페이지네이션: limit+1 요청 후 초과 여부로 hasMore 판단
		const fetchLimit = Math.min(limit, 500);
		const result = await queryLokiRange(query, start, end, fetchLimit + 1, "backward");

		const lokiResult = result as LokiQueryResult;
		const allEntries: [string, string][] = [];
		for (const stream of lokiResult?.data?.result ?? []) {
			for (const entry of stream.values ?? []) {
				allEntries.push(entry);
			}
		}

		const hasMore = allEntries.length > fetchLimit;
		const nextCursor = hasMore ? allEntries[fetchLimit - 1]?.[0] : undefined;

		// limit+1번째 엔트리는 제외하고 원본 결과 반환
		if (hasMore && lokiResult?.data?.result) {
			let remaining = fetchLimit;
			for (const stream of lokiResult.data.result) {
				if (stream.values && stream.values.length > 0) {
					const take = Math.min(remaining, stream.values.length);
					stream.values = stream.values.slice(0, take);
					remaining -= take;
				}
			}
		}

		return c.json({ ...lokiResult, meta: { hasMore, nextCursor } });
	} catch (error) {
		return c.json({ error: String(error) }, 400);
	}
});

logsRoutes.get("/query_range", async (c) => {
	const profile = c.req.query("profile");
	const eventTypes = c.req.query("eventTypes")?.split(",");
	const keyword = c.req.query("keyword");
	const sessionId = c.req.query("sessionId");
	const model = c.req.query("model")?.split(",");
	const toolName = c.req.query("toolName")?.split(",");
	const success = c.req.query("success");
	const start = c.req.query("start");
	const end = c.req.query("end");
	const limit = Number(c.req.query("limit")) || 100;

	if (!start || !end) {
		return c.json({ error: "start and end are required" }, 400);
	}

	try {
		const query = buildLogQLQuery({ profile, eventTypes, keyword, sessionId, model, toolName, success });
		const result = await queryLokiRange(query, start, end, Math.min(limit, 500));
		return c.json(result);
	} catch (error) {
		return c.json({ error: String(error) }, 400);
	}
});

// facets 캐시: 필드별 값 집계 결과를 5분간 캐시
interface FacetsCache {
	data: FacetsResult;
	timestamp: number;
}

interface FacetEntry {
	value: string;
	count: number;
}

interface FacetsResult {
	event_name: FacetEntry[];
	model: FacetEntry[];
	tool_name: FacetEntry[];
	success: FacetEntry[];
}

const facetsCache = new Map<string, FacetsCache>();
const FACETS_TTL_MS = 5 * 60 * 1000; // 5분

// 로그 스트림에서 필드별 고유값과 카운트를 집계하는 엔드포인트
logsRoutes.get("/facets", async (c) => {
	const profile = c.req.query("profile") || "all";
	const start = c.req.query("start");
	const end = c.req.query("end");

	if (!start || !end) {
		return c.json({ error: "start and end are required" }, 400);
	}

	const cacheKey = `${profile}:${start}:${end}`;
	const cached = facetsCache.get(cacheKey);
	if (cached && Date.now() - cached.timestamp < FACETS_TTL_MS) {
		return c.json({ data: cached.data, totalEntries: cached.data.event_name.reduce((s, e) => s + e.count, 0), cachedAt: new Date(cached.timestamp).toISOString() });
	}

	try {
		const profileFilter = profile === "all" ? "" : `, profile="${profile}"`;
		const query = `{service_name="claude-code"${profileFilter}}`;
		const result = await queryLokiRange(query, start, end, 5000);

		const r = result as LokiQueryResult;

		// 필드별 카운트 맵 초기화
		const eventNameMap = new Map<string, number>();
		const modelMap = new Map<string, number>();
		const toolNameMap = new Map<string, number>();
		const successMap = new Map<string, number>();

		let totalEntries = 0;

		for (const stream of r?.data?.result ?? []) {
			const labels = stream.stream || {};

			for (const [, line] of stream.values ?? []) {
				totalEntries++;

				// stream labels에서 먼저 읽고, 없으면 JSON 파싱
				let eventName = labels.event_name;
				let modelVal = labels.model;
				let toolNameVal = labels.tool_name;
				let successVal = labels.success;

				if (!eventName || !modelVal || !toolNameVal || !successVal) {
					try {
						const parsed = JSON.parse(line) as Record<string, unknown>;
						const body = parsed.body as Record<string, unknown> | undefined;
						if (!eventName) eventName = String(parsed.event_name ?? body?.event_name ?? "");
						if (!modelVal) modelVal = String(parsed.model ?? body?.model ?? "");
						if (!toolNameVal) toolNameVal = String(parsed.tool_name ?? body?.tool_name ?? "");
						if (!successVal) successVal = String(parsed.success ?? body?.success ?? "");
					} catch {
						// 파싱 불가 라인 스킵
					}
				}

				if (eventName) eventNameMap.set(eventName, (eventNameMap.get(eventName) ?? 0) + 1);
				if (modelVal) modelMap.set(modelVal, (modelMap.get(modelVal) ?? 0) + 1);
				if (toolNameVal) toolNameMap.set(toolNameVal, (toolNameMap.get(toolNameVal) ?? 0) + 1);
				if (successVal === "true" || successVal === "false") {
					successMap.set(successVal, (successMap.get(successVal) ?? 0) + 1);
				}
			}
		}

		// 카운트 내림차순 정렬 후 배열 변환
		const toSorted = (m: Map<string, number>): FacetEntry[] =>
			Array.from(m.entries())
				.sort((a, b) => b[1] - a[1])
				.map(([value, count]) => ({ value, count }));

		const data: FacetsResult = {
			event_name: toSorted(eventNameMap),
			model: toSorted(modelMap),
			tool_name: toSorted(toolNameMap),
			success: toSorted(successMap),
		};

		const cachedAt = new Date().toISOString();
		facetsCache.set(cacheKey, { data, timestamp: Date.now() });

		return c.json({ data, totalEntries, cachedAt });
	} catch (error) {
		return c.json({ error: String(error) }, 400);
	}
});
