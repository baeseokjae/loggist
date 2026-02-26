import { useQuery } from "@tanstack/react-query";
import { parseAsString, useQueryState } from "nuqs";
import type { SessionEvent, SessionSummary } from "../../shared/types/domain";
import { Header } from "../components/layout/header";
import { SessionDetail } from "../components/sessions/session-detail";
import { SessionList } from "../components/sessions/session-list";
import { api } from "../lib/api-client";

interface SessionDetailData {
	sessionId: string;
	events: SessionEvent[];
	summary: SessionSummary;
}

export function SessionsPage() {
	const [selectedSession, setSelectedSession] = useQueryState("id", parseAsString);

	const { data: sessions, isLoading } = useQuery({
		queryKey: ["sessions"],
		queryFn: () => api.get<{ data: SessionSummary[] }>("/sessions"),
		select: (res) => res.data,
	});

	const { data: detail } = useQuery({
		queryKey: ["session-detail", selectedSession],
		queryFn: () => api.get<{ data: SessionDetailData }>(`/sessions/${selectedSession}`),
		select: (res) => res.data,
		enabled: !!selectedSession,
	});

	return (
		<div className="space-y-6">
			<Header title="세션 분석" />

			<div className="grid gap-6 lg:grid-cols-3">
				<SessionList
					sessions={sessions}
					selectedSession={selectedSession}
					onSelectSession={setSelectedSession}
					isLoading={isLoading}
				/>

				<div className="lg:col-span-2">
					{detail ? (
						<SessionDetail detail={detail} />
					) : (
						<div className="flex h-64 items-center justify-center rounded-xl border bg-card">
							<p className="text-muted-foreground">세션을 선택하세요</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
