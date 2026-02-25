const PROMETHEUS_URL = process.env.PROMETHEUS_URL || "http://localhost:9090";

export async function queryPrometheus(query: string, time?: string): Promise<unknown> {
	const params = new URLSearchParams({ query });
	if (time) params.set("time", time);

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 10_000);

	try {
		const res = await fetch(`${PROMETHEUS_URL}/api/v1/query?${params}`, {
			signal: controller.signal,
		});
		if (!res.ok) {
			throw new Error(`Prometheus query failed: ${res.status}`);
		}
		return await res.json();
	} finally {
		clearTimeout(timeout);
	}
}

export async function queryPrometheusRange(
	query: string,
	start: string,
	end: string,
	step: string,
): Promise<unknown> {
	const params = new URLSearchParams({ query, start, end, step });

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 30_000);

	try {
		const res = await fetch(`${PROMETHEUS_URL}/api/v1/query_range?${params}`, {
			signal: controller.signal,
		});
		if (!res.ok) {
			throw new Error(`Prometheus range query failed: ${res.status}`);
		}
		return await res.json();
	} finally {
		clearTimeout(timeout);
	}
}
