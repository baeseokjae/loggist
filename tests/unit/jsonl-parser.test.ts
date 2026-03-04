import { describe, expect, it } from "vitest";
import { mergeStreamingChunks, type RawLine } from "@server/services/jsonl-parser";
import type { ContentBlock, ConversationMessage } from "@/shared/types/conversation";

function makeRawLine(overrides: Partial<RawLine>): RawLine {
	return {
		type: "assistant",
		uuid: crypto.randomUUID(),
		parentUuid: null,
		timestamp: new Date().toISOString(),
		sessionId: "test-session",
		isSidechain: false,
		requestId: "req-1",
		message: { role: "assistant", content: [] },
		...overrides,
	};
}

function textBlock(text: string): ContentBlock {
	return { type: "text", text };
}

function thinkingBlock(thinking: string): ContentBlock {
	return { type: "thinking", thinking };
}

function toolUseBlock(id: string, name = "Edit"): ContentBlock {
	return { type: "tool_use", id, name, input: {} };
}

function toolResultBlock(toolUseId: string, content = "ok"): ContentBlock {
	return { type: "tool_result", tool_use_id: toolUseId, content, is_error: false };
}

describe("mergeStreamingChunks", () => {
	it("같은 requestId 청크 병합 시 모든 청크의 블록 순서대로 합침", () => {
		const raw: RawLine[] = [
			makeRawLine({
				requestId: "req-1",
				message: { role: "assistant", content: [textBlock("first chunk text")] },
			}),
			makeRawLine({
				requestId: "req-1",
				message: { role: "assistant", content: [textBlock("second chunk text")] },
			}),
		];

		const result = mergeStreamingChunks(raw);
		expect(result).toHaveLength(1);
		expect(result[0].content).toHaveLength(2);
		expect(result[0].content[0]).toMatchObject({ type: "text", text: "first chunk text" });
		expect(result[0].content[1]).toMatchObject({ type: "text", text: "second chunk text" });
	});

	it("인터리브된 text + tool_use 순서 보존", () => {
		const raw: RawLine[] = [
			makeRawLine({
				requestId: "req-1",
				message: {
					role: "assistant",
					content: [
						textBlock("A"),
						toolUseBlock("t1"),
						textBlock("B"),
						toolUseBlock("t2"),
					],
				},
			}),
		];

		const result = mergeStreamingChunks(raw);
		expect(result).toHaveLength(1);
		const types = result[0].content.map((b) => b.type);
		expect(types).toEqual(["text", "tool_use", "text", "tool_use"]);
		expect((result[0].content[0] as { text: string }).text).toBe("A");
		expect((result[0].content[2] as { text: string }).text).toBe("B");
	});

	it("이전 청크의 text와 tool_use를 모두 보존", () => {
		const raw: RawLine[] = [
			makeRawLine({
				requestId: "req-1",
				message: {
					role: "assistant",
					content: [textBlock("start"), toolUseBlock("t-early", "Bash")],
				},
			}),
			makeRawLine({
				requestId: "req-1",
				message: {
					role: "assistant",
					content: [textBlock("final")],
				},
			}),
		];

		const result = mergeStreamingChunks(raw);
		expect(result).toHaveLength(1);
		// 모든 블록이 순서대로 보존됨
		expect(result[0].content).toHaveLength(3);
		expect(result[0].content[0]).toMatchObject({ type: "text", text: "start" });
		expect(result[0].content[1]).toMatchObject({ type: "tool_use", id: "t-early" });
		expect(result[0].content[2]).toMatchObject({ type: "text", text: "final" });
	});

	it("양쪽 청크에 같은 tool_use → 중복 없음", () => {
		const raw: RawLine[] = [
			makeRawLine({
				requestId: "req-1",
				message: {
					role: "assistant",
					content: [toolUseBlock("t1")],
				},
			}),
			makeRawLine({
				requestId: "req-1",
				message: {
					role: "assistant",
					content: [toolUseBlock("t1")],
				},
			}),
		];

		const result = mergeStreamingChunks(raw);
		const toolBlocks = result[0].content.filter((b) => b.type === "tool_use");
		expect(toolBlocks).toHaveLength(1);
	});

	it("마지막 청크에 없는 thinking 보충", () => {
		const raw: RawLine[] = [
			makeRawLine({
				requestId: "req-1",
				message: {
					role: "assistant",
					content: [thinkingBlock("내부 추론"), textBlock("partial")],
				},
			}),
			makeRawLine({
				requestId: "req-1",
				message: {
					role: "assistant",
					content: [textBlock("final answer")],
				},
			}),
		];

		const result = mergeStreamingChunks(raw);
		expect(result).toHaveLength(1);
		const thinkingBlocks = result[0].content.filter((b) => b.type === "thinking");
		expect(thinkingBlocks).toHaveLength(1);
		expect((thinkingBlocks[0] as { thinking: string }).thinking).toBe("내부 추론");
	});

	it("다른 requestId는 별도 메시지 유지", () => {
		const raw: RawLine[] = [
			makeRawLine({
				requestId: "req-A",
				message: { role: "assistant", content: [textBlock("from A")] },
			}),
			makeRawLine({
				requestId: "req-B",
				message: { role: "assistant", content: [textBlock("from B")] },
			}),
		];

		const result = mergeStreamingChunks(raw);
		expect(result).toHaveLength(2);
		expect((result[0].content[0] as { text: string }).text).toBe("from A");
		expect((result[1].content[0] as { text: string }).text).toBe("from B");
	});

	it("text-only 응답 — 모든 청크의 text 보존", () => {
		const raw: RawLine[] = [
			makeRawLine({
				requestId: "req-1",
				message: {
					role: "assistant",
					content: [textBlock("chunk1")],
				},
			}),
			makeRawLine({
				requestId: "req-1",
				message: {
					role: "assistant",
					content: [textBlock("hello world")],
				},
			}),
		];

		const result = mergeStreamingChunks(raw);
		expect(result).toHaveLength(1);
		expect(result[0].content).toHaveLength(2);
		expect(result[0].content[0]).toMatchObject({ type: "text", text: "chunk1" });
		expect(result[0].content[1]).toMatchObject({ type: "text", text: "hello world" });
	});

	it("tool-only 응답 (텍스트 없음)", () => {
		const raw: RawLine[] = [
			makeRawLine({
				requestId: "req-1",
				message: {
					role: "assistant",
					content: [toolUseBlock("t1", "Read"), toolUseBlock("t2", "Write")],
				},
			}),
		];

		const result = mergeStreamingChunks(raw);
		expect(result).toHaveLength(1);
		const types = result[0].content.map((b) => b.type);
		expect(types).toEqual(["tool_use", "tool_use"]);
	});

	it("빈 content 배열 처리", () => {
		const raw: RawLine[] = [
			makeRawLine({
				requestId: "req-1",
				message: { role: "assistant", content: [] },
			}),
		];

		const result = mergeStreamingChunks(raw);
		expect(result).toHaveLength(1);
		expect(result[0].content).toHaveLength(0);
	});

	it("user 메시지 위치 보존", () => {
		const raw: RawLine[] = [
			makeRawLine({
				type: "user",
				requestId: undefined,
				message: { role: "user", content: "질문1" },
			}),
			makeRawLine({
				requestId: "req-A",
				message: { role: "assistant", content: [textBlock("답변A")] },
			}),
			makeRawLine({
				type: "user",
				requestId: undefined,
				message: { role: "user", content: "질문2" },
			}),
			makeRawLine({
				requestId: "req-B",
				message: { role: "assistant", content: [textBlock("답변B")] },
			}),
		];

		const result = mergeStreamingChunks(raw);
		expect(result).toHaveLength(4);
		expect(result[0].type).toBe("user");
		expect(result[1].type).toBe("assistant");
		expect(result[2].type).toBe("user");
		expect(result[3].type).toBe("assistant");
	});

	it("여러 청크 중 마지막 model 사용", () => {
		const raw: RawLine[] = [
			makeRawLine({
				requestId: "req-1",
				message: { role: "assistant", model: "claude-3-haiku", content: [textBlock("a")] },
			}),
			makeRawLine({
				requestId: "req-1",
				message: { role: "assistant", model: "claude-sonnet-4-20250514", content: [textBlock("b")] },
			}),
		];

		const result = mergeStreamingChunks(raw);
		expect(result[0].model).toBe("claude-sonnet-4-20250514");
	});

	it("stop_reason 마지막 값 사용", () => {
		const raw: RawLine[] = [
			makeRawLine({
				requestId: "req-1",
				message: { role: "assistant", content: [textBlock("a")] },
			}),
			makeRawLine({
				requestId: "req-1",
				message: { role: "assistant", stop_reason: "tool_use", content: [textBlock("b")] },
			}),
		];

		const result = mergeStreamingChunks(raw);
		expect(result[0].stopReason).toBe("tool_use");
	});

	it("text와 tool_use가 별도 청크로 기록된 경우 모두 보존 (핵심 회귀 테스트)", () => {
		// 실제 Claude Code JSONL 구조: text와 tool_use가 별도 라인으로 기록
		const raw: RawLine[] = [
			makeRawLine({
				requestId: "req-1",
				message: {
					role: "assistant",
					content: [textBlock("마크다운 테이블 문제를 확인하겠습니다.")],
				},
			}),
			makeRawLine({
				requestId: "req-1",
				message: {
					role: "assistant",
					content: [toolUseBlock("t1", "Read")],
				},
			}),
		];

		const result = mergeStreamingChunks(raw);
		expect(result).toHaveLength(1);
		expect(result[0].content).toHaveLength(2);
		expect(result[0].content[0]).toMatchObject({ type: "text", text: "마크다운 테이블 문제를 확인하겠습니다." });
		expect(result[0].content[1]).toMatchObject({ type: "tool_use", id: "t1" });
	});

	it("병합 후 sanitization 적용", () => {
		const raw: RawLine[] = [
			makeRawLine({
				requestId: "req-1",
				message: {
					role: "assistant",
					content: [textBlock("key is sk-abcdefghij1234567890extra")],
				},
			}),
		];

		const result = mergeStreamingChunks(raw);
		expect((result[0].content[0] as { text: string }).text).toContain("[REDACTED]");
		expect((result[0].content[0] as { text: string }).text).not.toContain("sk-abcdefghij1234567890extra");
	});
});
