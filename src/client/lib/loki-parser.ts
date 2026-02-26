import type { LokiQueryResult } from "../../shared/types/loki";

export interface ParsedLogEntry {
	timestamp: string;
	[key: string]: unknown;
}

export function parseLokiResult(raw: unknown): ParsedLogEntry[] {
	const result = raw as LokiQueryResult;
	const streams = result?.data?.result ?? [];
	return streams.flatMap((stream) =>
		stream.values.map(([tsNano, line]) => {
			try {
				return { timestamp: tsNano, ...stream.stream, ...(JSON.parse(line) as Record<string, unknown>) };
			} catch {
				return { timestamp: tsNano, ...stream.stream, raw: line };
			}
		}),
	);
}
