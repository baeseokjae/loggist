import {
	buildLogQLQuery,
	buildPromQLQuery,
	isAllowedMetric,
	isAllowedPeriod,
	isAllowedProfile,
	sanitizeKeyword,
} from "@server/services/query-builder";
import { describe, expect, it } from "vitest";

describe("query-builder", () => {
	describe("buildPromQLQuery", () => {
		it("should build basic query", () => {
			const result = buildPromQLQuery({
				metric: "claude_code_cost_usage_USD_total",
				range: "24h",
			});
			expect(result).toBe("sum(increase(claude_code_cost_usage_USD_total[24h]))");
		});

		it("should include profile filter", () => {
			const result = buildPromQLQuery({
				metric: "claude_code_cost_usage_USD_total",
				profile: "claude-b",
				range: "1h",
			});
			expect(result).toBe(
				'sum(increase(claude_code_cost_usage_USD_total{profile="claude-b"}[1h]))',
			);
		});

		it("should skip profile filter for 'all'", () => {
			const result = buildPromQLQuery({
				metric: "claude_code_cost_usage_USD_total",
				profile: "all",
				range: "24h",
			});
			expect(result).toBe("sum(increase(claude_code_cost_usage_USD_total[24h]))");
		});

		it("should add by clause", () => {
			const result = buildPromQLQuery({
				metric: "claude_code_cost_usage_USD_total",
				range: "5m",
				aggregation: "sum",
				by: ["model"],
			});
			expect(result).toBe("sum by (model) (increase(claude_code_cost_usage_USD_total[5m]))");
		});

		it("should reject unknown metrics", () => {
			expect(() => buildPromQLQuery({ metric: "evil_metric", range: "1h" })).toThrow(
				"Metric not allowed",
			);
		});

		it("should reject unknown profiles", () => {
			expect(() =>
				buildPromQLQuery({
					metric: "claude_code_cost_usage_USD_total",
					profile: "hacker",
					range: "1h",
				}),
			).toThrow("Profile not allowed");
		});

		it("should reject unknown periods", () => {
			expect(() =>
				buildPromQLQuery({
					metric: "claude_code_cost_usage_USD_total",
					range: "99y",
				}),
			).toThrow("Range not allowed");
		});
	});

	describe("buildLogQLQuery", () => {
		it("should build basic query", () => {
			const result = buildLogQLQuery({});
			expect(result).toBe('{service_name="claude-code"}');
		});

		it("should add profile filter", () => {
			const result = buildLogQLQuery({ profile: "claude-b" });
			expect(result).toBe('{service_name="claude-code", profile="claude-b"}');
		});

		it("should filter event types via pipeline", () => {
			const result = buildLogQLQuery({ eventTypes: ["api_request", "api_error"] });
			expect(result).toContain('| event_name =~ "api_request|api_error"');
		});

		it("should filter single event type via pipeline", () => {
			const result = buildLogQLQuery({ eventTypes: ["api_request"] });
			expect(result).toContain('| event_name = "api_request"');
		});

		it("should filter invalid event types", () => {
			const result = buildLogQLQuery({ eventTypes: ["api_request", "evil_type"] });
			expect(result).toContain('| event_name = "api_request"');
			expect(result).not.toContain("evil_type");
		});

		it("should add keyword filter", () => {
			const result = buildLogQLQuery({ keyword: "error message" });
			expect(result).toContain('|= "error message"');
		});

		it("should sanitize malicious keywords", () => {
			const result = buildLogQLQuery({ keyword: '}" | evil_pipeline' });
			// The raw malicious input should not appear verbatim in the query
			expect(result).not.toContain('}" | evil_pipeline');
			// The injected pipe and brace characters should be stripped from the keyword portion
			const keywordMatch = result.match(/\|= "([^"]*)"/);
			if (keywordMatch) {
				expect(keywordMatch[1]).not.toContain("|");
				expect(keywordMatch[1]).not.toContain("}");
			}
		});
	});

	describe("sanitizeKeyword", () => {
		it("should remove special characters", () => {
			expect(sanitizeKeyword('test" | hack')).toBe("test  hack");
		});

		it("should truncate long strings", () => {
			const long = "a".repeat(300);
			expect(sanitizeKeyword(long)).toHaveLength(200);
		});
	});

	describe("validators", () => {
		it("should validate allowed metrics", () => {
			expect(isAllowedMetric("claude_code_cost_usage_USD_total")).toBe(true);
			expect(isAllowedMetric("evil_metric")).toBe(false);
		});

		it("should validate allowed profiles", () => {
			expect(isAllowedProfile("all")).toBe(true);
			expect(isAllowedProfile("claude-b")).toBe(true);
			expect(isAllowedProfile("hacker")).toBe(false);
		});

		it("should validate allowed periods", () => {
			expect(isAllowedPeriod("1h")).toBe(true);
			expect(isAllowedPeriod("99y")).toBe(false);
		});
	});
});
