import { BellOff } from "lucide-react";
import { useEffect, useState } from "react";
import type { Signal, SignalRule } from "../../../shared/types/domain";
import { api } from "../../lib/api-client";
import { SignalCard } from "./signal-card";

interface SignalsResponse {
	data: Signal[];
	total: number;
}

interface SignalListProps {
	ruleId: string;
	acknowledged: string;
	page: number;
	pageSize: number;
	onTotalChange: (total: number) => void;
	rulesMap: Map<string, SignalRule>;
}

export function SignalList({
	ruleId,
	acknowledged,
	page,
	pageSize,
	onTotalChange,
	rulesMap,
}: SignalListProps) {
	const [signals, setSignals] = useState<Signal[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const offset = page * pageSize;

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		setError(null);

		const params = new URLSearchParams();
		params.set("limit", String(pageSize));
		params.set("offset", String(offset));
		if (ruleId !== "all") params.set("ruleId", ruleId);
		if (acknowledged !== "all") params.set("acknowledged", acknowledged);

		api
			.get<SignalsResponse>(`/signals?${params.toString()}`)
			.then((res) => {
				if (!cancelled) {
					setSignals(res.data);
					onTotalChange(res.total);
					setLoading(false);
				}
			})
			.catch((err: unknown) => {
				if (!cancelled) {
					setError(err instanceof Error ? err.message : "불러오기 실패");
					setLoading(false);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [ruleId, acknowledged, offset, pageSize, onTotalChange]);

	function handleAcknowledged(id: number) {
		setSignals((prev) =>
			prev.map((s) => (s.id === id ? { ...s, acknowledged: 1 } : s)),
		);
	}

	if (loading) {
		return (
			<div className="space-y-3">
				{Array.from({ length: 3 }).map((_, i) => (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders
						key={i}
						className="h-20 animate-pulse rounded-lg border bg-muted"
					/>
				))}
			</div>
		);
	}

	if (error) {
		return (
			<div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
				<p className="text-sm text-destructive">{error}</p>
			</div>
		);
	}

	if (signals.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center gap-3 rounded-lg border bg-card py-16 text-muted-foreground">
				<BellOff className="h-8 w-8 opacity-40" />
				<p className="text-sm">시그널이 없습니다.</p>
			</div>
		);
	}

	return (
		<div className="space-y-3">
			{signals.map((signal) => (
				<SignalCard
					key={signal.id}
					signal={signal}
					rule={rulesMap.get(signal.rule_id)}
					onAcknowledged={handleAcknowledged}
				/>
			))}
		</div>
	);
}
