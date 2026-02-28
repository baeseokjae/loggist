import { Hono } from "hono";
import { getDB } from "../db/index";
import { queryLokiRange } from "../services/loki";
import type { SessionSummary } from "../../shared/types/domain";
import type { LokiQueryResult } from "../../shared/types/loki";

export const sessionsRoutes = new Hono();

// GET /api/sessions - List recent sessions with cost summary
sessionsRoutes.get("/", async (c) => {
	const profile = c.req.query("profile") || "all";
	const limit = Math.min(Number(c.req.query("limit")) || 20, 100);
	const start = c.req.query("start") || String(Math.floor(Date.now() / 1000) - 86400);
	const end = c.req.query("end") || String(Math.floor(Date.now() / 1000));

	const profileFilter = profile === "all" ? "" : `, profile="${profile}"`;

	const query = `{service_name="claude-code"${profileFilter}} | event_name = "api_request"`;

	try {
		const result = await queryLokiRange(query, start, end, 1000);
		const sessions = groupBySessions(result);
		return c.json({ data: sessions.slice(0, limit) });
	} catch (error) {
		return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
	}
});

// POST /api/sessions/backfill-titles - Backfill session titles from Loki
sessionsRoutes.post("/backfill-titles", async (c) => {
	const start = c.req.query("start") || String(Math.floor(Date.now() / 1000) - 86400 * 30);
	const end = c.req.query("end") || String(Math.floor(Date.now() / 1000));

	const query = `{service_name="claude-code"} | event_name = "user_prompt"`;

	try {
		const result = await queryLokiRange(query, start, end, 5000);
		const entries = parseLogEntries(result);

		const db = getDB();
		const upsert = db.prepare(
			"INSERT OR IGNORE INTO session_titles (session_id, first_prompt, profile) VALUES (?, ?, ?)",
		);

		let count = 0;
		const seen = new Set<string>();
		for (const entry of entries) {
			if (
				entry.session_id &&
				entry.session_id !== "default" &&
				!seen.has(entry.session_id)
			) {
				seen.add(entry.session_id);
				let prompt = entry.raw;
				try {
					const parsed = JSON.parse(entry.raw) as Record<string, unknown>;
					const body = parsed.body as Record<string, unknown> | undefined;
					prompt = String(parsed.prompt || body?.prompt || entry.raw);
				} catch {
					// use raw line as fallback
				}
				if (prompt && prompt.length > 0) {
					upsert.run(entry.session_id, prompt.slice(0, 200), "all");
					count++;
				}
			}
		}

		return c.json({ data: { backfilled: count } });
	} catch (error) {
		return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
	}
});

// GET /api/sessions/:id - Get session detail
sessionsRoutes.get("/:id", async (c) => {
	const sessionId = c.req.param("id");
	const start = c.req.query("start") || String(Math.floor(Date.now() / 1000) - 86400 * 7);
	const end = c.req.query("end") || String(Math.floor(Date.now() / 1000));

	const query = `{service_name="claude-code"} | session_id = "${sanitizeSessionId(sessionId)}"`;

	try {
		const result = await queryLokiRange(query, start, end, 500);
		const events = parseLogEntries(result);
		const summary = computeSessionSummary(events);
		return c.json({ data: { sessionId, events, summary } });
	} catch (error) {
		return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
	}
});

function sanitizeSessionId(id: string): string {
	return id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
}

interface LogEntry {
	timestamp: string;
	event_name: string;
	model?: string;
	cost_usd?: number;
	input_tokens?: number;
	output_tokens?: number;
	cache_read_input_tokens?: number;
	duration_ms?: number;
	tool_name?: string;
	success?: boolean;
	session_id?: string;
	prompt?: string;
	error_message?: string;
	status_code?: number;
	raw: string;
}

function parseLogEntries(result: unknown): LogEntry[] {
	const entries: LogEntry[] = [];
	const r = result as LokiQueryResult;
	if (!r?.data?.result) return entries;

	for (const stream of r.data.result) {
		const labels = stream.stream || {};

		for (const [ts, line] of stream.values || []) {
			// First try stream labels (OTel Collector exports metadata as Loki labels)
			if (labels.event_name) {
				const entry: LogEntry = {
					timestamp: ts,
					event_name: labels.event_name,
					model: labels.model || "",
					cost_usd: Number(labels.cost_usd || 0),
					input_tokens: Number(labels.input_tokens || 0),
					output_tokens: Number(labels.output_tokens || 0),
					cache_read_input_tokens: Number(
						labels.cache_read_input_tokens || labels.cache_read_tokens || 0,
					),
					duration_ms: Number(labels.duration_ms || 0),
					tool_name: labels.tool_name || "",
					success: labels.success !== undefined ? labels.success === "true" : undefined,
					session_id: labels.session_id || "",
					raw: line,
				};
				if (labels.prompt) {
					entry.prompt = String(labels.prompt).slice(0, 2000);
				}
				if (labels.error_message) {
					entry.error_message = String(labels.error_message);
				}
				if (labels.http_status_code) {
					entry.status_code = Number(labels.http_status_code);
				}
				entries.push(entry);
				continue;
			}

			// Fallback: try parsing log line as JSON
			try {
				const parsed = JSON.parse(line) as Record<string, unknown>;
				const body = parsed.body as Record<string, unknown> | undefined;
				const entry: LogEntry = {
					timestamp: ts,
					event_name: String(parsed.event_name || body?.event_name || "unknown"),
					model: String(parsed.model || body?.model || ""),
					cost_usd: Number(parsed.cost_usd || body?.cost_usd || 0),
					input_tokens: Number(parsed.input_tokens || body?.input_tokens || 0),
					output_tokens: Number(parsed.output_tokens || body?.output_tokens || 0),
					cache_read_input_tokens: Number(
						parsed.cache_read_input_tokens || body?.cache_read_input_tokens || 0,
					),
					duration_ms: Number(parsed.duration_ms || body?.duration_ms || 0),
					tool_name: String(parsed.tool_name || body?.tool_name || ""),
					success:
						parsed.success !== undefined
							? Boolean(parsed.success)
							: body?.success !== undefined
								? Boolean(body.success)
								: undefined,
					session_id: String(parsed.session_id || body?.session_id || ""),
					raw: line,
				};
				const promptVal = parsed.prompt || body?.prompt;
				if (promptVal) {
					entry.prompt = String(promptVal).slice(0, 2000);
				}
				const errorMsg = parsed.error_message || body?.error_message;
				if (errorMsg) {
					entry.error_message = String(errorMsg);
				}
				const statusCode = parsed.status_code || parsed.http_status_code || body?.status_code || body?.http_status_code;
				if (statusCode) {
					entry.status_code = Number(statusCode);
				}
				entries.push(entry);
			} catch {
				entries.push({
					timestamp: ts,
					event_name: "unknown",
					raw: line,
				});
			}
		}
	}

	return entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

function computeSessionSummary(events: LogEntry[]): SessionSummary {
	const models = new Set<string>();
	let totalCost = 0;
	let totalInputTokens = 0;
	let totalOutputTokens = 0;
	let totalCacheTokens = 0;
	let apiCalls = 0;
	let toolCalls = 0;
	let toolFailures = 0;

	for (const e of events) {
		if (e.event_name === "api_request") {
			apiCalls++;
			totalCost += e.cost_usd || 0;
			totalInputTokens += e.input_tokens || 0;
			totalOutputTokens += e.output_tokens || 0;
			totalCacheTokens += e.cache_read_input_tokens || 0;
			if (e.model) models.add(e.model);
		}
		if (e.event_name === "tool_result") {
			toolCalls++;
			if (e.success === false) toolFailures++;
		}
	}

	return {
		sessionId: events[0]?.session_id || "unknown",
		startTime: events[0]?.timestamp || "",
		endTime: events[events.length - 1]?.timestamp || "",
		totalCost,
		totalInputTokens,
		totalOutputTokens,
		totalCacheTokens,
		apiCalls,
		toolCalls,
		toolFailures,
		models: [...models],
		firstPrompt: null,
		durationMs:
			events.length > 0
				? Number(events[events.length - 1].timestamp) - Number(events[0].timestamp)
				: 0,
	};
}

function groupBySessions(result: unknown): SessionSummary[] {
	const entries = parseLogEntries(result);
	const sessionMap = new Map<string, LogEntry[]>();

	for (const entry of entries) {
		const sid = entry.session_id || "default";
		if (!sessionMap.has(sid)) sessionMap.set(sid, []);
		sessionMap.get(sid)?.push(entry);
	}

	const summaries: SessionSummary[] = [];
	for (const [, events] of sessionMap) {
		summaries.push(computeSessionSummary(events));
	}

	// Batch SQLite lookup for session titles
	const sessionIds = summaries
		.map((s) => s.sessionId)
		.filter((id) => id !== "unknown" && id !== "default");

	if (sessionIds.length > 0) {
		try {
			const db = getDB();
			const placeholders = sessionIds.map(() => "?").join(", ");
			const rows = db
				.prepare(
					`SELECT session_id, first_prompt FROM session_titles WHERE session_id IN (${placeholders})`,
				)
				.all(...sessionIds) as { session_id: string; first_prompt: string }[];

			const titleMap = new Map(rows.map((r) => [r.session_id, r.first_prompt]));
			for (const s of summaries) {
				s.firstPrompt = titleMap.get(s.sessionId) ?? null;
			}
		} catch {
			// Non-fatal: titles are best-effort
		}
	}

	return summaries.sort((a, b) => b.startTime.localeCompare(a.startTime));
}
