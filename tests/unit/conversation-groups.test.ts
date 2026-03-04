import { describe, expect, it } from "vitest";
import { groupMessagesIntoTurns } from "@client/lib/conversation-groups";
import type { ContentBlock, ConversationMessage } from "@/shared/types/conversation";

function makeMessage(
	type: "user" | "assistant",
	content: ContentBlock[],
	overrides?: Partial<ConversationMessage>,
): ConversationMessage {
	return {
		uuid: crypto.randomUUID(),
		parentUuid: null,
		timestamp: new Date().toISOString(),
		sessionId: "test-session",
		isSidechain: false,
		type,
		content,
		...overrides,
	};
}

function text(t: string): ContentBlock {
	return { type: "text", text: t };
}

function thinking(t: string): ContentBlock {
	return { type: "thinking", thinking: t };
}

function toolUse(id: string, name = "Edit"): ContentBlock {
	return { type: "tool_use", id, name, input: {} };
}

function toolResult(toolUseId: string, content = "ok", isError = false): ContentBlock {
	return { type: "tool_result", tool_use_id: toolUseId, content, is_error: isError };
}

describe("groupMessagesIntoTurns", () => {
	it("user + assistant → 1그룹", () => {
		const messages = [
			makeMessage("user", [text("hello")]),
			makeMessage("assistant", [text("hi there")]),
		];

		const groups = groupMessagesIntoTurns(messages);
		expect(groups).toHaveLength(1);
		expect(groups[0].userContent).toBe("hello");
		expect(groups[0].assistantText).toBe("hi there");
	});

	it("orderedBlocks에 text/tool_call 인터리브 순서 보존", () => {
		const messages = [
			makeMessage("user", [text("do something")]),
			makeMessage("assistant", [
				text("A"),
				toolUse("t1"),
				text("B"),
				toolUse("t2"),
			]),
		];

		const groups = groupMessagesIntoTurns(messages);
		expect(groups).toHaveLength(1);

		const blocks = groups[0].orderedBlocks;
		expect(blocks).toHaveLength(4);
		expect(blocks[0]).toMatchObject({ kind: "text", text: "A" });
		expect(blocks[1]).toMatchObject({ kind: "tool_call", toolUse: { id: "t1" } });
		expect(blocks[2]).toMatchObject({ kind: "text", text: "B" });
		expect(blocks[3]).toMatchObject({ kind: "tool_call", toolUse: { id: "t2" } });
	});

	it("여러 API round-trip을 하나의 턴으로 합침", () => {
		const messages = [
			makeMessage("user", [text("전체 테스트 실행해줘")]),
			makeMessage("assistant", [text("확인합니다"), toolUse("t1", "Bash")]),
			makeMessage("user", [toolResult("t1", "9 tests passed")]),
			makeMessage("assistant", [text("9개 테스트 통과. 전체 실행합니다"), toolUse("t2", "Bash")]),
			makeMessage("user", [toolResult("t2", "30 tests passed")]),
			makeMessage("assistant", [text("전체 30개 테스트 통과했습니다.")]),
		];

		const groups = groupMessagesIntoTurns(messages);
		expect(groups).toHaveLength(1);

		const blocks = groups[0].orderedBlocks;
		const textBlocks = blocks.filter((b) => b.kind === "text");
		const toolBlocks = blocks.filter((b) => b.kind === "tool_call");
		expect(textBlocks).toHaveLength(3);
		expect(toolBlocks).toHaveLength(2);

		// Verify order: text → tool → text → tool → text
		expect(blocks[0]).toMatchObject({ kind: "text", text: "확인합니다" });
		expect(blocks[1]).toMatchObject({ kind: "tool_call" });
		expect(blocks[2]).toMatchObject({ kind: "text", text: "9개 테스트 통과. 전체 실행합니다" });
		expect(blocks[3]).toMatchObject({ kind: "tool_call" });
		expect(blocks[4]).toMatchObject({ kind: "text", text: "전체 30개 테스트 통과했습니다." });
	});

	it("tool_result가 orderedBlocks의 tool_call에 패치", () => {
		const messages = [
			makeMessage("assistant", [toolUse("t1", "Read")]),
			makeMessage("user", [toolResult("t1", "file contents here")]),
		];

		const groups = groupMessagesIntoTurns(messages);
		expect(groups).toHaveLength(1);

		const block = groups[0].orderedBlocks[0];
		expect(block.kind).toBe("tool_call");
		if (block.kind === "tool_call") {
			expect(block.toolResult).not.toBeNull();
			expect(block.toolResult?.content).toBe("file contents here");
		}
	});

	it("is_error=true인 tool_result 처리", () => {
		const messages = [
			makeMessage("assistant", [toolUse("t1", "Bash")]),
			makeMessage("user", [toolResult("t1", "command failed", true)]),
		];

		const groups = groupMessagesIntoTurns(messages);
		const block = groups[0].orderedBlocks[0];
		if (block.kind === "tool_call") {
			expect(block.toolResult?.is_error).toBe(true);
			expect(block.toolResult?.content).toBe("command failed");
		}
	});

	it("빈 텍스트 블록 필터링", () => {
		const messages = [
			makeMessage("assistant", [
				text(""),
				text("   "),
				text("real content"),
				toolUse("t1"),
			]),
		];

		const groups = groupMessagesIntoTurns(messages);
		const textBlocks = groups[0].orderedBlocks.filter((b) => b.kind === "text");
		expect(textBlocks).toHaveLength(1);
		expect(textBlocks[0]).toMatchObject({ kind: "text", text: "real content" });
	});

	it("text-only 응답", () => {
		const messages = [
			makeMessage("user", [text("explain")]),
			makeMessage("assistant", [text("here is the explanation")]),
		];

		const groups = groupMessagesIntoTurns(messages);
		expect(groups[0].toolCalls).toHaveLength(0);
		expect(groups[0].orderedBlocks).toHaveLength(1);
		expect(groups[0].orderedBlocks[0]).toMatchObject({ kind: "text" });
	});

	it("tool-only 응답", () => {
		const messages = [
			makeMessage("assistant", [toolUse("t1"), toolUse("t2")]),
		];

		const groups = groupMessagesIntoTurns(messages);
		expect(groups[0].assistantText).toBe("");
		expect(groups[0].orderedBlocks).toHaveLength(2);
		expect(groups[0].orderedBlocks.every((b) => b.kind === "tool_call")).toBe(true);
	});

	it("thinking 텍스트 누적", () => {
		const messages = [
			makeMessage("assistant", [thinking("step 1"), text("answer 1"), toolUse("t1")]),
			makeMessage("user", [toolResult("t1")]),
			makeMessage("assistant", [thinking("step 2"), text("answer 2")]),
		];

		const groups = groupMessagesIntoTurns(messages);
		expect(groups).toHaveLength(1);
		expect(groups[0].thinkingText).toBe("step 1\nstep 2");
	});

	it("빈 메시지 배열 → 빈 그룹", () => {
		const groups = groupMessagesIntoTurns([]);
		expect(groups).toHaveLength(0);
	});

	it("user 없는 assistant-only 턴", () => {
		const messages = [
			makeMessage("assistant", [text("unsolicited response")]),
		];

		const groups = groupMessagesIntoTurns(messages);
		expect(groups).toHaveLength(1);
		expect(groups[0].userContent).toBeNull();
		expect(groups[0].assistantText).toBe("unsolicited response");
	});

	it("일반 user 메시지로 턴 분리", () => {
		const messages = [
			makeMessage("user", [text("question 1")]),
			makeMessage("assistant", [text("answer 1")]),
			makeMessage("user", [text("question 2")]),
			makeMessage("assistant", [text("answer 2")]),
		];

		const groups = groupMessagesIntoTurns(messages);
		expect(groups).toHaveLength(2);
		expect(groups[0].userContent).toBe("question 1");
		expect(groups[0].assistantText).toBe("answer 1");
		expect(groups[1].userContent).toBe("question 2");
		expect(groups[1].assistantText).toBe("answer 2");
	});

	it("tool_result+text 혼합 user 메시지 → 턴 분리", () => {
		const messages = [
			makeMessage("assistant", [toolUse("t1")]),
			makeMessage("user", [toolResult("t1"), text("and also this")]),
			makeMessage("assistant", [text("new turn response")]),
		];

		const groups = groupMessagesIntoTurns(messages);
		// The mixed user message doesn't match hasOnlyToolResults, so it starts a new turn
		expect(groups).toHaveLength(2);
		expect(groups[1].userContent).toBe("and also this");
	});

	it("assistant의 model 보존", () => {
		const messages = [
			makeMessage("assistant", [text("hello")], { model: "claude-sonnet-4-20250514" }),
		];

		const groups = groupMessagesIntoTurns(messages);
		expect(groups[0].model).toBe("claude-sonnet-4-20250514");
	});

	it("여러 assistant에서 마지막 model 사용", () => {
		const messages = [
			makeMessage("assistant", [text("a"), toolUse("t1")], { model: "claude-3-haiku" }),
			makeMessage("user", [toolResult("t1")]),
			makeMessage("assistant", [text("b")], { model: "claude-sonnet-4-20250514" }),
		];

		const groups = groupMessagesIntoTurns(messages);
		expect(groups).toHaveLength(1);
		expect(groups[0].model).toBe("claude-sonnet-4-20250514");
	});
});
