import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2 } from 'lucide-react';

import { setLocalToken } from '@/lib/auth';
import { readFragmentValue, resolveCompanionSsoCallback } from '@/lib/companion-sso-client';
import { decodeJwtPayload } from '@/lib/jwt-payload';
import { Button } from '@/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card';

/**
 * COMPANION-SSO-C01 — Flow A SPA result page (`/auth/sso/callback`).
 *
 * The server places the ATLAS JWT in the URL FRAGMENT
 * (`#atlasToken=<jwt>`), which the browser never sends to a server. This page
 * consumes it immediately, strips it with `history.replaceState` BEFORE any
 * further action, then routes by role. On failure the server passes only a
 * stable `ssoError` query code; the page strips that too before rendering a
 * plain, recoverable message.
 */

function stripUrlSecrets(keepPathname: string): void {
	try {
		window.history.replaceState({}, '', keepPathname);
	} catch {
		// Non-fatal: the token is still removed from the in-memory route below.
	}
}

export default function SsoCallback() {
	const navigate = useNavigate();
	const [error, setError] = useState<string | null>(null);
	const startedRef = useRef(false);

	useEffect(() => {
		if (startedRef.current) return;
		startedRef.current = true;

		const outcome = resolveCompanionSsoCallback(window.location.hash, window.location.search);

		// Strip the token fragment (and any error query) from the address bar and
		// browser history BEFORE any storage, request, or navigation happens.
		stripUrlSecrets(window.location.pathname);

		if (outcome.kind === 'token') {
			setLocalToken(outcome.token, false);
			let role: string | null = null;
			try {
				role = decodeJwtPayload(outcome.token)?.role ?? null;
			} catch {
				role = null;
			}
			if (role) window.localStorage.setItem('userRole', role);
			navigate(role === 'faculty' ? '/my' : '/', { replace: true });
			return;
		}

		setError(outcome.message);
	}, [navigate]);

	return (
		<div className='flex min-h-svh items-center justify-center bg-background p-6'>
			<Card className='w-full max-w-md'>
				<CardHeader className='text-center'>
					<CardTitle className='text-xl'>
						{error ? 'Sign-in could not complete' : 'Finishing sign-in'}
					</CardTitle>
					<CardDescription>
						{error ? 'ATLAS could not start your session.' : 'Please wait a moment.'}
					</CardDescription>
				</CardHeader>
				<CardContent className='flex flex-col items-center gap-4'>
					{error ? (
						<>
							<div
								role='alert'
								data-testid='sso-callback-error'
								className='flex w-full items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive'
							>
								<AlertCircle className='size-4 shrink-0' />
								<span>{error}</span>
							</div>
							<Button asChild className='w-full'>
								<Link to='/login'>Return to sign in</Link>
							</Button>
						</>
					) : (
						<Loader2 data-testid='sso-callback-loading' className='size-6 animate-spin text-primary' />
					)}
				</CardContent>
			</Card>
		</div>
	);
}

/** Exported for hermetic tests. */
export { readFragmentValue, stripUrlSecrets };
