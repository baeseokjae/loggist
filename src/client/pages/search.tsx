import { useQuery } from "@tanstack/react-query";
import { parseAsArrayOf, parseAsString, useQueryState } from "nuqs";
import { FilterPanel } from "../components/search/filter-panel";
import { type LogEntry, ResultTable } from "../components/search/result-table";
import { SearchBar } from "../components/search/search-bar";
import { api } from "../lib/api-client";
import { parseLokiResult } from "../lib/loki-parser";
import { useProfileFilter } from "../stores/profile-filter";

export function SearchPage() {
	const [keyword, setKeyword] = useQueryState("q", parseAsString.withDefault(""));
	const { profile, setProfile } = useProfileFilter();
	const [selectedEventTypes, setSelectedEventTypes] = useQueryState(
		"events",
		parseAsArrayOf(parseAsString).withDefault([]),
	);

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
		select: (raw) => parseLokiResult(raw) as LogEntry[],
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
