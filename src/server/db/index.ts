import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";

let db: Database.Database;

export function getDB(): Database.Database {
	if (!db) {
		throw new Error("Database not initialized. Call initDB() first.");
	}
	return db;
}

export function initDB(dbPath?: string): Database.Database {
	const dataDir = process.env.LOGGIST_DATA_DIR || "./data";
	if (!existsSync(dataDir)) {
		mkdirSync(dataDir, { recursive: true });
	}

	const finalPath = dbPath || join(dataDir, "loggist.db");
	db = new Database(finalPath);
	db.pragma("journal_mode = WAL");
	db.pragma("foreign_keys = ON");

	db.exec(`
CREATE TABLE IF NOT EXISTS budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile TEXT NOT NULL DEFAULT 'all',
  period TEXT NOT NULL CHECK(period IN ('daily', 'weekly', 'monthly')),
  amount_usd REAL NOT NULL,
  alert_threshold_pct INTEGER NOT NULL DEFAULT 80,
  notify_method TEXT NOT NULL DEFAULT 'dashboard',
  notify_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS budget_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  budget_id INTEGER NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  triggered_at TEXT NOT NULL DEFAULT (datetime('now')),
  current_amount_usd REAL NOT NULL,
  threshold_pct INTEGER NOT NULL,
  notified INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_budget_alerts_budget_id ON budget_alerts(budget_id);
CREATE INDEX IF NOT EXISTS idx_budget_alerts_triggered_at ON budget_alerts(triggered_at);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
	`);

	return db;
}

export function closeDB(): void {
	if (db) {
		db.close();
	}
}
