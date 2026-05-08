import { useEffect, useMemo, useRef, useState } from 'react';
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
	GraduationCap,
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
	const [email, setEmail] = useState('');
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
	const [googleUiError, setGoogleUiError] = useState<string | null>(null);
	const redirectTimeoutRef = useRef<number | null>(null);
	const hasToken = hasAnyAuthToken();
	const rememberedRole = localStorage.getItem('userRole');
	const defaultLandingRoute = rememberedRole === 'faculty' ? '/my' : '/';
	const enrollProHost = import.meta.env.VITE_ENROLLPRO_URL ?? 'http://localhost:5173';
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
			return `${enrollProHost}${logoUrl}`;
		}
		if (logoUrl.startsWith('/enrollpro-uploads/')) {
			return `${enrollProHost}${logoUrl.replace('/enrollpro-uploads/', '/uploads/')}`;
		}
		return `${enrollProHost}${logoUrl.startsWith('/') ? logoUrl : `/${logoUrl}`}`;
	}, [enrollProHost, logoUrl]);

	useEffect(() => {
		captureBridgeToken();
		fetchPublicSettings()
			.then((settings) => {
				applyEnrollProAccentTheme(settings.selectedAccentHsl);
				setLogoUrl(settings.logoUrl);
				if (settings.schoolName?.trim()) {
					setSchoolName('ATLAS Scheduling System');
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
			.catch(() => {
				setGoogleUiError('Google sign-in is not configured for this environment.');
			});

		setGoogleUiError('Google sign-in is not configured for this environment.');

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
				email: email.trim(),
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
				const code = err.response?.data?.code;
				if (err.response?.status === 429) {
					setError('Too many login attempts. Please wait and try again.');
				} else if (err.response?.status === 401 && code === 'INVALID_CREDENTIALS') {
					setError('Invalid email or password');
				} else if (err.response?.status === 400 && code === 'INVALID_EMAIL') {
					setError('Invalid email or password');
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
			className='h-screen w-full flex overflow-hidden'
			data-testid='atlas-login-page'
			style={{
				background:
					'linear-gradient(to bottom right, #f8fafc, hsl(var(--primary) / 0.08), hsl(var(--accent) / 0.06))',
			}}
		>
			<div className='hidden lg:flex lg:w-[55%] xl:w-3/5 relative overflow-hidden bg-primary'>
				<div
					className='absolute inset-0'
					style={{
						background:
							'linear-gradient(to bottom right, hsl(var(--primary)), hsl(var(--primary) / 0.88), hsl(var(--accent) / 0.88))',
					}}
				/>

				<div className='absolute inset-0'>
					<div className='absolute top-20 left-20 w-96 h-96 rounded-full bg-white/10 blur-3xl' />
					<div
						className='absolute bottom-32 right-16 w-80 h-80 rounded-full blur-3xl'
						style={{
							backgroundColor: 'hsl(var(--accent-foreground) / 0.18)',
						}}
					/>
					<div
						className='absolute top-1/2 left-1/4 w-64 h-64 rounded-full blur-2xl'
						style={{
							backgroundColor: 'hsl(var(--primary-foreground) / 0.2)',
						}}
					/>
				</div>

				<div className='relative z-10 flex flex-col justify-center px-12 xl:px-20 text-white w-full'>
					<div className='flex items-center gap-4 mb-12'>
						<div>
							<h1 className='text-4xl font-bold tracking-tight'>{acronym}</h1>
							<p className='text-white text-sm font-bold max-w-md'>{projectTagline}</p>
						</div>
					</div>

					<div className='space-y-3 mb-12'>
						<h2 className='text-3xl xl:text-4xl font-bold leading-tight tracking-tight'>
							{schoolName}
						</h2>
						<p className='text-white text-sm font-bold'>{jhsScopeLabel}</p>
						<div className='flex flex-col gap-1.5 mt-3'>
							{schoolAddress && (
								<div className='flex items-center gap-2 text-white text-sm font-bold'>
									<MapPin className='w-4 h-4 flex-shrink-0' />
									<span>{schoolAddress}</span>
								</div>
							)}
							{schoolDivision && (
								<div className='flex items-center gap-2 text-white text-sm font-bold'>
									<Building2 className='w-4 h-4 flex-shrink-0' />
									<span>Division of {schoolDivision}</span>
								</div>
							)}
							{schoolRegion && (
								<div className='flex items-center gap-2 text-white text-sm font-bold'>
									<Globe className='w-4 h-4 flex-shrink-0' />
									<span>{schoolRegion}</span>
								</div>
							)}
							{!schoolAddress && !schoolDivision && !schoolRegion && (
								<p className='text-white text-sm font-bold'>
									DepEd Public School Timetabling and Schedule Publishing Portal
								</p>
							)}
						</div>
					</div>

					<div className='grid gap-4'>
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
								className='flex items-center gap-4 p-4 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 transition-all duration-300 hover:bg-white/10 hover:border-white/20 group'
							>
								<div className='w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform'>
									<feature.icon className='w-6 h-6' />
								</div>
								<div>
									<h3 className='font-bold text-white'>{feature.title}</h3>
									<p className='text-white text-sm font-semibold'>{feature.desc}</p>
								</div>
							</div>
						))}
					</div>
				</div>

				<div className='absolute bottom-8 left-12 xl:left-20 flex items-center gap-3 text-white/50 text-sm'>
					<div className='w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center'>
						<Shield className='w-4 h-4' />
					</div>
					<span>{projectFullName}</span>
				</div>
			</div>

			<div className='relative w-full lg:w-[45%] xl:w-2/5 flex items-center justify-center p-4 sm:p-6 lg:p-8 overflow-y-auto'>
				<div className='relative z-10 w-full max-w-[420px]'>
					<div className='lg:hidden flex items-center justify-center gap-3 mb-6'>
						<div
							className='w-12 h-12 rounded-full flex items-center justify-center shadow-lg overflow-hidden'
							style={{
								background: fullLogoUrl
									? 'white'
									: 'linear-gradient(to bottom right, hsl(var(--primary)), hsl(var(--accent)))',
								boxShadow: '0 10px 15px -3px hsl(var(--primary) / 0.4)',
							}}
						>
							{fullLogoUrl ? (
								<img src={fullLogoUrl} alt={schoolName} className='w-full h-full object-cover' />
							) : (
								<GraduationCap className='w-7 h-7 text-white' />
							)}
						</div>
						<div>
							<span className='text-xl font-bold text-gray-900'>{acronym}</span>
							<p className='text-xs text-gray-500'>{schoolName}</p>
						</div>
					</div>

					<Card className='border-0 shadow-2xl shadow-gray-200 bg-white/90 backdrop-blur-xl rounded-3xl overflow-hidden'>
						<CardHeader className='space-y-1 text-center pt-5 pb-0 px-6'>
							<div
								className='w-14 h-14 mx-auto rounded-full flex items-center justify-center shadow-lg overflow-hidden'
								style={{
									background: fullLogoUrl
										? 'white'
										: 'linear-gradient(to bottom right, hsl(var(--primary)), hsl(var(--accent)))',
									boxShadow: '0 10px 15px -3px hsl(var(--primary) / 0.3)',
									border: fullLogoUrl ? '2px solid hsl(var(--primary) / 0.2)' : 'none',
								}}
							>
								{fullLogoUrl ? (
									<img src={fullLogoUrl} alt={schoolName} className='w-10 h-10 object-cover' />
								) : (
									<Sparkles className='w-5 h-5 text-white' />
								)}
							</div>
							<CardTitle className='text-xl font-bold text-gray-900 pt-2'>Welcome Back</CardTitle>
							<CardDescription className='text-gray-600 text-sm'>
								Sign in to continue to <span className='font-semibold text-primary'>ATLAS Scheduling System</span>
							</CardDescription>
						</CardHeader>

						<CardContent className='px-6 pb-5 pt-4'>
							{error && (
								<div className='mb-4 p-3 rounded-xl bg-gradient-to-r from-red-50 to-rose-50 border border-red-100 flex items-center gap-2.5'>
									<div className='w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0'>
										<AlertCircle className='w-4 h-4 text-red-600' />
									</div>
									<span className='text-sm font-bold text-red-700' data-testid='login-error-message'>{error}</span>
								</div>
							)}

							{success && (
								<div className='mb-4 p-3 rounded-xl border flex items-center gap-2.5 bg-gradient-to-r from-primary/10 to-accent/10 border-primary/25'>
									<div className='w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary/15'>
										<CheckCircle className='w-4 h-4 text-primary' />
									</div>
									<p className='text-sm font-semibold text-primary'>{success}</p>
								</div>
							)}

							<form onSubmit={handleSubmit} className='space-y-3'>
								<div className='space-y-1.5'>
									<Label htmlFor='email' className='text-gray-800 font-semibold text-sm pl-1'>
										Email
									</Label>
									<div className='relative group'>
										<div className='absolute left-0 top-0 bottom-0 w-11 flex items-center justify-center pointer-events-none z-10'>
											<div className='w-8 h-8 rounded-lg bg-gray-100 group-focus-within:bg-gray-200 flex items-center justify-center transition-colors duration-200'>
												<User className='w-4 h-4 text-gray-500 transition-colors duration-200' />
											</div>
										</div>
										<Input
											id='email'
											type='email'
											placeholder='Enter your email'
											data-testid='login-email-input'
											value={email}
											onChange={(event) => {
												setEmail(event.target.value);
												if (error) setError(null);
											}}
											className='pl-12 h-11 bg-gray-50 border-gray-200 hover:border-gray-300 focus:ring-4 focus:ring-primary/15 rounded-xl transition-all duration-200 placeholder:text-gray-400 text-gray-900 font-bold'
											autoComplete='email'
											required
										/>
									</div>
								</div>

								<div className='space-y-1.5'>
									<Label htmlFor='password' className='text-gray-800 font-semibold text-sm pl-1'>
										Password
									</Label>
									<div className='relative group'>
										<div className='absolute left-0 top-0 bottom-0 w-11 flex items-center justify-center pointer-events-none z-10'>
											<div className='w-8 h-8 rounded-lg bg-gray-100 group-focus-within:bg-gray-200 flex items-center justify-center transition-colors duration-200'>
												<Lock className='w-4 h-4 text-gray-500 transition-colors duration-200' />
											</div>
										</div>
										<Input
											id='password'
											type={showPassword ? 'text' : 'password'}
											placeholder='Enter your password'
											data-testid='login-password-input'
											value={password}
											onChange={(event) => {
												setPassword(event.target.value);
												if (error) setError(null);
											}}
											className='pl-12 pr-11 h-11 bg-gray-50 border-gray-200 hover:border-gray-300 focus:ring-4 focus:ring-primary/15 rounded-xl transition-all duration-200 placeholder:text-gray-400 text-gray-900 font-bold'
											autoComplete='current-password'
											required
										/>
										<Button
											type='button'
											variant='ghost'
											size='icon'
											onClick={() => setShowPassword((prev) => !prev)}
											className='absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8 text-gray-500 hover:bg-gray-100'
											aria-label={showPassword ? 'Hide password' : 'Show password'}
										>
											{showPassword ? <EyeOff className='w-4 h-4' /> : <Eye className='w-4 h-4' />}
										</Button>
									</div>
								</div>

								<div className='flex items-center justify-between text-sm'>
									<label className='flex items-center gap-2 cursor-pointer group'>
										<input
											type='checkbox'
											checked={rememberMe}
											onChange={(event) => setRememberMe(event.target.checked)}
											className='rounded border-gray-300 text-primary focus:ring-primary/25'
										/>
										<span className='text-gray-600 group-hover:text-gray-900 transition-colors font-bold text-sm'>
											Remember me
										</span>
									</label>
									<a
										href='#'
										onClick={(event) => event.preventDefault()}
										className='font-semibold text-primary transition-colors hover:underline underline-offset-4 decoration-2 text-sm'
									>
										Forgot password?
									</a>
								</div>

								<Button
									type='submit'
									data-testid='login-submit-button'
									disabled={isLoading || isCheckingSession}
									className='w-full h-11 font-semibold text-sm rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed'
								>
									{isLoading ? (
										<span className='flex items-center gap-3'>
											<Loader2 className='animate-spin h-5 w-5' />
											Signing in...
										</span>
									) : (
										<span className='flex items-center gap-3'>
											<LogIn className='w-5 h-5' />
											Sign In
										</span>
									)}
								</Button>

									<div className='space-y-3 pt-1'>
										<div className='relative'>
											<div className='absolute inset-0 flex items-center' aria-hidden='true'>
												<span className='w-full border-t border-slate-200' />
											</div>
											<div className='relative flex justify-center text-xs uppercase tracking-[0.22em] font-semibold text-slate-400 bg-white px-3 mx-auto w-fit'>
												Or continue with
											</div>
										</div>

										<div
											className='min-h-[44px] w-full flex items-center justify-center rounded-full border border-dashed border-slate-300 text-xs font-semibold text-slate-500 bg-slate-50'
											aria-label='Continue with Google'
										>
											Google sign-in button unavailable
										</div>

										{googleUiError && (
											<div
												className='rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800'
												role='status'
												aria-live='polite'
												data-testid='google-status-block'
											>
												{googleUiError}
											</div>
										)}
									</div>
							</form>

								<p className='text-[10px] text-gray-400 text-center mt-4 leading-relaxed'>
									By signing in, you agree to our{' '}
									<a href='#' onClick={(event) => event.preventDefault()} className='hover:underline text-primary'>
										Terms
									</a>{' '}
									and{' '}
									<a href='#' onClick={(event) => event.preventDefault()} className='hover:underline text-primary'>
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
