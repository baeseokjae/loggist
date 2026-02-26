export async function notify(params: {
	method: "dashboard" | "slack" | "webhook";
	url?: string | null;
	title: string;
	message: string;
	severity?: "info" | "warning" | "critical";
}): Promise<void> {
	const { method, url, title, message, severity = "info" } = params;

	if (method === "dashboard") {
		// No-op: alert is already stored in DB and displayed in UI
		return;
	}

	if (!url) {
		console.error(`[Notifier] method=${method} requires a URL but none was provided`);
		return;
	}

	if (method === "slack") {
		const severityEmoji: Record<string, string> = {
			info: ":information_source:",
			warning: ":warning:",
			critical: ":rotating_light:",
		};
		const emoji = severityEmoji[severity] ?? ":information_source:";

		const body = {
			text: `${emoji} *${title}*`,
			attachments: [
				{
					color: severity === "critical" ? "danger" : severity === "warning" ? "warning" : "good",
					text: message,
					footer: "Loggist",
					ts: Math.floor(Date.now() / 1000),
				},
			],
		};

		try {
			const response = await fetch(url, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});
			if (!response.ok) {
				console.error(
					`[Notifier] Slack webhook returned ${response.status}: ${await response.text()}`,
				);
			}
		} catch (error) {
			console.error("[Notifier] Failed to send Slack notification:", error);
		}
		return;
	}

	if (method === "webhook") {
		const body = {
			title,
			message,
			severity,
			timestamp: new Date().toISOString(),
		};

		try {
			const response = await fetch(url, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});
			if (!response.ok) {
				console.error(
					`[Notifier] Webhook returned ${response.status}: ${await response.text()}`,
				);
			}
		} catch (error) {
			console.error("[Notifier] Failed to send webhook notification:", error);
		}
		return;
	}
}
