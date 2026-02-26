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
