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

/** Normalize text for comparison: lowercase + collapse whitespace + trim */
function normalize(text: string): string {
	return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Check if two texts match after normalization. For texts ≥20 chars, allow prefix matching (handles 2000-char truncation). */
function contentMatches(a: string, b: string): boolean {
	const na = normalize(a);
	const nb = normalize(b);
	if (na === nb) return true;
	if (na.length >= 20 && nb.length >= 20) {
		return na.startsWith(nb) || nb.startsWith(na);
	}
	return false;
}

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

	const usedTelemetry = new Set<number>();
	const matched = new Map<number, { telemetryIdx: number; quality: UnifiedTurn["matchQuality"] }>();

	// Phase 1: Content matching
	for (let gi = 0; gi < conversationGroups.length; gi++) {
		const group = conversationGroups[gi];
		if (group.userContent == null) continue;

		let bestIdx = -1;
		let bestDiff = Infinity;

		const convMs = isoToMs(group.timestamp);

		for (let ti = 0; ti < telemetryTurns.length; ti++) {
			if (usedTelemetry.has(ti)) continue;
			const turn = telemetryTurns[ti];
			if (turn.prompt == null) continue;

			if (contentMatches(group.userContent, turn.prompt)) {
				const diff = Math.abs(convMs - nanoToMs(turn.promptTimestamp));
				if (diff < bestDiff) {
					bestDiff = diff;
					bestIdx = ti;
				}
			}
		}

		if (bestIdx >= 0) {
			usedTelemetry.add(bestIdx);
			const quality: UnifiedTurn["matchQuality"] =
				bestDiff <= FIVE_MINUTES_MS ? "exact" : "index_only";
			matched.set(gi, { telemetryIdx: bestIdx, quality });
		}
	}

	// Phase 2: Timestamp fallback for unmatched groups
	for (let gi = 0; gi < conversationGroups.length; gi++) {
		if (matched.has(gi)) continue;

		const group = conversationGroups[gi];
		const convMs = isoToMs(group.timestamp);

		let bestIdx = -1;
		let bestDiff = Infinity;

		for (let ti = 0; ti < telemetryTurns.length; ti++) {
			if (usedTelemetry.has(ti)) continue;
			const diff = Math.abs(convMs - nanoToMs(telemetryTurns[ti].promptTimestamp));
			if (diff < bestDiff && diff <= FIVE_MINUTES_MS) {
				bestDiff = diff;
				bestIdx = ti;
			}
		}

		if (bestIdx >= 0) {
			usedTelemetry.add(bestIdx);
			matched.set(gi, { telemetryIdx: bestIdx, quality: "index_only" });
		}
	}

	// Build result
	const turns: UnifiedTurn[] = [];
	let matchedCount = 0;

	for (let gi = 0; gi < conversationGroups.length; gi++) {
		const group = conversationGroups[gi];
		const match = matched.get(gi);

		if (match) {
			matchedCount++;
			turns.push({
				index: group.index,
				conversation: group,
				telemetry: buildAnnotation(telemetryTurns[match.telemetryIdx]),
				matchQuality: match.quality,
			});
		} else {
			turns.push({
				index: group.index,
				conversation: group,
				telemetry: null,
				matchQuality: "unmatched",
			});
		}
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
