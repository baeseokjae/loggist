import type { SessionSummary } from "../../../shared/types/domain";
import { formatDuration, formatRelativeTime, formatUSD } from "../../lib/format";
import { cn } from "../../lib/utils";

interface SessionListProps {
	sessions: SessionSummary[] | undefined;
	selectedSession: string | null;
	onSelectSession: (id: string) => void;
	isLoading: boolean;
}

function formatSessionDuration(durationNs: number): string {
	const seconds = Math.max(0, Math.floor(durationNs / 1_000_000_000));
	return formatDuration(seconds);
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
						session.toolFailures > 0 && "border-l-2 border-l-destructive",
					)}
				>
					<div className="flex items-start justify-between gap-2">
						<span
							className="flex-1 truncate text-sm font-medium"
							title={session.firstPrompt ?? session.sessionId}
						>
							{session.firstPrompt ?? `${session.sessionId.slice(0, 8)}...`}
						</span>
						<span className="shrink-0 text-sm font-semibold">
							{formatUSD(session.totalCost)}
						</span>
					</div>
					<div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
						<span>{formatRelativeTime(session.startTime)}</span>
						<span className="text-muted-foreground/40">·</span>
						<span>{formatSessionDuration(session.durationMs)}</span>
						{session.toolFailures > 0 && (
							<>
								<span className="text-muted-foreground/40">·</span>
								<span className="text-destructive">
									{session.toolFailures} failures
								</span>
							</>
						)}
					</div>
					<div className="mt-0.5 font-mono text-[10px] text-muted-foreground/50">
						{session.sessionId.slice(0, 8)}
					</div>
				</button>
			))}
			{sessions?.length === 0 && (
				<p className="text-sm text-muted-foreground">세션 데이터가 없습니다.</p>
			)}
		</div>
	);
}
