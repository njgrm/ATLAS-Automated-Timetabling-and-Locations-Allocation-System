import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2 } from 'lucide-react';

import atlasApi from '@/lib/api';
import { hasAnyAuthToken } from '@/lib/auth';
import {
	buildAuthorizeRequestBody,
	buildEnrollProAuthorizeLoginUrl,
} from '@/lib/companion-sso-client';
import { verifySessionToken } from '@/lib/settings';
import type { BridgeUser } from '@/types';
import { Button } from '@/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card';

/**
 * COMPANION-SSO-C01 — Flow B SPA page (`/auth/enrollpro/authorize`).
 *
 * EnrollPro redirects the browser here on a FULL PAGE LOAD, so the local
 * session is still hydrating on first render. This page waits for auth
 * hydration before deciding login state (guide pitfall #3); an unauthenticated
 * visitor is sent to `/login?returnUrl=<this full authorize URL>` and resumes
 * here afterward. When authenticated it calls the JWT-authed authorize API and
 * performs a same-tab `window.location.assign(callbackUrl)`.
 */
export default function EnrollProAuthorize() {
	const navigate = useNavigate();
	const [error, setError] = useState<string | null>(null);
	const startedRef = useRef(false);

	useEffect(() => {
		if (startedRef.current) return;
		startedRef.current = true;

		const search = window.location.search;
		const authorizeUrl = `${window.location.pathname}${search}`;

		const run = async () => {
			// 1. Wait for auth hydration before deciding the user is logged out.
			const user: BridgeUser | null = await verifySessionToken();
			if (!user) {
				setError(null);
				navigate(buildEnrollProAuthorizeLoginUrl(authorizeUrl), { replace: true });
				return;
			}

			// 2. Exchange the local session for a one-time reverse SSO code.
			try {
				const response = await atlasApi.post<{ callbackUrl?: string }>('/auth/sso/authorize', buildAuthorizeRequestBody(search));
				const callbackUrl = response.data?.callbackUrl;
				if (typeof callbackUrl !== 'string' || callbackUrl.length === 0) {
					setError('EnrollPro did not receive a valid sign-in code. Please try again.');
					return;
				}
				window.location.assign(callbackUrl);
			} catch {
				setError('You do not have access to EnrollPro, or the request could not be completed.');
			}
		};

		void run();
	}, [navigate]);

	return (
		<div className='flex min-h-svh items-center justify-center bg-background p-6'>
			<Card className='w-full max-w-md'>
				<CardHeader className='text-center'>
					<CardTitle className='text-xl'>Opening EnrollPro</CardTitle>
					<CardDescription>
						{error ? 'ATLAS could not complete the hand-off.' : 'Please wait a moment.'}
					</CardDescription>
				</CardHeader>
				<CardContent className='flex flex-col items-center gap-4'>
					{error ? (
						<>
							<div
								role='alert'
								data-testid='enrollpro-authorize-error'
								className='flex w-full items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive'
							>
								<AlertCircle className='size-4 shrink-0' />
								<span>{error}</span>
							</div>
							<Button className='w-full' onClick={() => navigate('/', { replace: true })}>
								Return to ATLAS
							</Button>
						</>
					) : (
						<Loader2 data-testid='enrollpro-authorize-loading' className='size-6 animate-spin text-primary' />
					)}
				</CardContent>
			</Card>
		</div>
	);
}

/** Re-exported so a page-level probe can assert token presence without a DOM. */
export { hasAnyAuthToken };
