import type { SessionEvent, SessionSummary } from "../../../shared/types/domain";
import { formatPercent, formatTokens, formatUSD } from "../../lib/format";
import { cn } from "../../lib/utils";

interface SessionDetail {
	sessionId: string;
	events: SessionEvent[];
	summary: SessionSummary;
}

interface SessionDetailProps {
	detail: SessionDetail;
}

// ── Model colors cycling through chart CSS vars ──────────────────────────────
const MODEL_COLOR_VARS = [
	"var(--color-chart-1)",
	"var(--color-chart-2)",
	"var(--color-chart-3)",
	"var(--color-chart-4)",
	"var(--color-chart-5)",
];

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-lg border bg-card p-3">
			<p className="text-xs text-muted-foreground">{label}</p>
			<p className="text-lg font-bold">{value}</p>
		</div>
	);
}

const EVENT_COLORS: Record<string, string> = {
	api_request: "bg-chart-1",
	api_error: "bg-destructive",
	tool_result: "bg-chart-2",
	tool_decision: "bg-chart-4",
	user_prompt: "bg-chart-5",
};

function EventBadge({ type }: { type: string }) {
	return (
		<span
			className={cn(
				"inline-block h-2 w-2 flex-shrink-0 rounded-full",
				EVENT_COLORS[type] || "bg-muted-foreground",
			)}
		/>
	);
}

// ── Cost by Model section ─────────────────────────────────────────────────────

function CostByModel({ events, totalCost }: { events: SessionEvent[]; totalCost: number }) {
	const modelCosts = new Map<string, number>();
	for (const event of events) {
		if (event.model && event.cost_usd) {
			modelCosts.set(event.model, (modelCosts.get(event.model) ?? 0) + event.cost_usd);
		}
	}

	const sorted = Array.from(modelCosts.entries()).sort((a, b) => b[1] - a[1]);

	if (!sorted.length) {
		return (
			<div className="rounded-xl border bg-card p-4">
				<h3 className="mb-3 text-sm font-medium">모델별 비용</h3>
				<p className="text-sm text-muted-foreground">모델 비용 데이터가 없습니다.</p>
			</div>
		);
	}

	return (
		<div className="rounded-xl border bg-card p-4">
			<h3 className="mb-3 text-sm font-medium">모델별 비용</h3>
			<div className="space-y-3">
				{sorted.map(([model, cost], idx) => {
					const pct = totalCost > 0 ? (cost / totalCost) * 100 : 0;
					const color = MODEL_COLOR_VARS[idx % MODEL_COLOR_VARS.length];
					return (
						<div key={model}>
							<div className="mb-1 flex items-center justify-between text-xs">
								<span className="max-w-[60%] truncate font-medium" title={model}>
									{model}
								</span>
								<span className="text-muted-foreground">
									{formatUSD(cost)} ({formatPercent(pct)})
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

// ── Tool Usage section ────────────────────────────────────────────────────────

interface ToolStat {
	name: string;
	calls: number;
	success: number;
	failure: number;
}

function ToolUsage({ events }: { events: SessionEvent[] }) {
	const toolMap = new Map<string, ToolStat>();

	for (const event of events) {
		if (event.event_name === "tool_result" && event.tool_name) {
			const existing = toolMap.get(event.tool_name) ?? {
				name: event.tool_name,
				calls: 0,
				success: 0,
				failure: 0,
			};
			existing.calls += 1;
			if (event.success === false) {
				existing.failure += 1;
			} else {
				existing.success += 1;
			}
			toolMap.set(event.tool_name, existing);
		}
	}

	const tools = Array.from(toolMap.values()).sort((a, b) => b.calls - a.calls);

	if (!tools.length) {
		return (
			<div className="rounded-xl border bg-card p-4">
				<h3 className="mb-3 text-sm font-medium">도구 사용 현황</h3>
				<p className="text-sm text-muted-foreground">도구 사용 데이터가 없습니다.</p>
			</div>
		);
	}

	return (
		<div className="rounded-xl border bg-card p-4">
			<h3 className="mb-3 text-sm font-medium">도구 사용 현황</h3>
			<div className="overflow-x-auto">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b text-left text-xs text-muted-foreground">
							<th className="pb-2 pr-4 font-medium">도구명</th>
							<th className="pb-2 pr-4 font-medium text-right">호출</th>
							<th className="pb-2 pr-4 font-medium text-right">성공</th>
							<th className="pb-2 font-medium text-right">실패</th>
						</tr>
					</thead>
					<tbody>
						{tools.map((tool) => (
							<tr key={tool.name} className="border-b last:border-0">
								<td className="py-1.5 pr-4 font-medium">{tool.name}</td>
								<td className="py-1.5 pr-4 text-right">{tool.calls}</td>
								<td className="py-1.5 pr-4 text-right text-chart-2">{tool.success}</td>
								<td
									className={cn(
										"py-1.5 text-right",
										tool.failure > 0 ? "text-destructive" : "text-muted-foreground",
									)}
								>
									{tool.failure}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

// ── Token Details section ─────────────────────────────────────────────────────

function TokenDetails({ summary }: { summary: SessionSummary }) {
	const { totalInputTokens, totalOutputTokens, totalCacheTokens } = summary;
	const totalTokens = totalInputTokens + totalOutputTokens + totalCacheTokens;
	const cacheEfficiency =
		totalInputTokens + totalCacheTokens > 0
			? (totalCacheTokens / (totalInputTokens + totalCacheTokens)) * 100
			: 0;

	return (
		<div className="rounded-xl border bg-card p-4">
			<h3 className="mb-3 text-sm font-medium">토큰 상세</h3>
			<div className="space-y-3">
				<div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
					<div>
						<p className="text-xs text-muted-foreground">입력</p>
						<p className="font-semibold">{formatTokens(totalInputTokens)}</p>
					</div>
					<div>
						<p className="text-xs text-muted-foreground">출력</p>
						<p className="font-semibold">{formatTokens(totalOutputTokens)}</p>
					</div>
					<div>
						<p className="text-xs text-muted-foreground">캐시 읽기</p>
						<p className="font-semibold">{formatTokens(totalCacheTokens)}</p>
					</div>
					<div>
						<p className="text-xs text-muted-foreground">합계</p>
						<p className="font-semibold">{formatTokens(totalTokens)}</p>
					</div>
				</div>

				<div>
					<div className="mb-1 flex items-center justify-between text-xs">
						<span className="text-muted-foreground">캐시 효율</span>
						<span className="font-medium">{formatPercent(cacheEfficiency)}</span>
					</div>
					<div className="h-2 overflow-hidden rounded-full bg-muted">
						<div
							className="h-full rounded-full bg-chart-3 transition-all duration-500"
							style={{ width: `${Math.min(cacheEfficiency, 100)}%` }}
						/>
					</div>
					<p className="mt-1 text-xs text-muted-foreground">
						캐시 토큰 / (입력 + 캐시 토큰)
					</p>
				</div>
			</div>
		</div>
	);
}

// ── Event Timeline section ────────────────────────────────────────────────────

function EventTimeline({ events }: { events: SessionEvent[] }) {
	return (
		<div className="rounded-xl border bg-card p-4">
			<h3 className="mb-3 text-sm font-medium">이벤트 타임라인</h3>
			<div className="max-h-72 space-y-1 overflow-y-auto">
				{events.map((event, i) => (
					<div
						key={`${event.timestamp}-${i}`}
						className={cn(
							"flex items-center gap-3 rounded-md px-3 py-1.5 text-sm",
							event.event_name === "api_error" && "bg-destructive/5",
							event.event_name === "tool_result" &&
								event.success === false &&
								"bg-destructive/5",
						)}
					>
						<EventBadge type={event.event_name} />
						<span className="flex-1 truncate">
							{event.tool_name || event.model || event.event_name}
						</span>
						{event.cost_usd ? (
							<span className="text-xs text-muted-foreground">{formatUSD(event.cost_usd)}</span>
						) : null}
					</div>
				))}
			</div>
		</div>
	);
}

// ── Main component ────────────────────────────────────────────────────────────

export function SessionDetail({ detail }: SessionDetailProps) {
	const { summary, events } = detail;

	const toolDecisionEvents = events.filter((e) => e.event_name === "tool_decision");
	const editAccepts = toolDecisionEvents.filter((e) => e.success === true).length;
	const editRejects = toolDecisionEvents.filter((e) => e.success === false).length;
	const editTotal = editAccepts + editRejects;
	const editAcceptRatio = editTotal > 0 ? (editAccepts / editTotal) * 100 : null;

	return (
		<div className="space-y-4">
			<div className="grid grid-cols-4 gap-3">
				<StatCard label="총 비용" value={formatUSD(summary.totalCost)} />
				<StatCard label="API 호출" value={String(summary.apiCalls)} />
				<StatCard label="도구 사용" value={String(summary.toolCalls)} />
				<StatCard label="입력 토큰" value={formatTokens(summary.totalInputTokens)} />
				{editAcceptRatio !== null && (
					<StatCard label="편집 수락률" value={formatPercent(editAcceptRatio)} />
				)}
			</div>

			<CostByModel events={events} totalCost={summary.totalCost} />
			<ToolUsage events={events} />
			<TokenDetails summary={summary} />
			<EventTimeline events={events} />
		</div>
	);
}
