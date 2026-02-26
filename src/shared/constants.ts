export const ALLOWED_PROFILES = ["all", "claude-b", "claude-p"] as const;
export type AllowedProfile = (typeof ALLOWED_PROFILES)[number];

export const ALLOWED_PERIODS = ["5m", "15m", "1h", "6h", "24h", "7d", "30d"] as const;
export type AllowedPeriod = (typeof ALLOWED_PERIODS)[number];

export const ALLOWED_EVENT_TYPES = ["api_request", "api_error", "tool_result", "tool_decision", "user_prompt"] as const;
export type AllowedEventType = (typeof ALLOWED_EVENT_TYPES)[number];

export const ALLOWED_METRICS = [
	"claude_code_cost_usage_USD_total",
	"claude_code_token_usage_tokens_total",
	"claude_code_cache_read_input_tokens_total",
	"claude_code_cache_creation_input_tokens_total",
	"claude_code_active_time_seconds_total",
	"claude_code_session_count_total",
	"claude_code_commit_count_total",
	"claude_code_code_edit_accept_total",
	"claude_code_code_edit_reject_total",
	"up",
] as const;
