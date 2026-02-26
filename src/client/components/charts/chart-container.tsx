import type { ReactNode } from "react";

interface ChartContainerProps {
	isLoading: boolean;
	isError: boolean;
	isEmpty: boolean;
	errorMessage?: string;
	emptyMessage?: string;
	children: ReactNode;
}

export function ChartContainer({
	isLoading,
	isError,
	isEmpty,
	errorMessage,
	emptyMessage,
	children,
}: ChartContainerProps) {
	if (isLoading) {
		return (
			<div className="flex h-60 items-center justify-center rounded-xl border bg-card">
				<div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
			</div>
		);
	}
	if (isError) {
		return (
			<div className="flex h-60 items-center justify-center rounded-xl border bg-card">
				<p className="text-sm text-destructive">{errorMessage ?? "데이터를 불러오지 못했습니다."}</p>
			</div>
		);
	}
	if (isEmpty) {
		return (
			<div className="flex h-60 items-center justify-center rounded-xl border bg-card">
				<p className="text-sm text-muted-foreground">{emptyMessage ?? "표시할 데이터가 없습니다."}</p>
			</div>
		);
	}
	return <>{children}</>;
}
