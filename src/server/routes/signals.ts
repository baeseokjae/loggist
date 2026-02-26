import { Hono } from "hono";
import { getDB } from "../db/index";
import { getQueries } from "../db/queries";
import { SIGNAL_RULES } from "../workers/signal-evaluator";
import type { SignalRule } from "../../shared/types/domain";

export const signalsRoutes = new Hono();

// GET /api/signals - List signal events with pagination
signalsRoutes.get("/", (c) => {
	const limit = Math.min(Number(c.req.query("limit")) || 50, 200);
	const offset = Number(c.req.query("offset")) || 0;
	const ruleId = c.req.query("ruleId");
	const acknowledgedParam = c.req.query("acknowledged");

	const db = getDB();

	const conditions: string[] = [];
	const params: (string | number)[] = [];

	if (ruleId) {
		conditions.push("rule_id = ?");
		params.push(ruleId);
	}

	if (acknowledgedParam !== undefined) {
		conditions.push("acknowledged = ?");
		params.push(acknowledgedParam === "true" ? 1 : 0);
	}

	const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

	const total = (
		db.prepare(`SELECT COUNT(*) as count FROM signal_events ${where}`).get(...params) as {
			count: number;
		}
	).count;

	const events = db
		.prepare(
			`SELECT * FROM signal_events ${where} ORDER BY fired_at DESC LIMIT ? OFFSET ?`,
		)
		.all(...params, limit, offset);

	return c.json({ data: events, total, limit, offset });
});

// Severity mapping for each signal rule
const RULE_SEVERITY: Record<string, "critical" | "warning" | "info"> = {
	cost_spike: "critical",
	api_error_burst: "critical",
	data_collection_stopped: "critical",
	cache_efficiency_drop: "warning",
	budget_exceeded: "warning",
};

// GET /api/signals/rules - List available signal rule definitions
signalsRoutes.get("/rules", (c) => {
	const rules: SignalRule[] = SIGNAL_RULES.map(({ id, name, description }) => ({
		id,
		name,
		description,
		severity: RULE_SEVERITY[id] ?? "info",
	}));
	return c.json({ rules });
});

// POST /api/signals/:id/acknowledge - Mark a signal event as acknowledged
signalsRoutes.post("/:id/acknowledge", (c) => {
	const id = c.req.param("id");
	const q = getQueries();

	const existing = q.getSignalEventById.get(id);
	if (!existing) {
		return c.json({ error: "Signal event not found" }, 404);
	}

	q.acknowledgeSignalEvent.run(id);

	const updated = q.getSignalEventById.get(id);
	return c.json({ data: updated });
});

// DELETE /api/signals/old - Delete signal events older than 30 days
signalsRoutes.delete("/old", (c) => {
	const q = getQueries();
	const result = q.deleteOldSignalEvents.run();

	return c.json({ deleted: result.changes });
});
