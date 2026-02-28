import { useEffect, useState } from "react";
import type { SessionEvent } from "../../../shared/types/domain";
import { formatNanoTimestamp, formatTokens, formatUSD } from "../../lib/format";
import type { ConversationTurn } from "../../lib/conversation";
import { cn } from "../../lib/utils";

const EVENT_STYLES: Record<string, { bg: string; badge: string; label: string; dot: string }> = {
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

const DEFAULT_STYLE = {
	bg: "border-border bg-muted/20",
	badge: "bg-muted-foreground text-background",
	label: "이벤트",
	dot: "bg-muted-foreground",
};

const INITIAL_VISIBLE = 15;

interface ConversationTurnProps {
	turn: ConversationTurn;
	visibleTypes: Set<string>;
	forceExpanded: boolean;
}

function EventItem({ event }: { event: SessionEvent }) {
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

function EventDetails({ event }: { event: SessionEvent }) {
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

export function ConversationTurnCard({ turn, visibleTypes, forceExpanded }: ConversationTurnProps) {
	const [expanded, setExpanded] = useState(false);

	useEffect(() => {
		setExpanded(forceExpanded);
	}, [forceExpanded]);
	const [promptExpanded, setPromptExpanded] = useState(false);
	const [showAll, setShowAll] = useState(false);

	const { summary } = turn;

	const filteredEvents = turn.events.filter((e) => visibleTypes.has(e.event_name));
	const visibleEvents = showAll
		? filteredEvents
		: filteredEvents.slice(0, INITIAL_VISIBLE);
	const hiddenCount = filteredEvents.length - INITIAL_VISIBLE;

	const promptPreview = turn.prompt
		? turn.prompt.split("\n").slice(0, 2).join(" ").slice(0, 120)
		: null;

	return (
		<div className="rounded-xl border bg-card">
			{/* Turn header */}
			<button
				type="button"
				className="flex w-full items-start gap-3 p-4 text-left hover:bg-muted/50 transition-colors rounded-xl"
				onClick={() => setExpanded(!expanded)}
			>
				<span className="mt-0.5 text-xs text-muted-foreground">
					{expanded ? "▼" : "▶"}
				</span>

				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 mb-1">
						<span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
							Turn {turn.index}
						</span>
						<span className="text-xs text-muted-foreground">
							{formatNanoTimestamp(turn.promptTimestamp)}
						</span>
					</div>

					{promptPreview && (
						<p className="text-sm text-foreground/80 truncate">
							{promptPreview}
						</p>
					)}
					{!promptPreview && turn.index === 0 && (
						<p className="text-sm text-muted-foreground italic">
							세션 초기화
						</p>
					)}
				</div>

				{/* Summary badges */}
				<div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
					{summary.apiCalls > 0 && (
						<span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
							API {summary.apiCalls}
						</span>
					)}
					{summary.toolCalls > 0 && (
						<span className="rounded bg-green-100 px-1.5 py-0.5 text-green-700 dark:bg-green-900/40 dark:text-green-300">
							Tool {summary.toolCalls}
						</span>
					)}
					{summary.toolFailures > 0 && (
						<span className="rounded bg-red-100 px-1.5 py-0.5 text-red-700 dark:bg-red-900/40 dark:text-red-300">
							Fail {summary.toolFailures}
						</span>
					)}
					{summary.totalCost > 0 && (
						<span className="rounded bg-muted px-1.5 py-0.5 font-medium">
							{formatUSD(summary.totalCost)}
						</span>
					)}
				</div>
			</button>

			{/* Turn body */}
			{expanded && (
				<div className="border-t px-4 pb-4 pt-3 space-y-3">
					{/* Full prompt */}
					{turn.prompt && (
						<div>
							<button
								type="button"
								className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
								onClick={() => setPromptExpanded(!promptExpanded)}
							>
								<span>{promptExpanded ? "▼" : "▶"}</span>
								<span>프롬프트 전문</span>
							</button>
							{promptExpanded && (
								<div className="rounded-lg border bg-muted/30 p-3 text-sm whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
									{turn.prompt}
								</div>
							)}
						</div>
					)}

					{/* Event list */}
					<div>
						{visibleEvents.map((event, i) => (
							<EventItem
								key={`${event.timestamp}-${i}`}
								event={event}
							/>
						))}

						{!showAll && hiddenCount > 0 && (
							<button
								type="button"
								className="mt-2 w-full rounded-lg border border-dashed py-2 text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
								onClick={() => setShowAll(true)}
							>
								나머지 {hiddenCount}개 이벤트 보기
							</button>
						)}

						{filteredEvents.length === 0 && (
							<p className="text-xs text-muted-foreground py-2">
								필터에 해당하는 이벤트가 없습니다.
							</p>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
