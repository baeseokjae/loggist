import { Hono } from "hono";
import { queryLokiRange } from "../services/loki";
import { buildLogQLQuery } from "../services/query-builder";
import type { LokiQueryResult } from "../../shared/types/loki";

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
		const toolMap = new Map<string, { totalCalls: number; successCount: number; failureCount: number }>();

		for (const stream of r?.data?.result ?? []) {
			const labels = stream.stream || {};
			for (const [, line] of stream.values || []) {
				let toolName: string | undefined;
				let success: boolean | undefined;

				// Try stream labels first (OTel Collector path)
				if (labels.tool_name) {
					toolName = labels.tool_name;
					success = labels.success !== undefined ? labels.success === "true" : undefined;
				} else {
					// Fallback: parse JSON log line
					try {
						const parsed = JSON.parse(line) as Record<string, unknown>;
						const body = parsed.body as Record<string, unknown> | undefined;
						const rawName = parsed.tool_name || body?.tool_name;
						toolName = rawName ? String(rawName) : undefined;
						const rawSuccess = parsed.success ?? body?.success;
						success = rawSuccess !== undefined ? Boolean(rawSuccess) : undefined;
					} catch {
						// skip unparseable lines
					}
				}

				if (!toolName) continue;
				const normalized = toolName.toLowerCase();

				const existing = toolMap.get(normalized) ?? { totalCalls: 0, successCount: 0, failureCount: 0 };
				existing.totalCalls += 1;
				if (success === false) {
					existing.failureCount += 1;
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
			}))
			.sort((a, b) => b.totalCalls - a.totalCalls);

		const data: ToolDistributionResult = { tools };
		toolDistributionCache.set(cacheKey, { data, timestamp: Date.now() });

		return c.json({ data });
	} catch (error) {
		return c.json({ error: String(error) }, 400);
	}
});

logsRoutes.get("/query", async (c) => {
	const profile = c.req.query("profile");
	const eventTypes = c.req.query("eventTypes")?.split(",");
	const keyword = c.req.query("keyword");
	const sessionId = c.req.query("sessionId");
	const limit = Number(c.req.query("limit")) || 100;

	try {
		const query = buildLogQLQuery({ profile, eventTypes, keyword, sessionId });
		// Loki does not support instant queries for log streams; use range query with 24h window
		const end = String(Math.floor(Date.now() / 1000));
		const start = String(Number(end) - 86400);
		const result = await queryLokiRange(query, start, end, Math.min(limit, 500), "backward");
		return c.json(result);
	} catch (error) {
		return c.json({ error: String(error) }, 400);
	}
});

logsRoutes.get("/query_range", async (c) => {
	const profile = c.req.query("profile");
	const eventTypes = c.req.query("eventTypes")?.split(",");
	const keyword = c.req.query("keyword");
	const sessionId = c.req.query("sessionId");
	const start = c.req.query("start");
	const end = c.req.query("end");
	const limit = Number(c.req.query("limit")) || 100;

	if (!start || !end) {
		return c.json({ error: "start and end are required" }, 400);
	}

	try {
		const query = buildLogQLQuery({ profile, eventTypes, keyword, sessionId });
		const result = await queryLokiRange(query, start, end, Math.min(limit, 500));
		return c.json(result);
	} catch (error) {
		return c.json({ error: String(error) }, 400);
	}
});
