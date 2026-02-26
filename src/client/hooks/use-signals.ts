import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Signal, SignalRule } from "../../shared/types/domain";
import { api } from "../lib/api-client";

interface SignalsResponse {
	data: Signal[];
	total: number;
	limit: number;
	offset: number;
}

interface SignalRulesResponse {
	rules: SignalRule[];
}

export function useSignals(params: {
	limit?: number;
	offset?: number;
	ruleId?: string;
	acknowledged?: string;
} = {}) {
	const { limit = 50, offset = 0, ruleId, acknowledged } = params;

	const searchParams = new URLSearchParams();
	searchParams.set("limit", String(limit));
	searchParams.set("offset", String(offset));
	if (ruleId && ruleId !== "all") searchParams.set("ruleId", ruleId);
	if (acknowledged && acknowledged !== "all") searchParams.set("acknowledged", acknowledged);

	return useQuery({
		queryKey: ["signals", limit, offset, ruleId, acknowledged],
		queryFn: () => api.get<SignalsResponse>(`/signals?${searchParams.toString()}`),
		refetchInterval: 30_000,
	});
}

export function useSignalRules() {
	return useQuery({
		queryKey: ["signal-rules"],
		queryFn: () => api.get<SignalRulesResponse>("/signals/rules"),
		select: (res) => res.rules,
		staleTime: 5 * 60 * 1000,
	});
}

export function useAcknowledgeSignal() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: number) => api.post(`/signals/${id}/acknowledge`, {}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["signals"] });
		},
	});
}

export function useDeleteOldSignals() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: () => api.delete("/signals/old"),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["signals"] });
		},
	});
}
