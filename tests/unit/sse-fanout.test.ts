import { getSSEConnectionCount } from "@server/realtime/sse-fanout";
import { describe, expect, it } from "vitest";

describe("sse-fanout", () => {
	describe("getSSEConnectionCount", () => {
		it("should return 0 initially", () => {
			expect(getSSEConnectionCount()).toBe(0);
		});
	});
});
