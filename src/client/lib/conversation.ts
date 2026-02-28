import type { SessionEvent } from "../../shared/types/domain";

export interface TurnSummary {
	apiCalls: number;
	toolCalls: number;
	toolFailures: number;
	totalCost: number;
	models: string[];
}

export interface ConversationTurn {
	index: number;
	prompt: string | null;
	promptTimestamp: string;
	events: SessionEvent[];
	summary: TurnSummary;
}

function computeTurnSummary(events: SessionEvent[]): TurnSummary {
	const models = new Set<string>();
	let apiCalls = 0;
	let toolCalls = 0;
	let toolFailures = 0;
	let totalCost = 0;

	for (const e of events) {
		if (e.event_name === "api_request") {
			apiCalls++;
			totalCost += e.cost_usd || 0;
			if (e.model) models.add(e.model);
		}
		if (e.event_name === "tool_result") {
			toolCalls++;
			if (e.success === false) toolFailures++;
		}
	}

	return { apiCalls, toolCalls, toolFailures, totalCost, models: [...models] };
}

export function groupEventsIntoTurns(events: SessionEvent[]): ConversationTurn[] {
	const turns: ConversationTurn[] = [];
	let currentEvents: SessionEvent[] = [];
	let currentPrompt: string | null = null;
	let currentTimestamp = events[0]?.timestamp || "";
	let turnIndex = 0;

	for (const event of events) {
		if (event.event_name === "user_prompt") {
			// Flush previous turn if it has events
			if (currentEvents.length > 0) {
				turns.push({
					index: turnIndex++,
					prompt: currentPrompt,
					promptTimestamp: currentTimestamp,
					events: currentEvents,
					summary: computeTurnSummary(currentEvents),
				});
			}
			// Start new turn
			currentPrompt = event.prompt || null;
			currentTimestamp = event.timestamp;
			currentEvents = [event];
		} else {
			currentEvents.push(event);
		}
	}

	// Flush last turn
	if (currentEvents.length > 0) {
		turns.push({
			index: turnIndex,
			prompt: currentPrompt,
			promptTimestamp: currentTimestamp,
			events: currentEvents,
			summary: computeTurnSummary(currentEvents),
		});
	}

	return turns;
}
