export interface Budget {
	id: number;
	profile: string;
	period: string;
	amount_usd: number;
	alert_threshold_pct: number;
	notify_method: string;
	notify_url: string | null;
	created_at: string;
	updated_at: string;
}

export interface BudgetAlert {
	id: number;
	budget_id: number;
	triggered_at: string;
	current_amount_usd: number;
	threshold_pct: number;
	notified: number;
	profile: string;
	period: string;
	amount_usd: number;
}

export interface Signal {
	id: number;
	rule_id: string;
	profile: string;
	data: string;
	fired_at: string;
	acknowledged: number;
}

export interface SignalRule {
	id: string;
	name: string;
	description: string;
	severity?: "critical" | "warning" | "info";
}

export interface SessionSummary {
	sessionId: string;
	startTime: string;
	endTime: string;
	totalCost: number;
	totalInputTokens: number;
	totalOutputTokens: number;
	totalCacheTokens: number;
	apiCalls: number;
	toolCalls: number;
	toolFailures: number;
	models: string[];
	firstPrompt: string | null;
	durationMs: number;
}

export interface SessionEvent {
	timestamp: string;
	event_name: string;
	model?: string;
	cost_usd?: number;
	input_tokens?: number;
	output_tokens?: number;
	tool_name?: string;
	success?: boolean;
}
