import { Pause, Play, Trash2 } from "lucide-react";
import { useEventStream } from "../../hooks/use-event-stream";
import { cn } from "../../lib/utils";
import { EventCard } from "./event-card";

const STATUS_STYLES: Record<string, { dot: string; label: string }> = {
	connecting: { dot: "bg-amber-400 animate-pulse", label: "연결 중..." },
	connected: { dot: "bg-green-500", label: "연결됨" },
	disconnected: { dot: "bg-yellow-400 animate-pulse", label: "재연결 중..." },
	error: { dot: "bg-red-500", label: "연결 오류" },
};

export function EventStream() {
	const { events, status, isPaused, setIsPaused, clearEvents } = useEventStream();

	const statusStyle = STATUS_STYLES[status] ?? STATUS_STYLES.disconnected;

	return (
		<div className="flex h-full flex-col gap-3">
			{/* Toolbar */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<span className={cn("inline-block h-2 w-2 rounded-full", statusStyle.dot)} />
					<span className="text-sm text-muted-foreground">{statusStyle.label}</span>
				</div>

				<div className="flex items-center gap-2">
					<span className="text-xs text-muted-foreground">{events.length}개 이벤트</span>

					<button
						type="button"
						onClick={() => setIsPaused(!isPaused)}
						className={cn(
							"flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
							isPaused
								? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
								: "hover:bg-muted",
						)}
					>
						{isPaused ? (
							<>
								<Play className="h-3 w-3" />
								재개
							</>
						) : (
							<>
								<Pause className="h-3 w-3" />
								일시정지
							</>
						)}
					</button>

					<button
						type="button"
						onClick={clearEvents}
						className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
					>
						<Trash2 className="h-3 w-3" />
						지우기
					</button>
				</div>
			</div>

			{/* Event list */}
			<div className="flex-1 space-y-1.5 overflow-y-auto">
				{events.length === 0 ? (
					<div className="flex h-48 items-center justify-center rounded-xl border bg-card">
						<p className="text-sm text-muted-foreground">
							{status === "connecting"
								? "Loki에 연결 중..."
								: status === "error"
									? "연결 실패. 잠시 후 다시 시도합니다."
									: "이벤트를 기다리는 중..."}
						</p>
					</div>
				) : (
					events.map((event, i) => <EventCard key={`${event.timestamp}-${i}`} event={event} />)
				)}
			</div>
		</div>
	);
}
