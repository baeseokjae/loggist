import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api-client";

interface Budget {
	id: number;
	profile: string;
	period: string;
	amount_usd: number;
	alert_threshold_pct: number;
	notify_method: string;
	notify_url: string | null;
	created_at: string;
	updated_at: string;
}

interface BudgetAlert {
	id: number;
	budget_id: number;
	triggered_at: string;
	current_amount_usd: number;
	threshold_pct: number;
	notified: number;
	profile: string;
	period: string;
	amount_usd: number;
}

interface BudgetListResponse {
	data: Budget[];
}

interface BudgetResponse {
	data: Budget;
}

interface AlertListResponse {
	data: BudgetAlert[];
}

export function useBudgets() {
	return useQuery({
		queryKey: ["budgets"],
		queryFn: () => api.get<BudgetListResponse>("/budget"),
		select: (res) => res.data,
	});
}

export function useBudgetAlerts() {
	return useQuery({
		queryKey: ["budget-alerts"],
		queryFn: () => api.get<AlertListResponse>("/budget/alerts"),
		select: (res) => res.data,
		refetchInterval: 30_000,
	});
}

export function useCreateBudget() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (data: {
			profile?: string;
			period: string;
			amount_usd: number;
			alert_threshold_pct?: number;
		}) => api.post<BudgetResponse>("/budget", data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["budgets"] });
		},
	});
}

export function useUpdateBudget() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			id,
			...data
		}: { id: number; amount_usd?: number; alert_threshold_pct?: number }) =>
			api.put<BudgetResponse>(`/budget/${id}`, data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["budgets"] });
		},
	});
}

export function useDeleteBudget() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: number) => api.delete(`/budget/${id}`),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["budgets"] });
		},
	});
}

export function useCurrentSpend(profile = "all", range = "24h") {
	return useQuery({
		queryKey: ["current-spend", profile, range],
		queryFn: () =>
			api.get<{ data: { result: Array<{ value: [number, string] }> } }>(
				`/metrics/query?preset=cost&profile=${profile}&range=${range}`,
			),
		select: (res) => {
			const value = res?.data?.result?.[0]?.value?.[1];
			return value ? Number.parseFloat(value) : 0;
		},
		refetchInterval: 30_000,
	});
}
