import type { SessionSummary } from "../../../shared/types/domain";
import { formatUSD } from "../../lib/format";
import { cn } from "../../lib/utils";

interface SessionListProps {
	sessions: SessionSummary[] | undefined;
	selectedSession: string | null;
	onSelectSession: (id: string) => void;
	isLoading: boolean;
}

export function SessionList({
	sessions,
	selectedSession,
	onSelectSession,
	isLoading,
}: SessionListProps) {
	return (
		<div className="space-y-2 lg:col-span-1">
			<h2 className="text-sm font-medium text-muted-foreground">최근 세션</h2>
			{isLoading && <p className="text-sm text-muted-foreground">불러오는 중...</p>}
			{sessions?.map((session) => (
				<button
					type="button"
					key={session.sessionId}
					onClick={() => onSelectSession(session.sessionId)}
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
						<span className="truncate">{session.models.join(", ")}</span>
					</div>
				</button>
			))}
			{sessions?.length === 0 && (
				<p className="text-sm text-muted-foreground">세션 데이터가 없습니다.</p>
			)}
		</div>
	);
}
