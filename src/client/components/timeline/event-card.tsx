import type { TimelineEvent } from "../../hooks/use-event-stream";
import { formatTokens, formatUSD } from "../../lib/format";
import { cn } from "../../lib/utils";

interface EventCardProps {
	event: TimelineEvent;
}

function formatTimestamp(tsNano: string): string {
	// tsNano is a nanosecond epoch string; convert to ms
	const ms = Number(BigInt(tsNano) / 1_000_000n);
	return new Date(ms).toLocaleTimeString();
}

const EVENT_STYLES: Record<string, { bg: string; badge: string; label: string }> = {
	api_request: {
		bg: "border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30",
		badge: "bg-blue-500 text-white",
		label: "API 요청",
	},
	api_error: {
		bg: "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30",
		badge: "bg-red-500 text-white",
		label: "API 오류",
	},
	tool_result: {
		bg: "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30",
		badge: "bg-green-500 text-white",
		label: "도구 결과",
	},
	tool_decision: {
		bg: "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30",
		badge: "bg-amber-500 text-white",
		label: "도구 결정",
	},
	user_prompt: {
		bg: "border-purple-200 bg-purple-50 dark:border-purple-900 dark:bg-purple-950/30",
		badge: "bg-purple-500 text-white",
		label: "사용자 입력",
	},
};

const DEFAULT_STYLE = {
	bg: "border-border bg-muted/20",
	badge: "bg-muted-foreground text-background",
	label: "이벤트",
};

export function EventCard({ event }: EventCardProps) {
	const eventName = event.event_name ?? "unknown";
	const style = EVENT_STYLES[eventName] ?? DEFAULT_STYLE;

	return (
		<div className={cn("rounded-lg border px-4 py-2.5 text-sm", style.bg)}>
			<div className="flex items-start justify-between gap-3">
				<div className="flex min-w-0 flex-1 items-center gap-2">
					<span
						className={cn(
							"shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide",
							style.badge,
						)}
					>
						{style.label}
					</span>
					<EventDetails event={event} />
				</div>
				<span className="shrink-0 text-xs text-muted-foreground">
					{formatTimestamp(event.timestamp)}
				</span>
			</div>
		</div>
	);
}

function EventDetails({ event }: { event: TimelineEvent }) {
	const eventName = event.event_name;

	if (eventName === "api_request") {
		return (
			<div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
				{event.model && <span className="font-medium text-foreground">{event.model}</span>}
				{event.cost_usd != null && <span>{formatUSD(event.cost_usd)}</span>}
				{event.input_tokens != null && <span>in: {formatTokens(event.input_tokens)}</span>}
				{event.output_tokens != null && <span>out: {formatTokens(event.output_tokens)}</span>}
				{event.cache_read_tokens != null && event.cache_read_tokens > 0 && (
					<span>cache: {formatTokens(event.cache_read_tokens)}</span>
				)}
				{event.duration_ms != null && <span>{event.duration_ms}ms</span>}
			</div>
		);
	}

	if (eventName === "api_error") {
		return (
			<div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
				{event.status_code != null && (
					<span className="font-medium text-red-600">HTTP {event.status_code}</span>
				)}
				{event.error_message && (
					<span className="truncate text-red-700">{event.error_message}</span>
				)}
			</div>
		);
	}

	if (eventName === "tool_result") {
		const successColor = event.success === false ? "text-red-600" : "text-green-600";
		return (
			<div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
				{event.tool_name && <span className="font-medium text-foreground">{event.tool_name}</span>}
				<span className={cn("font-medium", successColor)}>
					{event.success === false ? "실패" : "성공"}
				</span>
				{event.duration_ms != null && <span>{event.duration_ms}ms</span>}
			</div>
		);
	}

	if (eventName === "tool_decision") {
		return (
			<div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
				{event.tool_name && <span className="font-medium text-foreground">{event.tool_name}</span>}
			</div>
		);
	}

	if (eventName === "user_prompt") {
		const promptLen = typeof event.prompt === "string" ? event.prompt.length : undefined;
		return (
			<div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
				{promptLen != null && <span>{promptLen}자</span>}
				{event.session_id && (
					<span className="truncate font-mono opacity-60">
						{String(event.session_id).slice(0, 8)}
					</span>
				)}
			</div>
		);
	}

	// default / unknown
	if (event.raw) {
		return <span className="truncate text-xs text-muted-foreground">{event.raw}</span>;
	}

	return <span className="text-xs text-muted-foreground">{event.event_name ?? "unknown"}</span>;
}
