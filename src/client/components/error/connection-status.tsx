import { useEventStream } from "../../hooks/use-event-stream";
import { cn } from "../../lib/utils";

const STATUS_CONFIG = {
	connecting: {
		dot: "bg-amber-400 animate-pulse",
		label: "연결 중",
		badge:
			"border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400",
	},
	connected: {
		dot: "bg-green-500",
		label: "연결됨",
		badge:
			"border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400",
	},
	disconnected: {
		dot: "bg-yellow-400 animate-pulse",
		label: "재연결 중",
		badge:
			"border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-400",
	},
	error: {
		dot: "bg-red-500",
		label: "연결 오류",
		badge:
			"border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400",
	},
} as const;

export function ConnectionStatus() {
	const { status } = useEventStream();
	const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.disconnected;

	return (
		<span
			className={cn(
				"inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
				config.badge,
			)}
		>
			<span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} />
			{config.label}
		</span>
	);
}
