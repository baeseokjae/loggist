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

	// Seed default model pricing if table is empty
	const pricingCount = (
		db.prepare("SELECT COUNT(*) as count FROM model_pricing").get() as { count: number }
	).count;
	if (pricingCount === 0) {
		const upsert = db.prepare(
			`INSERT OR REPLACE INTO model_pricing (model, input_price_per_mtok, cache_read_price_per_mtok, output_price_per_mtok)
       VALUES (?, ?, ?, ?)`,
		);
		const seedPricing = db.transaction(() => {
			upsert.run("claude-opus-4", 15.0, 1.5, 75.0);
			upsert.run("claude-sonnet-4", 3.0, 0.3, 15.0);
			upsert.run("claude-haiku-3.5", 0.8, 0.08, 4.0);
		});
		seedPricing();
	}

	return db;
}

export function closeDB(): void {
	if (db) {
		db.close();
	}
}
