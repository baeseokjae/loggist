import { type FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/auth";

export function LoginPage() {
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [checking, setChecking] = useState(true);
	const login = useAuthStore((s) => s.login);
	const setup = useAuthStore((s) => s.setup);
	const needsSetup = useAuthStore((s) => s.needsSetup);
	const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
	const checkAuth = useAuthStore((s) => s.checkAuth);
	const navigate = useNavigate();
	const location = useLocation();
	const from = location.state?.from !== "/login" ? location.state?.from : undefined;

	useEffect(() => {
		checkAuth().finally(() => setChecking(false));
	}, [checkAuth]);

	useEffect(() => {
		if (!checking && isAuthenticated) {
			navigate(from || "/budget", { replace: true });
		}
	}, [checking, isAuthenticated, navigate, from]);

	const handleLogin = async (e: FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setError("");

		const success = await login(password);
		if (success) {
			navigate(from || "/budget");
		} else {
			setError("인증에 실패했습니다.");
		}
		setLoading(false);
	};

	const handleSetup = async (e: FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setError("");

		if (password.length < 4) {
			setError("비밀번호는 4자 이상이어야 합니다.");
			setLoading(false);
			return;
		}

		if (password !== confirmPassword) {
			setError("비밀번호가 일치하지 않습니다.");
			setLoading(false);
			return;
		}

		const success = await setup(password);
		if (success) {
			await checkAuth();
			const loginSuccess = await login(password);
			if (loginSuccess) {
				navigate(from || "/budget");
			} else {
				setError("설정 후 로그인에 실패했습니다.");
			}
		} else {
			setError("비밀번호 설정에 실패했습니다.");
		}
		setLoading(false);
	};

	if (checking) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-background">
				<div className="text-sm text-muted-foreground">Loading...</div>
			</div>
		);
	}

	if (needsSetup) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-background">
				<div className="w-full max-w-sm space-y-6 rounded-xl border bg-card p-8 shadow-sm">
					<div className="space-y-2 text-center">
						<h1 className="text-2xl font-bold">Loggist</h1>
						<p className="text-sm text-muted-foreground">초기 비밀번호를 설정하세요</p>
					</div>
					<form onSubmit={handleSetup} className="space-y-4">
						<div className="space-y-2">
							<label htmlFor="password" className="text-sm font-medium">
								새 비밀번호
							</label>
							<input
								id="password"
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								placeholder="4자 이상 입력"
								required
							/>
						</div>
						<div className="space-y-2">
							<label htmlFor="confirm-password" className="text-sm font-medium">
								비밀번호 확인
							</label>
							<input
								id="confirm-password"
								type="password"
								value={confirmPassword}
								onChange={(e) => setConfirmPassword(e.target.value)}
								className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								placeholder="비밀번호를 다시 입력"
								required
							/>
						</div>
						{error && <p className="text-sm text-destructive">{error}</p>}
						<button
							type="submit"
							disabled={loading}
							className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
						>
							{loading ? "..." : "비밀번호 설정"}
						</button>
					</form>
				</div>
			</div>
		);
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-background">
			<div className="w-full max-w-sm space-y-6 rounded-xl border bg-card p-8 shadow-sm">
				<div className="space-y-2 text-center">
					<h1 className="text-2xl font-bold">Loggist</h1>
					<p className="text-sm text-muted-foreground">Claude Code Observatory</p>
				</div>
				<form onSubmit={handleLogin} className="space-y-4">
					<div className="space-y-2">
						<label htmlFor="password" className="text-sm font-medium">
							Password
						</label>
						<input
							id="password"
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							placeholder="Enter password"
							required
						/>
					</div>
					{error && <p className="text-sm text-destructive">{error}</p>}
					<button
						type="submit"
						disabled={loading}
						className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
					>
						{loading ? "..." : "로그인"}
					</button>
				</form>
			</div>
		</div>
	);
}
