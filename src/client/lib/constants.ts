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
};

// Unified event type display configuration
export const EVENT_TYPE_CONFIG: Record<
	string,
	{
		label: string;
		color: string;
		badgeClass: string;
		borderClass: string;
		chartColor: string;
	}
> = {
	api_request: {
		label: "API 요청",
		color: "bg-chart-1",
		badgeClass: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
		borderClass: "border-l-blue-500",
		chartColor: "#5794F2",
	},
	api_error: {
		label: "API 오류",
		color: "bg-destructive",
		badgeClass: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
		borderClass: "border-l-red-500",
		chartColor: "#F2495C",
	},
	tool_result: {
		label: "도구 결과",
		color: "bg-chart-2",
		badgeClass: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
		borderClass: "border-l-green-500",
		chartColor: "#73BF69",
	},
	tool_decision: {
		label: "도구 결정",
		color: "bg-chart-4",
		badgeClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
		borderClass: "border-l-amber-500",
		chartColor: "#FF9830",
	},
	user_prompt: {
		label: "사용자 입력",
		color: "bg-chart-5",
		badgeClass: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
		borderClass: "border-l-purple-500",
		chartColor: "#B877D9",
	},
};

export const EVENT_TYPE_NAMES = Object.keys(EVENT_TYPE_CONFIG);
