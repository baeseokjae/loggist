import { EventStream } from "../components/timeline/event-stream";

export function TimelinePage() {
	return (
		<div className="flex h-full flex-col gap-4">
			<h1 className="text-2xl font-bold">실시간 타임라인</h1>
			<div className="min-h-0 flex-1">
				<EventStream />
			</div>
		</div>
	);
}
