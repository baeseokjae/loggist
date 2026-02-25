import { Hono } from "hono";
import { createSSEStream, getSSEConnectionCount } from "../realtime/sse-fanout";

export const eventsRoutes = new Hono();

eventsRoutes.get("/stream", (c) => {
	return createSSEStream(c);
});

eventsRoutes.get("/status", (c) => {
	return c.json({ connections: getSSEConnectionCount() });
});
