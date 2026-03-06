import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { type ReactNode, useState } from "react";
import { cn } from "../../lib/utils";
import { PROFILE_LABEL, useProfileFilter, useProfiles } from "../../stores/profile-filter";
import { RANGE_LABEL, RANGE_VALUES, useTimeRange } from "../../stores/time-range";

interface HeaderProps {
	title: string;
	children?: ReactNode;
	refreshKeys?: string[][];
	onRefresh?: () => void;
}

export function Header({ title, children, refreshKeys, onRefresh }: HeaderProps) {
	const { range, setRange } = useTimeRange();
	const { profile, setProfile } = useProfileFilter();
	const { data: dynamicProfiles } = useProfiles();
	const queryClient = useQueryClient();
	const [spinning, setSpinning] = useState(false);

	const hasRefresh = (refreshKeys && refreshKeys.length > 0) || onRefresh;

	function handleRefresh() {
		setSpinning(true);
		if (refreshKeys) {
			for (const key of refreshKeys) {
				queryClient.invalidateQueries({ queryKey: key });
			}
		}
		onRefresh?.();
		setTimeout(() => setSpinning(false), 500);
	}

	const profileOptions = dynamicProfiles ?? ["all"];

	return (
		<div className="flex items-center justify-between">
			<div className="flex items-center gap-2">
				<h1 className="text-2xl font-bold">{title}</h1>
				{hasRefresh && (
					<button
						type="button"
						onClick={handleRefresh}
						className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
						title="새로고침"
					>
						<RefreshCw
							className={cn("h-3.5 w-3.5", spinning && "animate-spin")}
						/>
					</button>
				)}
			</div>
			<div className="flex items-center gap-3">
				{children}
				<div className="flex items-center gap-2">
					<span className="text-xs font-medium text-muted-foreground">프로필</span>
					<select
						value={profile}
						onChange={(e) => setProfile(e.target.value)}
						className="h-7 rounded border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
					>
						{profileOptions.map((p) => (
							<option key={p} value={p}>
								{PROFILE_LABEL[p] ?? p}
							</option>
						))}
					</select>
				</div>
				<div className="flex items-center gap-2">
					<span className="text-xs font-medium text-muted-foreground">기간</span>
					<select
						value={range}
						onChange={(e) => setRange(e.target.value as (typeof RANGE_VALUES)[number])}
						className="h-7 rounded border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
					>
						{RANGE_VALUES.map((r) => (
							<option key={r} value={r}>
								{RANGE_LABEL[r]}
							</option>
						))}
					</select>
				</div>
			</div>
		</div>
	);
}
