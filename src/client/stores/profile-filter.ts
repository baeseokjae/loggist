import { parseAsStringLiteral, useQueryState } from "nuqs";

export const PROFILE_VALUES = ["all", "claude-b", "claude-p"] as const;
export type ProfileValue = (typeof PROFILE_VALUES)[number];

export const PROFILE_LABEL: Record<ProfileValue, string> = {
	all: "전체",
	"claude-b": "claude-b",
	"claude-p": "claude-p",
};

export function useProfileFilter() {
	const [profile, setQueryProfile] = useQueryState(
		"profile",
		parseAsStringLiteral(PROFILE_VALUES).withDefault("all"),
	);

	function setProfile(value: ProfileValue) {
		void setQueryProfile(value);
	}

	return {
		profile,
		setProfile,
	};
}
