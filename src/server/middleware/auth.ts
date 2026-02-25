import { createMiddleware } from "hono/factory";
import * as jose from "jose";

function getJwtSecret(): Uint8Array {
	const secret = process.env.LOGGIST_JWT_SECRET;
	if (!secret) {
		if (process.env.NODE_ENV === "test") {
			return new TextEncoder().encode("test-secret-key-for-testing-only");
		}
		throw new Error(
			"LOGGIST_JWT_SECRET 환경변수가 설정되지 않았습니다. " +
				"`openssl rand -base64 32`로 생성하여 설정하세요.",
		);
	}
	return new TextEncoder().encode(secret);
}

const JWT_SECRET = getJwtSecret();
const TOKEN_EXPIRY = "24h";

export async function createToken(): Promise<string> {
	return await new jose.SignJWT({ role: "admin" })
		.setProtectedHeader({ alg: "HS256" })
		.setExpirationTime(TOKEN_EXPIRY)
		.setIssuedAt()
		.sign(JWT_SECRET);
}

export async function verifyToken(token: string) {
	return await jose.jwtVerify(token, JWT_SECRET);
}

function getCookie(cookieHeader: string | undefined, name: string): string | undefined {
	if (!cookieHeader) return undefined;
	const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
	return match ? decodeURIComponent(match[1]) : undefined;
}

export const authMiddleware = createMiddleware(async (c, next) => {
	const path = c.req.path;
	if (
		path === "/api/auth/login" ||
		path === "/api/auth/logout" ||
		path === "/api/auth/check" ||
		path === "/api/auth/setup" ||
		path === "/api/health"
	) {
		return next();
	}

	const token = getCookie(c.req.header("cookie"), "loggist_token");
	if (!token) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	try {
		await jose.jwtVerify(token, JWT_SECRET);
		return next();
	} catch {
		return c.json({ error: "Invalid or expired token" }, 401);
	}
});
