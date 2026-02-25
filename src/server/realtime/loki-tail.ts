import WebSocket from "ws";

export type EventCallback = (events: ParsedEvent[]) => void;

export interface ParsedEvent {
	timestamp: string; // nanosecond string (BigInt range)
	[key: string]: unknown;
}

let ws: WebSocket | null = null;
const subscribers = new Set<EventCallback>();
let reconnectTimer: ReturnType<typeof setTimeout>;

const LOKI_URL = process.env.LOKI_URL || "http://localhost:3100";

export function startLokiTail() {
	const tailUrl = `${LOKI_URL.replace("http", "ws")}/loki/api/v1/tail?query=${encodeURIComponent('{service_name="claude-code"}')}&delay_for=0&limit=100&start=${BigInt(Date.now()) * 1_000_000n}`;

	function connect() {
		ws = new WebSocket(tailUrl);
		ws.on("message", (data: Buffer) => {
			try {
				const parsed = JSON.parse(data.toString()) as LokiTailResponse;
				const events = parseTailResponse(parsed);
				for (const cb of subscribers) {
					cb(events);
				}
			} catch (err) {
				console.error("[loki-tail] Parse error:", err);
			}
		});
		ws.on("close", () => {
			console.warn("[loki-tail] Connection closed, reconnecting in 3s...");
			reconnectTimer = setTimeout(connect, 3000);
		});
		ws.on("error", (err) => {
			console.error("[loki-tail] WebSocket error:", err);
			ws?.close();
		});
	}
	connect();
}

export function subscribe(cb: EventCallback) {
	subscribers.add(cb);
	return () => {
		subscribers.delete(cb);
	};
}

export function stopLokiTail() {
	clearTimeout(reconnectTimer);
	ws?.close();
	subscribers.clear();
}

// Loki tail response type
interface LokiTailStream {
	stream: Record<string, string>;
	values: [string, string][];
}

interface LokiTailResponse {
	streams: LokiTailStream[];
}

export function parseTailResponse(data: LokiTailResponse): ParsedEvent[] {
	if (!data.streams) return [];
	return data.streams.flatMap((stream) =>
		stream.values.map(([tsNano, line]) => {
			// Stream labels contain the actual metadata from OTel Collector
			if (stream.stream?.event_name) {
				return { timestamp: tsNano, ...stream.stream };
			}
			try {
				return { timestamp: tsNano, ...(JSON.parse(line) as Record<string, unknown>) };
			} catch {
				return { timestamp: tsNano, raw: line };
			}
		}),
	);
}
