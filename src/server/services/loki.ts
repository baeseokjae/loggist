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
