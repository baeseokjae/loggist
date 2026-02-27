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

CREATE TABLE IF NOT EXISTS signal_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_id TEXT NOT NULL,
  profile TEXT NOT NULL,
  data TEXT NOT NULL,
  fired_at TEXT NOT NULL DEFAULT (datetime('now')),
  acknowledged INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_signal_events_fired_at ON signal_events(fired_at);
CREATE INDEX IF NOT EXISTS idx_signal_events_rule_id ON signal_events(rule_id);

CREATE TABLE IF NOT EXISTS session_titles (
  session_id TEXT PRIMARY KEY,
  first_prompt TEXT NOT NULL,
  profile TEXT NOT NULL DEFAULT 'all',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS model_pricing (
  model TEXT PRIMARY KEY,
  input_price_per_mtok REAL NOT NULL,
  cache_read_price_per_mtok REAL NOT NULL,
  output_price_per_mtok REAL NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
