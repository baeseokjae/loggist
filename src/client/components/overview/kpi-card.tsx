import { cn } from "../../lib/utils";

interface KpiCardProps {
	title: string;
	value: string;
	subtitle?: string;
	trend?: "up" | "down" | "flat";
	trendValue?: string;
	className?: string;
	isLoading?: boolean;
}

export function KpiCard({
	title,
	value,
	subtitle,
	trend,
	trendValue,
	className,
	isLoading,
}: KpiCardProps) {
	return (
		<div className={cn("rounded-xl border bg-card p-6", className)}>
			<p className="text-sm font-medium text-muted-foreground">{title}</p>
			{isLoading ? (
				<div className="mt-2 h-8 w-24 animate-pulse rounded bg-muted" />
			) : (
				<>
					<p className="mt-1 text-3xl font-bold">{value}</p>
					{(subtitle || trendValue) && (
						<div className="mt-1 flex items-center gap-2">
							{trendValue && (
								<span
									className={cn(
										"text-xs font-medium",
										trend === "up" && "text-chart-2",
										trend === "down" && "text-destructive",
										trend === "flat" && "text-muted-foreground",
									)}
								>
									{trend === "up" && "↑"}
									{trend === "down" && "↓"}
									{trendValue}
								</span>
							)}
							{subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
						</div>
					)}
				</>
			)}
		</div>
	);
}
