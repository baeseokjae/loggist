import { memo } from "react";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@radix-ui/react-dropdown-menu";
import { ChevronDown, X } from "lucide-react";
import { EVENT_TYPE_CONFIG } from "../../lib/constants";
import { cn } from "../../lib/utils";
import type { FacetData } from "../../hooks/use-facets";

interface FilterChipsProps {
	selectedEventTypes: string[];
	onEventTypesChange: (v: string[]) => void;
	models: string[];
	onModelsChange: (v: string[]) => void;
	toolNames: string[];
	onToolNamesChange: (v: string[]) => void;
	success: string | null;
	onSuccessChange: (v: string | null) => void;
	facetData?: FacetData;
}

function toggleItem(current: string[], value: string): string[] {
	return current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
}

interface ChipProps {
	label: string;
	onRemove: () => void;
}

function Chip({ label, onRemove }: ChipProps) {
	return (
		<span className="inline-flex items-center gap-1 rounded-full border bg-muted px-2.5 py-0.5 text-xs font-medium">
			{label}
			<button
				type="button"
				onClick={onRemove}
				className="ml-0.5 rounded-full p-0.5 hover:bg-foreground/10"
				aria-label="필터 제거"
			>
				<X className="h-3 w-3" />
			</button>
		</span>
	);
}

interface FilterDropdownProps {
	label: string;
	options: { value: string; count: number }[];
	selected: string[];
	onChange: (v: string[]) => void;
	renderLabel?: (value: string) => string;
}

function FilterDropdown({ label, options, selected, onChange, renderLabel }: FilterDropdownProps) {
	const count = selected.length;
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className={cn(
						"inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium",
						"bg-background hover:bg-muted transition-colors",
					)}
				>
					{label}{count > 0 && ` (${count})`}
					<ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				className="z-50 min-w-[200px] rounded-md border bg-popover p-1 shadow-md"
				sideOffset={4}
			>
				{options.length === 0 ? (
					<div className="px-2 py-1.5 text-xs text-muted-foreground">항목 없음</div>
				) : (
					options.map((item) => (
						<DropdownMenuCheckboxItem
							key={item.value}
							checked={selected.includes(item.value)}
							onCheckedChange={() => onChange(toggleItem(selected, item.value))}
							onSelect={(e) => e.preventDefault()}
							className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-accent"
						>
							<span className="flex-1 truncate">{renderLabel?.(item.value) ?? item.value}</span>
							<span className="shrink-0 text-muted-foreground">({item.count})</span>
						</DropdownMenuCheckboxItem>
					))
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function SuccessFilterDropdown({ options, value, onChange }: {
	options: { value: string; count: number }[];
	value: string | null;
	onChange: (v: string | null) => void;
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className={cn(
						"inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium",
						"bg-background hover:bg-muted transition-colors",
					)}
				>
					성공/실패{value !== null && " (1)"}
					<ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				className="z-50 min-w-[160px] rounded-md border bg-popover p-1 shadow-md"
				sideOffset={4}
			>
				{options.length === 0 ? (
					<div className="px-2 py-1.5 text-xs text-muted-foreground">항목 없음</div>
				) : (
					options.map((item) => (
						<DropdownMenuCheckboxItem
							key={item.value}
							checked={value === item.value}
							onCheckedChange={(checked) => onChange(checked ? item.value : null)}
							onSelect={(e) => e.preventDefault()}
							className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-accent"
						>
							<span className="flex-1">{item.value === "true" ? "성공" : "실패"}</span>
							<span className="shrink-0 text-muted-foreground">({item.count})</span>
						</DropdownMenuCheckboxItem>
					))
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export const FilterChips = memo(function FilterChips({
	selectedEventTypes,
	onEventTypesChange,
	models,
	onModelsChange,
	toolNames,
	onToolNamesChange,
	success,
	onSuccessChange,
	facetData,
}: FilterChipsProps) {
	const hasAnyFilter =
		selectedEventTypes.length > 0 || models.length > 0 || toolNames.length > 0 || success !== null;

	const eventTypeOptions = facetData?.event_name ?? [];
	const modelOptions = facetData?.model ?? [];
	const toolNameOptions = facetData?.tool_name ?? [];
	const successOptions = facetData?.success ?? [];

	function clearAll() {
		onEventTypesChange([]);
		onModelsChange([]);
		onToolNamesChange([]);
		onSuccessChange(null);
	}

	return (
		<div className="flex flex-col gap-2">
			<div className="flex flex-wrap items-center gap-2">
				<FilterDropdown
					label="이벤트 유형"
					options={eventTypeOptions}
					selected={selectedEventTypes}
					onChange={onEventTypesChange}
					renderLabel={(v) => EVENT_TYPE_CONFIG[v]?.label ?? v}
				/>
				<FilterDropdown
					label="모델"
					options={modelOptions}
					selected={models}
					onChange={onModelsChange}
				/>
				<FilterDropdown
					label="도구"
					options={toolNameOptions}
					selected={toolNames}
					onChange={onToolNamesChange}
				/>
				<SuccessFilterDropdown
					options={successOptions}
					value={success}
					onChange={onSuccessChange}
				/>
				{hasAnyFilter && (
					<button
						type="button"
						onClick={clearAll}
						className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
					>
						모두 지우기
					</button>
				)}
			</div>

			{/* 활성 필터 칩 목록 */}
			{hasAnyFilter && (
				<div className="flex flex-wrap items-center gap-1.5">
					{selectedEventTypes.map((type) => (
						<Chip
							key={`event-${type}`}
							label={`이벤트: ${EVENT_TYPE_CONFIG[type]?.label ?? type}`}
							onRemove={() =>
								onEventTypesChange(selectedEventTypes.filter((v) => v !== type))
							}
						/>
					))}

					{models.map((model) => (
						<Chip
							key={`model-${model}`}
							label={`모델: ${model}`}
							onRemove={() => onModelsChange(models.filter((v) => v !== model))}
						/>
					))}

					{toolNames.map((tool) => (
						<Chip
							key={`tool-${tool}`}
							label={`도구: ${tool}`}
							onRemove={() => onToolNamesChange(toolNames.filter((v) => v !== tool))}
						/>
					))}

					{success !== null && (
						<Chip
							label={`상태: ${success === "true" ? "성공" : "실패"}`}
							onRemove={() => onSuccessChange(null)}
						/>
					)}
				</div>
			)}
		</div>
	);
});
