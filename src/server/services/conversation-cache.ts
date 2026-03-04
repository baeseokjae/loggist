import type { ConversationData } from "../../shared/types/conversation";

const MAX_ENTRIES = 50;
const TTL_MS = 10 * 60 * 1000;

interface CacheEntry {
	data: ConversationData;
	mtime: number;
	createdAt: number;
}

const cache = new Map<string, CacheEntry>();

function evictOldest() {
	if (cache.size < MAX_ENTRIES) return;

	let oldestKey: string | null = null;
	let oldestTime = Number.POSITIVE_INFINITY;

	for (const [key, entry] of cache) {
		if (entry.createdAt < oldestTime) {
			oldestTime = entry.createdAt;
			oldestKey = key;
		}
	}

	if (oldestKey) cache.delete(oldestKey);
}

export function getCached(
	sessionId: string,
	currentMtime: number,
): ConversationData | null {
	const entry = cache.get(sessionId);
	if (!entry) return null;

	const now = Date.now();
	if (now - entry.createdAt > TTL_MS) {
		cache.delete(sessionId);
		return null;
	}

	if (entry.mtime !== currentMtime) {
		cache.delete(sessionId);
		return null;
	}

	return entry.data;
}

export function setCached(
	sessionId: string,
	data: ConversationData,
	mtime: number,
): void {
	evictOldest();
	cache.set(sessionId, { data, mtime, createdAt: Date.now() });
}
