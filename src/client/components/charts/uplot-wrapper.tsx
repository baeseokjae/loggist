import "uplot/dist/uPlot.min.css";
import { useEffect, useRef } from "react";
import uPlot from "uplot";
import { cn } from "../../lib/utils";

interface UPlotWrapperProps {
	data: uPlot.AlignedData;
	options: Partial<uPlot.Options>;
	className?: string;
}

export function UPlotWrapper({ data, options, className }: UPlotWrapperProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const plotRef = useRef<uPlot | null>(null);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const width = container.clientWidth || 600;
		const height = (options.height as number) ?? 240;

		const fullOptions: uPlot.Options = {
			width,
			height,
			...options,
		} as uPlot.Options;

		const plot = new uPlot(fullOptions, data, container);
		plotRef.current = plot;

		const observer = new ResizeObserver((entries) => {
			const entry = entries[0];
			if (entry && plotRef.current) {
				plotRef.current.setSize({
					width: entry.contentRect.width,
					height: height,
				});
			}
		});
		observer.observe(container);

		return () => {
			observer.disconnect();
			plot.destroy();
			plotRef.current = null;
		};
	}, [data, options]);

	return <div ref={containerRef} className={cn("w-full", className)} />;
}
