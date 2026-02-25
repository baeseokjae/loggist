import { create } from "zustand";

interface AuthState {
	isAuthenticated: boolean;
	needsSetup: boolean;
	login: (password: string) => Promise<boolean>;
	setup: (password: string) => Promise<boolean>;
	logout: () => Promise<void>;
	checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
	isAuthenticated: false,
	needsSetup: false,

	login: async (password: string) => {
		const res = await fetch("/api/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ password }),
		});
		if (res.ok) {
			set({ isAuthenticated: true, needsSetup: false });
			return true;
		}
		return false;
	},

	setup: async (password: string) => {
		const res = await fetch("/api/auth/setup", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ password }),
		});
		if (res.ok) {
			return true;
		}
		return false;
	},

	logout: async () => {
		await fetch("/api/auth/logout", { method: "POST" });
		set({ isAuthenticated: false });
	},

	checkAuth: async () => {
		const res = await fetch("/api/auth/check");
		if (res.ok) {
			const data = await res.json();
			set({ isAuthenticated: true, needsSetup: data.needsSetup ?? false });
		} else {
			try {
				const data = await res.json();
				set({ isAuthenticated: false, needsSetup: data.needsSetup ?? false });
			} catch {
				set({ isAuthenticated: false, needsSetup: false });
			}
		}
	},
}));
