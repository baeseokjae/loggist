import { Hono } from "hono";
import { queryLokiRange } from "../services/loki";
import { buildLogQLQuery } from "../services/query-builder";

export const logsRoutes = new Hono();

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
