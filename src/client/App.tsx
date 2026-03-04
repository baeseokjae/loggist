import { NuqsAdapter } from "nuqs/adapters/react-router/v7";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/app-shell";
import { BudgetPage } from "./pages/budget";
import { OverviewPage } from "./pages/overview";
import { ProductivityPage } from "./pages/productivity";
import { SearchPage } from "./pages/search";
import { SessionsPage } from "./pages/sessions";
import { SignalsPage } from "./pages/signals";
import { TimelinePage } from "./pages/timeline";

export function App() {
	return (
		<BrowserRouter>
			<NuqsAdapter>
				<Routes>
					<Route element={<AppShell><Outlet /></AppShell>}>
						<Route path="/" element={<Navigate to="/budget" replace />} />
						<Route path="/budget" element={<BudgetPage />} />
						<Route path="/overview" element={<OverviewPage />} />
						<Route path="/productivity" element={<ProductivityPage />} />
						<Route path="/sessions" element={<SessionsPage />} />
						<Route path="/timeline" element={<TimelinePage />} />
						<Route path="/search" element={<SearchPage />} />
						<Route path="/signals" element={<SignalsPage />} />
						<Route path="*" element={<Navigate to="/budget" replace />} />
					</Route>
				</Routes>
			</NuqsAdapter>
		</BrowserRouter>
	);
}
