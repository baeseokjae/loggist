import { useMemo, useState } from "react";
import type { SessionEvent } from "../../../shared/types/domain";
import { groupEventsIntoTurns } from "../../lib/conversation";
import { ConversationTurnCard } from "./conversation-turn";

const EVENT_TYPE_LABELS: Record<string, string> = {
	api_request: "API 요청",
	api_error: "API 오류",
	tool_result: "도구 결과",
	tool_decision: "도구 결정",
	user_prompt: "사용자 입력",
};

const ALL_EVENT_TYPES = Object.keys(EVENT_TYPE_LABELS);

interface ConversationTimelineProps {
	events: SessionEvent[];
}

export function ConversationTimeline({ events }: ConversationTimelineProps) {
	const turns = useMemo(() => groupEventsIntoTurns(events), [events]);
	const [expandAll, setExpandAll] = useState(false);
	const [visibleTypes, setVisibleTypes] = useState<Set<string>>(
		() => new Set(ALL_EVENT_TYPES),
	);

	const toggleType = (type: string) => {
		setVisibleTypes((prev) => {
			const next = new Set(prev);
			if (next.has(type)) {
				next.delete(type);
			} else {
				next.add(type);
			}
			return next;
		});
	};

	if (events.length === 0) {
		return (
			<div className="rounded-xl border bg-card p-4">
				<h3 className="mb-3 text-sm font-medium">대화 타임라인</h3>
				<p className="text-sm text-muted-foreground">이벤트 데이터가 없습니다.</p>
			</div>
		);
	}

	return (
		<div className="space-y-3">
			{/* Header bar */}
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h3 className="text-sm font-medium">
					대화 타임라인
					<span className="ml-2 text-xs font-normal text-muted-foreground">
						{turns.length}개 턴 · {events.length}개 이벤트
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

			{/* Filter chips */}
			<div className="flex flex-wrap gap-1.5">
				{ALL_EVENT_TYPES.map((type) => (
					<button
						key={type}
						type="button"
						className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
							visibleTypes.has(type)
								? "bg-primary/10 border-primary/30 text-primary"
								: "bg-muted/50 text-muted-foreground border-transparent"
						}`}
						onClick={() => toggleType(type)}
					>
						{EVENT_TYPE_LABELS[type]}
					</button>
				))}
			</div>

			{/* Turn list */}
			<div className="space-y-2">
				{turns.map((turn) => (
					<ConversationTurnCard
						key={turn.index}
						turn={turn}
						visibleTypes={visibleTypes}
						forceExpanded={expandAll}
					/>
				))}
			</div>
		</div>
	);
}
