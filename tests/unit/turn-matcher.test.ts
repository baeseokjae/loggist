import { describe, expect, it } from "vitest";
import {
	matchTurns,
	buildAnnotation,
	nanoToMs,
	isoToMs,
} from "@client/lib/turn-matcher";
import type { ConversationGroup } from "@client/lib/conversation-groups";
import type { ConversationTurn } from "@client/lib/conversation";
import type { SessionEvent } from "@/shared/types/domain";

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

function makeIsoTimestamp(offsetMs = 0): string {
	return new Date(1_700_000_000_000 + offsetMs).toISOString();
}

/** Convert a JS Date/ms value to a nanosecond string matching the ISO timestamp above */
function msToNano(ms: number): string {
	return String(BigInt(ms) * 1_000_000n);
}

function makeConversationGroup(
	index: number,
	overrides: Partial<ConversationGroup> = {},
): ConversationGroup {
	return {
		index,
		userContent: `user message ${index}`,
		assistantText: `assistant response ${index}`,
		thinkingText: null,
		toolCalls: [],
		orderedBlocks: [],
		model: "claude-sonnet-4",
		timestamp: makeIsoTimestamp(index * 1000),
		...overrides,
	};
}

function makeApiRequestEvent(
	overrides: Partial<SessionEvent> = {},
): SessionEvent {
	return {
		timestamp: msToNano(1_700_000_000_000),
		event_name: "api_request",
		model: "claude-sonnet-4",
		cost_usd: 0.001,
		input_tokens: 100,
		output_tokens: 50,
		cache_read_input_tokens: 0,
		duration_ms: 500,
		...overrides,
	};
}

function makeToolResultEvent(
	overrides: Partial<SessionEvent> = {},
): SessionEvent {
	return {
		timestamp: msToNano(1_700_000_000_000),
		event_name: "tool_result",
		tool_name: "Bash",
		success: true,
		...overrides,
	};
}

function makeConversationTurn(
	index: number,
	overrides: Partial<ConversationTurn> = {},
): ConversationTurn {
	const baseMs = 1_700_000_000_000 + index * 1000;
	const events: SessionEvent[] = [makeApiRequestEvent()];

	return {
		index,
		prompt: `user prompt ${index}`,
		promptTimestamp: msToNano(baseMs),
		events,
		summary: {
			apiCalls: 1,
			toolCalls: 0,
			toolFailures: 0,
			totalCost: 0.001,
			models: ["claude-sonnet-4"],
		},
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("matchTurns", () => {
	it("scenario 1: equal turn counts (3:3) with matching timestamps -> all exact", () => {
		const groups = [0, 1, 2].map((i) => makeConversationGroup(i));
		const telemetry = [0, 1, 2].map((i) => makeConversationTurn(i));

		const result = matchTurns(groups, telemetry);

		expect(result.turns).toHaveLength(3);
		expect(result.stats.matchedCount).toBe(3);
		expect(result.stats.unmatchedCount).toBe(0);
		for (const turn of result.turns) {
			expect(turn.matchQuality).toBe("exact");
			expect(turn.telemetry).not.toBeNull();
		}
	});

	it("scenario 2: 5 JSONL turns, 3 telemetry turns -> 0-2 matched, 3-4 unmatched", () => {
		const groups = [0, 1, 2, 3, 4].map((i) => makeConversationGroup(i));
		const telemetry = [0, 1, 2].map((i) => makeConversationTurn(i));

		const result = matchTurns(groups, telemetry);

		expect(result.turns).toHaveLength(5);
		expect(result.stats.matchedCount).toBe(3);
		expect(result.stats.unmatchedCount).toBe(2);

		for (let i = 0; i < 3; i++) {
			expect(result.turns[i].telemetry).not.toBeNull();
			expect(result.turns[i].matchQuality).toBe("exact");
		}
		for (let i = 3; i < 5; i++) {
			expect(result.turns[i].telemetry).toBeNull();
			expect(result.turns[i].matchQuality).toBe("unmatched");
		}
	});

	it("scenario 3: 5 telemetry turns, 3 JSONL turns -> only 0-2 matched, excess telemetry ignored", () => {
		const groups = [0, 1, 2].map((i) => makeConversationGroup(i));
		const telemetry = [0, 1, 2, 3, 4].map((i) => makeConversationTurn(i));

		const result = matchTurns(groups, telemetry);

		expect(result.turns).toHaveLength(3);
		expect(result.stats.matchedCount).toBe(3);
		for (const turn of result.turns) {
			expect(turn.telemetry).not.toBeNull();
		}
	});

	it("scenario 4: timestamp diff > 5 minutes -> index_only", () => {
		const sixMinutesMs = 6 * 60 * 1000;
		// JSONL group timestamp is 0ms base
		const group = makeConversationGroup(0, {
			timestamp: new Date(1_700_000_000_000).toISOString(),
		});
		// Telemetry turn timestamp is 6 minutes later
		const telemetryTurn = makeConversationTurn(0, {
			promptTimestamp: msToNano(1_700_000_000_000 + sixMinutesMs),
		});

		const result = matchTurns([group], [telemetryTurn]);

		expect(result.turns).toHaveLength(1);
		expect(result.turns[0].matchQuality).toBe("index_only");
		expect(result.turns[0].telemetry).not.toBeNull();
	});

	it("scenario 5: empty JSONL, non-empty telemetry -> empty turns result", () => {
		const telemetry = [0, 1, 2].map((i) => makeConversationTurn(i));

		const result = matchTurns([], telemetry);

		expect(result.turns).toHaveLength(0);
		expect(result.stats.totalConversationTurns).toBe(0);
		expect(result.stats.totalTelemetryTurns).toBe(3);
		expect(result.stats.matchedCount).toBe(0);
	});

	it("scenario 6: non-empty JSONL, empty telemetry -> all turns have telemetry: null", () => {
		const groups = [0, 1, 2].map((i) => makeConversationGroup(i));

		const result = matchTurns(groups, []);

		expect(result.turns).toHaveLength(3);
		expect(result.stats.matchedCount).toBe(0);
		expect(result.stats.unmatchedCount).toBe(3);
		for (const turn of result.turns) {
			expect(turn.telemetry).toBeNull();
			expect(turn.matchQuality).toBe("unmatched");
		}
	});

	it("scenario 7: both empty arrays -> empty result", () => {
		const result = matchTurns([], []);

		expect(result.turns).toHaveLength(0);
		expect(result.stats.matchedCount).toBe(0);
		expect(result.stats.unmatchedCount).toBe(0);
	});

	it("scenario 8: index offset correction when telemetry turn 0 has prompt === null", () => {
		// Telemetry turn 0 is a pre-prompt accumulator (prompt === null)
		const preTurn = makeConversationTurn(0, { prompt: null });
		// Telemetry turns 1 and 2 are real turns
		const realTurn1 = makeConversationTurn(1);
		const realTurn2 = makeConversationTurn(2);

		// JSONL groups start from real user content
		const group0 = makeConversationGroup(0, { userContent: "real question 0" });
		const group1 = makeConversationGroup(1, { userContent: "real question 1" });

		const result = matchTurns([group0, group1], [preTurn, realTurn1, realTurn2]);

		// With offset=1: group0 <-> telemetryTurn[1], group1 <-> telemetryTurn[2]
		expect(result.turns).toHaveLength(2);
		expect(result.turns[0].telemetry?.telemetryIndex).toBe(1);
		expect(result.turns[1].telemetry?.telemetryIndex).toBe(2);
		expect(result.stats.matchedCount).toBe(2);
	});

	it("scenario 9: TelemetryAnnotation aggregation accuracy (cost, apiCalls, tokens)", () => {
		const events: SessionEvent[] = [
			makeApiRequestEvent({
				cost_usd: 0.002,
				input_tokens: 200,
				output_tokens: 80,
				cache_read_input_tokens: 50,
				duration_ms: 300,
			}),
			makeApiRequestEvent({
				cost_usd: 0.003,
				input_tokens: 300,
				output_tokens: 120,
				cache_read_input_tokens: 100,
				duration_ms: 700,
			}),
			makeToolResultEvent({ success: true }),
			makeToolResultEvent({ success: false }),
		];

		const turn = makeConversationTurn(0, {
			events,
			summary: {
				apiCalls: 2,
				toolCalls: 2,
				toolFailures: 1,
				totalCost: 0.005,
				models: ["claude-sonnet-4"],
			},
		});

		const annotation = buildAnnotation(turn);

		expect(annotation.cost).toBeCloseTo(0.005);
		expect(annotation.apiCalls).toBe(2);
		expect(annotation.toolCalls).toBe(2);
		expect(annotation.toolFailures).toBe(1);
		expect(annotation.inputTokens).toBe(500);
		expect(annotation.outputTokens).toBe(200);
		expect(annotation.cacheTokens).toBe(150);
		// avgDurationMs = (300 + 700) / 2 = 500
		expect(annotation.avgDurationMs).toBeCloseTo(500);
	});

	it("scenario 10: cache efficiency calculation accuracy", () => {
		// cacheEfficiency = cache / (input + cache) * 100
		// input=300, cache=100 -> 100/400 * 100 = 25%
		const events: SessionEvent[] = [
			makeApiRequestEvent({
				input_tokens: 300,
				output_tokens: 50,
				cache_read_input_tokens: 100,
			}),
		];

		const turn = makeConversationTurn(0, { events });
		const annotation = buildAnnotation(turn);

		expect(annotation.inputTokens).toBe(300);
		expect(annotation.cacheTokens).toBe(100);
		expect(annotation.cacheEfficiency).toBeCloseTo(25, 5);
	});
});

describe("nanoToMs / isoToMs helpers", () => {
	it("nanoToMs converts nanosecond string to milliseconds", () => {
		const ms = 1_700_000_000_000;
		const nano = msToNano(ms);
		expect(nanoToMs(nano)).toBe(ms);
	});

	it("isoToMs converts ISO 8601 string to milliseconds", () => {
		const ms = 1_700_000_000_000;
		const iso = new Date(ms).toISOString();
		expect(isoToMs(iso)).toBe(ms);
	});

	it("nanoToMs returns 0 for invalid input", () => {
		expect(nanoToMs("not-a-number")).toBe(0);
	});
});
