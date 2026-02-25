import bcrypt from "bcryptjs";
import { Hono } from "hono";
import { getDB } from "../db/index";
import { createToken } from "../middleware/auth";

const BCRYPT_SALT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 4;

function getPasswordHash(): string | undefined {
	const db = getDB();
	const row = db.prepare("SELECT value FROM settings WHERE key = 'password_hash'").get() as
		| { value: string }
		| undefined;
	return row?.value;
}

export async function migratePasswordFromEnv(): Promise<void> {
	const envPassword = process.env.LOGGIST_PASSWORD;
	if (!envPassword) return;

	const existing = getPasswordHash();
	if (existing) return;

	const hash = await bcrypt.hash(envPassword, BCRYPT_SALT_ROUNDS);
	const db = getDB();
	db.prepare(
		"INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('password_hash', ?, datetime('now'))",
	).run(hash);
}

export const authRoutes = new Hono();

authRoutes.post("/setup", async (c) => {
	const existing = getPasswordHash();
	if (existing) {
		return c.json({ error: "Password already configured" }, 403);
	}

	const body = await c.req.json();
	const { password } = body;

	if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
		return c.json({ error: "Password must be at least 4 characters" }, 400);
	}

	const hash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
	const db = getDB();
	db.prepare(
		"INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('password_hash', ?, datetime('now'))",
	).run(hash);

	return c.json({ success: true });
});

authRoutes.post("/login", async (c) => {
	const hash = getPasswordHash();
	if (!hash) {
		return c.json({ error: "Password not configured. Please set up a password first." }, 401);
	}

	const body = await c.req.json();
	const { password } = body;

	const valid = await bcrypt.compare(password, hash);
	if (!valid) {
		return c.json({ error: "Invalid password" }, 401);
	}

	const token = await createToken();

	c.header(
		"Set-Cookie",
		`loggist_token=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${24 * 60 * 60}`,
	);

	return c.json({ success: true });
});

authRoutes.post("/logout", (c) => {
	c.header("Set-Cookie", "loggist_token=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0");
	return c.json({ success: true });
});

authRoutes.get("/check", async (c) => {
	const needsSetup = !getPasswordHash();

	const cookie = c.req.header("cookie");
	if (!cookie) return c.json({ authenticated: false, needsSetup }, 401);

	const match = cookie.match(/(?:^|;\s*)loggist_token=([^;]*)/);
	if (!match) return c.json({ authenticated: false, needsSetup }, 401);

	try {
		const { verifyToken } = await import("../middleware/auth");
		await verifyToken(decodeURIComponent(match[1]));
		return c.json({ authenticated: true, needsSetup: false });
	} catch {
		return c.json({ authenticated: false, needsSetup }, 401);
	}
});

authRoutes.post("/change-password", async (c) => {
	const body = await c.req.json();
	const { currentPassword, newPassword } = body;

	if (typeof newPassword !== "string" || newPassword.length < MIN_PASSWORD_LENGTH) {
		return c.json({ error: "New password must be at least 4 characters" }, 400);
	}

	const hash = getPasswordHash();
	if (!hash) {
		return c.json({ error: "Password not configured" }, 400);
	}

	const valid = await bcrypt.compare(currentPassword, hash);
	if (!valid) {
		return c.json({ error: "Current password is incorrect" }, 401);
	}

	const newHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
	const db = getDB();
	db.prepare(
		"UPDATE settings SET value = ?, updated_at = datetime('now') WHERE key = 'password_hash'",
	).run(newHash);

	return c.json({ success: true });
});
