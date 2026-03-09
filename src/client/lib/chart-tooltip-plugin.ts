import type uPlot from "uplot";

export type ValueFormatter = (value: number | null | undefined, seriesIndex: number) => string;

function formatTimestamp(ts: number): string {
	const d = new Date(ts * 1000);
	const pad = (n: number) => String(n).padStart(2, "0");
	return (
		`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
		`${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
	);
}

function defaultFormatter(value: number | null | undefined): string {
	if (value == null || !isFinite(value)) return "-";
	return String(value);
}

/**
 * Grafana-style floating tooltip plugin for uPlot.
 *
 * @param formatValue - optional per-value formatter; receives the raw numeric value
 *   and the 1-based series index (matches u.series index). Falls back to a simple
 *   String() conversion when not provided.
 */
export function tooltipPlugin(formatValue?: ValueFormatter, rawData?: uPlot.AlignedData): uPlot.Plugin {
	let tooltipEl: HTMLDivElement | null = null;

	const fmt = formatValue ?? ((v) => defaultFormatter(v));

	return {
		hooks: {
			init(u: uPlot) {
				tooltipEl = document.createElement("div");
				tooltipEl.className = "uplot-tooltip";
				tooltipEl.style.display = "none";
				// Append inside u.root so it moves with the chart when the page scrolls
				u.root.style.position = "relative";
				u.root.appendChild(tooltipEl);
			},

			setCursor(u: uPlot) {
				if (!tooltipEl) return;

				const idx = u.cursor.idx;
				if (idx == null || idx < 0) {
					tooltipEl.style.display = "none";
					return;
				}

				const timestamps = u.data[0] as number[];
				const ts = timestamps[idx];
				if (ts == null) {
					tooltipEl.style.display = "none";
					return;
				}

				// Build rows for each data series (skip index 0 which is x/timestamps)
				const rows: string[] = [];
				for (let i = 1; i < u.series.length; i++) {
					const s = u.series[i];
					// Skip hidden series
					if (!s.show) continue;

					const dataSource = rawData ?? u.data;
					const raw = (dataSource[i] as (number | null)[])[idx];
					if (raw == null || raw === 0) continue;
					const color = (s.stroke as string) ?? "#fff";
					const label = s.label ?? `Series ${i}`;
					const valueStr = fmt(raw, i);

					rows.push(
						`<div class="uplot-tooltip-row">` +
							`<span class="uplot-tooltip-marker" style="color:${color}">&#9679;</span>` +
							`<span class="uplot-tooltip-label">${label}</span>` +
							`<span class="uplot-tooltip-value">${valueStr}</span>` +
							`</div>`,
					);
				}

				if (rows.length === 0) {
					tooltipEl.style.display = "none";
					return;
				}

				tooltipEl.innerHTML =
					`<div class="uplot-tooltip-ts">${formatTimestamp(ts)}</div>` + rows.join("");

				// Position: follow cursor, flip to left when near right edge
				const cursorLeft = u.cursor.left ?? 0;
				const chartWidth = u.bbox.width / devicePixelRatio;
				const tipWidth = tooltipEl.offsetWidth || 160;
				const OFFSET = 14;

				const leftPos =
					cursorLeft + OFFSET + tipWidth > chartWidth
						? cursorLeft - tipWidth - OFFSET
						: cursorLeft + OFFSET;

				tooltipEl.style.left = `${Math.max(0, leftPos)}px`;

				// Dynamic vertical positioning: place tooltip away from cursor
				const cursorTop = u.cursor.top ?? 0;
				const chartHeight = u.bbox.height / devicePixelRatio;
				const tipHeight = tooltipEl.offsetHeight || 80;
				const VERTICAL_OFFSET = 12;

				if (cursorTop < chartHeight / 2) {
					tooltipEl.style.top = `${Math.min(cursorTop + VERTICAL_OFFSET, chartHeight - tipHeight)}px`;
				} else {
					tooltipEl.style.top = `${Math.max(0, cursorTop - tipHeight - VERTICAL_OFFSET)}px`;
				}

				tooltipEl.style.display = "block";
			},
		},
	};
}
