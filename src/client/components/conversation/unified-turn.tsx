import { useEffect, useState } from "react";
import type { UnifiedTurn } from "../../lib/turn-matcher";
import { formatPercent, formatTokens, formatUSD } from "../../lib/format";
import { stripTags } from "../../lib/tag-parser";
import { MarkdownContent } from "./markdown-content";
import { TaggedContent } from "./tagged-content";
import { ToolUseCard } from "./tool-use-card";
import { EventItem } from "./event-item";

const INITIAL_VISIBLE = 15;

interface UnifiedTurnCardProps {
	turn: UnifiedTurn;
	forceExpanded: boolean;
}

export function UnifiedTurnCard({ turn, forceExpanded }: UnifiedTurnCardProps) {
	const [expanded, setExpanded] = useState(false);
	const [promptExpanded, setPromptExpanded] = useState(false);
	const [thinkingExpanded, setThinkingExpanded] = useState(false);
	const [telemetryExpanded, setTelemetryExpanded] = useState(false);
	const [eventsShowAll, setEventsShowAll] = useState(false);
	const [anchorCopied, setAnchorCopied] = useState(false);

	// Reset local expanded state when forceExpanded changes
	useEffect(() => {
		if (!forceExpanded) setExpanded(false);
	}, [forceExpanded]);

	const isExpanded = expanded || forceExpanded;

	const { conversation, telemetry } = turn;

	const promptPreview = conversation.userContent
		? stripTags(conversation.userContent).split("\n").slice(0, 2).join(" ").slice(0, 120)
		: null;

	const formattedTime = conversation.timestamp
		? new Date(conversation.timestamp).toLocaleTimeString("ko-KR", {
				hour: "2-digit",
				minute: "2-digit",
				second: "2-digit",
			})
		: "";

	const model =
		conversation.model ||
		(telemetry?.models.length ? telemetry.models[0] : null);

	// Token distribution bar
	const totalTokens = telemetry
		? telemetry.inputTokens + telemetry.cacheTokens + telemetry.outputTokens
		: 0;
	const inputPct =
		totalTokens > 0 ? (telemetry!.inputTokens / totalTokens) * 100 : 0;
	const cachePct =
		totalTokens > 0 ? (telemetry!.cacheTokens / totalTokens) * 100 : 0;
	const outputPct =
		totalTokens > 0 ? (telemetry!.outputTokens / totalTokens) * 100 : 0;

	// Anchor copy
	const anchorId = `turn-${turn.index + 1}`;
	function handleCopyAnchor(e: React.MouseEvent) {
		e.stopPropagation();
		const url = `${window.location.href.split("#")[0]}#${anchorId}`;
		navigator.clipboard.writeText(url).then(() => {
			setAnchorCopied(true);
			setTimeout(() => setAnchorCopied(false), 1500);
		});
	}

	// Event lazy loading
	const allEvents = telemetry?.events ?? [];
	const visibleEvents = eventsShowAll
		? allEvents
		: allEvents.slice(0, INITIAL_VISIBLE);
	const hiddenCount = allEvents.length - INITIAL_VISIBLE;

	return (
		<div
			id={anchorId}
			aria-label={`Turn ${turn.index + 1}`}
			className="group rounded-xl border bg-card"
		>
			{/* Turn header */}
			<button
				type="button"
				aria-expanded={isExpanded}
				className="flex w-full items-start gap-3 p-4 text-left hover:bg-muted/50 transition-colors rounded-xl"
				onClick={() => setExpanded(!isExpanded)}
			>
				<span className="mt-0.5 text-xs text-muted-foreground">
					{isExpanded ? "▼" : "▶"}
				</span>

				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 mb-1">
						<span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
							Turn {turn.index + 1}
						</span>
						{/* Anchor copy button - only visible on hover */}
						<button
							type="button"
							title="턴 링크 복사"
							className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-muted-foreground hover:text-foreground px-1 rounded"
							onClick={handleCopyAnchor}
						>
							{anchorCopied ? "✓" : "#"}
						</button>
						<span className="text-xs text-muted-foreground">
							{formattedTime}
						</span>
						{model && (
							<span className="text-xs text-muted-foreground truncate max-w-[160px]">
								{model}
							</span>
						)}
					</div>

					{promptPreview && (
						<p className="text-sm text-foreground/80 truncate">
							{promptPreview}
						</p>
					)}
				</div>

				{/* Summary badges */}
				<div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
					{telemetry && telemetry.cost > 0 && (
						<span className="rounded bg-muted px-1.5 py-0.5 font-medium">
							{formatUSD(telemetry.cost)}
						</span>
					)}
					{conversation.toolCalls.length > 0 && (
						<span className="rounded bg-green-100 px-1.5 py-0.5 text-green-700 dark:bg-green-900/40 dark:text-green-300">
							도구 {conversation.toolCalls.length}
						</span>
					)}
					{telemetry && telemetry.cacheEfficiency > 0 && (
						<span className="rounded bg-muted px-1.5 py-0.5">
							캐시 {formatPercent(telemetry.cacheEfficiency)}
						</span>
					)}
					{conversation.thinkingText && (
						<span className="rounded bg-muted px-1.5 py-0.5">
							사고
						</span>
					)}
				</div>
			</button>

			{/* Turn body */}
			{isExpanded && (
				<div className="border-t px-4 pb-4 pt-3 space-y-3">
					{/* User input */}
					{conversation.userContent && (
						<div>
							<button
								type="button"
								aria-expanded={promptExpanded}
								className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
								onClick={() => setPromptExpanded(!promptExpanded)}
							>
								<span>{promptExpanded ? "▼" : "▶"}</span>
								<span>사용자 입력</span>
							</button>
							{promptExpanded && (
								<div className="rounded-lg border bg-purple-50 dark:bg-purple-950/20 p-3 text-sm max-h-64 overflow-y-auto">
									<TaggedContent content={conversation.userContent!} />
								</div>
							)}
						</div>
					)}

					{/* Thinking */}
					{conversation.thinkingText && (
						<div>
							<button
								type="button"
								aria-expanded={thinkingExpanded}
								className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
								onClick={() => setThinkingExpanded(!thinkingExpanded)}
							>
								<span>{thinkingExpanded ? "▼" : "▶"}</span>
								<span>에이전트 사고</span>
							</button>
							{thinkingExpanded && (
								<div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground whitespace-pre-wrap break-words max-h-64 overflow-y-auto italic">
									{conversation.thinkingText}
								</div>
							)}
						</div>
					)}

					{/* Assistant text & tool calls (interleaved) */}
					{conversation.orderedBlocks.map((block, idx) => {
						if (block.kind === "text") {
							return (
								<MarkdownContent
									key={`text-${idx}`}
									content={block.text}
									className="rounded-lg border bg-background/50 p-3"
								/>
							);
						}
						return (
							<ToolUseCard
								key={block.toolUse.id}
								toolUse={block.toolUse}
								toolResult={block.toolResult}
							/>
						);
					})}

					{/* Telemetry section */}
					{telemetry !== null && (
						<div className="border-t pt-3">
							<button
								type="button"
								aria-expanded={telemetryExpanded}
								className="mb-2 flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
								onClick={() => setTelemetryExpanded(!telemetryExpanded)}
							>
								<span>{telemetryExpanded ? "▼" : "▶"}</span>
								<span>텔레메트리</span>
							</button>

							{/* Telemetry summary line (always visible when section open) */}
							<div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
								{telemetry.apiCalls > 0 && (
									<span>API {telemetry.apiCalls}회</span>
								)}
								{telemetry.inputTokens > 0 && (
									<span>입력 {formatTokens(telemetry.inputTokens)}</span>
								)}
								{telemetry.outputTokens > 0 && (
									<span>출력 {formatTokens(telemetry.outputTokens)}</span>
								)}
								{telemetry.cacheTokens > 0 && (
									<span>캐시 {formatTokens(telemetry.cacheTokens)}</span>
								)}
								{telemetry.avgDurationMs !== null && (
									<span>응답 {Math.round(telemetry.avgDurationMs)}ms</span>
								)}
								{telemetry.cost > 0 && (
									<span>{formatUSD(telemetry.cost)}</span>
								)}
							</div>

							{/* Token distribution mini bar */}
							{totalTokens > 0 && (
								<div className="mt-2">
									<div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
										<div
											className="bg-blue-500"
											style={{ width: `${inputPct}%` }}
											title={`입력 ${formatTokens(telemetry!.inputTokens)}`}
										/>
										<div
											className="bg-green-500"
											style={{ width: `${cachePct}%` }}
											title={`캐시 ${formatTokens(telemetry!.cacheTokens)}`}
										/>
										<div
											className="bg-amber-500"
											style={{ width: `${outputPct}%` }}
											title={`출력 ${formatTokens(telemetry!.outputTokens)}`}
										/>
									</div>
									<div className="mt-1 flex gap-3 text-xs text-muted-foreground">
										{telemetry!.inputTokens > 0 && (
											<span className="flex items-center gap-1">
												<span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
												입력 {formatTokens(telemetry!.inputTokens)}
											</span>
										)}
										{telemetry!.cacheTokens > 0 && (
											<span className="flex items-center gap-1">
												<span className="inline-block h-2 w-2 rounded-full bg-green-500" />
												캐시 {formatTokens(telemetry!.cacheTokens)}
											</span>
										)}
										{telemetry!.outputTokens > 0 && (
											<span className="flex items-center gap-1">
												<span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
												출력 {formatTokens(telemetry!.outputTokens)}
											</span>
										)}
									</div>
								</div>
							)}

							{/* Expanded event list with lazy loading */}
							{telemetryExpanded && allEvents.length > 0 && (
								<div className="mt-3">
									{visibleEvents.map((event, i) => (
										<EventItem
											key={`${event.timestamp}-${i}`}
											event={event}
										/>
									))}
									{!eventsShowAll && hiddenCount > 0 && (
										<button
											type="button"
											className="mt-2 w-full rounded-md border border-dashed px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
											onClick={() => setEventsShowAll(true)}
										>
											나머지 {hiddenCount}개 이벤트 보기
										</button>
									)}
								</div>
							)}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
