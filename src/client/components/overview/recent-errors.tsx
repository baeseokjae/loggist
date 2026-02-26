import { useQuery } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { api } from "../../lib/api-client";
import { formatNanoTimestamp, formatTokens } from "../../lib/format";
import { parseLokiResult, type ParsedLogEntry } from "../../lib/loki-parser";
import { useProfileFilter } from "../../stores/profile-filter";
import { useTimeRange } from "../../stores/time-range";

interface ErrorEntry {
	timestamp: string;
	status_code?: number;
	model?: string;
	error_message?: string;
	event_name?: string;
	session_id?: string;
	raw: Record<string, unknown>;
}

function parseLokiErrors(raw: unknown): ErrorEntry[] {
	const entries = parseLokiResult(raw);
	return entries
		.map((entry) => {
			const { timestamp, ...rest } = entry;
			return {
				timestamp,
				status_code: (entry.status_code ?? entry.http_status_code ?? entry["http.response.status_code"]) as number | undefined,
				model: (entry.model ?? entry["gen_ai.request.model"] ?? entry["llm.model"]) as string | undefined,
				error_message: (entry.error_message ?? entry.message ?? entry["error.message"] ?? entry["exception.message"]) as string | undefined,
				event_name: entry.event_name as string | undefined,
				session_id: (entry.session_id ?? entry["session.id"]) as string | undefined,
				raw: rest as Record<string, unknown>,
			};
		})
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

const CONTEXT_EVENT_STYLES: Record<string, { cls: string; label: string }> = {
	api_request: { cls: "bg-blue-500 text-white", label: "API 요청" },
	api_error: { cls: "bg-red-500 text-white", label: "API 오류" },
	tool_result: { cls: "bg-green-500 text-white", label: "도구 결과" },
	tool_decision: { cls: "bg-amber-500 text-white", label: "도구 결정" },
	user_prompt: { cls: "bg-purple-500 text-white", label: "사용자 입력" },
};

function buildContextDetail(event: ParsedLogEntry, eventName: string): string {
	if (eventName === "api_request") {
		const parts: string[] = [];
		if (event.model) parts.push(String(event.model));
		if (event.input_tokens != null) parts.push(`in: ${formatTokens(Number(event.input_tokens))}`);
		if (event.duration_ms != null) parts.push(`${event.duration_ms}ms`);
		return parts.join(" · ") || "API 요청";
	}
	if (eventName === "user_prompt") {
		const prompt = event.prompt as string | undefined;
		if (prompt) return prompt.length > 80 ? prompt.slice(0, 80) + "..." : prompt;
		return "사용자 입력";
	}
	if (eventName === "tool_result" || eventName === "tool_decision") {
		const parts: string[] = [];
		if (event.tool_name) parts.push(String(event.tool_name));
		if (eventName === "tool_result" && event.success != null) {
			parts.push(event.success ? "성공" : "실패");
		}
		return parts.join(" · ") || eventName;
	}
	return eventName;
}

function ContextEventRow({ event }: { event: ParsedLogEntry }) {
	const eventName = (event.event_name as string) ?? "unknown";
	const style = CONTEXT_EVENT_STYLES[eventName] ?? { cls: "bg-muted-foreground text-background", label: eventName };

	const detail = buildContextDetail(event, eventName);

	return (
		<div className="flex items-center gap-2 rounded bg-muted/30 px-3 py-1.5 text-xs">
			<span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${style.cls}`}>
				{style.label}
			</span>
			<span className="min-w-0 truncate text-muted-foreground">{detail}</span>
		</div>
	);
}

function ErrorDetailPanel({ error }: { error: ErrorEntry }) {
	const endSec = Math.floor(Number(BigInt(error.timestamp) / 1_000_000_000n));
	const startSec = endSec - 120;

	const { data: contextEvents, isLoading: contextLoading } = useQuery({
		queryKey: ["error-context", error.session_id, error.timestamp],
		queryFn: () => {
			const params = new URLSearchParams();
			params.set("sessionId", error.session_id!);
			params.set("start", String(startSec));
			params.set("end", String(endSec));
			params.set("limit", "5");
			return api.get<unknown>(`/logs/query_range?${params.toString()}`);
		},
		enabled: !!error.session_id,
		select: (raw: unknown) => {
			const entries = parseLokiResult(raw);
			return entries
				.filter((e) => e.timestamp !== error.timestamp)
				.sort((a, b) => Number(BigInt(b.timestamp) - BigInt(a.timestamp)))
				.slice(0, 3);
		},
	});

	const [showRaw, setShowRaw] = useState(false);

	return (
		<div className="space-y-4">
			{/* Context section - only if session_id exists */}
			{error.session_id && (
				<div>
					<h4 className="mb-2 text-xs font-semibold text-muted-foreground">에러 전 컨텍스트</h4>
					{contextLoading ? (
						<div className="flex h-12 items-center justify-center">
							<div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-primary" />
						</div>
					) : contextEvents && contextEvents.length > 0 ? (
						<div className="space-y-1.5">
							{contextEvents.map((evt, idx) => (
								<ContextEventRow key={`${evt.timestamp}-${idx}`} event={evt} />
							))}
						</div>
					) : (
						<p className="text-xs text-muted-foreground">컨텍스트 이벤트 없음</p>
					)}
				</div>
			)}

			{/* Error detail section */}
			<div>
				<h4 className="mb-2 text-xs font-semibold text-muted-foreground">에러 상세</h4>
				<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
					{error.status_code != null && (
						<>
							<dt className="text-muted-foreground">상태 코드</dt>
							<dd className="font-medium">{error.status_code}</dd>
						</>
					)}
					{error.error_message && (
						<>
							<dt className="text-muted-foreground">에러 메시지</dt>
							<dd className="break-all">{error.error_message}</dd>
						</>
					)}
					{error.model && (
						<>
							<dt className="text-muted-foreground">모델</dt>
							<dd>{error.model}</dd>
						</>
					)}
					{error.session_id && (
						<>
							<dt className="text-muted-foreground">세션</dt>
							<dd>
								<a
									href={`/sessions/${error.session_id}`}
									className="font-mono text-primary hover:underline"
									onClick={(e) => e.stopPropagation()}
								>
									{error.session_id.slice(0, 12)}...
								</a>
							</dd>
						</>
					)}
					{(error.raw.duration_ms != null) && (
						<>
							<dt className="text-muted-foreground">소요 시간</dt>
							<dd>{String(error.raw.duration_ms)}ms</dd>
						</>
					)}
					{(error.raw.input_tokens != null) && (
						<>
							<dt className="text-muted-foreground">토큰</dt>
							<dd>
								in: {formatTokens(Number(error.raw.input_tokens))}
								{error.raw.output_tokens != null && ` / out: ${formatTokens(Number(error.raw.output_tokens))}`}
							</dd>
						</>
					)}
				</dl>
			</div>

			{/* Collapsible raw data */}
			<div>
				<button
					type="button"
					className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
					onClick={(e) => {
						e.stopPropagation();
						setShowRaw((prev) => !prev);
					}}
				>
					<span className={`inline-block transition-transform ${showRaw ? "rotate-90" : ""}`}>▶</span>
					원본 데이터
				</button>
				{showRaw && (
					<pre className="mt-2 max-h-48 overflow-auto rounded bg-background p-3 text-xs font-mono whitespace-pre-wrap break-all">
						{JSON.stringify(error.raw, null, 2)}
					</pre>
				)}
			</div>
		</div>
	);
}

export function RecentErrors() {
	const { profile } = useProfileFilter();
	const { start, end, label } = useTimeRange();
	const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

	const params = new URLSearchParams();
	params.set("eventTypes", "api_error");
	params.set("limit", "20");
	params.set("start", String(start));
	params.set("end", String(end));
	if (profile && profile !== "all") params.set("profile", profile);

	const { data: errors, isLoading } = useQuery({
		queryKey: ["recent-errors", profile, start, end],
		queryFn: () => api.get<unknown>(`/logs/query_range?${params.toString()}`),
		select: parseLokiErrors,
		refetchInterval: 30_000,
	});

	return (
		<div className="rounded-xl border bg-card p-6">
			<h2 className="mb-4 text-base font-semibold">최근 에러 ({label})</h2>
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
								<th className="pb-2 text-left font-medium">에러 메시지</th>
							</tr>
						</thead>
						<tbody>
							{errors.map((err, i) => (
								<Fragment key={`${err.timestamp}-${i}`}>
									<tr
										className="border-b border-border/50 last:border-0 cursor-pointer hover:bg-muted/30 transition-colors"
										onClick={() => {
											setExpandedRows((prev) => {
												const next = new Set(prev);
												if (next.has(i)) next.delete(i);
												else next.add(i);
												return next;
											});
										}}
									>
										<td className="py-2 pr-4 font-mono text-xs text-muted-foreground whitespace-nowrap">
											{formatNanoTimestamp(err.timestamp)}
										</td>
										<td className="py-2 pr-4">
											<ErrorTypeBadge code={err.status_code} />
										</td>
										<td className="py-2 text-xs" title={err.error_message}>
											{err.error_message ?? "-"}
										</td>
									</tr>
									{expandedRows.has(i) && (
										<tr key={`${err.timestamp}-${i}-expanded`}>
											<td colSpan={3} className="bg-muted/50 px-4 py-3" onClick={(e) => e.stopPropagation()}>
												<ErrorDetailPanel error={err} />
											</td>
										</tr>
									)}
								</Fragment>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
