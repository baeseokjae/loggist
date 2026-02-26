import { CheckCheck, Clock } from "lucide-react";
import { useState } from "react";
import type { Signal, SignalRule } from "../../../shared/types/domain";
import { api } from "../../lib/api-client";
import { RULE_LABELS, SEVERITY_LABELS, SEVERITY_STYLES } from "../../lib/constants";
import { formatUSD } from "../../lib/format";
import { cn } from "../../lib/utils";

export type { Signal, SignalRule };

function formatFiredAt(iso: string): string {
	return new Date(iso).toLocaleString("ko-KR", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});
}

interface ParsedData {
	cost_usd?: number;
	baseline_cost_usd?: number;
	spike_ratio?: number;
	error_count?: number;
	window_minutes?: number;
	last_event_at?: string;
	silence_minutes?: number;
	cache_hit_ratio?: number;
	threshold?: number;
	budget_usd?: number;
	spend_usd?: number;
	period?: string;
	[key: string]: unknown;
}

function SignalDataDetails({ ruleId, raw }: { ruleId: string; raw: string }) {
	let parsed: ParsedData = {};
	try {
		parsed = JSON.parse(raw) as ParsedData;
	} catch {
		return <span className="text-xs text-muted-foreground">{raw}</span>;
	}

	if (ruleId === "cost_spike") {
		return (
			<div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
				{parsed.cost_usd != null && (
					<span>
						현재 비용: <span className="font-medium text-foreground">{formatUSD(parsed.cost_usd)}</span>
					</span>
				)}
				{parsed.baseline_cost_usd != null && (
					<span>
						기준 비용:{" "}
						<span className="font-medium text-foreground">{formatUSD(parsed.baseline_cost_usd)}</span>
					</span>
				)}
				{parsed.spike_ratio != null && (
					<span>
						급증 비율:{" "}
						<span className="font-medium text-foreground">{parsed.spike_ratio.toFixed(1)}x</span>
					</span>
				)}
			</div>
		);
	}

	if (ruleId === "api_error_burst") {
		return (
			<div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
				{parsed.error_count != null && (
					<span>
						오류 횟수:{" "}
						<span className="font-medium text-foreground">{parsed.error_count}건</span>
					</span>
				)}
				{parsed.window_minutes != null && (
					<span>
						기간:{" "}
						<span className="font-medium text-foreground">{parsed.window_minutes}분</span>
					</span>
				)}
			</div>
		);
	}

	if (ruleId === "data_collection_stopped") {
		return (
			<div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
				{parsed.last_event_at && (
					<span>
						마지막 이벤트:{" "}
						<span className="font-medium text-foreground">
							{new Date(parsed.last_event_at).toLocaleString("ko-KR")}
						</span>
					</span>
				)}
				{parsed.silence_minutes != null && (
					<span>
						무응답 시간:{" "}
						<span className="font-medium text-foreground">{parsed.silence_minutes}분</span>
					</span>
				)}
			</div>
		);
	}

	if (ruleId === "cache_efficiency_drop") {
		return (
			<div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
				{parsed.cache_hit_ratio != null && (
					<span>
						캐시 히트율:{" "}
						<span className="font-medium text-foreground">
							{(parsed.cache_hit_ratio * 100).toFixed(1)}%
						</span>
					</span>
				)}
				{parsed.threshold != null && (
					<span>
						임계값:{" "}
						<span className="font-medium text-foreground">
							{(parsed.threshold * 100).toFixed(1)}%
						</span>
					</span>
				)}
			</div>
		);
	}

	if (ruleId === "budget_exceeded") {
		const periodLabel =
			{ daily: "일일", weekly: "주간", monthly: "월간" }[parsed.period ?? ""] || parsed.period;
		return (
			<div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
				{parsed.spend_usd != null && (
					<span>
						지출:{" "}
						<span className="font-medium text-foreground">{formatUSD(parsed.spend_usd)}</span>
					</span>
				)}
				{parsed.budget_usd != null && (
					<span>
						예산:{" "}
						<span className="font-medium text-foreground">{formatUSD(parsed.budget_usd)}</span>
					</span>
				)}
				{periodLabel && (
					<span>
						기간: <span className="font-medium text-foreground">{periodLabel}</span>
					</span>
				)}
			</div>
		);
	}

	// Fallback: render non-null key-value pairs
	const entries = Object.entries(parsed).filter(([, v]) => v != null);
	if (entries.length === 0) return null;
	return (
		<div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
			{entries.map(([k, v]) => (
				<span key={k}>
					{k}: <span className="font-medium text-foreground">{String(v)}</span>
				</span>
			))}
		</div>
	);
}

interface SignalCardProps {
	signal: Signal;
	rule?: SignalRule;
	onAcknowledged: (id: number) => void;
}

export function SignalCard({ signal, rule, onAcknowledged }: SignalCardProps) {
	const [loading, setLoading] = useState(false);

	const severity = rule?.severity ?? "info";
	const styles = SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.info;
	const ruleName = RULE_LABELS[signal.rule_id] ?? signal.rule_id;

	async function handleAcknowledge() {
		setLoading(true);
		try {
			await api.post(`/signals/${signal.id}/acknowledge`, {});
			onAcknowledged(signal.id);
		} catch (err) {
			console.error("Failed to acknowledge signal", err);
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className={cn("relative flex rounded-lg border bg-card overflow-hidden", styles.card)}>
			{/* Severity bar */}
			<div className={cn("w-1 shrink-0", styles.bar)} />

			<div className="flex min-w-0 flex-1 items-start justify-between gap-4 p-4">
				<div className="min-w-0 flex-1 space-y-1.5">
					<div className="flex flex-wrap items-center gap-2">
						<span
							className={cn(
								"rounded px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide",
								styles.badge,
							)}
						>
							{SEVERITY_LABELS[severity] ?? severity}
						</span>
						<span className="font-medium">{ruleName}</span>
						{signal.profile && (
							<span className="text-xs text-muted-foreground">프로필: {signal.profile}</span>
						)}
					</div>

					<SignalDataDetails ruleId={signal.rule_id} raw={signal.data} />

					<div className="flex items-center gap-1 text-xs text-muted-foreground">
						<Clock className="h-3 w-3" />
						{formatFiredAt(signal.fired_at)}
					</div>
				</div>

				<div className="shrink-0">
					{signal.acknowledged ? (
						<span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
							<CheckCheck className="h-3.5 w-3.5" />
							확인됨
						</span>
					) : (
						<button
							type="button"
							onClick={handleAcknowledge}
							disabled={loading}
							className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
						>
							{loading ? "처리 중..." : "확인"}
						</button>
					)}
				</div>
			</div>
		</div>
	);
}
