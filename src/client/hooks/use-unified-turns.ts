import { useMemo } from "react";
import type { SessionEvent } from "../../shared/types/domain";
import type { ConversationData } from "../../shared/types/conversation";
import { useConversation } from "./use-conversation";
import { groupEventsIntoTurns } from "../lib/conversation";
import { groupMessagesIntoTurns } from "../lib/conversation-groups";
import { matchTurns, type MatchResult } from "../lib/turn-matcher";

export function useUnifiedTurns({
	sessionId,
	events,
}: {
	sessionId: string;
	events: SessionEvent[];
}): {
	result: MatchResult | null;
	isLoading: boolean;
	conversation: ConversationData | undefined;
} {
	const { data: conversation, isLoading } = useConversation(sessionId);

	const telemetryTurns = useMemo(
		() => groupEventsIntoTurns(events),
		[events],
	);

	const result = useMemo<MatchResult | null>(() => {
		if (!conversation) return null;

		const conversationGroups = groupMessagesIntoTurns(conversation.messages);
		return matchTurns(conversationGroups, telemetryTurns);
	}, [conversation, telemetryTurns]);

	return { result, isLoading, conversation };
}
