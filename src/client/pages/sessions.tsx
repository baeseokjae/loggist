import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../lib/api-client";
import { formatTokens, formatUSD } from "../lib/format";
import { cn } from "../lib/utils";

interface SessionSummary {
	sessionId: string;
	startTime: string;
	endTime: string;
	totalCost: number;
	totalInputTokens: number;
	totalOutputTokens: number;
	totalCacheTokens: number;
	apiCalls: number;
	toolCalls: number;
	toolFailures: number;
	models: string[];
}

interface SessionEvent {
	timestamp: string;
	event_name: string;
	model?: string;
	cost_usd?: number;
	input_tokens?: number;
	output_tokens?: number;
	tool_name?: string;
	success?: boolean;
}

interface SessionDetail {
	sessionId: string;
	events: SessionEvent[];
	summary: SessionSummary;
}

export function SessionsPage() {
	const [selectedSession, setSelectedSession] = useState<string | null>(null);

	const { data: sessions, isLoading } = useQuery({
		queryKey: ["sessions"],
		queryFn: () => api.get<{ data: SessionSummary[] }>("/sessions"),
		select: (res) => res.data,
	});

	const { data: detail } = useQuery({
		queryKey: ["session-detail", selectedSession],
		queryFn: () => api.get<{ data: SessionDetail }>(`/sessions/${selectedSession}`),
		select: (res) => res.data,
		enabled: !!selectedSession,
	});

	return (
		<div className="space-y-6">
			<h1 className="text-2xl font-bold">세션 분석</h1>

			<div className="grid gap-6 lg:grid-cols-3">
				<div className="space-y-2 lg:col-span-1">
					<h2 className="text-sm font-medium text-muted-foreground">최근 세션</h2>
					{isLoading && <p className="text-sm text-muted-foreground">불러오는 중...</p>}
					{sessions?.map((session) => (
						<button
							type="button"
							key={session.sessionId}
							onClick={() => setSelectedSession(session.sessionId)}
							className={cn(
								"w-full rounded-lg border p-3 text-left transition-colors",
								selectedSession === session.sessionId
									? "border-primary bg-primary/5"
									: "hover:bg-muted/50",
							)}
						>
							<div className="flex items-center justify-between">
								<span className="text-sm font-medium">{session.sessionId.slice(0, 8)}...</span>
								<span className="text-sm font-semibold">{formatUSD(session.totalCost)}</span>
							</div>
							<div className="mt-1 flex gap-3 text-xs text-muted-foreground">
								<span>{session.apiCalls} API</span>
								<span>{session.toolCalls} tools</span>
								<span>{session.models.join(", ")}</span>
							</div>
						</button>
					))}
					{sessions?.length === 0 && (
						<p className="text-sm text-muted-foreground">세션 데이터가 없습니다.</p>
					)}
				</div>

				<div className="lg:col-span-2">
					{detail ? (
						<SessionDetailView detail={detail} />
					) : (
						<div className="flex h-64 items-center justify-center rounded-xl border bg-card">
							<p className="text-muted-foreground">세션을 선택하세요</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

function SessionDetailView({ detail }: { detail: SessionDetail }) {
	const { summary, events } = detail;

	return (
		<div className="space-y-4">
			<div className="grid grid-cols-4 gap-3">
				<StatCard label="총 비용" value={formatUSD(summary.totalCost)} />
				<StatCard label="API 호출" value={String(summary.apiCalls)} />
				<StatCard label="도구 사용" value={String(summary.toolCalls)} />
				<StatCard label="입력 토큰" value={formatTokens(summary.totalInputTokens)} />
			</div>

			<div className="rounded-xl border bg-card p-4">
				<h3 className="mb-3 text-sm font-medium">이벤트 타임라인</h3>
				<div className="max-h-96 space-y-1 overflow-y-auto">
					{events.map((event, i) => (
						<div
							key={`${event.timestamp}-${i}`}
							className={cn(
								"flex items-center gap-3 rounded-md px-3 py-1.5 text-sm",
								event.event_name === "api_error" && "bg-destructive/5",
								event.event_name === "tool_result" && event.success === false && "bg-destructive/5",
							)}
						>
							<EventBadge type={event.event_name} />
							<span className="flex-1 truncate">
								{event.tool_name || event.model || event.event_name}
							</span>
							{event.cost_usd ? (
								<span className="text-xs text-muted-foreground">{formatUSD(event.cost_usd)}</span>
							) : null}
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

function StatCard({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-lg border bg-card p-3">
			<p className="text-xs text-muted-foreground">{label}</p>
			<p className="text-lg font-bold">{value}</p>
		</div>
	);
}

const EVENT_COLORS: Record<string, string> = {
	api_request: "bg-chart-1",
	api_error: "bg-destructive",
	tool_result: "bg-chart-2",
	tool_decision: "bg-chart-4",
	user_prompt: "bg-chart-5",
};

function EventBadge({ type }: { type: string }) {
	return (
		<span
			className={cn(
				"inline-block h-2 w-2 rounded-full",
				EVENT_COLORS[type] || "bg-muted-foreground",
			)}
		/>
	);
}
