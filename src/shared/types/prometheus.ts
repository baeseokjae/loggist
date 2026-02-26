export interface PrometheusMetric {
	metric: Record<string, string>;
	value?: [number, string];
	values?: [number, string][];
}

export interface PrometheusResult {
	data: {
		resultType: string;
		result: PrometheusMetric[];
	};
}
