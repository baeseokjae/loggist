import { useState } from "react";
import type {
	ToolResultBlock,
	ToolUseBlock,
} from "../../../shared/types/conversation";
import { cn } from "../../lib/utils";

interface ToolUseCardProps {
	toolUse: ToolUseBlock;
	toolResult: ToolResultBlock | null;
}

interface ToolStyle {
	dot: string;
	bg: string;
	badge: string;
}

const TOOL_STYLES: Record<string, ToolStyle> = {
	Read: {
		dot: "bg-blue-500",
		bg: "border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30",
		badge: "bg-blue-500 text-white",
	},
	Glob: {
		dot: "bg-violet-500",
		bg: "border-violet-200 bg-violet-50 dark:border-violet-900 dark:bg-violet-950/30",
		badge: "bg-violet-500 text-white",
	},
	Grep: {
		dot: "bg-violet-500",
		bg: "border-violet-200 bg-violet-50 dark:border-violet-900 dark:bg-violet-950/30",
		badge: "bg-violet-500 text-white",
	},
	Bash: {
		dot: "bg-amber-500",
		bg: "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30",
		badge: "bg-amber-500 text-white",
	},
	Edit: {
		dot: "bg-green-500",
		bg: "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30",
		badge: "bg-green-500 text-white",
	},
	Write: {
		dot: "bg-green-500",
		bg: "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30",
		badge: "bg-green-500 text-white",
	},
	WebSearch: {
		dot: "bg-cyan-500",
		bg: "border-cyan-200 bg-cyan-50 dark:border-cyan-900 dark:bg-cyan-950/30",
		badge: "bg-cyan-500 text-white",
	},
	WebFetch: {
		dot: "bg-cyan-500",
		bg: "border-cyan-200 bg-cyan-50 dark:border-cyan-900 dark:bg-cyan-950/30",
		badge: "bg-cyan-500 text-white",
	},
	Agent: {
		dot: "bg-purple-500",
		bg: "border-purple-200 bg-purple-50 dark:border-purple-900 dark:bg-purple-950/30",
		badge: "bg-purple-500 text-white",
	},
};

const DEFAULT_STYLE: ToolStyle = {
	dot: "bg-muted-foreground",
	bg: "border-border bg-muted/20",
	badge: "bg-muted-foreground text-background",
};

function getToolSummary(
	name: string,
	input: Record<string, unknown>,
): string {
	switch (name) {
		case "Read":
			return String(input.file_path ?? "");
		case "Glob":
			return [input.pattern, input.path].filter(Boolean).join(" in ");
		case "Grep":
			return [input.pattern, input.path].filter(Boolean).join(" in ");
		case "Bash": {
			const cmd = String(input.command ?? "");
			const desc = input.description ? String(input.description) : "";
			return desc || (cmd.length > 80 ? `${cmd.slice(0, 80)}…` : cmd);
		}
		case "Edit":
			return String(input.file_path ?? "");
		case "Write":
			return String(input.file_path ?? "");
		case "WebSearch":
			return String(input.query ?? "");
		case "WebFetch":
			return String(input.url ?? "");
		case "Agent":
			return [input.description, input.subagent_type]
				.filter(Boolean)
				.join(" · ");
		default: {
			const keys = Object.keys(input).slice(0, 3);
			return keys
				.map((k) => {
					const v = input[k];
					const s = typeof v === "string" ? v : JSON.stringify(v);
					return `${k}: ${s && s.length > 40 ? `${s.slice(0, 40)}…` : s}`;
				})
				.join(", ");
		}
	}
}

export function ToolUseCard({ toolUse, toolResult }: ToolUseCardProps) {
	const [expanded, setExpanded] = useState(false);
	const style = TOOL_STYLES[toolUse.name] ?? DEFAULT_STYLE;
	const summary = getToolSummary(toolUse.name, toolUse.input);

	return (
		<div className="relative flex gap-3 pb-3 last:pb-0 min-w-0">
			{/* Timeline rail */}
			<div className="flex flex-col items-center">
				<div
					className={cn(
						"h-2.5 w-2.5 shrink-0 rounded-full mt-1.5",
						style.dot,
					)}
				/>
				<div className="w-px flex-1 bg-border" />
			</div>

			{/* Card */}
			<div className={cn("flex-1 min-w-0 rounded-lg border px-3 py-2 text-sm", style.bg)}>
				<button
					type="button"
					className="flex w-full items-center gap-2 text-left"
					onClick={() => setExpanded(!expanded)}
				>
					<span
						className={cn(
							"shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
							style.badge,
						)}
					>
						{toolUse.name}
					</span>
					<span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
						{summary}
					</span>
					{toolResult && (
						<span
							className={cn(
								"shrink-0 text-[10px] font-medium",
								toolResult.is_error
									? "text-red-600 dark:text-red-400"
									: "text-green-600 dark:text-green-400",
							)}
						>
							{toolResult.is_error ? "오류" : "완료"}
						</span>
					)}
					<span className="shrink-0 text-xs text-muted-foreground">
						{expanded ? "▼" : "▶"}
					</span>
				</button>

				{expanded && (
					<div className="mt-2 space-y-2">
						{/* Input JSON */}
						<div>
							<p className="mb-1 text-[10px] font-medium uppercase text-muted-foreground">
								입력
							</p>
							<pre className="max-h-64 overflow-auto rounded border bg-background/50 p-2 text-xs whitespace-pre-wrap break-words">
								{JSON.stringify(toolUse.input, null, 2)}
							</pre>
						</div>

						{/* Tool result */}
						{toolResult && (
							<div>
								<p className="mb-1 text-[10px] font-medium uppercase text-muted-foreground">
									결과 {toolResult.is_error && "(오류)"}
								</p>
								<pre
									className={cn(
										"max-h-64 overflow-auto rounded border p-2 text-xs whitespace-pre-wrap break-words",
										toolResult.is_error
											? "bg-red-50 dark:bg-red-950/20"
											: "bg-background/50",
									)}
								>
									{toolResult.content}
								</pre>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
