import { useState } from "react";
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
	topFailureReasons?: Array<{ message: string; count: number }>;
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
	const [expandedTool, setExpandedTool] = useState<string | null>(null);

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
					const reasons = tool.topFailureReasons ?? [];
					const hasReasons = tool.failureCount > 0 && reasons.length > 0;
					const isExpanded = expandedTool === tool.name;
					return (
						<div key={tool.name}>
							<div className="mb-1 flex items-center justify-between text-xs">
								<div className="flex items-center gap-2">
									<span className="font-medium" title={tool.name}>
										{tool.name}
									</span>
									{failureRate > 10 && (
										<button
											type="button"
											className="flex items-center gap-0.5 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive transition-colors hover:bg-destructive/20"
											onClick={hasReasons ? () => setExpandedTool(isExpanded ? null : tool.name) : undefined}
											style={{ cursor: hasReasons ? "pointer" : "default" }}
										>
											실패 {formatPercent(failureRate)}
											{hasReasons && (
												<span className="ml-0.5 text-[9px]">{isExpanded ? "\u25B2" : "\u25BC"}</span>
											)}
										</button>
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
							{isExpanded && reasons.length > 0 && (
								<div className="mt-1.5 space-y-1 rounded-lg bg-destructive/5 px-3 py-2">
									{reasons.map((r) => (
										<div key={r.message} className="flex items-start justify-between gap-2 text-[11px]">
											<span className="text-muted-foreground break-all line-clamp-2">{r.message}</span>
											<span className="shrink-0 font-medium text-destructive">{r.count}회</span>
										</div>
									))}
								</div>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}
