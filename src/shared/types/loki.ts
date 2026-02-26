export interface LokiStream {
	stream: Record<string, string>;
	values: [string, string][];
}

export interface LokiQueryResult {
	data?: {
		result?: LokiStream[];
	};
}
