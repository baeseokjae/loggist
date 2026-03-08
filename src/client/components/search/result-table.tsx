import {
	type ColumnDef,
	type SortingState,
	type VisibilityState,
	createColumnHelper,
	flexRender,
	getCoreRowModel,
	getSortedRowModel,
	useReactTable,
} from "@tanstack/react-table";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@radix-ui/react-dropdown-menu";
import { ArrowDown, ArrowUp, ArrowUpDown, Columns3 } from "lucide-react";
import { memo, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { LogEntry } from "../../../shared/types/domain";
import { EVENT_TYPE_CONFIG } from "../../lib/constants";
import { formatNanoTimestamp, formatTokens, formatUSD } from "../../lib/format";
import { cn } from "../../lib/utils";

const COLUMN_VISIBILITY_KEY = "loggist:column-visibility";
const COLUMN_HEADER_LABELS: Record<string, string> = {
	timestamp: "시간",
	event_name: "이벤트",
	model: "모델",
	cost_usd: "비용",
	tokens: "토큰",
	duration_ms: "소요시간",
	details: "상세",
	session_id: "세션",
};

function loadVisibility(): VisibilityState {
	try {
		const stored = localStorage.getItem(COLUMN_VISIBILITY_KEY);
		if (stored) return JSON.parse(stored) as VisibilityState;
	} catch {}
	return {};
}

function saveVisibility(v: VisibilityState) {
	try {
		localStorage.setItem(COLUMN_VISIBILITY_KEY, JSON.stringify(v));
	} catch {}
}

interface ResultTableProps {
	entries: LogEntry[];
	isLoading?: boolean;
	isFetchingNewFilter?: boolean;
	selectedId?: string;
	onRowClick?: (entry: LogEntry) => void;
	sorting?: SortingState;
	onSortingChange?: (sorting: SortingState) => void;
}

function hashToColor(str: string): string {
	const colors = [
		"#5794F2", // blue
		"#73BF69", // green
		"#FF9830", // orange
		"#B877D9", // purple
		"#F2495C", // red
		"#56A64B", // dark green
		"#E0AE00", // yellow
		"#1F78C1", // dark blue
		"#8AB8FF", // light blue
		"#FF7383", // light red
	];
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
	}
	return colors[hash % colors.length];
}

function DetailsCell({ entry }: { entry: LogEntry }) {
	if (entry.event_name === "api_error") {
		return (
			<span className="truncate text-red-600">
				{entry.status_code != null ? `HTTP ${entry.status_code} ` : ""}
				{entry.error_message ?? ""}
			</span>
		);
	}
	if (entry.event_name === "tool_result" || entry.event_name === "tool_decision") {
		return <span>{entry.tool_name ?? "-"}</span>;
	}
	return <span className="truncate opacity-60">{entry.raw?.slice(0, 80) ?? "-"}</span>;
}

function SortIcon({ column }: { column: { getIsSorted: () => false | "asc" | "desc" } }) {
	const sorted = column.getIsSorted();
	if (sorted === "asc") return <ArrowUp className="inline h-3 w-3 ml-1" />;
	if (sorted === "desc") return <ArrowDown className="inline h-3 w-3 ml-1" />;
	return <ArrowUpDown className="inline h-3 w-3 ml-1 opacity-40" />;
}

const DEFAULT_SORTING: SortingState = [{ id: "timestamp", desc: true }];
const coreRowModel = getCoreRowModel<LogEntry>();
const sortedRowModel = getSortedRowModel<LogEntry>();

const columnHelper = createColumnHelper<LogEntry>();

const columns: ColumnDef<LogEntry, unknown>[] = [
	columnHelper.accessor("timestamp", {
		header: "시간",
		cell: (info) => (
			<span className="whitespace-nowrap font-mono text-xs text-muted-foreground">
				{formatNanoTimestamp(info.getValue() as string)}
			</span>
		),
		enableSorting: true,
		sortDescFirst: true,
	}) as ColumnDef<LogEntry, unknown>,
	columnHelper.accessor("event_name", {
		header: "이벤트",
		cell: (info) => {
			const value = (info.getValue() as string | undefined) ?? "";
			const config = EVENT_TYPE_CONFIG[value];
			return (
				<span
					className={cn(
						"rounded px-1.5 py-0.5 text-xs font-medium",
						config?.badgeClass ?? "bg-muted text-muted-foreground",
					)}
				>
					{config?.label ?? value ?? "-"}
				</span>
			);
		},
		enableSorting: false,
	}) as ColumnDef<LogEntry, unknown>,
	columnHelper.accessor("model", {
		header: "모델",
		cell: (info) => (
			<span className="text-xs">{(info.getValue() as string | undefined) ?? "-"}</span>
		),
		enableSorting: false,
	}) as ColumnDef<LogEntry, unknown>,
	columnHelper.accessor("cost_usd", {
		header: "비용",
		cell: (info) => {
			const v = info.getValue() as number | undefined;
			return <span className="text-xs">{v != null ? formatUSD(v) : "-"}</span>;
		},
		enableSorting: true,
	}) as ColumnDef<LogEntry, unknown>,
	columnHelper.accessor(
		(row) => (row.input_tokens ?? 0) + (row.output_tokens ?? 0) || 0,
		{
			id: "tokens",
			header: "토큰",
			cell: (info) => {
				const v = info.getValue() as number;
				return <span className="text-xs">{v > 0 ? formatTokens(v) : "-"}</span>;
			},
			enableSorting: true,
		},
	) as ColumnDef<LogEntry, unknown>,
	columnHelper.accessor("duration_ms", {
		header: "소요시간",
		cell: (info) => {
			const v = info.getValue() as number | undefined;
			if (v == null) return <span className="text-xs">-</span>;
			const text = v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${v}ms`;
			return <span className="text-xs">{text}</span>;
		},
		enableSorting: true,
	}) as ColumnDef<LogEntry, unknown>,
	columnHelper.display({
		id: "details",
		header: "상세",
		cell: ({ row }) => (
			<span className="max-w-xs text-xs">
				<DetailsCell entry={row.original} />
			</span>
		),
		enableSorting: false,
	}) as ColumnDef<LogEntry, unknown>,
	columnHelper.accessor("session_id", {
		header: "세션",
		cell: (info) => {
			const id = info.getValue() as string | undefined;
			if (!id) return <span className="text-xs">-</span>;
			return (
				<Link
					to={`/sessions?id=${id}`}
					className="font-mono text-xs text-primary underline-offset-2 hover:underline"
					onClick={(e) => e.stopPropagation()}
				>
					{id.slice(0, 8)}
				</Link>
			);
		},
		enableSorting: false,
	}) as ColumnDef<LogEntry, unknown>,
];

function ColumnVisibilityDropdown({ table }: { table: ReturnType<typeof useReactTable<LogEntry>> }) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className={cn(
						"inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium",
						"bg-background hover:bg-muted transition-colors",
					)}
				>
					<Columns3 className="h-3.5 w-3.5" />
					열
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				className="z-50 min-w-[140px] rounded-md border bg-popover p-1 shadow-md"
				align="end"
				sideOffset={4}
			>
				{table.getAllColumns().filter((col) => col.getCanHide()).map((col) => (
					<DropdownMenuCheckboxItem
						key={col.id}
						checked={col.getIsVisible()}
						onCheckedChange={(v) => col.toggleVisibility(!!v)}
						onSelect={(e) => e.preventDefault()}
						className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-accent"
					>
						{COLUMN_HEADER_LABELS[col.id] ?? col.id}
					</DropdownMenuCheckboxItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export const ResultTable = memo(function ResultTable({
	entries,
	isLoading,
	isFetchingNewFilter,
	selectedId,
	onRowClick,
	sorting: externalSorting,
	onSortingChange,
}: ResultTableProps) {
	const sorting: SortingState = externalSorting ?? DEFAULT_SORTING;
	const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(loadVisibility);

	useEffect(() => {
		saveVisibility(columnVisibility);
	}, [columnVisibility]);

	const table = useReactTable({
		data: entries,
		columns,
		state: { sorting, columnVisibility },
		onSortingChange: (updater) => {
			if (onSortingChange) {
				const next = typeof updater === "function" ? updater(sorting) : updater;
				onSortingChange(next);
			}
		},
		onColumnVisibilityChange: (updater) => {
			setColumnVisibility((prev) =>
				typeof updater === "function" ? updater(prev) : updater,
			);
		},
		getCoreRowModel: coreRowModel,
		getSortedRowModel: sortedRowModel,
		manualSorting: false,
	});

	if (isLoading) {
		return (
			<div className="flex h-48 items-center justify-center rounded-xl border bg-card">
				<p className="text-sm text-muted-foreground">검색 중...</p>
			</div>
		);
	}

	if (entries.length === 0) {
		return (
			<div className="flex h-48 items-center justify-center rounded-xl border bg-card">
				<p className="text-sm text-muted-foreground">결과가 없습니다.</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-2">
			{/* 인포 바 */}
			<div className="flex items-center justify-between text-xs text-muted-foreground">
				<div className="flex items-center gap-2">
					<span className="font-medium text-foreground">{entries.length}건</span>
					<span>· 로드된 {entries.length}건 내에서 정렬됨</span>
				</div>
				<ColumnVisibilityDropdown table={table} />
			</div>

			<div className={cn(
				"overflow-x-auto rounded-xl border bg-card transition-opacity duration-150",
				isFetchingNewFilter && "opacity-50",
			)}>
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
							{table.getFlatHeaders().map((header) => {
								const canSort = header.column.getCanSort();
								return (
									<th
										key={header.id}
										className={cn(
											"px-3 py-2 font-medium",
											canSort && "cursor-pointer select-none hover:text-foreground",
										)}
										onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
									>
										{flexRender(header.column.columnDef.header, header.getContext())}
										{canSort && <SortIcon column={header.column} />}
									</th>
								);
							})}
						</tr>
					</thead>
					<tbody className="divide-y divide-border">
						{table.getRowModel().rows.map((row) => {
							const entry = row.original;
							const sessionColor = entry.session_id ? hashToColor(entry.session_id) : undefined;
							const isSelected = selectedId != null && entry.timestamp === selectedId;

							return (
								<tr
									key={row.id}
									onClick={() => onRowClick?.(entry)}
									className={cn(
										"relative transition-colors",
										onRowClick && "cursor-pointer hover:bg-muted/30",
										entry.event_name === "api_error" && "bg-destructive/5",
										isSelected && "bg-primary/5 ring-1 ring-inset ring-primary/20",
									)}
									style={
										sessionColor
											? {
													borderLeft: `2px solid ${sessionColor}`,
												}
											: undefined
									}
								>
									{row.getVisibleCells().map((cell) => (
										<td key={cell.id} className="px-3 py-2">
											{flexRender(cell.column.columnDef.cell, cell.getContext())}
										</td>
									))}
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</div>
	);
});
