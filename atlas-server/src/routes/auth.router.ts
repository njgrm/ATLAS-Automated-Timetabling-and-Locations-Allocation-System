import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate, extractBearerToken } from '../middleware/authenticate.js';
import { login, type LocalAuthUser } from '../services/local-auth.service.js';
import {
	CompanionSsoError,
	COMPANION_SSO_CODE_PATTERN,
	COMPANION_SSO_INVALID_CODE_BODY,
	exchangeCompanionSsoCode,
	exchangeEnrollProCallbackCode,
	issueCompanionSsoCode,
	matchReverseClientSecret,
	validateAuthorizeRequest,
	type CompanionSsoErrorCode,
} from '../services/companion-sso.service.js';

const router = Router();

/** SPA result page that consumes the fragment token (or renders the error). */
const COMPANION_SSO_RESULT_PATH = '/auth/sso/callback';

function redirectToCompanionSsoResult(res: Response, params: URLSearchParams, fragment?: string): void {
	// Set `Location` directly: `res.redirect()` re-encodes a `#fragment` into a
	// query parameter, which would leak the session token to the server on the
	// next request. The token MUST stay in the URL fragment.
	const query = params.toString();
	const suffix = fragment ? `#${fragment}` : '';
	res.status(302).setHeader('Location', `${COMPANION_SSO_RESULT_PATH}${query ? `?${query}` : ''}${suffix}`);
	res.end();
}

router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
	try {
		const identifier = typeof req.body?.identifier === 'string' 
			? req.body.identifier 
			: typeof req.body?.email === 'string' 
				? req.body.email 
				: '';
		const password = typeof req.body?.password === 'string' ? req.body.password : '';

		const result = await login({
			identifier,
			password,
			ipAddress: req.ip || 'unknown',
			userAgent: req.get('user-agent') ?? undefined,
		});

		if (!result.ok) {
			if (result.retryAfterSeconds) {
				res.setHeader('Retry-After', String(result.retryAfterSeconds));
			}
			res.status(result.status).json({
				code: result.code,
				message: result.message,
			});
			return;
		}

		res.json({
			token: result.token,
			user: {
				userId: result.user.userId,
				role: result.user.role,
				mustChangePassword: result.user.mustChangePassword,
				authSource: result.user.authSource,
			},
		});
	} catch (err) {
		next(err);
	}
});

/* ─── COMPANION-SSO-C01 ────────────────────────────────────────────────────── */

/**
 * Flow A — EnrollPro launch callback. Validates the code shape first, exchanges
 * it server-to-server, maps it onto an EXISTING local account, creates a local
 * session, and redirects to the SPA result page with the ATLAS token in the URL
 * FRAGMENT (never a query param, so it is never sent to a server or logged).
 * On any failure it redirects with a stable, non-secret error code only.
 */
router.get('/enrollpro/callback', async (req: Request, res: Response) => {
	try {
		const rawCode = typeof req.query.code === 'string' ? req.query.code.trim() : '';
		if (!COMPANION_SSO_CODE_PATTERN.test(rawCode)) {
			redirectToCompanionSsoResult(res, new URLSearchParams({ ssoError: 'COMPANION_SSO_CODE_INVALID' }));
			return;
		}
		const outcome = await exchangeEnrollProCallbackCode(rawCode);
		if (!outcome.ok) {
			redirectToCompanionSsoResult(res, new URLSearchParams({ ssoError: outcome.code }));
			return;
		}
		redirectToCompanionSsoResult(res, new URLSearchParams(), `atlasToken=${outcome.token}`);
	} catch (err) {
		if (err instanceof CompanionSsoError) {
			redirectToCompanionSsoResult(res, new URLSearchParams({ ssoError: err.code }));
			return;
		}
		redirectToCompanionSsoResult(res, new URLSearchParams({ ssoError: 'COMPANION_SSO_UNREACHABLE' }));
	}
});

/**
 * Flow B — issue a one-time reverse SSO code. JWT-authenticated, privileged
 * roles only. Open-redirect rejection: an unknown client/redirect yields a typed
 * 400 with zero code rows and no redirect.
 */
router.post('/sso/authorize', authenticate, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const validated = validateAuthorizeRequest({
			responseType: req.body?.response_type,
			clientId: req.body?.client_id,
			redirectUri: req.body?.redirect_uri,
			state: req.body?.state,
			role: req.user?.role,
		});
		// A privileged token must carry a real local account and school. Never
		// fall back to `userId`/`0`, which would bind the code to a non-account.
		const accountId = req.user?.accountId;
		const schoolId = req.user?.schoolId;
		if (!Number.isInteger(accountId) || (accountId as number) <= 0 || !Number.isInteger(schoolId) || (schoolId as number) <= 0) {
			res.status(403).json({
				code: 'COMPANION_SSO_IDENTITY_INCOMPLETE',
				message: 'The authenticated session is missing a usable account or school.',
			});
			return;
		}
		const issued = await issueCompanionSsoCode({
			userId: accountId as number,
			schoolId: schoolId as number,
			redirectUri: validated.redirectUri,
			state: validated.state,
		});
		res.json({ callbackUrl: issued.callbackUrl, expiresAt: issued.expiresAt.toISOString() });
	} catch (err) {
		if (err instanceof CompanionSsoError) {
			res.status(err.status).json({ code: err.code, message: err.message });
			return;
		}
		next(err);
	}
});

/**
 * Flow B — exchange the code for the ATLAS identity assertion. Authenticated by
 * the shared Bearer reverse secret (constant-time compare); any invalid code
 * returns the guide's EXACT single JSON body so code state cannot be probed.
 */
router.post('/sso/exchange', async (req: Request, res: Response, next: NextFunction) => {
	try {
		const provided = extractBearerToken(req);
		const matchedEnvName = matchReverseClientSecret(provided);
		if (!matchedEnvName) {
			res.status(401).json({ code: 'COMPANION_SSO_CLIENT_INVALID', message: 'The reverse SSO client secret is missing or invalid.' });
			return;
		}
		const result = await exchangeCompanionSsoCode({
			code: req.body?.code,
			clientId: req.body?.clientId,
			redirectUri: req.body?.redirectUri,
		});
		if (!result.ok) {
			res.status(401).json(COMPANION_SSO_INVALID_CODE_BODY);
			return;
		}
		res.json(result.assertion);
	} catch (err) {
		next(err);
	}
});

// TODO(atlas-auth): Keep a dedicated /admin/login endpoint once scheduler and IT admin flows diverge.

// Verify bridge token and return decoded identity
router.get('/me', authenticate, (req: Request, res: Response) => {
	res.json({
		user: {
			userId: req.user!.userId,
			role: req.user!.role,
			mustChangePassword: req.user!.mustChangePassword ?? false,
			authSource: req.user!.authSource ?? 'bridge',
			schoolId: req.user!.schoolId,
			accountId: req.user!.accountId,
		},
	});
});

export default router;
