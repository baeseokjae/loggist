import { getDB } from "../db/index";
import { type ParsedEvent, subscribe as subscribeLoki } from "./loki-tail";

export function initSessionTitleCache() {
	subscribeLoki((events: ParsedEvent[]) => {
		const db = getDB();
		const upsert = db.prepare(
			"INSERT OR IGNORE INTO session_titles (session_id, first_prompt, profile) VALUES (?, ?, ?)",
		);

		for (const event of events) {
			if (
				event.event_name === "user_prompt" &&
				typeof event.session_id === "string" &&
				event.session_id.length > 0 &&
				typeof event.prompt === "string" &&
				event.prompt.length > 0
			) {
				try {
					upsert.run(
						event.session_id,
						String(event.prompt).slice(0, 200),
						String(event.profile || "all"),
					);
				} catch {
					// Non-fatal: title caching is best-effort
				}
			}
		}
	});
}
