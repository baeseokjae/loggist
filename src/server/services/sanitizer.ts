// Filter patterns for sensitive data
const SENSITIVE_PATTERNS = [
	/(?:api[_-]?key|apikey|secret|password|token)\s*[:=]\s*['"]?[^\s'"]+/gi,
	/(?:authorization)\s*[:=]\s*['"]?.+/gi, // authorization header value (rest of line)
	/bearer\s+[^\s'"]+/gi, // Bearer token values
	/sk-[a-zA-Z0-9]{20,}/g, // API keys like sk-...
	/ghp_[a-zA-Z0-9]{36}/g, // GitHub PATs
	/eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g, // JWTs
];

export function sanitizeLogContent(content: string): string {
	let result = content;
	for (const pattern of SENSITIVE_PATTERNS) {
		result = result.replace(pattern, "[REDACTED]");
	}
	return result;
}

export function sanitizeEvent(event: Record<string, unknown>): Record<string, unknown> {
	const sanitized = { ...event };
	// sanitize string fields
	for (const [key, value] of Object.entries(sanitized)) {
		if (typeof value === "string") {
			sanitized[key] = sanitizeLogContent(value);
		}
	}
	return sanitized;
}
