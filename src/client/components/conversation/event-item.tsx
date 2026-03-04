import type { SessionEvent } from "../../../shared/types/domain";
import { formatTokens, formatUSD } from "../../lib/format";
import { cn } from "../../lib/utils";

export const EVENT_STYLES: Record<string, { bg: string; badge: string; label: string; dot: string }> = {
	api_request: {
		bg: "border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30",
		badge: "bg-blue-500 text-white",
		label: "API",
		dot: "bg-blue-500",
	},
	api_error: {
		bg: "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30",
		badge: "bg-red-500 text-white",
		label: "오류",
		dot: "bg-red-500",
	},
	tool_result: {
		bg: "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30",
		badge: "bg-green-500 text-white",
		label: "도구",
		dot: "bg-green-500",
	},
	tool_decision: {
		bg: "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30",
		badge: "bg-amber-500 text-white",
		label: "결정",
		dot: "bg-amber-500",
	},
	user_prompt: {
		bg: "border-purple-200 bg-purple-50 dark:border-purple-900 dark:bg-purple-950/30",
		badge: "bg-purple-500 text-white",
		label: "입력",
		dot: "bg-purple-500",
	},
};

export const DEFAULT_STYLE = {
	bg: "border-border bg-muted/20",
	badge: "bg-muted-foreground text-background",
	label: "이벤트",
	dot: "bg-muted-foreground",
};

export function EventDetails({ event }: { event: SessionEvent }) {
	if (event.event_name === "api_request") {
		return (
			<div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground">
				{event.model && <span className="font-medium text-foreground">{event.model}</span>}
				{event.cost_usd ? <span>{formatUSD(event.cost_usd)}</span> : null}
				{event.input_tokens ? <span>in: {formatTokens(event.input_tokens)}</span> : null}
				{event.output_tokens ? <span>out: {formatTokens(event.output_tokens)}</span> : null}
				{event.cache_read_input_tokens ? (
					<span>cache: {formatTokens(event.cache_read_input_tokens)}</span>
				) : null}
			</div>
		);
	}

	if (event.event_name === "api_error") {
		return (
			<div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground">
				{event.status_code != null && (
					<span className="font-medium text-red-600 dark:text-red-400">
						HTTP {event.status_code}
					</span>
				)}
				{event.error_message && (
					<span className="truncate text-red-700 dark:text-red-300">
						{event.error_message}
					</span>
				)}
			</div>
		);
	}

	if (event.event_name === "tool_result") {
		return (
			<div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground">
				{event.tool_name && (
					<span className="font-medium text-foreground">{event.tool_name}</span>
				)}
				<span
					className={cn(
						"font-medium",
						event.success === false
							? "text-red-600 dark:text-red-400"
							: "text-green-600 dark:text-green-400",
					)}
				>
					{event.success === false ? "실패" : "성공"}
				</span>
			</div>
		);
	}

	if (event.event_name === "tool_decision") {
		return (
			<div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground">
				{event.tool_name && (
					<span className="font-medium text-foreground">{event.tool_name}</span>
				)}
				<span
					className={cn(
						"font-medium",
						event.success === true
							? "text-green-600 dark:text-green-400"
							: event.success === false
								? "text-red-600 dark:text-red-400"
								: "text-muted-foreground",
					)}
				>
					{event.success === true ? "수락" : event.success === false ? "거절" : ""}
				</span>
			</div>
		);
	}

	if (event.event_name === "user_prompt") {
		const len = event.prompt?.length;
		return (
			<span className="text-xs text-muted-foreground">
				{len != null ? `${len}자` : "사용자 입력"}
			</span>
		);
	}

	return (
		<span className="text-xs text-muted-foreground">{event.event_name}</span>
	);
}

export function EventItem({ event }: { event: SessionEvent }) {
	const style = EVENT_STYLES[event.event_name] ?? DEFAULT_STYLE;

	return (
		<div className="relative flex gap-3 pb-3 last:pb-0">
			{/* Timeline rail */}
			<div className="flex flex-col items-center">
				<div className={cn("h-2.5 w-2.5 shrink-0 rounded-full mt-1.5", style.dot)} />
				<div className="w-px flex-1 bg-border" />
			</div>

			{/* Event card */}
			<div className={cn("flex-1 rounded-lg border px-3 py-2 text-sm", style.bg)}>
				<div className="flex items-center justify-between gap-2">
					<div className="flex min-w-0 items-center gap-2">
						<span
							className={cn(
								"shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
								style.badge,
							)}
						>
							{style.label}
						</span>
						<EventDetails event={event} />
					</div>
					{event.duration_ms ? (
						<span className="shrink-0 text-xs text-muted-foreground">
							{event.duration_ms}ms
						</span>
					) : null}
				</div>
			</div>
		</div>
	);
}
