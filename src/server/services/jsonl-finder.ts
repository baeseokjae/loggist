import { readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

const SESSION_ID_REGEX = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
	index: Map<string, string>; // sessionId → file path
	baseDirs: string[];
	timestamp: number;
}

let cache: CacheEntry | null = null;

// Discover all Claude profile directories.
// When CLAUDE_PROJECTS_DIR is set (e.g. Docker), use that single directory.
// Otherwise, scan home for ~/.claude/projects, ~/.claude-{profile}/projects
// to cover all profiles (e.g. ~/.claude, ~/.claude-b, ~/.claude-p).
async function getBaseDirs(): Promise<string[]> {
	const envDir = process.env.CLAUDE_PROJECTS_DIR;
	if (envDir) return [path.resolve(envDir)];

	const home = homedir();
	const dirs: string[] = [];

	try {
		const entries = await readdir(home);
		for (const entry of entries) {
			// Match .claude and .claude-* (e.g. .claude-b, .claude-p)
			if (entry === ".claude" || /^\.claude-[a-zA-Z0-9]+$/.test(entry)) {
				const projectsPath = path.join(home, entry, "projects");
				try {
					const s = await stat(projectsPath);
					if (s.isDirectory()) {
						dirs.push(projectsPath);
					}
				} catch {
					// projects dir doesn't exist for this profile
				}
			}
		}
	} catch {
		// fallback
	}

	// Fallback if nothing found
	if (dirs.length === 0) {
		dirs.push(path.join(home, ".claude", "projects"));
	}

	return dirs;
}

async function scanDirectories(): Promise<{
	index: Map<string, string>;
	baseDirs: string[];
}> {
	const baseDirs = await getBaseDirs();
	const index = new Map<string, string>();

	for (const baseDir of baseDirs) {
		let projectDirs: string[];
		try {
			projectDirs = await readdir(baseDir);
		} catch {
			continue;
		}

		for (const projectDir of projectDirs) {
			const projectPath = path.join(baseDir, projectDir);
			try {
				const s = await stat(projectPath);
				if (!s.isDirectory()) continue;

				const files = await readdir(projectPath);
				for (const file of files) {
					if (!file.endsWith(".jsonl")) continue;
					const sessionId = file.replace(".jsonl", "");
					if (SESSION_ID_REGEX.test(sessionId)) {
						index.set(sessionId, path.join(projectPath, file));
					}
				}
			} catch {
				// skip inaccessible directories
			}
		}
	}

	return { index, baseDirs };
}

async function getIndex(forceRescan = false): Promise<CacheEntry> {
	const now = Date.now();
	if (!forceRescan && cache && now - cache.timestamp < CACHE_TTL_MS) {
		return cache;
	}

	const { index, baseDirs } = await scanDirectories();
	cache = { index, baseDirs, timestamp: now };
	return cache;
}

export function validateSessionId(id: string): boolean {
	return SESSION_ID_REGEX.test(id);
}

export async function findSession(
	sessionId: string,
): Promise<{ filePath: string; fileSize: number } | null> {
	if (!validateSessionId(sessionId)) return null;

	// Try cached index first
	let entry = await getIndex();
	let filePath = entry.index.get(sessionId);

	// Cache miss: force rescan
	if (!filePath) {
		entry = await getIndex(true);
		filePath = entry.index.get(sessionId);
	}

	if (!filePath) return null;

	// Security: ensure resolved path stays within one of the base directories
	const resolved = path.resolve(filePath);
	const isWithinBase = entry.baseDirs.some((baseDir) =>
		resolved.startsWith(path.resolve(baseDir)),
	);
	if (!isWithinBase) return null;

	try {
		const s = await stat(resolved);
		return { filePath: resolved, fileSize: s.size };
	} catch {
		return null;
	}
}

export async function getFileMtime(filePath: string): Promise<number> {
	const s = await stat(filePath);
	return s.mtimeMs;
}
