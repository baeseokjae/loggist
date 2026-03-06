import {
	ALLOWED_METRICS,
	ALLOWED_PERIODS,
	ALLOWED_EVENT_TYPES,
	isValidProfile,
} from "../../shared/constants";

type AllowedMetric = (typeof ALLOWED_METRICS)[number];
type AllowedPeriod = (typeof ALLOWED_PERIODS)[number];

export function isAllowedMetric(m: string): m is AllowedMetric {
	return (ALLOWED_METRICS as readonly string[]).includes(m);
}

export function isAllowedProfile(p: string): boolean {
	return isValidProfile(p);
}

export function isAllowedPeriod(p: string): p is AllowedPeriod {
	return (ALLOWED_PERIODS as readonly string[]).includes(p);
}

export function buildPromQLQuery(params: {
	metric: string;
	profile?: string;
	range: string;
	aggregation?: "sum" | "avg" | "max" | "min";
	by?: string[];
	extraLabels?: Record<string, string>;
}): string {
	if (!isAllowedMetric(params.metric)) {
		throw new Error(`Metric not allowed: ${params.metric}`);
	}
	if (params.profile && !isAllowedProfile(params.profile)) {
		throw new Error(`Profile not allowed: ${params.profile}`);
	}
	if (!isAllowedPeriod(params.range)) {
		throw new Error(`Range not allowed: ${params.range}`);
	}

	const labels: string[] = [];
	if (params.profile && params.profile !== "all") {
		labels.push(`profile="${params.profile}"`);
	}
	if (params.extraLabels) {
		for (const [key, value] of Object.entries(params.extraLabels)) {
			labels.push(`${key}="${value}"`);
		}
	}

	const labelStr = labels.length > 0 ? `{${labels.join(",")}}` : "";
	const baseExpr = `increase(${params.metric}${labelStr}[${params.range}])`;

	const agg = params.aggregation || "sum";
	if (params.by && params.by.length > 0) {
		return `${agg} by (${params.by.join(",")}) (${baseExpr})`;
	}
	return `${agg}(${baseExpr})`;
}

export function sanitizeKeyword(keyword: string): string {
	return keyword.replace(/[\\"`|{}[\]()]/g, "").slice(0, 200);
}

// 메타데이터 값 sanitize: Loki 파이프라인 필터에서 안전하게 사용할 수 있는 값만 허용
function sanitizeMetadataValue(value: string): string {
	return value.replace(/["`\\|{}[\]()]/g, "").slice(0, 200);
}

export function buildLogQLQuery(params: {
	profile?: string;
	eventTypes?: string[];
	keyword?: string;
	sessionId?: string;
	model?: string[];
	toolName?: string[];
	success?: string;
}): string {
	const streamLabels: string[] = ['service_name="claude-code"'];
	if (params.profile && params.profile !== "all" && isAllowedProfile(params.profile)) {
		streamLabels.push(`profile="${params.profile}"`);
	}

	let query = `{${streamLabels.join(", ")}}`;

	if (params.eventTypes && params.eventTypes.length > 0) {
		const validTypes = params.eventTypes.filter((t) =>
			(ALLOWED_EVENT_TYPES as readonly string[]).includes(t),
		);
		if (validTypes.length > 0) {
			// event_name은 structured metadata이므로 파이프라인 필터 사용
			const eventFilter =
				validTypes.length === 1
					? `| event_name = "${validTypes[0]}"`
					: `| event_name =~ "${validTypes.join("|")}"`;
			query += ` ${eventFilter}`;
		}
	}

	// model 필터: 다중 선택 시 OR 조건으로 Loki regex 매칭 사용
	if (params.model && params.model.length > 0) {
		const sanitized = params.model.map(sanitizeMetadataValue).filter((v) => v.length > 0);
		if (sanitized.length > 0) {
			const modelFilter =
				sanitized.length === 1
					? `| model = "${sanitized[0]}"`
					: `| model =~ "${sanitized.join("|")}"`;
			query += ` ${modelFilter}`;
		}
	}

	// toolName 필터: 다중 선택 시 OR 조건으로 Loki regex 매칭 사용
	if (params.toolName && params.toolName.length > 0) {
		const sanitized = params.toolName.map(sanitizeMetadataValue).filter((v) => v.length > 0);
		if (sanitized.length > 0) {
			const toolFilter =
				sanitized.length === 1
					? `| tool_name = "${sanitized[0]}"`
					: `| tool_name =~ "${sanitized.join("|")}"`;
			query += ` ${toolFilter}`;
		}
	}

	// success 필터: "true" 또는 "false" 단일 값
	if (params.success === "true" || params.success === "false") {
		query += ` | success = "${params.success}"`;
	}

	if (params.sessionId) {
		const sanitized = params.sessionId.replace(/[^a-zA-Z0-9_\-]/g, "").slice(0, 200);
		if (sanitized.length > 0) {
			query += ` | session_id = \`${sanitized}\``;
		}
	}

	if (params.keyword) {
		const sanitized = sanitizeKeyword(params.keyword);
		if (sanitized.length > 0) {
			query += ` |= "${sanitized}"`;
		}
	}

	return query;
}
