export function formatUSD(amount: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(amount);
}

export function formatPercent(value: number): string {
	if (!Number.isFinite(value)) return "0.0%";
	return `${value.toFixed(1)}%`;
}

export function formatTokens(count: number): string {
	if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
	if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
	return String(count);
}

export function formatDuration(seconds: number): string {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	if (h > 0) return `${h}h ${m}m`;
	return `${m}m`;
}

export function formatNanoTimestamp(tsNano: string): string {
	try {
		const ms = Math.floor(Number(BigInt(tsNano) / 1_000_000n));
		return new Date(ms).toLocaleString("ko-KR", {
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		});
	} catch {
		return tsNano;
	}
}

export function formatRelativeTime(tsNano: string): string {
	try {
		const ms = Math.floor(Number(BigInt(tsNano) / 1_000_000n));
		const diff = Date.now() - ms;
		const seconds = Math.floor(diff / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (seconds < 60) return "방금 전";
		if (minutes < 60) return `${minutes}분 전`;
		if (hours < 24) return `${hours}시간 전`;
		if (days < 7) return `${days}일 전`;
		return formatNanoTimestamp(tsNano);
	} catch {
		return tsNano;
	}
}
