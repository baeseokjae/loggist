import { NuqsAdapter } from "nuqs/adapters/react-router/v7";
import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "./components/layout/app-shell";
import { BudgetPage } from "./pages/budget";
import { LoginPage } from "./pages/login";
import { OverviewPage } from "./pages/overview";
import { SearchPage } from "./pages/search";
import { SessionsPage } from "./pages/sessions";
import { SignalsPage } from "./pages/signals";
import { TimelinePage } from "./pages/timeline";
import { useAuthStore } from "./stores/auth";

export function App() {
	return (
		<BrowserRouter>
			<NuqsAdapter>
				<Routes>
					<Route path="/login" element={<LoginPage />} />
					<Route element={<ProtectedRoute />}>
						<Route path="/" element={<Navigate to="/budget" replace />} />
						<Route path="/budget" element={<BudgetPage />} />
						<Route path="/overview" element={<OverviewPage />} />
						<Route path="/sessions" element={<SessionsPage />} />
						<Route path="/timeline" element={<TimelinePage />} />
						<Route path="/search" element={<SearchPage />} />
						<Route path="/signals" element={<SignalsPage />} />
					</Route>
				</Routes>
			</NuqsAdapter>
		</BrowserRouter>
	);
}

function ProtectedRoute() {
	const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
	const checkAuth = useAuthStore((s) => s.checkAuth);
	const [checking, setChecking] = useState(true);
	const location = useLocation();

	useEffect(() => {
		checkAuth().finally(() => setChecking(false));
	}, [checkAuth]);

	if (checking) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-background">
				<div className="text-sm text-muted-foreground">Loading...</div>
			</div>
		);
	}

	if (!isAuthenticated) {
		return <Navigate to="/login" replace state={{ from: location.pathname }} />;
	}

	return (
		<AppShell>
			<Outlet />
		</AppShell>
	);
}
