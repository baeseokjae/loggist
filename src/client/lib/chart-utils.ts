import type uPlot from "uplot";

/** Add alpha to any CSS color format (oklch, hsl, rgb, hex) */
export function withAlpha(color: string, alpha: number): string {
	if (color.endsWith(")")) {
		return color.slice(0, -1) + ` / ${alpha})`;
	}
	if (color.startsWith("#")) {
		const hex = Math.round(alpha * 255)
			.toString(16)
			.padStart(2, "0");
		return color.length <= 7 ? `${color}${hex}` : color;
	}
	return color;
}

// Shared across all chart components
export function getChartColors() {
	const style = getComputedStyle(document.documentElement);
	return {
		chart1: style.getPropertyValue("--color-chart-1").trim() || "oklch(0.646 0.222 41.116)",
		chart2: style.getPropertyValue("--color-chart-2").trim() || "oklch(0.6 0.118 184)",
		chart3: style.getPropertyValue("--color-chart-3").trim() || "oklch(0.6 0.118 145)",
		chart4: style.getPropertyValue("--color-chart-4").trim() || "oklch(0.6 0.118 80)",
		chart5: style.getPropertyValue("--color-chart-5").trim() || "oklch(0.6 0.118 300)",
		foreground: style.getPropertyValue("--color-foreground").trim() || "oklch(0.145 0 0)",
		border: style.getPropertyValue("--color-border").trim() || "oklch(0.922 0 0)",
	};
}

// Grafana-inspired model colors — vibrant on dark backgrounds
const MODEL_COLOR_MAP: Record<string, string> = {
	opus: "#FADE2A",
	sonnet: "#5794F2",
	haiku: "#73BF69",
};
const FALLBACK_COLORS = ["#FF9830", "#B877D9", "#F2495C", "#FF6A00", "#8AB8FF"];

export function getModelColor(model: string, index: number): string {
	const lower = model.toLowerCase();
	for (const [key, color] of Object.entries(MODEL_COLOR_MAP)) {
		if (lower.includes(key)) return color;
	}
	return FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

// Build aligned uPlot data from Prometheus range query result
export function buildAlignedData(
	result: Array<{ metric: Record<string, string>; values?: [number, string][] }>,
): uPlot.AlignedData {
	if (!result.length) {
		return [[], []];
	}

	// Collect all unique timestamps across all series
	const tsSet = new Set<number>();
	for (const series of result) {
		for (const [ts] of series.values ?? []) {
			tsSet.add(ts);
		}
	}

	const timestamps = Array.from(tsSet).sort((a, b) => a - b);
	const tsIndex = new Map(timestamps.map((ts, i) => [ts, i]));

	const seriesArrays: (number | null)[][] = result.map((series) => {
		const arr: (number | null)[] = new Array(timestamps.length).fill(null);
		for (const [ts, valStr] of series.values ?? []) {
			const idx = tsIndex.get(ts);
			if (idx !== undefined) {
				arr[idx] = Number.parseFloat(valStr);
			}
		}
		return arr;
	});

	return [timestamps, ...seriesArrays] as uPlot.AlignedData;
}

/** Build cumulative per-model data from Prometheus increase() results */
export function buildCumulativeModelData(
	result: Array<{ metric: Record<string, string>; values?: [number, string][] }>,
): { data: uPlot.AlignedData; models: string[] } {
	if (!result.length) return { data: [[], []], models: [] };

	const tsSet = new Set<number>();
	for (const series of result) {
		for (const [ts] of series.values ?? []) tsSet.add(ts);
	}

	const timestamps = Array.from(tsSet).sort((a, b) => a - b);
	const tsIndex = new Map(timestamps.map((ts, i) => [ts, i]));

	const models: string[] = [];
	const seriesArrays: (number | null)[][] = [];

	for (const series of result) {
		const model = series.metric?.model ?? "unknown";
		models.push(model);

		const raw: (number | null)[] = new Array(timestamps.length).fill(null);
		for (const [ts, valStr] of series.values ?? []) {
			const idx = tsIndex.get(ts);
			if (idx !== undefined) {
				raw[idx] = Number.parseFloat(valStr);
			}
		}

		// Running cumulative sum with forward-fill
		const cumulative: (number | null)[] = new Array(timestamps.length).fill(null);
		let sum = 0;
		for (let i = 0; i < timestamps.length; i++) {
			if (raw[i] != null) {
				sum += raw[i] as number;
				cumulative[i] = sum;
			} else if (sum > 0) {
				cumulative[i] = sum;
			}
		}
		seriesArrays.push(cumulative);
	}

	// Sort by final cumulative value descending (largest cost model first)
	const indices = models.map((_, i) => i);
	indices.sort((a, b) => {
		const aLast = seriesArrays[a][seriesArrays[a].length - 1] ?? 0;
		const bLast = seriesArrays[b][seriesArrays[b].length - 1] ?? 0;
		return bLast - aLast;
	});

	return {
		data: [timestamps, ...indices.map((i) => seriesArrays[i])] as uPlot.AlignedData,
		models: indices.map((i) => models[i]),
	};
}

/** Build per-step (raw increase) per-model data from Prometheus increase() results */
export function buildPerStepModelData(
	result: Array<{ metric: Record<string, string>; values?: [number, string][] }>,
): { data: uPlot.AlignedData; models: string[] } {
	if (!result.length) return { data: [[], []], models: [] };

	const tsSet = new Set<number>();
	for (const series of result) {
		for (const [ts] of series.values ?? []) tsSet.add(ts);
	}

	const timestamps = Array.from(tsSet).sort((a, b) => a - b);
	const tsIndex = new Map(timestamps.map((ts, i) => [ts, i]));

	const models: string[] = [];
	const seriesArrays: (number | null)[][] = [];

	for (const series of result) {
		const model = series.metric?.model ?? "unknown";
		models.push(model);

		const raw: (number | null)[] = new Array(timestamps.length).fill(null);
		for (const [ts, valStr] of series.values ?? []) {
			const idx = tsIndex.get(ts);
			if (idx !== undefined) {
				raw[idx] = Number.parseFloat(valStr);
			}
		}

		// Use raw values as-is (no cumulative sum, no forward-fill)
		seriesArrays.push(raw);
	}

	// Sort by total sum descending (largest cost model first)
	const indices = models.map((_, i) => i);
	indices.sort((a, b) => {
		const aSum = seriesArrays[a].reduce<number>((acc, v) => acc + (v ?? 0), 0);
		const bSum = seriesArrays[b].reduce<number>((acc, v) => acc + (v ?? 0), 0);
		return bSum - aSum;
	});

	return {
		data: [timestamps, ...indices.map((i) => seriesArrays[i])] as uPlot.AlignedData,
		models: indices.map((i) => models[i]),
	};
}
