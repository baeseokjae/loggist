import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Copy, Check, X, ChevronDown, ChevronRight as ChevronRightIcon } from "lucide-react";
import type { LogEntry } from "../../../shared/types/domain";
import { EVENT_TYPE_CONFIG } from "../../lib/constants";
import { formatNanoTimestamp, formatTokens, formatUSD } from "../../lib/format";
import { cn } from "../../lib/utils";
import { SessionMinimap } from "./session-minimap";

interface LogDetailDrawerProps {
	entry: LogEntry | null;
	onClose: () => void;
	onNavigate: (direction: "prev" | "next") => void;
}

function MetaRow({ label, value }: { label: string; value?: string | null }) {
	if (value == null || value === "" || value === "-") return null;
	return (
		<>
			<dt className="text-xs font-medium text-muted-foreground">{label}</dt>
			<dd className="text-xs">{value}</dd>
		</>
	);
}

function tryFormatJson(data: unknown): string {
	try {
		const str = typeof data === "string" ? data : JSON.stringify(data);
		return JSON.stringify(JSON.parse(str), null, 2);
	} catch {
		return typeof data === "string" ? data : String(data);
	}
}

function CopyButton({ text }: { text: string }) {
	const [copied, setCopied] = useState(false);

	function handleCopy() {
		void navigator.clipboard.writeText(text).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		});
	}

	return (
		<button
			type="button"
			onClick={handleCopy}
			className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs hover:bg-muted"
		>
			{copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
			{copied ? "복사됨" : "복사"}
		</button>
	);
}

export function LogDetailDrawer({ entry, onClose, onNavigate }: LogDetailDrawerProps) {
	const [rawOpen, setRawOpen] = useState(false);
	const drawerRef = useRef<HTMLDivElement>(null);

	// 키보드 네비게이션
	useEffect(() => {
		function handleKeyDown(e: KeyboardEvent) {
			const target = e.target as HTMLElement;
			if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

			if (e.key === "Escape") {
				onClose();
			} else if (e.key === "j" || e.key === "ArrowDown") {
				if (entry) {
					e.preventDefault();
					onNavigate("next");
				}
			} else if (e.key === "k" || e.key === "ArrowUp") {
				if (entry) {
					e.preventDefault();
					onNavigate("prev");
				}
			}
		}

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [entry, onClose, onNavigate]);

	const isOpen = entry !== null;
	const config = entry ? EVENT_TYPE_CONFIG[entry.event_name ?? ""] : null;

	const totalTokens =
		entry && ((entry.input_tokens ?? 0) + (entry.output_tokens ?? 0) || undefined);

	return (
		<div
			ref={drawerRef}
			className={cn(
				"fixed right-0 top-0 z-40 flex h-full w-[420px] flex-col border-l bg-background shadow-xl",
				"transition-transform duration-200",
				isOpen ? "translate-x-0" : "translate-x-full",
			)}
		>
			{entry && (
				<>
					{/* 헤더 */}
					<div className="flex shrink-0 items-center gap-2 border-b px-4 py-3">
						<span
							className={cn(
								"rounded px-1.5 py-0.5 text-xs font-medium",
								config?.badgeClass ?? "bg-muted text-muted-foreground",
							)}
						>
							{config?.label ?? entry.event_name ?? "-"}
						</span>

						<span className="flex-1 truncate text-xs text-muted-foreground">
							{formatNanoTimestamp(entry.timestamp)}
						</span>

						<span className="hidden text-[10px] text-muted-foreground sm:inline">j/k 이동</span>

						<button
							type="button"
							onClick={() => onNavigate("prev")}
							className="rounded p-1 hover:bg-muted"
							title="이전 (k)"
						>
							<ChevronLeft className="h-4 w-4" />
						</button>

						<button
							type="button"
							onClick={() => onNavigate("next")}
							className="rounded p-1 hover:bg-muted"
							title="다음 (j)"
						>
							<ChevronRight className="h-4 w-4" />
						</button>

						<button
							type="button"
							onClick={onClose}
							className="rounded p-1 hover:bg-muted"
							title="닫기 (Esc)"
						>
							<X className="h-4 w-4" />
						</button>
					</div>

					{/* 본문 (스크롤) */}
					<div className="flex-1 overflow-y-auto px-4 py-4">
						<div className="flex flex-col gap-5">
							{/* 메타데이터 그리드 */}
							<section>
								<h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
									메타데이터
								</h3>
								<dl className="grid grid-cols-2 gap-x-4 gap-y-2">
									<MetaRow label="시간" value={formatNanoTimestamp(entry.timestamp)} />
									<MetaRow label="이벤트" value={config?.label ?? entry.event_name} />
									<MetaRow label="모델" value={entry.model} />
									<MetaRow
										label="비용"
										value={entry.cost_usd != null ? formatUSD(entry.cost_usd) : null}
									/>
									<MetaRow
										label="입력 토큰"
										value={
											entry.input_tokens != null
												? formatTokens(entry.input_tokens)
												: null
										}
									/>
									<MetaRow
										label="출력 토큰"
										value={
											entry.output_tokens != null
												? formatTokens(entry.output_tokens)
												: null
										}
									/>
									<MetaRow
										label="캐시 토큰"
										value={
											entry.cache_read_input_tokens != null &&
											entry.cache_read_input_tokens > 0
												? formatTokens(entry.cache_read_input_tokens)
												: null
										}
									/>
									<MetaRow
										label="총 토큰"
										value={totalTokens != null ? formatTokens(totalTokens) : null}
									/>
									<MetaRow
										label="소요시간"
										value={
											entry.duration_ms != null
												? entry.duration_ms >= 1000
													? `${(entry.duration_ms / 1000).toFixed(1)}s`
													: `${entry.duration_ms}ms`
												: null
										}
									/>
									<MetaRow label="도구" value={entry.tool_name} />
									<MetaRow
										label="성공 여부"
										value={
											entry.success != null
												? entry.success
													? "성공"
													: "실패"
												: null
										}
									/>
									<MetaRow
										label="HTTP 상태"
										value={
											entry.status_code != null
												? String(entry.status_code)
												: null
										}
									/>
								</dl>
							</section>

							{/* 에러 메시지 */}
							{entry.event_name === "api_error" && entry.error_message && (
								<section>
									<h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-red-600">
										오류 메시지
									</h3>
									<p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
										{entry.error_message}
									</p>
								</section>
							)}

							{/* 프롬프트 */}
							{entry.prompt && (
								<section>
									<h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
										프롬프트
									</h3>
									<pre className="whitespace-pre-wrap break-words rounded border bg-muted/30 px-3 py-2 text-xs leading-relaxed">
										{entry.prompt}
									</pre>
								</section>
							)}

							{/* 세션 컨텍스트 */}
							{entry.session_id && (
								<section>
									<div className="mb-2 flex items-center justify-between">
										<h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
											세션 컨텍스트
										</h3>
										<Link
											to={`/sessions?id=${entry.session_id}`}
											className="text-xs text-primary underline-offset-2 hover:underline"
										>
											세션 상세 보기 →
										</Link>
									</div>
									<SessionMinimap
										sessionId={entry.session_id}
										currentTimestamp={entry.timestamp}
									/>
								</section>
							)}

							{/* Raw JSON */}
							<section>
								<div className="flex items-center justify-between">
									<button
										type="button"
										onClick={() => setRawOpen((v) => !v)}
										className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
									>
										{rawOpen ? (
											<ChevronDown className="h-3 w-3" />
										) : (
											<ChevronRightIcon className="h-3 w-3" />
										)}
										Raw JSON
									</button>
									{rawOpen && (
										<CopyButton
											text={tryFormatJson(entry)}
										/>
									)}
								</div>

								{rawOpen && (
									<pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap break-all rounded border bg-muted/30 px-3 py-2 text-[11px] leading-relaxed">
										{tryFormatJson(entry)}
									</pre>
								)}
							</section>
						</div>
					</div>
				</>
			)}
		</div>
	);
}
