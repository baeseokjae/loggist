// Content block types (Claude API message structure)
export interface TextBlock {
	type: "text";
	text: string;
}

export interface ThinkingBlock {
	type: "thinking";
	thinking: string;
}

export interface ToolUseBlock {
	type: "tool_use";
	id: string;
	name: string;
	input: Record<string, unknown>;
}

export interface ToolResultBlock {
	type: "tool_result";
	tool_use_id: string;
	content: string;
	is_error?: boolean;
}

export type ContentBlock =
	| TextBlock
	| ThinkingBlock
	| ToolUseBlock
	| ToolResultBlock;

export type DisplayBlock =
	| { kind: "text"; text: string }
	| { kind: "tool_call"; toolUse: ToolUseBlock; toolResult: ToolResultBlock | null };

export interface ConversationMessage {
	uuid: string;
	parentUuid: string | null;
	timestamp: string;
	sessionId: string;
	isSidechain: boolean;
	agentId?: string;
	slug?: string;
	type: "user" | "assistant";
	model?: string;
	content: ContentBlock[];
	stopReason?: string;
}

export interface SubagentInfo {
	agentId: string;
	slug?: string;
	messageCount: number;
}

export interface ConversationData {
	sessionId: string;
	messages: ConversationMessage[];
	subagents: SubagentInfo[];
	totalMessages: number;
	truncated: boolean;
}
