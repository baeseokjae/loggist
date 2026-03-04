import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import type {
	ContentBlock,
	ConversationData,
	ConversationMessage,
	SubagentInfo,
} from "../../shared/types/conversation";
import { sanitizeLogContent } from "./sanitizer";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_STRING_LENGTH = 5000;
const ALLOWED_TYPES = new Set(["user", "assistant"]);

interface RawLine {
	type: string;
	uuid: string;
	parentUuid: string | null;
	timestamp: string;
	sessionId: string;
	isSidechain: boolean;
	requestId?: string;
	message?: {
		role: string;
		model?: string;
		content: unknown;
		stop_reason?: string;
	};
	agentId?: string;
	slug?: string;
}

export async function parseJsonlFile(
	filePath: string,
	fileSize: number,
): Promise<ConversationData> {
	if (fileSize > MAX_FILE_SIZE) {
		throw new FileTooLargeError(
			`파일 크기가 ${Math.round(fileSize / 1024 / 1024)}MB로 제한(50MB)을 초과합니다.`,
		);
	}

	const rawMessages: RawLine[] = [];

	const rl = createInterface({
		input: createReadStream(filePath, { encoding: "utf8" }),
		crlfDelay: Number.POSITIVE_INFINITY,
	});

	for await (const line of rl) {
		if (!line.trim()) continue;

		try {
			const parsed = JSON.parse(line) as Record<string, unknown>;
			const type = parsed.type as string;

			if (!ALLOWED_TYPES.has(type)) continue;

			rawMessages.push({
				type,
				uuid: parsed.uuid as string,
				parentUuid: (parsed.parentUuid as string) ?? null,
				timestamp: parsed.timestamp as string,
				sessionId: parsed.sessionId as string,
				isSidechain: Boolean(parsed.isSidechain),
				requestId: parsed.requestId as string | undefined,
				message: parsed.message as RawLine["message"],
				agentId: parsed.agentId as string | undefined,
				slug: parsed.slug as string | undefined,
			});
		} catch {
			// skip malformed lines
		}
	}

	// Merge streaming chunks: for assistant messages with the same requestId,
	// keep only the last UUID's message (which has the most complete content)
	const messages = mergeStreamingChunks(rawMessages);

	// Track subagents
	const subagentMap = new Map<
		string,
		{ slug?: string; messageCount: number }
	>();
	for (const msg of messages) {
		if (msg.agentId) {
			const existing = subagentMap.get(msg.agentId) ?? {
				slug: msg.slug,
				messageCount: 0,
			};
			existing.messageCount++;
			subagentMap.set(msg.agentId, existing);
		}
	}

	const subagents: SubagentInfo[] = Array.from(subagentMap.entries()).map(
		([agentId, info]) => ({
			agentId,
			slug: info.slug,
			messageCount: info.messageCount,
		}),
	);

	const sessionId =
		messages[0]?.sessionId ?? rawMessages[0]?.sessionId ?? "unknown";

	return {
		sessionId,
		messages,
		subagents,
		totalMessages: messages.length,
		truncated: false,
	};
}

export function paginateConversation(
	data: ConversationData,
	offset: number,
	limit: number,
): ConversationData {
	return {
		...data,
		messages: data.messages.slice(offset, offset + limit),
		truncated: offset + limit < data.totalMessages,
	};
}

function mergeStreamingChunks(
	rawMessages: RawLine[],
): ConversationMessage[] {
	const result: ConversationMessage[] = [];

	// Group assistant messages by requestId
	const requestGroups = new Map<string, RawLine[]>();

	for (const msg of rawMessages) {
		if (msg.type === "assistant" && msg.requestId) {
			const group = requestGroups.get(msg.requestId) ?? [];
			group.push(msg);
			requestGroups.set(msg.requestId, group);
		}
	}

	// For each request group, merge content blocks from all chunks
	const mergedAssistants = new Map<string, ConversationMessage>();

	for (const [requestId, group] of requestGroups) {
		// Collect all unique content blocks across chunks
		const allBlocks: ContentBlock[] = [];
		const seenToolUseIds = new Set<string>();
		let model = "";
		let stopReason: string | undefined;

		// Process in order; last chunk has the most complete data
		for (const msg of group) {
			if (msg.message?.model) model = msg.message.model;
			if (msg.message?.stop_reason) stopReason = msg.message.stop_reason;

			const content = normalizeContent(msg.message?.content);
			for (const block of content) {
				if (block.type === "tool_use") {
					if (!seenToolUseIds.has(block.id)) {
						seenToolUseIds.add(block.id);
						allBlocks.push(block);
					}
				} else if (block.type === "thinking") {
					// Deduplicate thinking blocks: later chunks contain the full text,
					// so replace any earlier thinking block with the latest one
					const existingIdx = allBlocks.findIndex(
						(b) => b.type === "thinking",
					);
					if (existingIdx >= 0) {
						// Keep the longer (more complete) thinking block
						const existing = allBlocks[existingIdx];
						if (
							existing.type === "thinking" &&
							block.thinking.length >= existing.thinking.length
						) {
							allBlocks[existingIdx] = block;
						}
					} else {
						allBlocks.push(block);
					}
				} else if (block.type === "text") {
					// Streaming chunks progressively build up text.
					// Later chunks from the same requestId contain the full text,
					// so replace any existing text block with the latest one.
					const existingIdx = allBlocks.findIndex(
						(b) => b.type === "text",
					);
					if (existingIdx >= 0) {
						// Keep the longer (more complete) text
						const existing = allBlocks[existingIdx];
						if (
							existing.type === "text" &&
							block.text.length >= existing.text.length
						) {
							allBlocks[existingIdx] = block;
						}
					} else {
						allBlocks.push(block);
					}
				} else {
					allBlocks.push(block);
				}
			}
		}

		const lastMsg = group[group.length - 1];
		const merged: ConversationMessage = {
			uuid: lastMsg.uuid,
			parentUuid: group[0].parentUuid,
			timestamp: group[0].timestamp,
			sessionId: lastMsg.sessionId,
			isSidechain: lastMsg.isSidechain,
			agentId: lastMsg.agentId,
			slug: lastMsg.slug,
			type: "assistant",
			model,
			content: sanitizeBlocks(allBlocks),
			stopReason,
		};

		mergedAssistants.set(requestId, merged);
	}

	// Reconstruct ordered list
	const seenRequestIds = new Set<string>();

	for (const msg of rawMessages) {
		if (msg.type === "assistant" && msg.requestId) {
			if (seenRequestIds.has(msg.requestId)) continue;
			seenRequestIds.add(msg.requestId);
			const merged = mergedAssistants.get(msg.requestId);
			if (merged) result.push(merged);
		} else if (msg.type === "user") {
			result.push(convertUserMessage(msg));
		}
	}

	return result;
}

function convertUserMessage(raw: RawLine): ConversationMessage {
	const content = normalizeContent(raw.message?.content);
	return {
		uuid: raw.uuid,
		parentUuid: raw.parentUuid,
		timestamp: raw.timestamp,
		sessionId: raw.sessionId,
		isSidechain: raw.isSidechain,
		agentId: raw.agentId,
		slug: raw.slug,
		type: "user",
		content: sanitizeBlocks(content),
	};
}

function normalizeContent(raw: unknown): ContentBlock[] {
	if (!raw) return [];

	// String content (user text)
	if (typeof raw === "string") {
		return [{ type: "text", text: raw }];
	}

	// Array of content blocks
	if (Array.isArray(raw)) {
		const blocks: ContentBlock[] = [];
		for (const block of raw as Record<string, unknown>[]) {
			if (block.type === "text") {
				blocks.push({
					type: "text",
					text: truncateString(String(block.text ?? "")),
				});
			} else if (block.type === "thinking") {
				blocks.push({
					type: "thinking",
					thinking: truncateString(String(block.thinking ?? "")),
					// Strip signature field (large base64)
				});
			} else if (block.type === "tool_use") {
				blocks.push({
					type: "tool_use",
					id: String(block.id ?? ""),
					name: String(block.name ?? ""),
					input: truncateObjectValues(
						(block.input as Record<string, unknown>) ?? {},
					),
				});
			} else if (block.type === "tool_result") {
				const content = block.content;
				let contentStr: string;
				if (typeof content === "string") {
					contentStr = content;
				} else if (Array.isArray(content)) {
					contentStr = content
						.map((c: Record<string, unknown>) =>
							String(c.text ?? c.content ?? ""),
						)
						.join("\n");
				} else {
					contentStr = String(content ?? "");
				}
				blocks.push({
					type: "tool_result",
					tool_use_id: String(block.tool_use_id ?? ""),
					content: truncateString(contentStr),
					is_error: Boolean(block.is_error),
				});
			}
		}
		return blocks;
	}

	return [];
}

function truncateString(str: string): string {
	if (str.length <= MAX_STRING_LENGTH) return str;
	return `${str.slice(0, MAX_STRING_LENGTH)}… [truncated, ${str.length} chars total]`;
}

function truncateObjectValues(
	obj: Record<string, unknown>,
): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(obj)) {
		if (typeof value === "string") {
			result[key] = truncateString(value);
		} else {
			result[key] = value;
		}
	}
	return result;
}

function sanitizeBlocks(blocks: ContentBlock[]): ContentBlock[] {
	return blocks.map((block) => {
		if (block.type === "text") {
			return { ...block, text: sanitizeLogContent(block.text) };
		}
		if (block.type === "thinking") {
			return { ...block, thinking: sanitizeLogContent(block.thinking) };
		}
		if (block.type === "tool_result") {
			return { ...block, content: sanitizeLogContent(block.content) };
		}
		if (block.type === "tool_use") {
			const sanitizedInput: Record<string, unknown> = {};
			for (const [key, value] of Object.entries(block.input)) {
				sanitizedInput[key] =
					typeof value === "string" ? sanitizeLogContent(value) : value;
			}
			return { ...block, input: sanitizedInput };
		}
		return block;
	});
}

export class FileTooLargeError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "FileTooLargeError";
	}
}
