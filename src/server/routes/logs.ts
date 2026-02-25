import { Hono } from "hono";
import { queryLoki, queryLokiRange } from "../services/loki";
import { buildLogQLQuery } from "../services/query-builder";

export const logsRoutes = new Hono();

logsRoutes.get("/query", async (c) => {
	const profile = c.req.query("profile");
	const eventTypes = c.req.query("eventTypes")?.split(",");
	const keyword = c.req.query("keyword");
	const limit = Number(c.req.query("limit")) || 100;

	try {
		const query = buildLogQLQuery({ profile, eventTypes, keyword });
		const result = await queryLoki(query, Math.min(limit, 500));
		return c.json(result);
	} catch (error) {
		return c.json({ error: String(error) }, 400);
	}
});

logsRoutes.get("/query_range", async (c) => {
	const profile = c.req.query("profile");
	const eventTypes = c.req.query("eventTypes")?.split(",");
	const keyword = c.req.query("keyword");
	const start = c.req.query("start");
	const end = c.req.query("end");
	const limit = Number(c.req.query("limit")) || 100;

	if (!start || !end) {
		return c.json({ error: "start and end are required" }, 400);
	}

	try {
		const query = buildLogQLQuery({ profile, eventTypes, keyword });
		const result = await queryLokiRange(query, start, end, Math.min(limit, 500));
		return c.json(result);
	} catch (error) {
		return c.json({ error: String(error) }, 400);
	}
});
