import type { SessionSummary } from "../../../shared/types/domain";

interface Bin {
	label: string;
	count: number;
	minNs: number;
	maxNs: number;
}

interface SessionHistogramProps {
	sessions: SessionSummary[];
	onFilterChange: (range: [number, number] | null) => void;
	activeFilter: [number, number] | null;
}

// Bin edges in seconds, converted to nanoseconds for comparison
const BIN_EDGES_SEC = [0, 60, 300, 600, 1800, 3600, Infinity];
const BIN_LABELS = ["<1분", "1-5분", "5-10분", "10-30분", "30-60분", ">1시간"];

const NS_PER_SEC = 1_000_000_000;

function buildBins(sessions: SessionSummary[]): Bin[] {
	const bins: Bin[] = BIN_LABELS.map((label, i) => ({
		label,
		count: 0,
		minNs: BIN_EDGES_SEC[i] * NS_PER_SEC,
		maxNs: BIN_EDGES_SEC[i + 1] * NS_PER_SEC,
	}));

	for (const session of sessions) {
		const durationNs = session.durationMs;
		for (const bin of bins) {
			if (durationNs >= bin.minNs && durationNs < bin.maxNs) {
				bin.count++;
				break;
			}
		}
	}

	return bins;
}

export function SessionHistogram({
	sessions,
	onFilterChange,
	activeFilter,
}: SessionHistogramProps) {
	const bins = buildBins(sessions);
	const total = sessions.length;

	return (
		<div className="rounded-xl border bg-card p-4">
			<div className="mb-3 flex items-center justify-between">
				<h2 className="text-sm font-medium text-muted-foreground">세션 시간 분포</h2>
				<span className="text-xs text-muted-foreground">{total}개 세션</span>
			</div>
			<div className="space-y-1.5">
				{bins.map((bin, i) => {
					const pct = total > 0 ? (bin.count / total) * 100 : 0;
					const isActive =
						activeFilter !== null &&
						activeFilter[0] === bin.minNs &&
						activeFilter[1] === bin.maxNs;
					return (
						<button
							key={i}
							type="button"
							className="flex w-full items-center gap-2 rounded px-1 py-0.5 transition-colors hover:bg-muted/50"
							onClick={() => {
								if (isActive) {
									onFilterChange(null);
								} else {
									onFilterChange([bin.minNs, bin.maxNs]);
								}
							}}
						>
							<span className="w-16 text-right text-xs text-muted-foreground">
								{bin.label}
							</span>
							<div className="h-5 flex-1 overflow-hidden rounded bg-muted">
								<div
									className={`h-full rounded transition-all ${isActive ? "bg-chart-2" : "bg-chart-1"}`}
									style={{ width: `${pct}%` }}
								/>
							</div>
							<span className="w-10 text-left text-xs text-muted-foreground">
								{bin.count}
							</span>
						</button>
					);
				})}
			</div>
		</div>
	);
}
