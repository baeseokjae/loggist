import { readFileSync } from "node:fs";
import { join } from "node:path";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { initDB } from "./db/index";
import { authMiddleware } from "./middleware/auth";
import { createRateLimiter } from "./middleware/rate-limit";
import { securityHeaders } from "./middleware/security-headers";
import { startLokiTail } from "./realtime/loki-tail";
import { initFanout } from "./realtime/sse-fanout";
import { authRoutes, migratePasswordFromEnv } from "./routes/auth";
import { budgetRoutes } from "./routes/budget";
import { eventsRoutes } from "./routes/events";
import { logsRoutes } from "./routes/logs";
import { metricsRoutes } from "./routes/metrics";
import { sessionsRoutes } from "./routes/sessions";
import { startBudgetChecker } from "./workers/budget-checker";

const app = new Hono();

initDB();
await migratePasswordFromEnv();

app.use("*", securityHeaders);
app.use("*", logger());

app.route("/api/auth", authRoutes);

app.get("/api/health", (c) => {
	return c.json({ status: "ok", uptime: process.uptime() });
});

app.use("/api/*", authMiddleware);
app.use("/api/*", createRateLimiter());
app.route("/api/budget", budgetRoutes);
app.route("/api/sessions", sessionsRoutes);
app.route("/api/metrics", metricsRoutes);
app.route("/api/logs", logsRoutes);
app.route("/api/events", eventsRoutes);

// 프로덕션: 빌드된 React SPA 서빙
if (process.env.NODE_ENV === "production") {
	const clientDir = join(import.meta.dirname, "../client");
	app.use("/*", serveStatic({ root: clientDir }));

	// SPA fallback: 알 수 없는 경로는 index.html로
	app.get("*", (c) => {
		try {
			const html = readFileSync(join(clientDir, "index.html"), "utf-8");
			return c.html(html);
		} catch {
			return c.text("Not Found", 404);
		}
	});
}

const port = Number(process.env.PORT) || 3001;

startBudgetChecker();
startLokiTail();
initFanout();

serve({ fetch: app.fetch, port }, (info) => {
	console.log(`Loggist server running on http://localhost:${info.port}`);
});

export default app;
