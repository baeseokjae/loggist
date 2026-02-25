import { useCallback, useEffect, useRef, useState } from "react";

export interface TimelineEvent {
	timestamp: string;
	event_name?: string;
	model?: string;
	cost_usd?: number;
	session_id?: string;
	tool_name?: string;
	success?: boolean;
	status_code?: number;
	error_message?: string;
	input_tokens?: number;
	output_tokens?: number;
	cache_read_tokens?: number;
	duration_ms?: number;
	raw?: string;
	[key: string]: unknown;
}

type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

interface UseEventStreamOptions {
	maxEvents?: number;
	maxRetries?: number;
}

export function useEventStream(opts: UseEventStreamOptions = {}) {
	const { maxEvents = 500, maxRetries = 10 } = opts;
	const [events, setEvents] = useState<TimelineEvent[]>([]);
	const [status, setStatus] = useState<ConnectionStatus>("connecting");
	const [isPaused, setIsPaused] = useState(false);
	const retriesRef = useRef(0);
	const esRef = useRef<EventSource | null>(null);
	const isPausedRef = useRef(isPaused);
	isPausedRef.current = isPaused;

	const connect = useCallback(() => {
		const es = new EventSource("/api/events/stream");
		esRef.current = es;

		es.onopen = () => {
			setStatus("connected");
			retriesRef.current = 0;
		};

		es.onmessage = (e) => {
			if (isPausedRef.current) return;
			try {
				const newEvents: TimelineEvent[] = JSON.parse(e.data as string);
				setEvents((prev) => [...newEvents, ...prev].slice(0, maxEvents));
			} catch {
				// malformed data, skip
			}
		};

		es.onerror = () => {
			es.close();
			setStatus("disconnected");
			if (retriesRef.current < maxRetries) {
				const delay = Math.min(1000 * 2 ** retriesRef.current, 30_000);
				retriesRef.current++;
				setTimeout(connect, delay);
			} else {
				setStatus("error");
			}
		};
	}, [maxEvents, maxRetries]);

	useEffect(() => {
		connect();
		return () => esRef.current?.close();
	}, [connect]);

	const clearEvents = useCallback(() => setEvents([]), []);

	return { events, status, isPaused, setIsPaused, clearEvents };
}
