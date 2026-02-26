import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api-client";
import { formatNanoTimestamp } from "../../lib/format";
import { parseLokiResult } from "../../lib/loki-parser";
import { useProfileFilter } from "../../stores/profile-filter";

interface ErrorEntry {
	timestamp: string;
	status_code?: number;
	model?: string;
	error_message?: string;
	event_name?: string;
}

function parseLokiErrors(raw: unknown): ErrorEntry[] {
	const entries = parseLokiResult(raw);
	return entries
		.map((entry) => ({
			timestamp: entry.timestamp,
			status_code: (entry.status_code ?? entry.http_status_code) as number | undefined,
			model: entry.model as string | undefined,
			error_message: (entry.error_message ?? entry.message) as string | undefined,
			event_name: entry.event_name as string | undefined,
		}))
		.sort((a, b) => Number(BigInt(b.timestamp) - BigInt(a.timestamp)));
}

function errorTypeLabel(code?: number): string {
	if (code === 429) return "429";
	if (code === 500) return "500";
	if (code != null) return String(code);
	return "기타";
}

function ErrorTypeBadge({ code }: { code?: number }) {
	const label = errorTypeLabel(code);
	const cls =
		code === 429
			? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
			: code === 500
				? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
				: "bg-muted text-muted-foreground";

	return (
		<span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${cls}`}>
			{label}
		</span>
	);
}

export function RecentErrors() {
	const { profile } = useProfileFilter();

	const params = new URLSearchParams();
	params.set("eventTypes", "api_error");
	params.set("limit", "10");
	if (profile && profile !== "all") params.set("profile", profile);

	const { data: errors, isLoading } = useQuery({
		queryKey: ["recent-errors", profile],
		queryFn: () => api.get<unknown>(`/logs/query?${params.toString()}`),
		select: parseLokiErrors,
		refetchInterval: 30_000,
	});

	return (
		<div className="rounded-xl border bg-card p-6">
			<h2 className="mb-4 text-base font-semibold">최근 에러</h2>
			{isLoading ? (
				<div className="flex h-24 items-center justify-center">
					<div className="h-6 w-6 animate-spin rounded-full border-4 border-muted border-t-primary" />
				</div>
			) : !errors?.length ? (
				<p className="py-6 text-center text-sm text-muted-foreground">에러 없음</p>
			) : (
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b text-xs text-muted-foreground">
								<th className="pb-2 text-left font-medium">시간</th>
								<th className="pb-2 text-left font-medium">유형</th>
								<th className="pb-2 text-left font-medium">모델</th>
								<th className="pb-2 text-left font-medium">메시지</th>
							</tr>
						</thead>
						<tbody>
							{errors.map((err, i) => (
								<tr
									key={`${err.timestamp}-${i}`}
									className="border-b border-border/50 last:border-0"
								>
									<td className="py-2 pr-4 font-mono text-xs text-muted-foreground whitespace-nowrap">
										{formatNanoTimestamp(err.timestamp)}
									</td>
									<td className="py-2 pr-4">
										<ErrorTypeBadge code={err.status_code} />
									</td>
									<td className="py-2 pr-4 text-xs text-muted-foreground">
										{err.model ?? "-"}
									</td>
									<td className="py-2 max-w-xs truncate text-xs" title={err.error_message}>
										{err.error_message ?? "-"}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
