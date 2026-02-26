import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const __dirname = dirname(fileURLToPath(import.meta.url));

let db: Database.Database;

export function getDB(): Database.Database {
	if (!db) {
		throw new Error("Database not initialized. Call initDB() first.");
	}
	return db;
}

export function initDB(dbPath?: string): Database.Database {
	const dataDir = process.env.LOGGIST_DATA_DIR || "./data";
	if (!existsSync(dataDir)) {
		mkdirSync(dataDir, { recursive: true });
	}

	const finalPath = dbPath || join(dataDir, "loggist.db");
	db = new Database(finalPath);
	db.pragma("journal_mode = WAL");
	db.pragma("foreign_keys = ON");

	const schema = readFileSync(join(__dirname, "schema.sql"), "utf-8");
	db.exec(schema);

	return db;
}

export function closeDB(): void {
	if (db) {
		db.close();
	}
}
