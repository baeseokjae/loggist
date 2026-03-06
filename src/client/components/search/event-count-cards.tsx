import { memo } from "react";
import { cn } from "../../lib/utils";
import { EVENT_TYPE_CONFIG, EVENT_TYPE_NAMES } from "../../lib/constants";

interface EventCountCardsProps {
	counts: Record<string, number>;
	isLoading: boolean;
	onEventTypeClick: (eventType: string) => void;
}

export const EventCountCards = memo(function EventCountCards({ counts, isLoading, onEventTypeClick }: EventCountCardsProps) {
	return (
		<div className="grid grid-cols-2 gap-3 md:grid-cols-5">
			{EVENT_TYPE_NAMES.map((type) => {
				const config = EVENT_TYPE_CONFIG[type];
				return (
					<button
						key={type}
						type="button"
						onClick={() => onEventTypeClick(type)}
						className={cn(
							"rounded-xl border border-l-4 bg-card p-4 text-left transition-colors hover:bg-muted/50",
							config?.borderClass,
						)}
					>
						{isLoading ? (
							<div className="space-y-2">
								<div className="h-4 w-16 animate-pulse rounded bg-muted" />
								<div className="h-6 w-10 animate-pulse rounded bg-muted" />
							</div>
						) : (
							<>
								<p className="text-xs text-muted-foreground">{config?.label ?? type}</p>
								<p className="mt-1 text-2xl font-bold tabular-nums">
									{(counts[type] ?? 0).toLocaleString()}
								</p>
							</>
						)}
					</button>
				);
			})}
		</div>
	);
});
