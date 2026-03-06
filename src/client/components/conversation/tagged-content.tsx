import { memo, useState } from "react";
import { cn } from "../../lib/utils";
import { parseTaggedTextMemo, containsTags } from "../../lib/tag-parser";
import type { ParsedSegment, TagName } from "../../lib/tag-parser";

type TagSegment = Extract<ParsedSegment, { kind: "tag" }>;

interface TagStyle {
	label: string;
	badge: string;
	container: string;
	collapsible: boolean;
	mono: boolean;
	prefix?: string;
}

const TAG_STYLES: Record<TagName, TagStyle> = {
	"bash-input": {
		label: "명령 입력",
		badge: "bg-amber-500 text-white",
		container:
			"bg-zinc-900 dark:bg-zinc-950 text-green-400 border-zinc-700",
		collapsible: false,
		mono: true,
		prefix: "$ ",
	},
	"bash-stdout": {
		label: "명령 출력",
		badge: "bg-zinc-600 text-white",
		container:
			"bg-zinc-800/80 dark:bg-zinc-900/80 text-zinc-200 border-zinc-700",
		collapsible: false,
		mono: true,
	},
	"command-message": {
		label: "시스템 명령",
		badge: "bg-blue-500 text-white",
		container:
			"bg-blue-50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-900",
		collapsible: false,
		mono: false,
	},
	"command-name": {
		label: "",
		badge: "bg-violet-500 text-white",
		container: "",
		collapsible: false,
		mono: true,
	},
	"command-args": {
		label: "",
		badge: "",
		container: "",
		collapsible: false,
		mono: true,
	},
	"local-command-caveat": {
		label: "명령 안내",
		badge:
			"bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
		container:
			"bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900",
		collapsible: true,
		mono: false,
	},
	"system-reminder": {
		label: "시스템 알림",
		badge: "bg-muted-foreground/80 text-background",
		container: "bg-muted/30 text-muted-foreground border-border",
		collapsible: true,
		mono: false,
	},
};

function RenderChildren({ children }: { children: ParsedSegment[] }) {
	return (
		<>
			{children.map((child, i) => (
				<SegmentRenderer key={i} segment={child} />
			))}
		</>
	);
}

function InlineCommandName({ content }: { content: string }) {
	return (
		<span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300 font-mono">
			{content}
		</span>
	);
}

function InlineCommandArgs({ content }: { content: string }) {
	return (
		<span className="inline text-xs font-mono text-muted-foreground">
			{content}
		</span>
	);
}

function TerminalBlock({
	segment,
	style,
}: { segment: TagSegment; style: TagStyle }) {
	return (
		<div
			className={cn(
				"rounded-lg border px-3 py-2 text-xs font-mono",
				style.container,
			)}
		>
			{style.prefix && (
				<span className="select-none text-zinc-500">{style.prefix}</span>
			)}
			<span className="whitespace-pre-wrap break-words">
				{segment.children.length > 0 ? (
					<RenderChildren children={segment.children} />
				) : (
					segment.content
				)}
			</span>
		</div>
	);
}

function CollapsibleBlock({
	segment,
	style,
}: { segment: TagSegment; style: TagStyle }) {
	const [expanded, setExpanded] = useState(false);
	const rawContent =
		segment.children.length > 0
			? segment.children.map((c) => c.content).join("")
			: segment.content;
	const preview = rawContent.replace(/\s+/g, " ").slice(0, 80);

	return (
		<div className={cn("rounded-lg border", style.container)}>
			<button
				type="button"
				className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs"
				onClick={() => setExpanded(!expanded)}
			>
				<span
					className={cn(
						"shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
						style.badge,
					)}
				>
					{style.label}
				</span>
				{!expanded && (
					<span className="truncate text-muted-foreground">
						{preview}...
					</span>
				)}
				<span className="ml-auto shrink-0 text-muted-foreground">
					{expanded ? "▼" : "▶"}
				</span>
			</button>
			{expanded && (
				<div className="border-t px-3 py-2 text-xs whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
					{segment.children.length > 0 ? (
						<RenderChildren children={segment.children} />
					) : (
						segment.content
					)}
				</div>
			)}
		</div>
	);
}

function StandardBlock({
	segment,
	style,
}: { segment: TagSegment; style: TagStyle }) {
	return (
		<div
			className={cn(
				"rounded-lg border px-3 py-2 text-sm",
				style.container,
			)}
		>
			<div className="mb-1">
				<span
					className={cn(
						"rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
						style.badge,
					)}
				>
					{style.label}
				</span>
			</div>
			<div className="whitespace-pre-wrap break-words">
				{segment.children.length > 0 ? (
					<RenderChildren children={segment.children} />
				) : (
					segment.content
				)}
			</div>
		</div>
	);
}

function SegmentRenderer({ segment }: { segment: ParsedSegment }) {
	if (segment.kind === "text") {
		if (!segment.content) return null;
		return (
			<span className="whitespace-pre-wrap">{segment.content}</span>
		);
	}

	const style = TAG_STYLES[segment.tagName];

	if (!style) {
		return (
			<span className="whitespace-pre-wrap">{segment.content}</span>
		);
	}

	if (segment.tagName === "command-name") {
		return <InlineCommandName content={segment.content} />;
	}

	if (segment.tagName === "command-args") {
		return <InlineCommandArgs content={segment.content} />;
	}

	if (style.collapsible) {
		return <CollapsibleBlock segment={segment} style={style} />;
	}

	if (style.mono) {
		return <TerminalBlock segment={segment} style={style} />;
	}

	return <StandardBlock segment={segment} style={style} />;
}

interface TaggedContentProps {
	content: string;
	className?: string;
}

export const TaggedContent = memo(function TaggedContent({
	content,
	className,
}: TaggedContentProps) {
	if (!containsTags(content)) {
		return (
			<div className={cn("whitespace-pre-wrap break-words", className)}>
				{content}
			</div>
		);
	}

	const segments = parseTaggedTextMemo(content);

	return (
		<div className={cn("space-y-1", className)}>
			{segments.map((segment, i) => (
				<SegmentRenderer key={i} segment={segment} />
			))}
		</div>
	);
});
