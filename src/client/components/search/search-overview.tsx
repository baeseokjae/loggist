import { useQuery } from "@tanstack/react-query";
import { useTimeRange } from "../../stores/time-range";
import { useProfileFilter } from "../../stores/profile-filter";
import { useVolumeData } from "../../hooks/use-search-overview";
import type { LogEntry } from "../../../shared/types/domain";
import { api } from "../../lib/api-client";
import { parseLokiResult } from "../../lib/loki-parser";
import { VolumeChart } from "./volume-chart";
import { ResultTable } from "./result-table";

export function SearchOverview() {
	const { start, end, step } = useTimeRange();
	const { profile } = useProfileFilter();

	const {
		data: volumeData,
		isLoading: volumeLoading,
		isError: volumeError,
	} = useVolumeData(profile, start, end, step);

	const { data: recentEntries, isLoading: recentLoading } = useQuery({
		queryKey: ["recent-logs", profile],
		queryFn: () => {
			const params = new URLSearchParams({ limit: "50" });
			if (profile !== "all") params.set("profile", profile);
			return api.get<unknown>(`/logs/query?${params}`);
		},
		select: (raw) => parseLokiResult(raw) as unknown as LogEntry[],
		staleTime: 2 * 60 * 1000,
	});

	return (
		<div className="flex flex-col gap-4">
			<div className="rounded-xl border bg-card p-6">
				<h2 className="mb-4 text-sm font-medium text-muted-foreground">이벤트 볼륨</h2>
				<VolumeChart
					data={volumeData ?? []}
					isLoading={volumeLoading}
					isError={volumeError}
					start={start}
					end={end}
				/>
			</div>

			<div>
				<h2 className="mb-3 text-sm font-medium text-muted-foreground">최근 이벤트</h2>
				<ResultTable entries={recentEntries ?? []} isLoading={recentLoading} />
			</div>
		</div>
	);
}
