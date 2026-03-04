import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "../../lib/utils";

interface MarkdownContentProps {
	content: string;
	className?: string;
}

export const MarkdownContent = memo(function MarkdownContent({
	content,
	className,
}: MarkdownContentProps) {
	return (
		<div
			className={cn(
				"prose prose-sm dark:prose-invert max-w-none",
				"prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground",
				"prose-li:text-foreground prose-th:text-foreground prose-td:text-foreground",
				"prose-blockquote:text-muted-foreground prose-blockquote:border-border",
				"prose-hr:border-border",
				"prose-pre:bg-muted prose-pre:border prose-pre:rounded-md prose-pre:text-foreground",
				"prose-code:before:content-none prose-code:after:content-none",
				"prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:text-foreground",
				"prose-a:text-primary prose-a:underline",
				className,
			)}
		>
			<ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
		</div>
	);
});
