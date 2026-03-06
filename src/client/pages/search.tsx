import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { parseAsArrayOf, parseAsString, useQueryState } from "nuqs";
import type { SortingState } from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Header } from "../components/layout/header";
import { FilterChips } from "../components/search/filter-chips";
import { LogDetailDrawer } from "../components/search/log-detail-drawer";
import { ResultTable } from "../components/search/result-table";
import { SearchOverview } from "../components/search/search-overview";
import { SearchBar } from "../components/search/search-bar";
import { api } from "../lib/api-client";
import { parseLokiResult } from "../lib/loki-parser";
import { cn } from "../lib/utils";
import { useProfileFilter } from "../stores/profile-filter";
import { useTimeRange } from "../stores/time-range";
import { useFacets } from "../hooks/use-facets";
import { useEventCounts } from "../hooks/use-search-overview";
import { EventCountCards } from "../components/search/event-count-cards";
import type { LogEntry } from "../../shared/types/domain";

const PAGE_SIZE = 50;
const arrayParser = parseAsArrayOf(parseAsString).withDefault([]);

interface QueryResponse {
	data?: { result?: unknown[] };
	meta?: { hasMore: boolean; nextCursor?: string };
}

export function SearchPage() {
	const [keyword, setKeyword] = useQueryState("q", parseAsString.withDefault(""));
	const { profile } = useProfileFilter();
	const { start, end } = useTimeRange();

	const [selectedEventTypes, setSelectedEventTypes] = useQueryState("events", arrayParser);
	const [models, setModels] = useQueryState("model", arrayParser);
	const [toolNames, setToolNames] = useQueryState("tool", arrayParser);
	const [success, setSuccess] = useQueryState("success", parseAsString);
	const [sort, setSort] = useQueryState("sort", parseAsString);
	const [selected, setSelected] = useQueryState("selected", parseAsString);

	// sort nuqs ↔ SortingState 변환
	const sorting: SortingState = useMemo(() => {
		if (!sort) return [{ id: "timestamp", desc: true }];
		const [id, dir] = sort.split(":");
		return [{ id, desc: dir !== "asc" }];
	}, [sort]);

	const handleSortingChange = useCallback((next: SortingState) => {
		if (next.length === 0) {
			void setSort(null);
		} else {
			void setSort(`${next[0].id}:${next[0].desc ? "desc" : "asc"}`);
		}
	}, [setSort]);

	// 페이지네이션 상태 (URL에 노출하지 않음)
	const [cursor, setCursor] = useState<string | null>(null);
	const [allEntries, setAllEntries] = useState<LogEntry[]>([]);
	const [hasMore, setHasMore] = useState(false);

	// 필터 변경 감지용 키 — 변경 시 누적 초기화
	const filterKey = useMemo(
		() =>
			JSON.stringify({
				keyword,
				profile,
				start,
				end,
				selectedEventTypes,
				models,
				toolNames,
				success,
				sort,
			}),
		[keyword, profile, start, end, selectedEventTypes, models, toolNames, success, sort],
	);
	const prevFilterKey = useRef(filterKey);

	// 필터가 바뀌면 커서와 누적 엔트리 리셋
	useEffect(() => {
		if (prevFilterKey.current !== filterKey) {
			prevFilterKey.current = filterKey;
			setCursor(null);
			setAllEntries([]);
			setHasMore(false);
		}
	}, [filterKey]);

	const isActive =
		keyword.length > 0 ||
		selectedEventTypes.length > 0 ||
		models.length > 0 ||
		toolNames.length > 0 ||
		success !== null ||
		profile !== "all";

	// cursor가 있으면 cursor를 end로 사용 (backward 방향이므로 cursor 이전 데이터)
	const queryEnd = cursor ?? end;

	const queryParams = useMemo(() => {
		const params = new URLSearchParams();
		if (keyword) params.set("keyword", keyword);
		if (profile !== "all") params.set("profile", profile);
		if (selectedEventTypes.length > 0) params.set("eventTypes", selectedEventTypes.join(","));
		if (models.length > 0) params.set("model", models.join(","));
		if (toolNames.length > 0) params.set("toolName", toolNames.join(","));
		if (success) params.set("success", success);
		if (sort) params.set("sort", sort);
		params.set("start", start);
		params.set("end", queryEnd);
		params.set("limit", String(PAGE_SIZE));
		return params;
	}, [keyword, profile, selectedEventTypes, models, toolNames, success, sort, start, queryEnd]);

	const { data: rawData, isLoading, isFetching, dataUpdatedAt } = useQuery({
		queryKey: ["logs-search", filterKey, cursor],
		queryFn: () => api.get<QueryResponse>(`/logs/query?${queryParams.toString()}`),
		enabled: isActive,
		placeholderData: keepPreviousData,
	});

	// 새 데이터가 도착할 때마다 누적 (dataUpdatedAt으로 변경 감지)
	const lastProcessedAt = useRef(0);

	useEffect(() => {
		if (!rawData || dataUpdatedAt === lastProcessedAt.current) return;
		lastProcessedAt.current = dataUpdatedAt;

		const newEntries = parseLokiResult(rawData) as unknown as LogEntry[];
		const meta = rawData.meta;

		if (cursor === null) {
			// 첫 로드: 교체
			setAllEntries(newEntries);
		} else {
			// 추가 로드: 누적 (중복 제거)
			setAllEntries((prev) => {
				const existing = new Set(prev.map((e) => e.timestamp));
				const filtered = newEntries.filter((e) => !existing.has(e.timestamp));
				return [...prev, ...filtered];
			});
		}

		setHasMore(meta?.hasMore ?? false);
	}, [rawData, cursor, dataUpdatedAt]);

	const previousEntriesRef = useRef<LogEntry[]>([]);

	useEffect(() => {
		if (allEntries.length > 0) {
			previousEntriesRef.current = allEntries;
		}
	}, [allEntries]);

	const displayEntries = (allEntries.length === 0 && isFetching && previousEntriesRef.current.length > 0)
		? previousEntriesRef.current
		: allEntries;

	const isTransitioning = allEntries.length === 0 && isFetching && previousEntriesRef.current.length > 0;

	const { data: eventCounts, isLoading: countsLoading } = useEventCounts(profile, start, end);
	const { data: facetData } = useFacets(profile, start, end);

	// selected nuqs param과 동기화된 선택 엔트리
	const selectedEntry = useMemo(
		() => (selected ? (displayEntries.find((e) => e.timestamp === selected) ?? null) : null),
		[selected, displayEntries],
	);

	const handleRowClick = useCallback((entry: LogEntry) => {
		void setSelected(entry.timestamp === selected ? null : entry.timestamp);
	}, [selected, setSelected]);

	const handleClose = useCallback(() => {
		void setSelected(null);
	}, [setSelected]);

	const handleNavigate = useCallback((direction: "prev" | "next") => {
		if (!selected || allEntries.length === 0) return;
		const idx = allEntries.findIndex((e) => e.timestamp === selected);
		if (idx === -1) return;
		const nextIdx = direction === "next" ? idx + 1 : idx - 1;
		if (nextIdx >= 0 && nextIdx < allEntries.length) {
			void setSelected(allEntries[nextIdx].timestamp);
		}
	}, [selected, allEntries, setSelected]);

	const handleEventTypesChange = useCallback(
		(v: string[]) => void setSelectedEventTypes(v),
		[setSelectedEventTypes],
	);
	const handleModelsChange = useCallback(
		(v: string[]) => void setModels(v),
		[setModels],
	);
	const handleToolNamesChange = useCallback(
		(v: string[]) => void setToolNames(v),
		[setToolNames],
	);
	const handleSuccessChange = useCallback(
		(v: string | null) => void setSuccess(v),
		[setSuccess],
	);
	const handleEventTypeClick = useCallback(
		(type: string) => {
			void setSelectedEventTypes((prev) =>
				prev.length === 1 && prev[0] === type ? [] : [type],
			);
		},
		[setSelectedEventTypes],
	);

	const handleLoadMore = useCallback(() => {
		if (!rawData?.meta?.nextCursor) return;
		// nextCursor를 나노초 → 초 단위로 변환 (Loki end 파라미터는 Unix 초)
		const cursorSec = String(Math.floor(Number(BigInt(rawData.meta.nextCursor) / 1_000_000_000n)));
		setCursor(cursorSec);
	}, [rawData]);

	// Enter 키: 드로어 닫혀있을 때 첫 번째 항목으로 열기
	useEffect(() => {
		function handleKeyDown(e: KeyboardEvent) {
			const target = e.target as HTMLElement;
			if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
			if (e.key === "Enter" && !selected && allEntries.length > 0) {
				e.preventDefault();
				void setSelected(allEntries[0].timestamp);
			}
		}
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [selected, allEntries, setSelected]);

	const drawerOpen = selectedEntry !== null;

	return (
		<div className="relative flex min-h-0 flex-col gap-4">
			<div className={cn("flex flex-col gap-4 transition-all duration-200", drawerOpen && "mr-[420px]")}>
				<Header
					title="로그 검색"
					refreshKeys={[["logs-search"], ["event-counts"], ["volume"], ["recent-logs"]]}
				/>

				<SearchBar value={keyword} onChange={setKeyword} />

				<FilterChips
					selectedEventTypes={selectedEventTypes}
					onEventTypesChange={handleEventTypesChange}
					models={models}
					onModelsChange={handleModelsChange}
					toolNames={toolNames}
					onToolNamesChange={handleToolNamesChange}
					success={success}
					onSuccessChange={handleSuccessChange}
					facetData={facetData}
				/>

				<EventCountCards
					counts={eventCounts ?? {}}
					isLoading={countsLoading}
					onEventTypeClick={handleEventTypeClick}
				/>

				{isActive ? (
					<div className="flex flex-col gap-3">
						<ResultTable
							entries={displayEntries}
							isLoading={isLoading && displayEntries.length === 0}
							isFetchingNewFilter={isTransitioning}
							selectedId={selected ?? undefined}
							onRowClick={handleRowClick}
							sorting={sorting}
							onSortingChange={handleSortingChange}
						/>

						{hasMore && (
							<div className="flex items-center justify-center">
								<button
									type="button"
									onClick={handleLoadMore}
									disabled={isFetching}
									className={cn(
										"rounded-md border px-4 py-2 text-sm font-medium transition-colors",
										"bg-background hover:bg-muted",
										isFetching && "cursor-not-allowed opacity-50",
									)}
								>
									{isFetching ? "로드 중..." : `더 보기 (${PAGE_SIZE}건)`}
								</button>
							</div>
						)}

						{!hasMore && displayEntries.length > 0 && !isTransitioning && (
							<p className="text-center text-xs text-muted-foreground">
								총 {displayEntries.length}건 모두 로드됨
							</p>
						)}
					</div>
				) : (
					<SearchOverview />
				)}
			</div>

			<LogDetailDrawer
				entry={selectedEntry}
				onClose={handleClose}
				onNavigate={handleNavigate}
			/>
		</div>
	);
}
