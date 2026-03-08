const LOKI_URL = process.env.LOKI_URL || "http://localhost:3100";

export async function queryLoki(query: string, limit = 100): Promise<unknown> {
	const params = new URLSearchParams({ query, limit: String(limit) });

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 10_000);

	try {
		const res = await fetch(`${LOKI_URL}/loki/api/v1/query?${params}`, {
			signal: controller.signal,
		});
		if (!res.ok) {
			throw new Error(`Loki query failed: ${res.status}`);
		}
		return await res.json();
	} finally {
		clearTimeout(timeout);
	}
}

export async function queryLokiRange(
	query: string,
	start: string,
	end: string,
	limit = 100,
	direction: "forward" | "backward" = "backward",
): Promise<unknown> {
	const params = new URLSearchParams({ query, start, end, limit: String(limit), direction });

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 30_000);

	try {
		const res = await fetch(`${LOKI_URL}/loki/api/v1/query_range?${params}`, {
			signal: controller.signal,
		});
		if (!res.ok) {
			throw new Error(`Loki range query failed: ${res.status}`);
		}
		return await res.json();
	} finally {
		clearTimeout(timeout);
	}
}

// 라벨 값 조회: 지정된 시간 범위 내 고유 라벨 값 반환
export async function queryLokiLabelValues(
	labelName: string,
	start?: string,
	end?: string,
): Promise<string[]> {
	const params = new URLSearchParams();
	if (start) params.set("start", start);
	if (end) params.set("end", end);
	params.set("query", '{service_name="claude-code"}');

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 10_000);

	try {
		const res = await fetch(
			`${LOKI_URL}/loki/api/v1/label/${encodeURIComponent(labelName)}/values?${params}`,
			{ signal: controller.signal },
		);
		if (!res.ok) {
			throw new Error(`Loki label values query failed: ${res.status}`);
		}
		const json = (await res.json()) as { data?: string[] };
		return json.data ?? [];
	} finally {
		clearTimeout(timeout);
	}
}

// 메트릭 범위 쿼리: count_over_time 등 집계 함수 결과를 시계열로 반환
export async function queryLokiMetricRange(
	query: string,
	start: string,
	end: string,
	step: string,
): Promise<unknown> {
	const params = new URLSearchParams({ query, start, end, step });
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 30_000);
	try {
		const res = await fetch(`${LOKI_URL}/loki/api/v1/query_range?${params}`, {
			signal: controller.signal,
		});
		if (!res.ok) throw new Error(`Loki metric range query failed: ${res.status}`);
		return await res.json();
	} finally {
		clearTimeout(timeout);
	}
}
