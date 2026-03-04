import { useEffect, useState } from "react";
import { formatNanoTimestamp, formatUSD } from "../../lib/format";
import type { ConversationTurn } from "../../lib/conversation";
import { EventItem } from "./event-item";

const INITIAL_VISIBLE = 15;

interface ConversationTurnProps {
	turn: ConversationTurn;
	visibleTypes: Set<string>;
	forceExpanded: boolean;
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
