import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
	children: ReactNode;
	fallback?: ReactNode;
	level?: "page" | "section" | "widget";
	onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
	hasError: boolean;
	error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
	constructor(props: ErrorBoundaryProps) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		console.error(`[ErrorBoundary:${this.props.level || "widget"}]`, error, errorInfo);
		this.props.onError?.(error, errorInfo);
	}

	render() {
		if (this.state.hasError) {
			if (this.props.fallback) {
				return this.props.fallback;
			}
			return (
				<ErrorFallback
					error={this.state.error}
					level={this.props.level || "widget"}
					onRetry={() => this.setState({ hasError: false, error: null })}
				/>
			);
		}
		return this.props.children;
	}
}

function ErrorFallback({
	error,
	level,
	onRetry,
}: {
	error: Error | null;
	level: string;
	onRetry: () => void;
}) {
	if (level === "widget") {
		return (
			<div className="flex items-center justify-center rounded-lg border border-destructive/20 bg-destructive/5 p-4">
				<div className="text-center">
					<p className="text-sm text-destructive">데이터를 불러올 수 없습니다</p>
					<button
						type="button"
						onClick={onRetry}
						className="mt-2 text-xs text-muted-foreground hover:text-foreground"
					>
						다시 시도
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="flex min-h-[200px] items-center justify-center rounded-xl border bg-card p-8">
			<div className="text-center">
				<h3 className="text-lg font-semibold">오류가 발생했습니다</h3>
				<p className="mt-1 text-sm text-muted-foreground">{error?.message || "알 수 없는 오류"}</p>
				<button
					type="button"
					onClick={onRetry}
					className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
				>
					다시 시도
				</button>
			</div>
		</div>
	);
}
