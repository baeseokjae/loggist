import { sanitizeEvent, sanitizeLogContent } from "@server/services/sanitizer";
import { describe, expect, it } from "vitest";

describe("sanitizer", () => {
	describe("sanitizeLogContent", () => {
		it("should redact sk- API keys", () => {
			const input = "using key sk-abcdefghij1234567890extra";
			const result = sanitizeLogContent(input);
			expect(result).not.toContain("sk-abcdefghij1234567890extra");
			expect(result).toContain("[REDACTED]");
		});

		it("should redact GitHub PATs (ghp_)", () => {
			const input = `token ghp_${"a".repeat(36)}`;
			const result = sanitizeLogContent(input);
			expect(result).not.toContain("ghp_");
			expect(result).toContain("[REDACTED]");
		});

		it("should redact JWTs (eyJ...)", () => {
			const jwt =
				"eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
			const result = sanitizeLogContent(jwt);
			expect(result).not.toContain("eyJhbGciOiJIUzI1NiJ9");
			expect(result).toContain("[REDACTED]");
		});

		it("should redact password= patterns", () => {
			const input = "password=supersecret123";
			const result = sanitizeLogContent(input);
			expect(result).not.toContain("supersecret123");
			expect(result).toContain("[REDACTED]");
		});

		it("should redact api_key: patterns", () => {
			const input = 'api_key: "my-api-key-value"';
			const result = sanitizeLogContent(input);
			expect(result).not.toContain("my-api-key-value");
			expect(result).toContain("[REDACTED]");
		});

		it("should redact authorization: bearer patterns", () => {
			const input = "authorization: Bearer token123abc";
			const result = sanitizeLogContent(input);
			expect(result).not.toContain("token123abc");
			expect(result).toContain("[REDACTED]");
		});

		it("should not modify normal text", () => {
			const input = "Hello world, this is a normal log message.";
			const result = sanitizeLogContent(input);
			expect(result).toBe(input);
		});

		it("should not modify empty string", () => {
			expect(sanitizeLogContent("")).toBe("");
		});
	});

	describe("sanitizeEvent", () => {
		it("should sanitize string fields in an event object", () => {
			const event = {
				timestamp: "1234567890",
				message: "token sk-abcdefghijklmnopqrstu in use",
				model: "claude-3",
			};
			const result = sanitizeEvent(event);
			expect(result.message).toContain("[REDACTED]");
			expect(result.message).not.toContain("sk-abcdefghijklmnopqrstu");
			expect(result.model).toBe("claude-3");
			expect(result.timestamp).toBe("1234567890");
		});

		it("should not mutate the original event", () => {
			const event = { message: "secret=abc123", other: 42 };
			sanitizeEvent(event);
			expect(event.message).toBe("secret=abc123");
		});

		it("should leave non-string fields unchanged", () => {
			const event = { count: 5, active: true, nested: { key: "value" } };
			const result = sanitizeEvent(event);
			expect(result.count).toBe(5);
			expect(result.active).toBe(true);
			expect(result.nested).toEqual({ key: "value" });
		});

		it("should sanitize multiple string fields", () => {
			const event = {
				a: "api_key=abc123",
				b: "normal text",
				c: `token ghp_${"x".repeat(36)}`,
			};
			const result = sanitizeEvent(event);
			expect(result.a).toContain("[REDACTED]");
			expect(result.b).toBe("normal text");
			expect(result.c).toContain("[REDACTED]");
		});
	});
});
