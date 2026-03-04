import type { SessionEvent } from "../../shared/types/domain";
import type { ConversationGroup } from "./conversation-groups";
import type { ConversationTurn } from "./conversation";

export interface TelemetryAnnotation {
	telemetryIndex: number;
	cost: number;
	apiCalls: number;
	toolCalls: number;
	toolFailures: number;
	models: string[];
	inputTokens: number;
	outputTokens: number;
	cacheTokens: number;
	cacheEfficiency: number; // 0-100
	avgDurationMs: number | null;
	events: SessionEvent[];
}

export interface UnifiedTurn {
	index: number;
	conversation: ConversationGroup;
	telemetry: TelemetryAnnotation | null;
	matchQuality: "exact" | "index_only" | "unmatched";
}

export interface MatchResult {
	turns: UnifiedTurn[];
	stats: {
		totalConversationTurns: number;
		totalTelemetryTurns: number;
		matchedCount: number;
		unmatchedCount: number;
	};
}

// Convert a nanosecond timestamp string to milliseconds
export function nanoToMs(tsNano: string): number {
	try {
		return Math.floor(Number(BigInt(tsNano) / 1_000_000n));
	} catch {
		return 0;
	}
}

// Convert an ISO 8601 timestamp string to milliseconds
export function isoToMs(tsIso: string): number {
	try {
		return new Date(tsIso).getTime();
	} catch {
		return 0;
	}
}

const FIVE_MINUTES_MS = 300_000;

/**
 * Build a TelemetryAnnotation from a ConversationTurn by aggregating
 * its events (api_request, tool_result) into summary metrics.
 */
export function buildAnnotation(turn: ConversationTurn): TelemetryAnnotation {
	const events = turn.events;
	const { apiCalls, toolCalls, toolFailures, totalCost, models } = turn.summary;

	let inputTokens = 0;
	let outputTokens = 0;
	let cacheTokens = 0;
	let totalDurationMs = 0;
	let durationCount = 0;

	for (const e of events) {
		if (e.event_name === "api_request") {
			inputTokens += e.input_tokens ?? 0;
			outputTokens += e.output_tokens ?? 0;
			cacheTokens += e.cache_read_input_tokens ?? 0;
			if (e.duration_ms != null) {
				totalDurationMs += e.duration_ms;
				durationCount++;
			}
		}
	}

	const cacheEfficiency =
		inputTokens + cacheTokens > 0
			? (cacheTokens / (inputTokens + cacheTokens)) * 100
			: 0;

	const avgDurationMs =
		durationCount > 0 ? totalDurationMs / durationCount : null;

	return {
		telemetryIndex: turn.index,
		cost: totalCost,
		apiCalls,
		toolCalls,
		toolFailures,
		models,
		inputTokens,
		outputTokens,
		cacheTokens,
		cacheEfficiency,
		avgDurationMs,
		events,
	};
}

/**
 * Match JSONL ConversationGroups with telemetry ConversationTurns.
 *
 * The telemetry groupEventsIntoTurns() may produce a turn 0 that collects
 * pre-prompt events (prompt === null), while groupMessagesIntoTurns() starts
 * at the first real user message. When that offset is detected, telemetry
 * index is shifted by 1 when pairing with conversation groups.
 */
export function matchTurns(
	conversationGroups: ConversationGroup[],
	telemetryTurns: ConversationTurn[],
): MatchResult {
	if (conversationGroups.length === 0) {
		return {
			turns: [],
			stats: {
				totalConversationTurns: 0,
				totalTelemetryTurns: telemetryTurns.length,
				matchedCount: 0,
				unmatchedCount: 0,
			},
		};
	}

	// Detect index offset: telemetry turn 0 is a pre-prompt accumulator
	const offset =
		telemetryTurns.length > 0 &&
		telemetryTurns[0].prompt === null &&
		conversationGroups.length > 0 &&
		conversationGroups[0].userContent !== null
			? 1
			: 0;

	const turns: UnifiedTurn[] = [];
	let matchedCount = 0;

	for (const group of conversationGroups) {
		const telemetryIdx = group.index + offset;
		const telemetryTurn =
			telemetryIdx < telemetryTurns.length
				? telemetryTurns[telemetryIdx]
				: undefined;

		if (telemetryTurn === undefined) {
			turns.push({
				index: group.index,
				conversation: group,
				telemetry: null,
				matchQuality: "unmatched",
			});
			continue;
		}

		const annotation = buildAnnotation(telemetryTurn);

		// Validate by timestamp proximity
		const convMs = isoToMs(group.timestamp);
		const telemMs = nanoToMs(telemetryTurn.promptTimestamp);
		const diff = Math.abs(convMs - telemMs);
		const matchQuality: UnifiedTurn["matchQuality"] =
			diff <= FIVE_MINUTES_MS ? "exact" : "index_only";

		matchedCount++;
		turns.push({
			index: group.index,
			conversation: group,
			telemetry: annotation,
			matchQuality,
		});
	}

	return {
		turns,
		stats: {
			totalConversationTurns: conversationGroups.length,
			totalTelemetryTurns: telemetryTurns.length,
			matchedCount,
			unmatchedCount: conversationGroups.length - matchedCount,
		},
	};
}
