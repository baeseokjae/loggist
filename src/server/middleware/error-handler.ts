import type { ErrorHandler } from "hono";

export const errorHandler: ErrorHandler = (err, c) => {
	console.error("[Error Handler]", err);

	const isProduction = process.env.NODE_ENV === "production";

	// Determine status code: 400 for validation/client errors, 500 for everything else
	const isValidationError =
		err.name === "ValidationError" ||
		err.name === "ZodError" ||
		err.message?.toLowerCase().includes("invalid") ||
		err.message?.toLowerCase().includes("validation") ||
		err.message?.toLowerCase().includes("required") ||
		err.message?.toLowerCase().includes("bad request");

	const status = isValidationError ? 400 : 500;

	const body: { error: string; status: number; stack?: string } = {
		error: err.message || "Internal Server Error",
		status,
	};

	if (!isProduction && err.stack) {
		body.stack = err.stack;
	}

	return c.json(body, status);
};
