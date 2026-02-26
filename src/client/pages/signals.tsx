import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { SignalRule } from "../../shared/types/domain";
import { SignalList } from "../components/signals/signal-list";
import { api } from "../lib/api-client";
import { RULE_LABELS } from "../lib/constants";
import { cn } from "../lib/utils";

const PAGE_SIZE = 20;

const RULE_FILTER_OPTIONS = [
	{ value: "all", label: "전체 규칙" },
	...Object.entries(RULE_LABELS).map(([value, label]) => ({ value, label })),
];

const ACK_FILTER_OPTIONS = [
	{ value: "all", label: "전체" },
	{ value: "0", label: "미확인" },
	{ value: "1", label: "확인됨" },
];

export function SignalsPage() {
	const [ruleId, setRuleId] = useState("all");
	const [acknowledged, setAcknowledged] = useState("all");
	const [page, setPage] = useState(0);
	const [total, setTotal] = useState(0);
	const [rulesMap, setRulesMap] = useState<Map<string, SignalRule>>(new Map());

	const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

	// Fetch rules once for name/severity lookup
	useEffect(() => {
		api
			.get<{ rules: SignalRule[] }>("/signals/rules")
			.then((res) => {
				const map = new Map<string, SignalRule>();
				for (const rule of res.rules) {
					map.set(rule.id, rule);
				}
				setRulesMap(map);
			})
			.catch(() => {
				// Use static fallback if rules endpoint isn't available yet
			});
	}, []);

	// Reset to page 0 when filters change
	function handleRuleChange(value: string) {
		setRuleId(value);
		setPage(0);
	}

	function handleAckChange(value: string) {
		setAcknowledged(value);
		setPage(0);
	}

	const handleTotalChange = useCallback((newTotal: number) => {
		setTotal(newTotal);
	}, []);

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-bold">시그널</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					이상 감지 규칙에 의해 발생한 알림을 확인하고 관리합니다.
				</p>
			</div>

			{/* Filters */}
			<div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
				<div className="flex items-center gap-2">
					<span className="text-xs font-medium text-muted-foreground">규칙</span>
					<select
						value={ruleId}
						onChange={(e) => handleRuleChange(e.target.value)}
						className="h-7 rounded border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
					>
						{RULE_FILTER_OPTIONS.map((opt) => (
							<option key={opt.value} value={opt.value}>
								{opt.label}
							</option>
						))}
					</select>
				</div>

				<div className="flex items-center gap-1 rounded-md border bg-background p-0.5">
					{ACK_FILTER_OPTIONS.map((opt) => (
						<button
							key={opt.value}
							type="button"
							onClick={() => handleAckChange(opt.value)}
							className={cn(
								"rounded px-2.5 py-1 text-xs font-medium transition-colors",
								acknowledged === opt.value
									? "bg-primary text-primary-foreground"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							{opt.label}
						</button>
					))}
				</div>

				<span className="ml-auto text-xs text-muted-foreground">
					총 {total}건
				</span>
			</div>

			{/* Signal list */}
			<SignalList
				ruleId={ruleId}
				acknowledged={acknowledged}
				page={page}
				pageSize={PAGE_SIZE}
				onTotalChange={handleTotalChange}
				rulesMap={rulesMap}
			/>

			{/* Pagination */}
			{totalPages > 1 && (
				<div className="flex items-center justify-center gap-2">
					<button
						type="button"
						onClick={() => setPage((p) => Math.max(0, p - 1))}
						disabled={page === 0}
						className="flex h-8 w-8 items-center justify-center rounded-md border bg-card transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
					>
						<ChevronLeft className="h-4 w-4" />
					</button>

					<div className="flex items-center gap-1">
						{Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
							const pageNum = getPageNum(i, page, totalPages);
							if (pageNum === -1) {
								return (
									<span
										// biome-ignore lint/suspicious/noArrayIndexKey: ellipsis slots
										key={`ellipsis-${i}`}
										className="px-1 text-xs text-muted-foreground"
									>
										…
									</span>
								);
							}
							return (
								<button
									// biome-ignore lint/suspicious/noArrayIndexKey: page number buttons
									key={`page-${i}`}
									type="button"
									onClick={() => setPage(pageNum)}
									className={cn(
										"flex h-8 w-8 items-center justify-center rounded-md border text-xs font-medium transition-colors",
										pageNum === page
											? "border-primary bg-primary text-primary-foreground"
											: "bg-card hover:bg-muted",
									)}
								>
									{pageNum + 1}
								</button>
							);
						})}
					</div>

					<button
						type="button"
						onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
						disabled={page >= totalPages - 1}
						className="flex h-8 w-8 items-center justify-center rounded-md border bg-card transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
					>
						<ChevronRight className="h-4 w-4" />
					</button>
				</div>
			)}
		</div>
	);
}

/**
 * Returns up to 7 page slots with ellipsis (-1) for large page counts.
 * Slot index 0..6 maps to actual page numbers centered around current page.
 */
function getPageNum(slotIndex: number, currentPage: number, totalPages: number): number {
	if (totalPages <= 7) {
		return slotIndex < totalPages ? slotIndex : -1;
	}

	const pages: (number | -1)[] = [];

	// Always show first, last, current, and neighbors
	const show = new Set<number>();
	show.add(0);
	show.add(totalPages - 1);
	for (let d = -1; d <= 1; d++) {
		const p = currentPage + d;
		if (p >= 0 && p < totalPages) show.add(p);
	}

	const sorted = Array.from(show).sort((a, b) => a - b);

	let prev = -1;
	for (const p of sorted) {
		if (prev !== -1 && p - prev > 1) pages.push(-1);
		pages.push(p);
		prev = p;
	}

	// Pad or trim to exactly 7 slots
	while (pages.length < 7) pages.push(-1);

	return pages[slotIndex] ?? -1;
}
