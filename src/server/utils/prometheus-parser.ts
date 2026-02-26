import type { PrometheusResult } from "../../shared/types/prometheus";

export function parseScalarValue(result: unknown, fallback = "0"): number {
	const typed = result as PrometheusResult | undefined;
	const value = typed?.data?.result?.[0]?.value?.[1] ?? fallback;
	return Number.parseFloat(value);
}

export function parseResultCount(result: unknown): number {
	const typed = result as PrometheusResult | undefined;
	return typed?.data?.result?.length ?? 0;
}
