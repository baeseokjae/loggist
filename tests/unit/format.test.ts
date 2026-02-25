import { formatDuration, formatPercent, formatTokens, formatUSD } from "@client/lib/format";
import { describe, expect, it } from "vitest";

describe("format utilities", () => {
	describe("formatUSD", () => {
		it("should format dollars", () => {
			expect(formatUSD(10.5)).toBe("$10.50");
			expect(formatUSD(0)).toBe("$0.00");
			expect(formatUSD(1234.56)).toBe("$1,234.56");
		});
	});

	describe("formatPercent", () => {
		it("should format percentage", () => {
			expect(formatPercent(85.6)).toBe("85.6%");
			expect(formatPercent(0)).toBe("0.0%");
			expect(formatPercent(100)).toBe("100.0%");
		});
	});

	describe("formatTokens", () => {
		it("should format token counts", () => {
			expect(formatTokens(500)).toBe("500");
			expect(formatTokens(1500)).toBe("1.5k");
			expect(formatTokens(1500000)).toBe("1.5M");
		});
	});

	describe("formatDuration", () => {
		it("should format seconds to human readable", () => {
			expect(formatDuration(90)).toBe("1m");
			expect(formatDuration(3661)).toBe("1h 1m");
			expect(formatDuration(7200)).toBe("2h 0m");
		});
	});
});
