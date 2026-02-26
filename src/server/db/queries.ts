import type Database from "better-sqlite3";
import { getDB } from "./index";

let stmts: ReturnType<typeof createStatements> | null = null;
let stmtsDb: Database.Database | null = null;

function createStatements(db: Database.Database) {
	return {
		// Budget queries
		getAllBudgets: db.prepare("SELECT * FROM budgets ORDER BY created_at DESC"),
		getBudgetById: db.prepare("SELECT * FROM budgets WHERE id = ?"),
		insertBudget: db.prepare(
			`INSERT INTO budgets (profile, period, amount_usd, alert_threshold_pct, notify_method, notify_url)
     VALUES (?, ?, ?, ?, ?, ?)`,
		),
		updateBudget: db.prepare(
			`UPDATE budgets SET
       amount_usd = COALESCE(?, amount_usd),
       alert_threshold_pct = COALESCE(?, alert_threshold_pct),
       notify_method = COALESCE(?, notify_method),
       notify_url = COALESCE(?, notify_url),
       updated_at = datetime('now')
     WHERE id = ?`,
		),
		deleteBudget: db.prepare("DELETE FROM budgets WHERE id = ?"),
		getAllBudgetsForCheck: db.prepare("SELECT * FROM budgets"),

		// Budget alert queries
		getRecentBudgetAlert: db.prepare(
			`SELECT 1 FROM budget_alerts
       WHERE budget_id = ? AND threshold_pct = ?
       AND triggered_at > datetime('now', '-1 day')`,
		),
		insertBudgetAlert: db.prepare(
			`INSERT INTO budget_alerts (budget_id, current_amount_usd, threshold_pct)
       VALUES (?, ?, ?)`,
		),
		getAlertsWithBudgets: db.prepare(
			`SELECT ba.*, b.profile, b.period, b.amount_usd
       FROM budget_alerts ba
       JOIN budgets b ON ba.budget_id = b.id
       ORDER BY ba.triggered_at DESC
       LIMIT 50`,
		),
		getUnnotifiedAlertForProfile: db.prepare(
			`SELECT ba.*, b.profile, b.period, b.amount_usd
         FROM budget_alerts ba
         JOIN budgets b ON ba.budget_id = b.id
         WHERE ba.notified = 0
           AND (b.profile = ? OR ? = 'all')
         ORDER BY ba.triggered_at DESC
         LIMIT 1`,
		),

		// Signal event queries
		getRecentSignalEvent: db.prepare(
			`SELECT 1 FROM signal_events
       WHERE rule_id = ? AND profile = ?
       AND fired_at > datetime('now', '-1 hour')`,
		),
		insertSignalEvent: db.prepare(
			"INSERT INTO signal_events (rule_id, profile, data) VALUES (?, ?, ?)",
		),
		getSignalEventById: db.prepare("SELECT * FROM signal_events WHERE id = ?"),
		acknowledgeSignalEvent: db.prepare(
			"UPDATE signal_events SET acknowledged = 1 WHERE id = ?",
		),
		deleteOldSignalEvents: db.prepare(
			"DELETE FROM signal_events WHERE fired_at < datetime('now', '-30 days')",
		),

		// Settings queries
		getNotifyWebhookUrl: db.prepare(
			"SELECT value FROM settings WHERE key = 'notify_webhook_url'",
		),
	};
}

export function getQueries() {
	const currentDb = getDB();
	if (!stmts || stmtsDb !== currentDb) {
		stmts = createStatements(currentDb);
		stmtsDb = currentDb;
	}
	return stmts;
}
