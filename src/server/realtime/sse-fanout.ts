import type { Context } from "hono";
import { sanitizeEvent } from "../services/sanitizer";
import { type ParsedEvent, subscribe as subscribeLoki } from "./loki-tail";

const MAX_SSE_CONNECTIONS = 50;
const sseClients = new Set<ReadableStreamDefaultController>();

export function initFanout() {
	subscribeLoki((events: ParsedEvent[]) => {
		const sanitized = events.map(sanitizeEvent);
		const payload = `data: ${JSON.stringify(sanitized)}\n\n`;
		const encoded = new TextEncoder().encode(payload);
		for (const controller of sseClients) {
			try {
				controller.enqueue(encoded);
			} catch {
				sseClients.delete(controller);
			}
		}
	});
}

export function createSSEStream(c: Context): Response {
	if (sseClients.size >= MAX_SSE_CONNECTIONS) {
		return c.json({ error: "Too many SSE connections" }, 429);
	}

	const stream = new ReadableStream({
		start(controller) {
			sseClients.add(controller);
			c.req.raw.signal.addEventListener("abort", () => {
				sseClients.delete(controller);
				controller.close();
			});
		},
		cancel() {
			// cleanup handled by abort
		},
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
			"X-Accel-Buffering": "no",
		},
	});
}

export function getSSEConnectionCount(): number {
	return sseClients.size;
}
