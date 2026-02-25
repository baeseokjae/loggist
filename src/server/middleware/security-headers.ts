import { createMiddleware } from "hono/factory";

export const securityHeaders = createMiddleware(async (c, next) => {
	await next();
	c.header("X-Content-Type-Options", "nosniff");
	c.header("X-Frame-Options", "DENY");
	c.header("X-XSS-Protection", "1; mode=block");
	c.header("Referrer-Policy", "strict-origin-when-cross-origin");
	c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
	c.header(
		"Content-Security-Policy",
		"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'",
	);
});
