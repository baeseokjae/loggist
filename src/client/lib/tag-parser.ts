export type TagName =
	| "bash-input"
	| "bash-stdout"
	| "command-message"
	| "command-name"
	| "command-args"
	| "local-command-caveat"
	| "system-reminder";

export type ParsedSegment =
	| { kind: "text"; content: string }
	| {
			kind: "tag";
			tagName: TagName;
			content: string;
			children: ParsedSegment[];
		};

const SUPPORTED_TAGS: TagName[] = [
	"bash-input",
	"bash-stdout",
	"command-message",
	"command-name",
	"command-args",
	"local-command-caveat",
	"system-reminder",
];

const TAG_NAMES_PATTERN = SUPPORTED_TAGS.join("|");

const TAG_QUICK_CHECK = new RegExp(
	`<\\/?(${TAG_NAMES_PATTERN})>`,
);

const TAG_REGEX = new RegExp(
	`<(\\/?)(${TAG_NAMES_PATTERN})>`,
	"g",
);

export function containsTags(input: string): boolean {
	return TAG_QUICK_CHECK.test(input);
}

const STRIP_REGEX = new RegExp(`<\\/?(${TAG_NAMES_PATTERN})>`, "g");

export function stripTags(input: string): string {
	return input.replace(STRIP_REGEX, "");
}

interface StackFrame {
	tagName: TagName;
	children: ParsedSegment[];
	openTagText: string;
}

export function parseTaggedText(input: string): ParsedSegment[] {
	if (!input || !containsTags(input)) {
		return input ? [{ kind: "text", content: input }] : [];
	}

	const result: ParsedSegment[] = [];
	const stack: StackFrame[] = [];
	let lastIndex = 0;

	// Reset regex state
	TAG_REGEX.lastIndex = 0;

	let match: RegExpExecArray | null;
	while ((match = TAG_REGEX.exec(input)) !== null) {
		const [fullMatch, slash, tagName] = match;
		const isClosing = slash === "/";
		const matchIndex = match.index;

		// Capture text between last match and current match
		if (matchIndex > lastIndex) {
			const text = input.slice(lastIndex, matchIndex);
			const target = stack.length > 0 ? stack[stack.length - 1].children : result;
			target.push({ kind: "text", content: text });
		}

		if (!isClosing) {
			// Opening tag: push new frame
			stack.push({
				tagName: tagName as TagName,
				children: [],
				openTagText: fullMatch,
			});
		} else if (
			stack.length > 0 &&
			stack[stack.length - 1].tagName === tagName
		) {
			// Closing tag matches stack top: pop and create tag segment
			const frame = stack.pop()!;
			const content = getTextContent(frame.children);
			const segment: ParsedSegment = {
				kind: "tag",
				tagName: frame.tagName,
				content,
				children: frame.children,
			};
			const target = stack.length > 0 ? stack[stack.length - 1].children : result;
			target.push(segment);
		} else {
			// Mismatched closing tag: treat as plain text
			const target = stack.length > 0 ? stack[stack.length - 1].children : result;
			target.push({ kind: "text", content: fullMatch });
		}

		lastIndex = matchIndex + fullMatch.length;
	}

	// Flush remaining stack frames as plain text (unclosed tags)
	while (stack.length > 0) {
		const frame = stack.pop()!;
		const target = stack.length > 0 ? stack[stack.length - 1].children : result;
		target.push({ kind: "text", content: frame.openTagText });
		for (const child of frame.children) {
			target.push(child);
		}
	}

	// Trailing text after last match
	if (lastIndex < input.length) {
		result.push({ kind: "text", content: input.slice(lastIndex) });
	}

	// Filter out empty text segments
	return result.filter(
		(seg) => !(seg.kind === "text" && seg.content === ""),
	);
}

function getTextContent(segments: ParsedSegment[]): string {
	return segments.map((seg) => seg.content).join("");
}

// Memoized version with bounded cache
const cache = new Map<string, ParsedSegment[]>();
const MAX_CACHE = 200;

export function parseTaggedTextMemo(input: string): ParsedSegment[] {
	const cached = cache.get(input);
	if (cached) return cached;

	const result = parseTaggedText(input);

	if (cache.size >= MAX_CACHE) {
		const first = cache.keys().next().value;
		if (first !== undefined) cache.delete(first);
	}
	cache.set(input, result);

	return result;
}
