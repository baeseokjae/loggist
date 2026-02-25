import { parseTailResponse } from "@server/realtime/loki-tail";
import { describe, expect, it } from "vitest";

describe("loki-tail", () => {
	describe("parseTailResponse", () => {
		it("should parse a valid Loki tail response", () => {
			const response = {
				streams: [
					{
						stream: { service_name: "claude-code" },
						values: [
							[
								"1700000000000000000",
								JSON.stringify({ event_name: "api_request", model: "claude-3" }),
							],
						],
					},
				],
			};

			const result = parseTailResponse(response);

			expect(result).toHaveLength(1);
			expect(result[0].timestamp).toBe("1700000000000000000");
			expect(result[0].event_name).toBe("api_request");
			expect(result[0].model).toBe("claude-3");
		});

		it("should return empty array for missing streams", () => {
			const response = { streams: [] };
			expect(parseTailResponse(response)).toEqual([]);
		});

		it("should handle non-JSON log lines gracefully", () => {
			const response = {
				streams: [
					{
						stream: { service_name: "claude-code" },
						values: [["1700000000000000001", "this is not json"]],
					},
				],
			};

			const result = parseTailResponse(response);

			expect(result).toHaveLength(1);
			expect(result[0].timestamp).toBe("1700000000000000001");
			expect(result[0].raw).toBe("this is not json");
		});

		it("should parse multiple streams and values", () => {
			const response = {
				streams: [
					{
						stream: { service_name: "claude-code" },
						values: [
							["1700000000000000000", JSON.stringify({ event_name: "api_request" })],
							["1700000000000000001", JSON.stringify({ event_name: "tool_result" })],
						],
					},
					{
						stream: { service_name: "claude-code", profile: "claude-b" },
						values: [["1700000000000000002", JSON.stringify({ event_name: "user_prompt" })]],
					},
				],
			};

			const result = parseTailResponse(response);

			expect(result).toHaveLength(3);
			expect(result[0].event_name).toBe("api_request");
			expect(result[1].event_name).toBe("tool_result");
			expect(result[2].event_name).toBe("user_prompt");
		});

		it("should include timestamp in each parsed event", () => {
			const ts = "9876543210000000000";
			const response = {
				streams: [
					{
						stream: {},
						values: [[ts, JSON.stringify({ event_name: "api_error" })]],
					},
				],
			};

			const result = parseTailResponse(response);
			expect(result[0].timestamp).toBe(ts);
		});
	});
});
