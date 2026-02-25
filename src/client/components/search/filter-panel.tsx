const EVENT_TYPES = [
	{ value: "api_request", label: "API 요청" },
	{ value: "api_error", label: "API 오류" },
	{ value: "tool_result", label: "도구 결과" },
	{ value: "tool_decision", label: "도구 결정" },
	{ value: "user_prompt", label: "사용자 프롬프트" },
] as const;

const PROFILES = [
	{ value: "all", label: "전체" },
	{ value: "claude-b", label: "claude-b" },
	{ value: "claude-p", label: "claude-p" },
] as const;

export type ProfileValue = (typeof PROFILES)[number]["value"];

interface FilterPanelProps {
	selectedEventTypes: string[];
	onEventTypesChange: (types: string[]) => void;
	profile: ProfileValue;
	onProfileChange: (profile: ProfileValue) => void;
}

export function FilterPanel({
	selectedEventTypes,
	onEventTypesChange,
	profile,
	onProfileChange,
}: FilterPanelProps) {
	function toggleEventType(type: string) {
		if (selectedEventTypes.includes(type)) {
			onEventTypesChange(selectedEventTypes.filter((t) => t !== type));
		} else {
			onEventTypesChange([...selectedEventTypes, type]);
		}
	}

	return (
		<div className="flex flex-wrap items-center gap-4 rounded-lg border bg-card p-3">
			<div className="flex flex-wrap items-center gap-2">
				<span className="text-xs font-medium text-muted-foreground">이벤트 유형</span>
				{EVENT_TYPES.map((et) => (
					<label key={et.value} className="flex cursor-pointer items-center gap-1.5">
						<input
							type="checkbox"
							checked={selectedEventTypes.includes(et.value)}
							onChange={() => toggleEventType(et.value)}
							className="h-3.5 w-3.5 rounded border accent-primary"
						/>
						<span className="text-xs">{et.label}</span>
					</label>
				))}
			</div>

			<div className="flex items-center gap-2">
				<span className="text-xs font-medium text-muted-foreground">프로필</span>
				<select
					value={profile}
					onChange={(e) => onProfileChange(e.target.value as ProfileValue)}
					className="h-7 rounded border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
				>
					{PROFILES.map((p) => (
						<option key={p.value} value={p.value}>
							{p.label}
						</option>
					))}
				</select>
			</div>
		</div>
	);
}
