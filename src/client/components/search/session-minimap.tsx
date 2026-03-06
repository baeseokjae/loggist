import { useQuery } from "@tanstack/react-query";
import type { LogEntry, SessionSummary } from "../../../shared/types/domain";
import { EVENT_TYPE_CONFIG } from "../../lib/constants";
import { formatUSD } from "../../lib/format";
import { api } from "../../lib/api-client";
import { cn } from "../../lib/utils";

interface SessionMinimapProps {
	sessionId: string;
	currentTimestamp: string;
	onSelectEvent?: (entry: LogEntry) => void;
}

interface SessionDetailData {
	sessionId: string;
	events: LogEntry[];
	summary: SessionSummary;
}

function formatDurationMs(ms: number): string {
	if (ms < 1000) return `${ms}ms`;
	if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
	const m = Math.floor(ms / 60_000);
	const s = Math.floor((ms % 60_000) / 1000);
	return `${m}m ${s}s`;
}

function nanoToMs(tsNano: string): number {
	try {
		return Math.floor(Number(BigInt(tsNano) / 1_000_000n));
	} catch {
		return 0;
	}
}

export function SessionMinimap({ sessionId, currentTimestamp, onSelectEvent }: SessionMinimapProps) {
	const { data, isLoading } = useQuery({
		queryKey: ["session-detail", sessionId],
		queryFn: () => api.get<{ data: SessionDetailData }>(`/sessions/${sessionId}`),
		select: (res) => res?.data,
		staleTime: 5 * 60 * 1000,
	});

	if (isLoading) {
		return (
			<div className="h-10 animate-pulse rounded bg-muted" />
		);
	}

	if (!data) return null;

	const { summary, events } = data;

	if (events.length === 0) return null;

	const startMs = nanoToMs(events[0].timestamp);
	const endMs = nanoToMs(events[events.length - 1].timestamp);
	const durationMs = endMs - startMs || 1;
	const currentMs = nanoToMs(currentTimestamp);

	return (
		<div className="flex flex-col gap-2">
			{/* 요약 한 줄 */}
			<div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
				<span>비용: <span className="font-medium text-foreground">{formatUSD(summary.totalCost)}</span></span>
				<span>API: <span className="font-medium text-foreground">{summary.apiCalls}회</span></span>
				<span>도구: <span className="font-medium text-foreground">{summary.toolCalls}회</span></span>
				<span>시간: <span className="font-medium text-foreground">{formatDurationMs(durationMs)}</span></span>
			</div>

			{/* 가로 막대 미니맵 */}
			<div className="relative h-6 w-full overflow-hidden rounded border bg-muted/30">
				{events.map((event, i) => {
					const eventMs = nanoToMs(event.timestamp);
					const pct = ((eventMs - startMs) / durationMs) * 100;
					const isCurrent = event.timestamp === currentTimestamp;
					const config = EVENT_TYPE_CONFIG[event.event_name ?? ""];
					const color = config?.chartColor ?? "#888888";

					return (
						<button
							key={`${event.timestamp}-${i}`}
							type="button"
							onClick={() => onSelectEvent?.(event)}
							className={cn(
								"absolute top-0 h-full w-[3px] cursor-pointer transition-opacity hover:opacity-100",
								isCurrent ? "opacity-100 z-10" : "opacity-60",
							)}
							style={{
								left: `${Math.min(Math.max(pct, 0), 99.5)}%`,
								backgroundColor: color,
								boxShadow: isCurrent ? `0 0 0 2px white, 0 0 0 3px ${color}` : undefined,
							}}
							title={`${config?.label ?? event.event_name} @ ${new Date(eventMs).toLocaleTimeString("ko-KR")}`}
						/>
					);
				})}

				{/* 현재 위치 지시선 */}
				{currentMs >= startMs && currentMs <= endMs && (
					<div
						className="pointer-events-none absolute top-0 h-full w-px bg-foreground/60 z-20"
						style={{
							left: `${Math.min(((currentMs - startMs) / durationMs) * 100, 100)}%`,
						}}
					/>
				)}
			</div>

			<div className="flex justify-between text-[10px] text-muted-foreground">
				<span>{events.length}개 이벤트</span>
				<span>{formatDurationMs(durationMs)}</span>
			</div>
		</div>
	);
}
