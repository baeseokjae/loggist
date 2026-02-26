// Signal severity styling
export const SEVERITY_STYLES: Record<string, { bar: string; badge: string; card: string }> = {
	critical: {
		bar: "bg-red-500",
		badge: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400",
		card: "border-red-200 dark:border-red-900",
	},
	warning: {
		bar: "bg-amber-500",
		badge: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
		card: "border-amber-200 dark:border-amber-900",
	},
	info: {
		bar: "bg-blue-500",
		badge: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400",
		card: "border-blue-200 dark:border-blue-900",
	},
};

export const SEVERITY_LABELS: Record<string, string> = {
	critical: "위험",
	warning: "경고",
	info: "정보",
};

// Signal rule labels (Korean)
export const RULE_LABELS: Record<string, string> = {
	cost_spike: "비용 급증",
	api_error_burst: "API 오류 급증",
	data_collection_stopped: "데이터 수집 중단",
	cache_efficiency_drop: "캐시 효율 저하",
	budget_exceeded: "예산 초과",
};

// Event type display configuration
export const EVENT_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
	api_request: { label: "API 요청", color: "bg-chart-1" },
	api_error: { label: "API 에러", color: "bg-destructive" },
	tool_result: { label: "도구 결과", color: "bg-chart-2" },
	tool_decision: { label: "도구 결정", color: "bg-chart-4" },
	user_prompt: { label: "사용자 프롬프트", color: "bg-chart-5" },
};
