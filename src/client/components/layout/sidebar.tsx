import { Activity, Bell, DollarSign, LayoutDashboard, LogOut, Radio, Search, TrendingUp } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "../../lib/utils";
import { useAuthStore } from "../../stores/auth";

const navItems = [
	{ to: "/budget", label: "비용 예산", icon: DollarSign },
	{ to: "/overview", label: "개요", icon: LayoutDashboard },
	{ to: "/productivity", label: "생산성", icon: TrendingUp },
	{ to: "/sessions", label: "세션", icon: Activity },
	{ to: "/timeline", label: "타임라인", icon: Radio },
	{ to: "/search", label: "검색", icon: Search },
	{ to: "/signals", label: "시그널", icon: Bell },
];

export function Sidebar() {
	const logout = useAuthStore((s) => s.logout);

	return (
		<aside className="flex h-full w-56 flex-col border-r bg-sidebar">
			<div className="flex h-14 items-center gap-2 border-b px-4">
				<Activity className="h-5 w-5 text-sidebar-primary" />
				<span className="font-bold text-sidebar-foreground">Loggist</span>
			</div>
			<nav className="flex-1 space-y-1 p-2">
				{navItems.map((item) => (
					<NavLink
						key={item.to}
						to={item.to}
						className={({ isActive }) =>
							cn(
								"flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
								isActive
									? "bg-sidebar-accent text-sidebar-accent-foreground"
									: "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
							)
						}
					>
						<item.icon className="h-4 w-4" />
						{item.label}
					</NavLink>
				))}
			</nav>
			<div className="border-t p-2">
				<button
					type="button"
					onClick={() => logout()}
					className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
				>
					<LogOut className="h-4 w-4" />
					로그아웃
				</button>
			</div>
		</aside>
	);
}
