import { useEffect, useMemo, useState } from "react";
import type { ConversationData } from "../../../shared/types/conversation";
import {
	type ConversationGroup,
	groupMessagesIntoTurns,
} from "../../lib/conversation-groups";
import { MarkdownContent } from "./markdown-content";
import { ToolUseCard } from "./tool-use-card";

interface ConversationViewProps {
	data: ConversationData;
}

function TurnCard({
	group,
	forceExpanded,
}: { group: ConversationGroup; forceExpanded: boolean }) {
	const [expanded, setExpanded] = useState(false);
	const [promptExpanded, setPromptExpanded] = useState(false);
	const [thinkingExpanded, setThinkingExpanded] = useState(false);

	// Reset local expanded state when forceExpanded changes
	useEffect(() => {
		if (!forceExpanded) setExpanded(false);
	}, [forceExpanded]);

	const isExpanded = expanded || forceExpanded;

	const promptPreview = group.userContent
		? group.userContent.split("\n").slice(0, 2).join(" ").slice(0, 120)
		: null;

	const formattedTime = group.timestamp
		? new Date(group.timestamp).toLocaleTimeString("ko-KR", {
				hour: "2-digit",
				minute: "2-digit",
				second: "2-digit",
			})
		: "";

	return (
		<div className="rounded-xl border bg-card">
			{/* Turn header */}
			<button
				type="button"
				className="flex w-full items-start gap-3 p-4 text-left hover:bg-muted/50 transition-colors rounded-xl"
				onClick={() => setExpanded(!isExpanded)}
			>
				<span className="mt-0.5 text-xs text-muted-foreground">
					{isExpanded ? "▼" : "▶"}
				</span>

				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 mb-1">
						<span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
							Turn {group.index + 1}
						</span>
						<span className="text-xs text-muted-foreground">
							{formattedTime}
						</span>
						{group.model && (
							<span className="text-xs text-muted-foreground">
								{group.model}
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
					{group.toolCalls.length > 0 && (
						<span className="rounded bg-green-100 px-1.5 py-0.5 text-green-700 dark:bg-green-900/40 dark:text-green-300">
							도구 {group.toolCalls.length}
						</span>
					)}
					{group.thinkingText && (
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
					{group.userContent && (
						<div>
							<button
								type="button"
								className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
								onClick={() => setPromptExpanded(!promptExpanded)}
							>
								<span>{promptExpanded ? "▼" : "▶"}</span>
								<span>사용자 입력</span>
							</button>
							{promptExpanded && (
								<div className="rounded-lg border bg-purple-50 dark:bg-purple-950/20 p-3 text-sm whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
									{group.userContent}
								</div>
							)}
						</div>
					)}

					{/* Thinking */}
					{group.thinkingText && (
						<div>
							<button
								type="button"
								className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
								onClick={() => setThinkingExpanded(!thinkingExpanded)}
							>
								<span>{thinkingExpanded ? "▼" : "▶"}</span>
								<span>에이전트 사고</span>
							</button>
							{thinkingExpanded && (
								<div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground whitespace-pre-wrap break-words max-h-64 overflow-y-auto italic">
									{group.thinkingText}
								</div>
							)}
						</div>
					)}

					{/* Assistant text & tool calls (interleaved) */}
					{group.orderedBlocks.map((block, idx) => {
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
				</div>
			)}
		</div>
	);
}

export function ConversationView({ data }: ConversationViewProps) {
	const groups = useMemo(
		() => groupMessagesIntoTurns(data.messages),
		[data.messages],
	);
	const [expandAll, setExpandAll] = useState(false);

	if (groups.length === 0) {
		return (
			<div className="rounded-xl border bg-card p-6 text-center">
				<p className="text-sm text-muted-foreground">
					대화 데이터가 비어 있습니다.
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-3">
			{/* Header */}
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h3 className="text-sm font-medium">
					대화 내용
					<span className="ml-2 text-xs font-normal text-muted-foreground">
						{groups.length}개 턴 · {data.totalMessages}개 메시지
						{data.subagents.length > 0 &&
							` · ${data.subagents.length}개 서브에이전트`}
					</span>
				</h3>
				<button
					type="button"
					className="rounded-md border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted transition-colors"
					onClick={() => setExpandAll(!expandAll)}
				>
					{expandAll ? "모두 접기" : "모두 펼치기"}
				</button>
			</div>

			{data.truncated && (
				<div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
					총 {data.totalMessages}개 메시지 중 일부만 표시되고 있습니다.
				</div>
			)}

			{/* Turn list */}
			<div className="space-y-2">
				{groups.map((group) => (
					<TurnCard
						key={group.index}
						group={group}
						forceExpanded={expandAll}
					/>
				))}
			</div>
		</div>
	);
}
