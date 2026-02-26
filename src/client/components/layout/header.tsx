import type { ReactNode } from "react";
import { PROFILE_LABEL, PROFILE_VALUES, useProfileFilter } from "../../stores/profile-filter";
import { RANGE_LABEL, RANGE_VALUES, useTimeRange } from "../../stores/time-range";

interface HeaderProps {
	title: string;
	children?: ReactNode;
}

export function Header({ title, children }: HeaderProps) {
	const { range, setRange } = useTimeRange();
	const { profile, setProfile } = useProfileFilter();

	return (
		<div className="flex items-center justify-between">
			<h1 className="text-2xl font-bold">{title}</h1>
			<div className="flex items-center gap-3">
				{children}
				<div className="flex items-center gap-2">
					<span className="text-xs font-medium text-muted-foreground">프로필</span>
					<select
						value={profile}
						onChange={(e) => setProfile(e.target.value as (typeof PROFILE_VALUES)[number])}
						className="h-7 rounded border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
					>
						{PROFILE_VALUES.map((p) => (
							<option key={p} value={p}>
								{PROFILE_LABEL[p]}
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
