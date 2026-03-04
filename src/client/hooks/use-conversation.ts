import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api-client";
import type { ConversationData } from "../../shared/types/conversation";

export function useConversation(sessionId: string | null) {
	return useQuery({
		queryKey: ["conversation", sessionId],
		queryFn: () =>
			api.get<{ data: ConversationData }>(
				`/sessions/${sessionId}/conversation`,
			),
		select: (res) => res.data,
		enabled: !!sessionId,
		staleTime: 10 * 60 * 1000,
		retry: false,
	});
}
