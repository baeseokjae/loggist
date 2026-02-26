import { useQuery } from "@tanstack/react-query";
import { parseLokiResult } from "../lib/loki-parser";
import { api } from "../lib/api-client";

export type { ParsedLogEntry as RawLogEntry } from "../lib/loki-parser";

export interface LogsQueryParams {
	profile?: string;
	eventTypes?: string[];
	keyword?: string;
	limit?: number;
}

export function useLogsQuery(params: LogsQueryParams) {
	const { profile = "all", eventTypes = [], keyword = "", limit = 200 } = params;

	const queryParams = new URLSearchParams();
	if (keyword) queryParams.set("keyword", keyword);
	if (profile !== "all") queryParams.set("profile", profile);
	if (eventTypes.length > 0) queryParams.set("eventTypes", eventTypes.join(","));
	queryParams.set("limit", String(limit));

	return useQuery({
		queryKey: ["logs-query", profile, eventTypes, keyword, limit],
		queryFn: () => api.get<unknown>(`/logs/query?${queryParams.toString()}`),
		select: parseLokiResult,
	});
}

export interface LogsRangeQueryParams extends LogsQueryParams {
	start: string;
	end: string;
}

export function useLogsRangeQuery(params: LogsRangeQueryParams) {
	const { profile = "all", eventTypes = [], keyword = "", limit = 200, start, end } = params;

	const queryParams = new URLSearchParams();
	if (keyword) queryParams.set("keyword", keyword);
	if (profile !== "all") queryParams.set("profile", profile);
	if (eventTypes.length > 0) queryParams.set("eventTypes", eventTypes.join(","));
	queryParams.set("limit", String(limit));
	queryParams.set("start", start);
	queryParams.set("end", end);

	return useQuery({
		queryKey: ["logs-range-query", profile, eventTypes, keyword, limit, start, end],
		queryFn: () => api.get<unknown>(`/logs/query_range?${queryParams.toString()}`),
		select: parseLokiResult,
		enabled: !!start && !!end,
	});
}
