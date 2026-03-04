import { useEffect, useState } from "react";
import type { SessionEvent } from "../../../shared/types/domain";
import { useUnifiedTurns } from "../../hooks/use-unified-turns";
import { UnifiedTurnCard } from "./unified-turn";
import { ConversationTimeline } from "./conversation-timeline";

interface UnifiedTimelineProps {
	sessionId: string;
	events: SessionEvent[];
}

function UnifiedTimelineSkeleton() {
	return (
		<div className="space-y-3 animate-pulse">
			{/* Header skeleton: title + stats + button */}
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="flex items-center gap-2">
					<div className="h-4 w-28 rounded bg-muted" />
					<div className="h-3 w-36 rounded bg-muted" />
				</div>
				<div className="h-7 w-24 rounded-md border bg-muted" />
			</div>
			{/* Turn card skeletons x4 */}
			{Array.from({ length: 4 }).map((_, i) => (
				<div key={i} className="rounded-xl border bg-card p-4 space-y-2">
					{/* Turn badge + time + model */}
					<div className="flex items-center gap-3">
						<span className="h-5 w-2 rounded bg-muted" />
						<div className="h-5 w-14 rounded bg-muted" />
						<div className="h-4 w-16 rounded bg-muted" />
						<div className="h-4 w-32 rounded bg-muted" />
						<div className="flex-1" />
						{/* Badge skeletons */}
						<div className="h-5 w-12 rounded bg-muted" />
						<div className="h-5 w-10 rounded bg-muted" />
					</div>
					{/* Prompt preview line */}
					<div className="ml-5 h-4 w-3/4 rounded bg-muted" />
				</div>
			))}
		</div>
	);
}

export function UnifiedTimeline({ sessionId, events }: UnifiedTimelineProps) {
	const { result, isLoading, conversation } = useUnifiedTurns({
		sessionId,
		events,
	});
	const [expandAll, setExpandAll] = useState(false);

	// Scroll to anchor on mount after data loads
	useEffect(() => {
		if (!result) return;
		const hash = window.location.hash;
		if (!hash || !/^#turn-\d+$/.test(hash)) return;
		const id = hash.slice(1); // remove '#'
		const timer = setTimeout(() => {
			const el = document.getElementById(id);
			if (el) {
				el.scrollIntoView({ behavior: "smooth", block: "start" });
			}
		}, 150);
		return () => clearTimeout(timer);
	}, [result]);

	// Loading state: JSONL not yet available
	if (isLoading && !conversation) {
		return <UnifiedTimelineSkeleton />;
	}

	// JSONL unavailable: show informational banner + telemetry fallback
	if (!conversation) {
		return (
			<div className="space-y-3">
				<div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
					이 세션의 JSONL 대화 파일을 찾을 수 없어 텔레메트리 전용 뷰로 표시합니다.
					~/.claude/projects 디렉토리에 해당 세션의 JSONL 파일이 있는지 확인하세요.
				</div>
				<ConversationTimeline events={events} />
			</div>
		);
	}

	// Unified timeline available
	const turns = result?.turns ?? [];

	return (
		<div className="space-y-3">
			{/* Header */}
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h3 className="text-sm font-medium">
					대화 타임라인
					<span className="ml-2 text-xs font-normal text-muted-foreground">
						{turns.length}개 턴 · {conversation.totalMessages}개 메시지
						{conversation.subagents.length > 0 &&
							` · ${conversation.subagents.length}개 서브에이전트`}
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

			{/* Truncated warning */}
			{conversation.truncated && (
				<div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
					총 {conversation.totalMessages}개 메시지 중 일부만 표시되고 있습니다.
				</div>
			)}

			{/* Turn list */}
			<div className="space-y-2">
				{turns.map((turn) => (
					<UnifiedTurnCard
						key={turn.index}
						turn={turn}
						forceExpanded={expandAll}
					/>
				))}
				{turns.length === 0 && (
					<div className="rounded-xl border bg-card p-6 text-center">
						<p className="text-sm text-muted-foreground">
							대화 데이터가 비어 있습니다.
						</p>
					</div>
				)}
			</div>
		</div>
	);
}
