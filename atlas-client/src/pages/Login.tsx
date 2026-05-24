import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import {
	AlertCircle,
	BarChart3,
	BookOpen,
	Building2,
	CheckCircle,
	Eye,
	EyeOff,
	Globe,
	Loader2,
	Lock,
	LogIn,
	MapPin,
	Shield,
	Sparkles,
	User,
} from 'lucide-react';

import atlasApi from '@/lib/api';
import { captureBridgeToken } from '@/lib/bridge';
import { clearAtlasAuthStorage, hasAnyAuthToken, setLocalToken } from '@/lib/auth';
import { applyEnrollProAccentTheme, fetchPublicSettings, verifySessionToken } from '@/lib/settings';
import { Button } from '@/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { Checkbox } from '@/ui/checkbox';

type LoginResponse = {
	token: string;
	user: {
		userId: number;
		role: string;
		mustChangePassword?: boolean;
		authSource?: 'local' | 'bridge';
	};
};

export default function Login() {
	const navigate = useNavigate();
	const [showPassword, setShowPassword] = useState(false);
	const [rememberMe, setRememberMe] = useState(false);
	const [identifier, setIdentifier] = useState('');
	const [password, setPassword] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [isCheckingSession, setIsCheckingSession] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [schoolName, setSchoolName] = useState('ATLAS Scheduling System');
	const [schoolAddress, setSchoolAddress] = useState<string | null>(null);
	const [schoolDivision, setSchoolDivision] = useState<string | null>(null);
	const [schoolRegion, setSchoolRegion] = useState<string | null>(null);
	const [logoUrl, setLogoUrl] = useState<string | null>(null);
	const redirectTimeoutRef = useRef<number | null>(null);
	const hasToken = hasAnyAuthToken();
	const rememberedRole = localStorage.getItem('userRole');
	const defaultLandingRoute = rememberedRole === 'faculty' ? '/my' : '/';
	const projectTagline = 'ATLAS Scheduling System';
	const projectFullName = 'ATLAS Scheduling System';
	const jhsScopeLabel = 'Junior High School (Grades 7-10)';

	const acronym = useMemo(() => {
		const parts = schoolName
			.trim()
			.split(/\s+/)
			.filter(Boolean);
		if (parts.length <= 1) return schoolName.slice(0, 3).toUpperCase();
		return parts
			.slice(0, 3)
			.map((part) => part[0]?.toUpperCase() ?? '')
			.join('');
	}, [schoolName]);

	const fullLogoUrl = useMemo(() => {
		if (!logoUrl) return null;
		if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) return logoUrl;
		if (logoUrl.startsWith('/uploads/')) {
			return logoUrl.replace(/^\/uploads/, '/enrollpro-uploads');
		}
		if (logoUrl.startsWith('/enrollpro-uploads/')) {
			return logoUrl;
		}
		return `/enrollpro-uploads/${logoUrl.replace(/^\/+/, '')}`;
	}, [logoUrl]);

	useEffect(() => {
		captureBridgeToken();
		fetchPublicSettings()
			.then((settings) => {
				applyEnrollProAccentTheme(settings.selectedAccentHsl);
				setLogoUrl(settings.logoUrl);
				if (settings.schoolName?.trim()) {
					setSchoolName(settings.schoolName.trim());
				}

				const details = settings as {
					schoolAddress?: string;
					schoolDivision?: string;
					schoolRegion?: string;
				};

				setSchoolAddress(details.schoolAddress?.trim() || null);
				setSchoolDivision(details.schoolDivision?.trim() || null);
				setSchoolRegion(details.schoolRegion?.trim() || null);
			})
			.catch(() => {});

		verifySessionToken()
			.then((user) => {
				if (user) {
					localStorage.setItem('userRole', user.role);
					navigate(user.role === 'faculty' ? '/my' : '/', { replace: true });
					return;
				}
				clearAtlasAuthStorage();
			})
			.finally(() => setIsCheckingSession(false));

		return () => {
			if (redirectTimeoutRef.current) {
				window.clearTimeout(redirectTimeoutRef.current);
			}
		};
	}, [navigate]);

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		setError(null);
		setSuccess(null);
		setIsLoading(true);

		try {
			const response = await atlasApi.post<LoginResponse>('/auth/login', {
				identifier: identifier.trim(),
				password,
			});
			setLocalToken(response.data.token, rememberMe);
			localStorage.setItem('userRole', response.data.user.role);
			setSuccess('Login successful! Redirecting...');
			redirectTimeoutRef.current = window.setTimeout(() => {
				navigate(response.data.user.role === 'faculty' ? '/my' : '/', { replace: true });
			}, 800);
		} catch (err: unknown) {
			if (isAxiosError(err)) {
				if (err.response?.status === 429) {
					setError('Too many login attempts. Please try again later.');
				} else if (err.response?.status === 401) {
					setError('Invalid Employee ID/Email or password');
				} else if (err.response?.status === 400) {
					setError('Please provide a valid Employee ID or Email');
				} else {
					setError('Unable to sign in right now. Please try again.');
				}
			} else {
				setError('Unable to sign in right now. Please try again.');
			}
		} finally {
			setIsLoading(false);
		}
	};

	if (!isCheckingSession && hasToken) {
		return <Navigate to={defaultLandingRoute} replace />;
	}

	return (
		<div
			className="h-screen w-full flex overflow-hidden"
			style={{
				background:
					'linear-gradient(to bottom right, #f8fafc, hsl(var(--primary) / 0.08), hsl(var(--accent) / 0.06))',
			}}
		>
			<style>{`
				@keyframes login-gradient-shift {
					0% { background-position: 0% 50%; }
					50% { background-position: 100% 50%; }
					100% { background-position: 0% 50%; }
				}

				@keyframes login-float {
					0%, 100% { transform: translateY(0px); }
					50% { transform: translateY(-16px); }
				}

				@keyframes login-scale-in {
					0% { opacity: 0; transform: scale(0.98); }
					100% { opacity: 1; transform: scale(1); }
				}

				.login-gradient {
					animation: login-gradient-shift 14s ease infinite;
					background-size: 200% 200%;
				}

				.login-float {
					animation: login-float 9s ease-in-out infinite;
				}

				.login-scale-in {
					animation: login-scale-in 220ms ease-out;
				}
			`}</style>

			{/* Decorative Sidebar */}
			<div className="hidden lg:flex lg:w-[55%] xl:w-3/5 relative overflow-hidden bg-primary shrink-0">
				<div
					className="absolute inset-0 login-gradient"
					style={{
						background:
							'linear-gradient(to bottom right, hsl(var(--primary)), hsl(var(--primary) / 0.88), hsl(var(--accent) / 0.88))',
					}}
				/>

				<div className="absolute inset-0">
					<div className="absolute top-20 left-20 w-96 h-96 rounded-full bg-white/10 blur-3xl login-float" />
					<div
						className="absolute bottom-32 right-16 w-80 h-80 rounded-full blur-3xl login-float"
						style={{
							backgroundColor: 'hsl(var(--accent-foreground) / 0.18)',
							animationDelay: '2s',
						}}
					/>
					<div
						className="absolute top-1/2 left-1/4 w-64 h-64 rounded-full blur-2xl login-float"
						style={{
							backgroundColor: 'hsl(var(--primary-foreground) / 0.2)',
							animationDelay: '4s',
						}}
					/>

					<div
						className="absolute inset-0 opacity-[0.03]"
						style={{
							backgroundImage:
								'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
							backgroundSize: '50px 50px',
						}}
					/>

					<div className="absolute -top-1/2 -right-1/4 w-full h-full bg-[radial-gradient(circle,_rgba(255,255,255,0.08)_0%,_transparent_70%)] rounded-full" />
				</div>

				<div className="relative z-10 flex flex-col justify-center px-12 xl:px-20 text-white w-full">
					<div className="flex items-center gap-4 mb-12">
						<div>
							<h1 className="text-4xl font-bold tracking-tight">{acronym}</h1>
							<p className="text-white text-sm font-bold max-w-md">{projectTagline}</p>
						</div>
					</div>

					<div className="space-y-3 mb-12">
						<h2 className="text-3xl xl:text-4xl font-bold leading-tight tracking-tight">
							{schoolName}
						</h2>
						<p className="text-white text-sm font-bold">{jhsScopeLabel}</p>
						<div className="flex flex-col gap-1.5 mt-3">
							{schoolAddress && (
								<div className="flex items-center gap-2 text-white text-sm font-bold">
									<MapPin className="w-4 h-4 flex-shrink-0" />
									<span>{schoolAddress}</span>
								</div>
							)}
							{schoolDivision && (
								<div className="flex items-center gap-2 text-white text-sm font-bold">
									<Building2 className="w-4 h-4 flex-shrink-0" />
									<span>Division of {schoolDivision}</span>
								</div>
							)}
							{schoolRegion && (
								<div className="flex items-center gap-2 text-white text-sm font-bold">
									<Globe className="w-4 h-4 flex-shrink-0" />
									<span>{schoolRegion}</span>
								</div>
							)}
							{!schoolAddress && !schoolDivision && !schoolRegion && (
								<p className="text-white text-sm font-bold">
									DepEd Public School Timetabling and Schedule Publishing Portal
								</p>
							)}
						</div>
					</div>

					<div className="grid gap-4">
						{[
							{
								icon: BookOpen,
								title: 'Preference Collection',
								desc: 'Collect faculty time and room preferences before generation.',
							},
							{
								icon: BarChart3,
								title: 'Automated Generation',
								desc: 'Build draft timetables with policy and workload-aware scheduling.',
							},
							{
								icon: Shield,
								title: 'Review and Publish Workflow',
								desc: 'Validate violations, resolve conflicts, and publish approved schedules.',
							},
						].map((feature) => (
							<div
								key={feature.title}
								className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 transition-all duration-300 hover:bg-white/10 hover:border-white/20 group"
							>
								<div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
									<feature.icon className="w-6 h-6" />
								</div>
								<div>
									<h3 className="font-bold text-white">{feature.title}</h3>
									<p className="text-white text-sm font-semibold">{feature.desc}</p>
								</div>
							</div>
						))}
					</div>
				</div>

				<div className="absolute bottom-8 left-12 xl:left-20 flex items-center gap-3 text-white/50 text-sm">
					<div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
						<Shield className="w-4 h-4" />
					</div>
					<span>{projectFullName}</span>
				</div>
			</div>

			{/* Main Login Area */}
			<div className="relative w-full lg:w-[45%] xl:w-2/5 flex items-center justify-center p-4 sm:p-6 lg:p-8 overflow-y-auto">
				<div className="pointer-events-none absolute inset-0" aria-hidden="true">
					<div
						className="absolute inset-0"
						style={{
							background: 'hsl(var(--sidebar-background)/0.5)',
						}}
					/>

					<svg
						className="absolute inset-0 h-full w-full opacity-[0.08]"
						xmlns="http://www.w3.org/2000/svg"
					>
						<defs>
							<pattern
								id="login-pixel-grid"
								x="0"
								y="0"
								width="80"
								height="80"
								patternUnits="userSpaceOnUse"
							>
								<rect
									x="2"
									y="2"
									width="36"
									height="36"
									rx="2"
									fill="none"
									stroke="hsl(var(--primary))"
									strokeWidth="1.5"
								/>
								<rect
									x="42"
									y="2"
									width="36"
									height="36"
									rx="2"
									fill="none"
									stroke="hsl(var(--primary))"
									strokeWidth="1.5"
								/>
								<rect
									x="2"
									y="42"
									width="36"
									height="36"
									rx="2"
									fill="none"
									stroke="hsl(var(--primary))"
									strokeWidth="1.5"
								/>
								<rect
									x="42"
									y="42"
									width="36"
									height="36"
									rx="2"
									fill="none"
									stroke="hsl(var(--primary))"
									strokeWidth="1.5"
								/>
							</pattern>
						</defs>
						<rect width="100%" height="100%" fill="url(#login-pixel-grid)" />
					</svg>

					<div
						className="absolute inset-0"
						style={{
							background:
								'radial-gradient(circle at center, hsl(var(--primary)/0.05) 0%, transparent 70%)',
						}}
					/>
				</div>

				<div className="relative z-10 w-full max-w-[420px]">
					<Card className="border-0 shadow-2xl shadow-gray-200 bg-white/90 backdrop-blur-xl rounded-lg overflow-hidden">
						<CardHeader className="space-y-1 text-center pt-5 pb-0 px-6">
							<div
								className="w-14 h-14 mx-auto rounded-full flex items-center justify-center shadow-lg overflow-hidden"
								style={{
									background: fullLogoUrl
										? 'white'
										: 'linear-gradient(to bottom right, hsl(var(--primary)), hsl(var(--accent)))',
									boxShadow: '0 10px 15px -3px hsl(var(--primary) / 0.3)',
									border: fullLogoUrl ? '2px solid hsl(var(--primary) / 0.2)' : 'none',
								}}
							>
								{fullLogoUrl ? (
									<img src={fullLogoUrl} alt={schoolName} className="w-10 h-10 object-cover" />
								) : (
									<Sparkles className="w-5 h-5 text-white" />
								)}
							</div>
							<CardTitle className="text-xl font-bold text-gray-900 pt-2">Welcome Back</CardTitle>
							<CardDescription className="text-gray-600 text-sm">
								Sign in to continue to{' '}
								<span className="font-semibold text-primary">ATLAS</span>
							</CardDescription>
						</CardHeader>

						<CardContent className="px-6 pb-5 pt-4">
							{error && (
								<div className="mb-4 p-3 rounded-xl bg-gradient-to-r from-red-50 to-rose-50 border border-red-100 flex items-center gap-2.5 login-scale-in">
									<div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
										<AlertCircle className="w-4 h-4 text-red-600" />
									</div>
									<span className="text-sm font-bold text-red-700">{error}</span>
								</div>
							)}

							{success && (
								<div className="mb-4 p-3 rounded-xl border flex items-center gap-2.5 login-scale-in bg-gradient-to-r from-primary/10 to-accent/10 border-primary/25">
									<div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary/15">
										<CheckCircle className="w-4 h-4 text-primary" />
									</div>
									<div>
										<p className="text-sm font-semibold text-primary">{success}</p>
									</div>
								</div>
							)}

							<form onSubmit={handleSubmit} className="space-y-3">
								<div className="space-y-1.5">
									<Label htmlFor="identifier" className="text-gray-800 font-semibold text-sm pl-1">
										Employee ID or Email
									</Label>
									<div className="relative group">
										<div className="absolute left-0 top-0 bottom-0 w-11 flex items-center justify-center pointer-events-none z-10">
											<div className="w-8 h-8 rounded-lg bg-gray-100 group-focus-within:bg-gray-200 flex items-center justify-center transition-colors duration-200">
												<User className="w-4 h-4 text-gray-500 transition-colors duration-200" />
											</div>
										</div>
										<Input
											id="identifier"
											type="text"
											placeholder="Employee ID or Email"
											value={identifier}
											onChange={(event) => {
												setIdentifier(event.target.value);
												if (error) setError(null);
											}}
											className="pl-12 h-11 bg-gray-50 border-gray-200 hover:border-gray-300 focus:ring-4 focus:ring-primary/15 rounded-xl transition-all duration-200 placeholder:text-gray-400 text-gray-900 font-bold"
											autoComplete="username"
											required
										/>
									</div>
								</div>

								<div className="space-y-1.5">
									<Label htmlFor="password" className="text-gray-800 font-semibold text-sm pl-1">
										Password
									</Label>
									<div className="relative group">
										<div className="absolute left-0 top-0 bottom-0 w-11 flex items-center justify-center pointer-events-none z-10">
											<div className="w-8 h-8 rounded-lg bg-gray-100 group-focus-within:bg-gray-200 flex items-center justify-center transition-colors duration-200">
												<Lock className="w-4 h-4 text-gray-500 transition-colors duration-200" />
											</div>
										</div>
										<Input
											id="password"
											type={showPassword ? 'text' : 'password'}
											placeholder="Enter your password"
											value={password}
											onChange={(event) => {
												setPassword(event.target.value);
												if (error) setError(null);
											}}
											className="pl-12 pr-11 h-11 bg-gray-50 border-gray-200 hover:border-gray-300 focus:ring-4 focus:ring-primary/15 rounded-xl transition-all duration-200 placeholder:text-gray-400 text-gray-900 font-bold"
											autoComplete="current-password"
											required
										/>
										<button
											type="button"
											onClick={() => setShowPassword(!showPassword)}
											className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 transition-all duration-200"
											aria-label={showPassword ? 'Hide password' : 'Show password'}
										>
											{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
										</button>
									</div>
								</div>

								<div className="flex items-center justify-between text-sm">
									<label className="flex items-center gap-2 cursor-pointer group">
										<Checkbox
											id="rememberMe"
											checked={rememberMe}
											onCheckedChange={(checked) => setRememberMe(checked as boolean)}
											className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
										/>
										<span className="text-gray-600 group-hover:text-gray-900 transition-colors font-bold text-sm">
											Remember me
										</span>
									</label>
									<a
										href="#"
										onClick={(event) => event.preventDefault()}
										className="font-semibold text-primary transition-colors hover:underline underline-offset-4 decoration-2 text-sm"
									>
										Forgot password?
									</a>
								</div>

								<Button
									type="submit"
									disabled={isLoading || isCheckingSession}
									className="w-full h-11 font-semibold text-sm rounded-xl shadow-lg hover:shadow-xl transition-all duration-0 disabled:opacity-70 disabled:cursor-not-allowed bg-primary text-primary-foreground hover:bg-primary/90"
								>
									{isLoading ? (
										<span className="flex items-center gap-3">
											<Loader2 className="animate-spin h-5 w-5" />
											Signing in...
										</span>
									) : (
										<span className="flex items-center gap-3">
											<LogIn className="w-5 h-5" />
											Sign In
										</span>
									)}
								</Button>
							</form>

							<p className="text-[10px] text-gray-400 text-center mt-4 leading-relaxed">
								By signing in, you agree to our{' '}
								<a
									href="#"
									onClick={(event) => event.preventDefault()}
									className="hover:underline text-primary"
								>
									Terms
								</a>{' '}
								and{' '}
								<a
									href="#"
									onClick={(event) => event.preventDefault()}
									className="hover:underline text-primary"
								>
									Privacy Policy
								</a>
							</p>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
