import {
	ALLOWED_METRICS,
	ALLOWED_PROFILES,
	ALLOWED_PERIODS,
	ALLOWED_EVENT_TYPES,
} from "../../shared/constants";

type AllowedMetric = (typeof ALLOWED_METRICS)[number];
type AllowedProfile = (typeof ALLOWED_PROFILES)[number];
type AllowedPeriod = (typeof ALLOWED_PERIODS)[number];

export function isAllowedMetric(m: string): m is AllowedMetric {
	return (ALLOWED_METRICS as readonly string[]).includes(m);
}

export function isAllowedProfile(p: string): p is AllowedProfile {
	return (ALLOWED_PROFILES as readonly string[]).includes(p);
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

export function buildLogQLQuery(params: {
	profile?: string;
	eventTypes?: string[];
	keyword?: string;
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
			// event_name is structured metadata, filter via pipeline (not stream selector)
			const eventFilter =
				validTypes.length === 1
					? `| event_name = "${validTypes[0]}"`
					: `| event_name =~ "${validTypes.join("|")}"`;
			query += ` ${eventFilter}`;
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
