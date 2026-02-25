import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
			"@server": path.resolve(__dirname, "./src/server"),
			"@client": path.resolve(__dirname, "./src/client"),
		},
	},
	test: {
		globals: true,
		environment: "node",
		include: ["tests/**/*.test.ts"],
		coverage: {
			provider: "v8",
			include: ["src/server/**/*.ts"],
			exclude: [
				"src/client/**",
				"src/server/index.ts", // entry point with side effects (serve, startBudgetChecker, etc.)
			],
		},
	},
});
