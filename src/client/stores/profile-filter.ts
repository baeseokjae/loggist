import { useQuery } from "@tanstack/react-query";
import { parseAsString, useQueryState } from "nuqs";
import { api } from "../lib/api-client";

export const PROFILE_LABEL: Record<string, string> = {
	all: "전체",
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
			return ["all", ...dynamic.filter((p) => p !== "all")];
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
