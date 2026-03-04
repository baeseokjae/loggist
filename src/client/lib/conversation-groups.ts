import type {
	ContentBlock,
	ConversationMessage,
	ToolUseBlock,
	ToolResultBlock,
} from "../../shared/types/conversation";

export interface ConversationGroup {
	index: number;
	userContent: string | null;
	assistantText: string;
	thinkingText: string | null;
	toolCalls: Array<{
		toolUse: ToolUseBlock;
		toolResult: ToolResultBlock | null;
	}>;
	model: string;
	timestamp: string;
}

export function groupMessagesIntoTurns(
	messages: ConversationMessage[],
): ConversationGroup[] {
	const groups: ConversationGroup[] = [];
	let i = 0;
	let groupIndex = 0;

	while (i < messages.length) {
		const msg = messages[i];

		// Collect user content
		let userContent: string | null = null;
		let timestamp = msg.timestamp;

		if (msg.type === "user") {
			userContent = extractUserText(msg.content);
			timestamp = msg.timestamp;
			i++;
		}

		// Collect all following assistant messages as one turn
		let assistantText = "";
		let thinkingText: string | null = null;
		let model = "";
		const toolUses: ToolUseBlock[] = [];
		const toolResults = new Map<string, ToolResultBlock>();

		while (i < messages.length && messages[i].type === "assistant") {
			const aMsg = messages[i];
			if (aMsg.model) model = aMsg.model;

			for (const block of aMsg.content) {
				if (block.type === "text") {
					assistantText += (assistantText ? "\n" : "") + block.text;
				} else if (block.type === "thinking") {
					thinkingText =
						(thinkingText ? thinkingText + "\n" : "") + block.thinking;
				} else if (block.type === "tool_use") {
					toolUses.push(block);
				} else if (block.type === "tool_result") {
					toolResults.set(block.tool_use_id, block);
				}
			}
			i++;
		}

		// Also scan ahead for tool_result in user messages (tool results come back as user messages)
		while (
			i < messages.length &&
			messages[i].type === "user" &&
			hasOnlyToolResults(messages[i].content)
		) {
			for (const block of messages[i].content) {
				if (block.type === "tool_result") {
					toolResults.set(block.tool_use_id, block);
				}
			}
			i++;

			// After tool results, collect more assistant messages
			while (i < messages.length && messages[i].type === "assistant") {
				const aMsg = messages[i];
				if (aMsg.model) model = aMsg.model;

				for (const block of aMsg.content) {
					if (block.type === "text") {
						assistantText += (assistantText ? "\n" : "") + block.text;
					} else if (block.type === "thinking") {
						thinkingText =
							(thinkingText ? thinkingText + "\n" : "") + block.thinking;
					} else if (block.type === "tool_use") {
						toolUses.push(block);
					} else if (block.type === "tool_result") {
						toolResults.set(block.tool_use_id, block);
					}
				}
				i++;
			}
		}

		// Only create a group if there's something to show
		if (userContent || assistantText || thinkingText || toolUses.length > 0) {
			const toolCalls = toolUses.map((tu) => ({
				toolUse: tu,
				toolResult: toolResults.get(tu.id) ?? null,
			}));

			groups.push({
				index: groupIndex++,
				userContent,
				assistantText,
				thinkingText,
				toolCalls,
				model,
				timestamp,
			});
		}
	}

	return groups;
}

function extractUserText(content: ContentBlock[]): string | null {
	const texts: string[] = [];
	for (const block of content) {
		if (block.type === "text") {
			texts.push(block.text);
		}
	}
	return texts.length > 0 ? texts.join("\n") : null;
}

function hasOnlyToolResults(content: ContentBlock[]): boolean {
	return (
		content.length > 0 && content.every((b) => b.type === "tool_result")
	);
}
