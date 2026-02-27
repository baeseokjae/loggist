import { useQuery } from "@tanstack/react-query";
import { parseAsString, useQueryState } from "nuqs";
import { api } from "../lib/api-client";

export const PROFILE_VALUES = ["all", "claude-b", "claude-p"] as const;
export type ProfileValue = (typeof PROFILE_VALUES)[number];

export const PROFILE_LABEL: Record<string, string> = {
	all: "전체",
	"claude-b": "claude-b",
	"claude-p": "claude-p",
};

interface ProfilesResponse {
	data: {
		profiles: string[];
	};
}

export function useProfiles() {
	return useQuery({
		queryKey: ["profiles"],
		queryFn: () => api.get<ProfilesResponse>("/metrics/profiles"),
		select: (res) => {
			const dynamic = res?.data?.profiles ?? [];
			// Always include "all" and merge with dynamic values, deduplicated
			const merged = ["all", ...dynamic.filter((p) => p !== "all")];
			return merged;
		},
		staleTime: 5 * 60 * 1000, // 5 minutes
		refetchInterval: 5 * 60 * 1000,
	});
}

export function useProfileFilter() {
	const [profile, setQueryProfile] = useQueryState(
		"profile",
		parseAsString.withDefault("all"),
	);

	function setProfile(value: string) {
		void setQueryProfile(value);
	}

	return {
		profile: profile ?? "all",
		setProfile,
	};
}
