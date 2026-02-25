import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FilterPanel, type ProfileValue } from "../components/search/filter-panel";
import { type LogEntry, ResultTable } from "../components/search/result-table";
import { SearchBar } from "../components/search/search-bar";
import { api } from "../lib/api-client";

interface LokiStream {
	stream: Record<string, string>;
	values: [string, string][];
}

interface LokiQueryResult {
	data?: {
		result?: LokiStream[];
	};
}

function parseLokiResult(raw: unknown): LogEntry[] {
	const result = raw as LokiQueryResult;
	const streams = result?.data?.result ?? [];
	return streams.flatMap((stream) =>
		stream.values.map(([tsNano, line]) => {
			try {
				return { timestamp: tsNano, ...(JSON.parse(line) as Record<string, unknown>) } as LogEntry;
			} catch {
				return { timestamp: tsNano, raw: line } satisfies LogEntry;
			}
		}),
	);
}

export function SearchPage() {
	const [keyword, setKeyword] = useState("");
	const [profile, setProfile] = useState<ProfileValue>("all");
	const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>([]);

	const queryParams = new URLSearchParams();
	if (keyword) queryParams.set("keyword", keyword);
	if (profile !== "all") queryParams.set("profile", profile);
	if (selectedEventTypes.length > 0) queryParams.set("eventTypes", selectedEventTypes.join(","));
	queryParams.set("limit", "200");

	const isActive = keyword.length > 0 || selectedEventTypes.length > 0 || profile !== "all";

	const { data, isLoading } = useQuery({
		queryKey: ["logs-search", keyword, profile, selectedEventTypes],
		queryFn: () => api.get<unknown>(`/logs/query?${queryParams.toString()}`),
		enabled: isActive,
		select: parseLokiResult,
	});

	const entries: LogEntry[] = data ?? [];

	return (
		<div className="flex flex-col gap-4">
			<h1 className="text-2xl font-bold">로그 검색</h1>

			<SearchBar value={keyword} onChange={setKeyword} />

			<FilterPanel
				selectedEventTypes={selectedEventTypes}
				onEventTypesChange={setSelectedEventTypes}
				profile={profile}
				onProfileChange={setProfile}
			/>

			<ResultTable entries={entries} isLoading={isActive && isLoading} />
		</div>
	);
}
