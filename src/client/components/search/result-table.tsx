import { formatDuration, formatNanoTimestamp, formatTokens, formatUSD } from "../../lib/format";
import { cn } from "../../lib/utils";

export interface LogEntry {
	timestamp: string;
	event_name?: string;
	model?: string;
	cost_usd?: number;
	input_tokens?: number;
	output_tokens?: number;
	duration_ms?: number;
	tool_name?: string;
	success?: boolean;
	status_code?: number;
	error_message?: string;
	raw?: string;
}

interface ResultTableProps {
	entries: LogEntry[];
	isLoading?: boolean;
}

const EVENT_BADGE: Record<string, string> = {
	api_request: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
	api_error: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
	tool_result: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
	tool_decision: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
	user_prompt: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
};

const EVENT_LABELS: Record<string, string> = {
	api_request: "API 요청",
	api_error: "API 오류",
	tool_result: "도구 결과",
	tool_decision: "도구 결정",
	user_prompt: "사용자 입력",
};

function DetailsCell({ entry }: { entry: LogEntry }) {
	if (entry.event_name === "api_error") {
		return (
			<span className="truncate text-red-600">
				{entry.status_code != null ? `HTTP ${entry.status_code} ` : ""}
				{entry.error_message ?? ""}
			</span>
		);
	}
	if (entry.event_name === "tool_result" || entry.event_name === "tool_decision") {
		return <span>{entry.tool_name ?? "-"}</span>;
	}
	return <span className="truncate opacity-60">{entry.raw?.slice(0, 80) ?? "-"}</span>;
}

export function ResultTable({ entries, isLoading }: ResultTableProps) {
	if (isLoading) {
		return (
			<div className="flex h-48 items-center justify-center rounded-xl border bg-card">
				<p className="text-sm text-muted-foreground">검색 중...</p>
			</div>
		);
	}

	if (entries.length === 0) {
		return (
			<div className="flex h-48 items-center justify-center rounded-xl border bg-card">
				<p className="text-sm text-muted-foreground">결과가 없습니다.</p>
			</div>
		);
	}

	return (
		<div className="overflow-x-auto rounded-xl border bg-card">
			<table className="w-full text-sm">
				<thead>
					<tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
						<th className="px-3 py-2 font-medium">시간</th>
						<th className="px-3 py-2 font-medium">이벤트 유형</th>
						<th className="px-3 py-2 font-medium">모델</th>
						<th className="px-3 py-2 font-medium">비용</th>
						<th className="px-3 py-2 font-medium">토큰</th>
						<th className="px-3 py-2 font-medium">소요시간</th>
						<th className="px-3 py-2 font-medium">상세</th>
					</tr>
				</thead>
				<tbody className="divide-y divide-border">
					{entries.map((entry, i) => {
						const badgeClass =
							EVENT_BADGE[entry.event_name ?? ""] ?? "bg-muted text-muted-foreground";
						const label = EVENT_LABELS[entry.event_name ?? ""] ?? entry.event_name ?? "-";
						const totalTokens = (entry.input_tokens ?? 0) + (entry.output_tokens ?? 0) || undefined;

						return (
							<tr
								key={`${entry.timestamp}-${i}`}
								className={cn(
									"transition-colors hover:bg-muted/30",
									entry.event_name === "api_error" && "bg-destructive/5",
								)}
							>
								<td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-muted-foreground">
									{formatNanoTimestamp(entry.timestamp)}
								</td>
								<td className="px-3 py-2">
									<span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", badgeClass)}>
										{label}
									</span>
								</td>
								<td className="px-3 py-2 text-xs">{entry.model ?? "-"}</td>
								<td className="px-3 py-2 text-xs">
									{entry.cost_usd != null ? formatUSD(entry.cost_usd) : "-"}
								</td>
								<td className="px-3 py-2 text-xs">
									{totalTokens != null ? formatTokens(totalTokens) : "-"}
								</td>
								<td className="px-3 py-2 text-xs">
									{entry.duration_ms != null
										? entry.duration_ms >= 1000
											? formatDuration(entry.duration_ms / 1000)
											: `${entry.duration_ms}ms`
										: "-"}
								</td>
								<td className="max-w-xs px-3 py-2 text-xs">
									<DetailsCell entry={entry} />
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}
