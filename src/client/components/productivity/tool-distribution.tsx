import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api-client";
import { formatPercent } from "../../lib/format";

// ── Color vars cycling through chart CSS vars ─────────────────────────────────
const MODEL_COLOR_VARS = [
	"var(--color-chart-1)",
	"var(--color-chart-2)",
	"var(--color-chart-3)",
	"var(--color-chart-4)",
	"var(--color-chart-5)",
];

interface ToolStat {
	name: string;
	totalCalls: number;
	successCount: number;
	failureCount: number;
	successRate: number;
}

interface ToolDistributionProps {
	profile: string;
	start: string;
	end: string;
}

interface ToolDistributionResponse {
	data: {
		tools: ToolStat[];
	};
}

export function useToolDistribution(profile: string, start: string, end: string) {
	return useQuery({
		queryKey: ["tool-distribution", profile, start, end],
		queryFn: () =>
			api.get<ToolDistributionResponse>(
				`/logs/tool-distribution?profile=${profile}&start=${start}&end=${end}`,
			),
		select: (res) => res?.data?.tools ?? [],
		enabled: !!start && !!end,
		refetchInterval: 60_000,
	});
}

export function ToolDistribution({ profile, start, end }: ToolDistributionProps) {
	const { data: tools, isLoading } = useToolDistribution(profile, start, end);

	if (isLoading) {
		return (
			<div className="rounded-xl border bg-card p-4">
				<h3 className="mb-3 text-sm font-medium">도구 사용 분포</h3>
				<div className="space-y-3">
					{[1, 2, 3].map((i) => (
						<div key={i} className="animate-pulse">
							<div className="mb-1 h-3 w-32 rounded bg-muted" />
							<div className="h-2 rounded-full bg-muted" />
						</div>
					))}
				</div>
			</div>
		);
	}

	if (!tools || tools.length === 0) {
		return (
			<div className="rounded-xl border bg-card p-4">
				<h3 className="mb-3 text-sm font-medium">도구 사용 분포</h3>
				<p className="text-sm text-muted-foreground">도구 사용 데이터가 없습니다.</p>
			</div>
		);
	}

	const maxCalls = tools[0]?.totalCalls ?? 1;

	return (
		<div className="rounded-xl border bg-card p-4">
			<h3 className="mb-3 text-sm font-medium">도구 사용 분포</h3>
			<div className="space-y-3">
				{tools.map((tool, idx) => {
					const pct = maxCalls > 0 ? (tool.totalCalls / maxCalls) * 100 : 0;
					const failureRate = tool.totalCalls > 0 ? (tool.failureCount / tool.totalCalls) * 100 : 0;
					const color = MODEL_COLOR_VARS[idx % MODEL_COLOR_VARS.length];
					return (
						<div key={tool.name}>
							<div className="mb-1 flex items-center justify-between text-xs">
								<div className="flex items-center gap-2">
									<span className="font-medium" title={tool.name}>
										{tool.name}
									</span>
									{failureRate > 10 && (
										<span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
											실패 {formatPercent(failureRate)}
										</span>
									)}
								</div>
								<span className="text-muted-foreground">
									{tool.totalCalls}회 ({formatPercent((tool.totalCalls / (tools.reduce((s, t) => s + t.totalCalls, 0) || 1)) * 100)})
								</span>
							</div>
							<div className="h-2 overflow-hidden rounded-full bg-muted">
								<div
									className="h-full rounded-full transition-all duration-500"
									style={{ width: `${pct}%`, backgroundColor: color }}
								/>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
