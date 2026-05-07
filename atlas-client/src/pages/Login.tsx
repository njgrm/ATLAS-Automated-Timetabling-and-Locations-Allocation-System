import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import {
	AlertCircle,
	CheckCircle,
	Eye,
	EyeOff,
	Loader2,
	Lock,
	LogIn,
	Sparkles,
	User,
} from 'lucide-react';

import atlasApi from '@/lib/api';
import { captureBridgeToken } from '@/lib/bridge';
import { ATLAS_LOCAL_TOKEN_KEY, clearAtlasAuthStorage, hasAnyAuthToken } from '@/lib/auth';
import { verifySessionToken } from '@/lib/settings';
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
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [isCheckingSession, setIsCheckingSession] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const hasToken = hasAnyAuthToken();

	useEffect(() => {
		captureBridgeToken();
		verifySessionToken()
			.then((user) => {
				if (user) {
					localStorage.setItem('userRole', user.role);
					navigate('/', { replace: true });
					return;
				}
				clearAtlasAuthStorage();
			})
			.finally(() => setIsCheckingSession(false));
	}, [navigate]);

	const accentStyles = useMemo(
		() => ({
			background:
				'linear-gradient(to bottom right, hsl(var(--primary)), hsl(var(--primary) / 0.88), hsl(var(--accent) / 0.88))',
		}),
		[],
	);

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
			sessionStorage.setItem(ATLAS_LOCAL_TOKEN_KEY, response.data.token);
			localStorage.setItem('userRole', response.data.user.role);
			setSuccess('Login successful! Redirecting...');
			navigate('/', { replace: true });
		} catch (err: unknown) {
			if (isAxiosError(err)) {
				const code = err.response?.data?.code;
				if (err.response?.status === 401 && code === 'INVALID_CREDENTIALS') {
					setError('Invalid email or password');
				} else if (err.response?.status === 400 && code === 'INVALID_EMAIL') {
					setError('Please enter a valid email address');
				} else if (err.response?.status === 429) {
					setError('Too many login attempts. Please wait and try again.');
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
		return <Navigate to='/' replace />;
	}

	return (
		<div
			className='h-screen w-full flex overflow-hidden'
			style={{
				background:
					'linear-gradient(to bottom right, #f8fafc, hsl(var(--primary) / 0.08), hsl(var(--accent) / 0.06))',
			}}
		>
			<div className='hidden lg:flex lg:w-[55%] xl:w-3/5 relative overflow-hidden bg-primary'>
				<div className='absolute inset-0' style={accentStyles} />
				<div className='relative z-10 flex flex-col justify-center px-12 xl:px-20 text-white w-full'>
					<div className='space-y-4 mb-10'>
						<h1 className='text-4xl xl:text-5xl font-bold tracking-tight'>
							ATLAS Scheduling System
						</h1>
						<p className='text-white text-base font-semibold max-w-xl'>
							Standalone local login for Faculty and Scheduler Officers.
						</p>
					</div>
					<div className='grid gap-4'>
						{[
							'Secure local credential sign-in with hashed passwords',
							'Dual-auth ready with EnrollPro bridge compatibility',
							'Mobile-first access for faculty scheduling workflows',
						].map((item) => (
							<div
								key={item}
								className='rounded-2xl border border-white/20 bg-white/10 p-4 text-sm font-semibold'
							>
								{item}
							</div>
						))}
					</div>
				</div>
			</div>

			<div className='relative w-full lg:w-[45%] xl:w-2/5 flex items-center justify-center p-4 sm:p-6 lg:p-8 overflow-y-auto'>
				<div className='relative z-10 w-full max-w-[420px]'>
					<Card className='border-0 shadow-2xl shadow-gray-200 bg-white/90 backdrop-blur-xl rounded-3xl overflow-hidden'>
						<CardHeader className='space-y-1 text-center pt-6 pb-1 px-6'>
							<div className='w-14 h-14 mx-auto rounded-full flex items-center justify-center shadow-lg bg-primary/90'>
								<Sparkles className='w-5 h-5 text-white' />
							</div>
							<CardTitle className='text-xl font-bold text-gray-900 pt-2'>Welcome Back</CardTitle>
							<CardDescription className='text-gray-600 text-sm'>
								Sign in to continue to <span className='font-semibold text-primary'>ATLAS Scheduling System</span>
							</CardDescription>
						</CardHeader>

						<CardContent className='px-6 pb-6 pt-4'>
							{error && (
								<div className='mb-4 p-3 rounded-xl bg-gradient-to-r from-red-50 to-rose-50 border border-red-100 flex items-center gap-2.5'>
									<div className='w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0'>
										<AlertCircle className='w-4 h-4 text-red-600' />
									</div>
									<span className='text-sm font-bold text-red-700'>{error}</span>
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

								<Button
									type='submit'
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
							</form>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
