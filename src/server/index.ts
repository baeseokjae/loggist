import { readFileSync } from "node:fs";
import { join } from "node:path";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { getDB, initDB } from "./db/index";
import { authMiddleware } from "./middleware/auth";
import { errorHandler } from "./middleware/error-handler";
import { createRateLimiter } from "./middleware/rate-limit";
import { securityHeaders } from "./middleware/security-headers";
import { startLokiTail } from "./realtime/loki-tail";
import { initSessionTitleCache } from "./realtime/session-title-cache";
import { initFanout } from "./realtime/sse-fanout";
import { authRoutes, migratePasswordFromEnv } from "./routes/auth";
import { budgetRoutes } from "./routes/budget";
import { eventsRoutes } from "./routes/events";
import { logsRoutes } from "./routes/logs";
import { metricsRoutes } from "./routes/metrics";
import { sessionsRoutes } from "./routes/sessions";
import { signalsRoutes } from "./routes/signals";
import { startBudgetChecker } from "./workers/budget-checker";
import { startSignalEvaluator } from "./workers/signal-evaluator";

const app = new Hono();

initDB();
await migratePasswordFromEnv();

app.use("*", securityHeaders);
app.use("*", logger());
app.onError(errorHandler);

app.route("/api/auth", authRoutes);

app.get("/api/health", async (c) => {
	const prometheusUrl = process.env.PROMETHEUS_URL || "http://localhost:9090";
	const lokiUrl = process.env.LOKI_URL || "http://localhost:3100";

	const checkSqlite = async (): Promise<boolean> => {
		try {
			const db = getDB();
			db.prepare("SELECT 1").get();
			return true;
		} catch {
			return false;
		}
	};

	const checkUrl = async (url: string): Promise<boolean> => {
		try {
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), 2000);
			const res = await fetch(url, { signal: controller.signal });
			clearTimeout(timeout);
			return res.ok;
		} catch {
			return false;
		}
	};

	const [sqliteResult, prometheusResult, lokiResult] = await Promise.allSettled([
		checkSqlite(),
		checkUrl(`${prometheusUrl}/-/healthy`),
		checkUrl(`${lokiUrl}/ready`),
	]);

	const checks = {
		sqlite: sqliteResult.status === "fulfilled" ? sqliteResult.value : false,
		prometheus: prometheusResult.status === "fulfilled" ? prometheusResult.value : false,
		loki: lokiResult.status === "fulfilled" ? lokiResult.value : false,
	};

	return c.json({ status: "ok", uptime: process.uptime(), checks });
});

app.use("/api/*", authMiddleware);
app.use("/api/*", createRateLimiter());
app.route("/api/budget", budgetRoutes);
app.route("/api/sessions", sessionsRoutes);
app.route("/api/metrics", metricsRoutes);
app.route("/api/logs", logsRoutes);
app.route("/api/events", eventsRoutes);
app.route("/api/signals", signalsRoutes);

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
startSignalEvaluator();
startLokiTail();
initSessionTitleCache();
initFanout();

serve({ fetch: app.fetch, port }, (info) => {
	console.log(`Loggist server running on http://localhost:${info.port}`);
});

export default app;
