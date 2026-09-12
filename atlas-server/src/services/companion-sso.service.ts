import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';

import { prisma } from '../lib/prisma.js';
import { hasPrivilegedRole } from '../middleware/authorize.js';
import {
	classifyFacultyLoginEligibility,
	issueCompanionSsoToken,
	writeCompanionSsoAudit,
	type LocalAuthUser,
} from './local-auth.service.js';
import { resolveCanonicalFacultyMirror } from './faculty-identity.service.js';

/**
 * COMPANION-SSO-C01 — ATLAS-side companion SSO (EnrollPro ↔ ATLAS).
 *
 * Flow A (EnrollPro → ATLAS): EnrollPro launches the browser at
 * `GET /api/v1/auth/enrollpro/callback?code=<43-char>`; ATLAS exchanges the code
 * server-to-server, maps the identity onto an EXISTING local account, creates a
 * local JWT session, and redirects to `/auth/sso/callback#atlasToken=<jwt>`.
 *
 * Flow B (ATLAS → EnrollPro): an authenticated privileged ATLAS user reaches
 * `/auth/enrollpro/authorize`; the SPA calls
 * `POST /api/v1/auth/sso/authorize` to mint a 43-char one-time code whose hash
 * is persisted; EnrollPro later calls `POST /api/v1/auth/sso/exchange` with its
 * reverse secret and receives the ATLAS identity assertion.
 *
 * Security invariants (guide §5/§7):
 * - the plaintext code is never persisted, logged, or returned outside the
 *   authenticated authorize response and the browser redirect;
 * - the inbound reverse secret is compared constant-time and only the matching
 *   env NAME is logged;
 * - the code is consumed with one atomic UPDATE; concurrency yields exactly one
 *   success;
 * - this integration NEVER creates, provisions, or updates an account.
 */

export const COMPANION_SSO_CODE_TTL_MS = 60_000;
export const COMPANION_SSO_CODE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
export const COMPANION_SSO_COMPANION = 'atlas';
export const COMPANION_SSO_AUDIENCE = 'enrollpro';
export const COMPANION_SSO_CLIENT_ID = 'enrollpro';
export const COMPANION_SSO_REVERSE_CLIENT_ID = 'enrollpro';
export const COMPANION_SSO_ISSUER = 'ATLAS';
export const COMPANION_SSO_UPSTREAM_TIMEOUT_MS = 5_000;
const MAX_STATE_LENGTH = 2_048;
const MAX_CODE_HASH_LENGTH = 64;

/**
 * The ATLAS local roles that may create a companion SSO session. The local
 * `faculty` role maps to EnrollPro's `TEACHER`; officer/admin roles map to the
 * EnrollPro staff roles.
 */
const ALLOWED_ATLAS_ROLES = new Set(['SYSTEM_ADMIN', 'HEAD_REGISTRAR', 'CLASS_ADVISER', 'TEACHER', 'FACULTY', 'OFFICER', 'ADMIN']);

/** Stable error codes (guide §8 + the school-year semantics it references). */
export type CompanionSsoErrorCode =
	| 'COMPANION_SSO_NOT_CONFIGURED'
	| 'COMPANION_SSO_UNREACHABLE'
	| 'COMPANION_SSO_CLIENT_INVALID'
	| 'COMPANION_SSO_CODE_INVALID'
	| 'COMPANION_SSO_IDENTITY_INCOMPLETE'
	| 'COMPANION_SSO_ACCOUNT_UNAVAILABLE'
	| 'COMPANION_SSO_ROLE_DENIED'
	| 'COMPANION_SSO_COMPLETER_BLOCKED'
	| 'ACTIVE_SCHOOL_YEAR_REQUIRED'
	| 'ACTIVE_SCHOOL_YEAR_CONFLICT'
	| 'COMPANION_SSO_INVALID_REQUEST';

const ERROR_HTTP_STATUS: Record<CompanionSsoErrorCode, number> = {
	COMPANION_SSO_NOT_CONFIGURED: 503,
	COMPANION_SSO_UNREACHABLE: 503,
	COMPANION_SSO_CLIENT_INVALID: 401,
	COMPANION_SSO_CODE_INVALID: 401,
	COMPANION_SSO_IDENTITY_INCOMPLETE: 401,
	COMPANION_SSO_ACCOUNT_UNAVAILABLE: 401,
	COMPANION_SSO_ROLE_DENIED: 403,
	COMPANION_SSO_COMPLETER_BLOCKED: 403,
	ACTIVE_SCHOOL_YEAR_REQUIRED: 409,
	ACTIVE_SCHOOL_YEAR_CONFLICT: 409,
	COMPANION_SSO_INVALID_REQUEST: 400,
};

/**
 * The exact public body for a failed Flow B exchange. The guide requires ONE
 * identical response for every invalid/expired/consumed/wrong-system code so
 * callers cannot probe code state.
 */
export const COMPANION_SSO_INVALID_CODE_BODY = {
	code: 'COMPANION_SSO_CODE_INVALID',
	message: 'The SSO authorization code is invalid, expired, or already used.',
} as const;

export class CompanionSsoError extends Error {
	readonly code: CompanionSsoErrorCode;
	readonly status: number;

	constructor(code: CompanionSsoErrorCode, message?: string) {
		super(message ?? code);
		this.name = 'CompanionSsoError';
		this.code = code;
		this.status = ERROR_HTTP_STATUS[code];
	}
}

/* ─── Environment resolution (read-only; never logged) ─────────────────────── */

function trimmedEnv(name: string): string | null {
	const value = process.env[name]?.trim();
	return value ? value : null;
}

/** Canonical outbound secret, accepting ATLAS's legacy alias. */
export function resolveEnrollProOutboundSecret(): { name: string; value: string } | null {
	const canonical = trimmedEnv('ENROLLPRO_SSO_CLIENT_SECRET');
	if (canonical) return { name: 'ENROLLPRO_SSO_CLIENT_SECRET', value: canonical };
	const legacy = trimmedEnv('ATLAS_SSO_CLIENT_SECRET');
	if (legacy) return { name: 'ATLAS_SSO_CLIENT_SECRET', value: legacy };
	return null;
}

/** Canonical reverse inbound secret, accepting the legacy alias. */
export function resolveReverseClientSecret(): { name: string; value: string } | null {
	const canonical = trimmedEnv('ATLAS_SSO_REVERSE_CLIENT_SECRET');
	if (canonical) return { name: 'ATLAS_SSO_REVERSE_CLIENT_SECRET', value: canonical };
	const legacy = trimmedEnv('ENROLLPRO_REVERSE_CLIENT_SECRET');
	if (legacy) return { name: 'ENROLLPRO_REVERSE_CLIENT_SECRET', value: legacy };
	return null;
}

/** `ENROLLPRO_BASE_URL` may legitimately include a trailing `/api`. */
export function resolveEnrollProBaseUrl(): string | null {
	const raw = trimmedEnv('ENROLLPRO_BASE_URL');
	if (!raw) return null;
	return raw.replace(/\/+$/, '');
}

export function resolveEnrollProCallbackUrl(): string | null {
	return trimmedEnv('ENROLLPRO_SSO_CALLBACK_URL');
}

/**
 * Constant-time compare against the configured reverse secret. Returns the
 * matching env NAME (never the value) or null. A length mismatch short-circuits
 * to an invalid result without throwing.
 */
export function matchReverseClientSecret(provided: string | null | undefined): string | null {
	if (typeof provided !== 'string' || provided.length === 0) return null;
	const configured = resolveReverseClientSecret();
	if (!configured) return null;
	const expected = Buffer.from(configured.value, 'utf8');
	const actual = Buffer.from(provided, 'utf8');
	if (expected.length !== actual.length) return null;
	if (!timingSafeEqual(expected, actual)) return null;
	return configured.name;
}

export function hashCompanionSsoCode(code: string): string {
	return createHash('sha256').update(code, 'utf8').digest('hex');
}

/** 32 random bytes → 43 base64url characters. */
export function generateCompanionSsoCode(): string {
	return randomBytes(32).toString('base64url');
}

/**
 * Build the EnrollPro reverse callback URL with the code and the UNCHANGED
 * state. Uses the URL API so existing query params on the configured callback
 * survive. Returns null when the configured value is not an absolute HTTP(S)
 * URL.
 */
export function buildCompanionSsoCallbackUrl(base: string, code: string, state: string): string | null {
	let url: URL;
	try {
		url = new URL(base);
	} catch {
		return null;
	}
	if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
	url.searchParams.set('code', code);
	url.searchParams.set('state', state);
	return url.toString();
}

/* ─── Flow A — outbound exchange payload validation ────────────────────────── */

type CompanionSsoUpstreamIdentity = {
	subject?: unknown;
	userId?: unknown;
	accountName?: unknown;
	employeeId?: unknown;
	lrn?: unknown;
	firstName?: unknown;
	middleName?: unknown;
	lastName?: unknown;
	roles?: unknown;
};

type CompanionSsoUpstreamResponse = {
	success?: unknown;
	companion?: unknown;
	identity?: CompanionSsoUpstreamIdentity | null;
	activeSchoolYear?: { id?: unknown; yearLabel?: unknown } | null;
	authenticatedAt?: unknown;
};

export type ValidatedCompanionIdentity = {
	employeeId: string | null;
	accountName: string | null;
	roles: string[];
	activeSchoolYearId: number;
	activeSchoolYearLabel: string;
};

function normalizeEmployeeId(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed ? trimmed : null;
}

function normalizeAccountName(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed ? trimmed : null;
}

function normalizeAllowedRoles(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	const normalized: string[] = [];
	for (const role of value) {
		if (typeof role !== 'string') continue;
		const upper = role.trim().toUpperCase();
		if (!upper || normalized.includes(upper)) continue;
		normalized.push(upper);
	}
	return normalized;
}

/**
 * Strictly validate the EnrollPro exchange response (guide §5.3). Throws a typed
 * CompanionSsoError on any structural or policy failure; never returns a partial
 * identity.
 */
export function validateCompanionSsoIdentity(payload: CompanionSsoUpstreamResponse, accountName: string | null): ValidatedCompanionIdentity {
	if (!payload || payload.success !== true) {
		throw new CompanionSsoError('COMPANION_SSO_CODE_INVALID');
	}
	if (typeof payload.companion !== 'string' || payload.companion.trim().toLowerCase() !== COMPANION_SSO_COMPANION) {
		throw new CompanionSsoError('COMPANION_SSO_CODE_INVALID');
	}
	const identity = payload.identity;
	if (!identity || typeof identity !== 'object') {
		throw new CompanionSsoError('COMPANION_SSO_IDENTITY_INCOMPLETE');
	}
	const employeeId = normalizeEmployeeId(identity.employeeId);
	// EnrollPro may expose the local account name either explicitly or as its own
	// `subject`. Never fabricate one: absent stays absent.
	const upstreamAccountName = normalizeAccountName(identity.accountName) ?? normalizeAccountName(identity.subject as string | undefined);
	const roles = normalizeAllowedRoles(identity.roles);
	if (!employeeId && !upstreamAccountName) {
		throw new CompanionSsoError('COMPANION_SSO_IDENTITY_INCOMPLETE');
	}
	if (roles.length === 0) {
		throw new CompanionSsoError('COMPANION_SSO_ROLE_DENIED');
	}
	const yearId = payload.activeSchoolYear?.id;
	const yearLabel = payload.activeSchoolYear?.yearLabel;
	if (!Number.isInteger(yearId) || (yearId as number) <= 0 || typeof yearLabel !== 'string' || !yearLabel.trim()) {
		throw new CompanionSsoError('ACTIVE_SCHOOL_YEAR_REQUIRED');
	}
	return {
		employeeId,
		accountName: upstreamAccountName,
		roles,
		activeSchoolYearId: yearId as number,
		activeSchoolYearLabel: (yearLabel as string).trim(),
	};
}

/* ─── Flow A — callback (exchange + map + local session) ───────────────────── */

export type CompanionSsoCallbackOutcome =
	| { ok: true; token: string; role: string }
	| { ok: false; code: CompanionSsoErrorCode };

type RawCompanionSsoUpstream = CompanionSsoUpstreamResponse & { accountNameHint?: string | null };

/**
 * Exchange a Flow A code with EnrollPro, map it onto an EXISTING local account,
 * and create a local session. One code → at most one successful exchange ever:
 * an ambiguous network result is treated as consumed and never retried.
 *
 * This path NEVER creates or updates an account (it deliberately differs from
 * the legacy credential-delegation login path).
 */
export async function exchangeEnrollProCallbackCode(
	rawCode: string,
	accountNameHint: string | null = null,
): Promise<CompanionSsoCallbackOutcome> {
	try {
		const identity = await performUpstreamExchange(rawCode, accountNameHint);
		return await createSessionForExistingAccount(identity);
	} catch (error) {
		if (error instanceof CompanionSsoError) {
			return { ok: false, code: error.code };
		}
		return { ok: false, code: 'COMPANION_SSO_UNREACHABLE' };
	}
}

async function performUpstreamExchange(code: string, accountNameHint: string | null): Promise<ValidatedCompanionIdentity> {
	const baseUrl = resolveEnrollProBaseUrl();
	const secret = resolveEnrollProOutboundSecret();
	if (!baseUrl || !secret) {
		throw new CompanionSsoError('COMPANION_SSO_NOT_CONFIGURED');
	}
	const endpoint = `${baseUrl}/auth/companion-sso/${COMPANION_SSO_COMPANION}/exchange`;
	let response: Response;
	try {
		response = await fetch(endpoint, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${secret.value}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ code }),
			signal: AbortSignal.timeout(COMPANION_SSO_UPSTREAM_TIMEOUT_MS),
		});
	} catch {
		// Ambiguous network failure: the code may already be consumed upstream.
		// Never retry it.
		throw new CompanionSsoError('COMPANION_SSO_UNREACHABLE');
	}
	if (!response.ok) {
		throw new CompanionSsoError('COMPANION_SSO_CODE_INVALID');
	}
	let payload: RawCompanionSsoUpstream;
	try {
		payload = await response.json() as RawCompanionSsoUpstream;
	} catch {
		throw new CompanionSsoError('COMPANION_SSO_UNREACHABLE');
	}
	return validateCompanionSsoIdentity(payload, accountNameHint);
}

async function createSessionForExistingAccount(identity: ValidatedCompanionIdentity): Promise<CompanionSsoCallbackOutcome> {
	const account = await findExistingAccount(identity);

	if (!account.isActive) {
		throw new CompanionSsoError('COMPANION_SSO_ACCOUNT_UNAVAILABLE');
	}
	if (!ALLOWED_ATLAS_ROLES.has(account.role.toUpperCase())) {
		throw new CompanionSsoError('COMPANION_SSO_ROLE_DENIED');
	}

	const mirror = await resolveActiveSchoolYearMirror(account.schoolId, identity.activeSchoolYearId, identity.activeSchoolYearLabel);

	let facultyExternalId: number | null = null;
	let canonicalFacultyId: number | null = account.facultyId ?? null;
	if (account.role === 'faculty') {
		const resolution = await resolveCanonicalFacultyMirror({
			schoolId: account.schoolId,
			schoolYearId: mirror.enrollProSchoolYearId,
			accountId: account.id,
			linkedFacultyId: account.facultyId,
			email: account.email,
			employeeId: account.employeeId ?? identity.employeeId,
			accountName: account.accountName,
		});
		const eligibility = classifyFacultyLoginEligibility(resolution, account.schoolId);
		if (!eligibility.ok) {
			throw new CompanionSsoError(mapFacultyEligibilityCode(eligibility.code));
		}
		facultyExternalId = resolution?.faculty.externalId ?? null;
		canonicalFacultyId = resolution?.faculty.id ?? account.facultyId ?? null;
	}

	const sessionUser: LocalAuthUser = {
		userId: account.role === 'faculty' && facultyExternalId ? facultyExternalId : account.id,
		role: account.role,
		mustChangePassword: account.mustChangePassword,
		authSource: 'local',
		schoolId: account.schoolId,
		accountId: account.id,
		facultyId: canonicalFacultyId,
		email: account.email,
		employeeId: account.employeeId,
		accountName: account.accountName,
	};

	const token = issueCompanionSsoToken(sessionUser);
	if (!token) {
		throw new CompanionSsoError('COMPANION_SSO_NOT_CONFIGURED');
	}

	await prisma.atlasAuthAccount.update({
		where: { id: account.id },
		data: { facultyId: canonicalFacultyId, lastLoginAt: new Date() },
	});

	await writeCompanionSsoAudit({
		schoolId: account.schoolId,
		actorId: account.id,
		action: 'COMPANION_SSO_SESSION_CREATED',
		targetIds: [account.id],
		metadata: {
			accountId: account.id,
			role: account.role,
			authSource: 'local',
			activeSchoolYearId: mirror.enrollProSchoolYearId,
		},
	});

	return { ok: true, token, role: account.role };
}

function mapFacultyEligibilityCode(code: string): CompanionSsoErrorCode {
	switch (code) {
		case 'FACULTY_IDENTITY_INACTIVE':
		case 'FACULTY_IDENTITY_STALE':
			return 'COMPANION_SSO_ACCOUNT_UNAVAILABLE';
		case 'FACULTY_IDENTITY_AMBIGUOUS':
			return 'COMPANION_SSO_IDENTITY_INCOMPLETE';
		case 'FACULTY_IDENTITY_UNRESOLVED':
			return 'COMPANION_SSO_IDENTITY_INCOMPLETE';
		case 'FACULTY_CROSS_SCHOOL_DENIED':
			return 'COMPANION_SSO_ACCOUNT_UNAVAILABLE';
		default:
			return 'COMPANION_SSO_IDENTITY_INCOMPLETE';
	}
}

type ExistingAccount = {
	id: number;
	schoolId: number;
	role: string;
	email: string;
	employeeId: string | null;
	accountName: string | null;
	facultyId: number | null;
	isActive: boolean;
	mustChangePassword: boolean;
};

/**
 * Map EnrollPro's identity onto an EXISTING `atlas_auth_accounts` row: exact
 * normalized `employeeId` first, then exact `accountName`. Zero or multiple
 * matches are rejected; no account is ever created or updated here.
 */
async function findExistingAccount(identity: ValidatedCompanionIdentity): Promise<ExistingAccount> {
	const candidates = new Map<number, ExistingAccount>();
	const collect = (rows: ExistingAccount[]) => {
		for (const row of rows) candidates.set(row.id, row);
	};

	if (identity.employeeId) {
		collect(await prisma.atlasAuthAccount.findMany({
			where: { employeeId: identity.employeeId },
			select: ACCOUNT_SELECT,
		}));
	}
	if (candidates.size === 0 && identity.accountName) {
		collect(await prisma.atlasAuthAccount.findMany({
			where: { accountName: identity.accountName },
			select: ACCOUNT_SELECT,
		}));
	}
	if (candidates.size !== 1) {
		throw new CompanionSsoError('COMPANION_SSO_IDENTITY_INCOMPLETE');
	}
	return [...candidates.values()][0];
}

const ACCOUNT_SELECT = {
	id: true,
	schoolId: true,
	role: true,
	email: true,
	employeeId: true,
	accountName: true,
	facultyId: true,
	isActive: true,
	mustChangePassword: true,
} as const;

type ActiveSchoolYearMirror = {
	id: number;
	enrollProSchoolYearId: number;
	yearLabel: string;
};

/**
 * The session school must have exactly one active, non-archived
 * `EnrollProSchoolYearMirror` whose EnrollPro year id matches the payload (and
 * label when the mirror stores one).
 */
async function resolveActiveSchoolYearMirror(
	schoolId: number,
	expectedYearId: number,
	expectedLabel: string,
): Promise<ActiveSchoolYearMirror> {
	const mirrors = await prisma.enrollProSchoolYearMirror.findMany({
		where: { schoolId, isActive: true, isArchived: false },
		select: { id: true, enrollProSchoolYearId: true, yearLabel: true },
	});
	if (mirrors.length === 0) {
		throw new CompanionSsoError('ACTIVE_SCHOOL_YEAR_REQUIRED');
	}
	if (mirrors.length !== 1) {
		throw new CompanionSsoError('ACTIVE_SCHOOL_YEAR_CONFLICT');
	}
	const mirror = mirrors[0];
	if (mirror.enrollProSchoolYearId !== expectedYearId) {
		throw new CompanionSsoError('ACTIVE_SCHOOL_YEAR_CONFLICT');
	}
	if (mirror.yearLabel && mirror.yearLabel.trim().toLowerCase() !== expectedLabel.trim().toLowerCase()) {
		throw new CompanionSsoError('ACTIVE_SCHOOL_YEAR_CONFLICT');
	}
	return mirror;
}

/* ─── Flow B — authorize (issue) ───────────────────────────────────────────── */

export type AuthorizeParams = {
	responseType?: unknown;
	clientId?: unknown;
	redirectUri?: unknown;
	state?: unknown;
	role?: string | undefined;
};

/**
 * Strict Flow B authorize validation. Throws a typed error (no redirect, no
 * code row) on any mismatch — including open-redirect attempts.
 */
export function validateAuthorizeRequest(params: AuthorizeParams): { redirectUri: string; state: string } {
	if (!hasPrivilegedRole(params.role)) {
		throw new CompanionSsoError('COMPANION_SSO_ROLE_DENIED', 'This endpoint is restricted to scheduler officers and administrators.');
	}
	const responseType = typeof params.responseType === 'string' ? params.responseType : '';
	const clientId = typeof params.clientId === 'string' ? params.clientId : '';
	const redirectUri = typeof params.redirectUri === 'string' ? params.redirectUri : '';
	const state = typeof params.state === 'string' ? params.state : '';

	if (responseType !== 'code') {
		throw new CompanionSsoError('COMPANION_SSO_INVALID_REQUEST', 'response_type must be "code".');
	}
	if (clientId !== COMPANION_SSO_CLIENT_ID) {
		throw new CompanionSsoError('COMPANION_SSO_INVALID_REQUEST', 'client_id is not recognized.');
	}
	if (state.length === 0 || state.length > MAX_STATE_LENGTH) {
		throw new CompanionSsoError('COMPANION_SSO_INVALID_REQUEST', 'state must be a non-empty bounded string.');
	}
	const registeredCallback = resolveEnrollProCallbackUrl();
	if (!registeredCallback) {
		throw new CompanionSsoError('COMPANION_SSO_NOT_CONFIGURED', 'The EnrollPro reverse callback is not configured.');
	}
	if (redirectUri !== registeredCallback) {
		throw new CompanionSsoError('COMPANION_SSO_INVALID_REQUEST', 'redirect_uri is not the registered EnrollPro callback.');
	}
	return { redirectUri, state };
}

export type IssuedCompanionSsoCode = {
	code: string;
	callbackUrl: string;
	expiresAt: Date;
};

/**
 * Issue a one-time code bound to the local account, audience, and exact
 * redirect URI. Persists ONLY the SHA-256 hash.
 */
export async function issueCompanionSsoCode(params: {
	userId: number;
	schoolId: number;
	redirectUri: string;
	state: string;
	now?: Date;
}): Promise<IssuedCompanionSsoCode> {
	const now = params.now ?? new Date();
	const expiresAt = new Date(now.getTime() + COMPANION_SSO_CODE_TTL_MS);
	const code = generateCompanionSsoCode();
	const codeHash = hashCompanionSsoCode(code);

	await prisma.companionSsoCode.create({
		data: {
			codeHash,
			userId: params.userId,
			schoolId: params.schoolId,
			audience: COMPANION_SSO_AUDIENCE,
			redirectUri: params.redirectUri,
			expiresAt,
		},
	});

	const callbackUrl = buildCompanionSsoCallbackUrl(params.redirectUri, code, params.state);
	if (!callbackUrl) {
		throw new CompanionSsoError('COMPANION_SSO_NOT_CONFIGURED', 'The EnrollPro reverse callback is not a valid absolute URL.');
	}
	return { code, callbackUrl, expiresAt };
}

/* ─── Flow B — exchange (consume + assertion) ──────────────────────────────── */

export type CompanionSsoAssertion = {
	success: true;
	issuer: string;
	identity: {
		subject: string;
		employeeId: string | null;
		lrn: null;
		firstName: string;
		middleName: null;
		lastName: string;
		roles: string[];
	};
	activeSchoolYear: { id: number; yearLabel: string };
	authenticatedAt: string;
};

export type ExchangeResult =
	| { ok: true; assertion: CompanionSsoAssertion }
	| { ok: false; body: typeof COMPANION_SSO_INVALID_CODE_BODY };

type ExchangeParams = {
	code?: unknown;
	clientId?: unknown;
	redirectUri?: unknown;
};

function readExchangeCode(params: ExchangeParams): string | null {
	if (typeof params.code !== 'string') return null;
	const code = params.code.trim();
	if (!COMPANION_SSO_CODE_PATTERN.test(code)) return null;
	return code;
}

/**
 * Atomic single-statement consume. The `updateMany` predicate covers the hash,
 * unconsumed state, freshness, audience, and redirect binding, so two concurrent
 * identical exchanges race on the row lock and exactly one wins. No
 * read-then-update window exists.
 */
export async function consumeCompanionSsoCode(params: {
	code: string;
	redirectUri: string;
	now?: Date;
}): Promise<{ id: number; userId: number | null; schoolId: number | null; consumedAt: Date } | null> {
	const now = params.now ?? new Date();
	const codeHash = hashCompanionSsoCode(params.code);
	const claimed = await prisma.companionSsoCode.updateMany({
		where: {
			codeHash,
			consumedAt: null,
			expiresAt: { gt: now },
			audience: COMPANION_SSO_AUDIENCE,
			redirectUri: params.redirectUri,
		},
		data: { consumedAt: now },
	});
	if (claimed.count !== 1) return null;

	const row = await prisma.companionSsoCode.findUnique({
		where: { codeHash },
		select: { id: true, userId: true, schoolId: true, consumedAt: true },
	});
	if (!row || !row.consumedAt) return null;
	return { id: row.id, userId: row.userId, schoolId: row.schoolId, consumedAt: row.consumedAt };
}

export async function exchangeCompanionSsoCode(params: ExchangeParams): Promise<ExchangeResult> {
	const invalid = { ok: false as const, body: COMPANION_SSO_INVALID_CODE_BODY };
	const registeredCallback = resolveEnrollProCallbackUrl();
	if (!registeredCallback) return invalid;

	const code = readExchangeCode(params);
	if (!code) return invalid;

	const redirectUri = typeof params.redirectUri === 'string' ? params.redirectUri : '';
	const clientId = typeof params.clientId === 'string' ? params.clientId : '';
	if (clientId !== COMPANION_SSO_REVERSE_CLIENT_ID || redirectUri !== registeredCallback) {
		return invalid;
	}

	const claimed = await consumeCompanionSsoCode({ code, redirectUri });
	if (!claimed) return invalid;

	try {
		const assertion = await buildAssertion(claimed);
		await writeCompanionSsoAudit({
			schoolId: assertion.audit.schoolId,
			actorId: assertion.audit.actorId,
			action: 'COMPANION_SSO_CODE_CONSUMED',
			targetIds: [assertion.audit.actorId],
			metadata: { codeId: claimed.id, audience: COMPANION_SSO_AUDIENCE },
		});
		return { ok: true, assertion: assertion.assertion };
	} catch (error) {
		// The code is already consumed: never retry it. A failed assertion writes
		// no success audit.
		void error;
		return invalid;
	}
}

type AssertionBundle = {
	assertion: CompanionSsoAssertion;
	audit: { schoolId: number; actorId: number };
};

async function buildAssertion(claimed: {
	id: number;
	userId: number | null;
	schoolId: number | null;
	consumedAt: Date;
}): Promise<AssertionBundle> {
	if (!claimed.userId) {
		throw new CompanionSsoError('COMPANION_SSO_ACCOUNT_UNAVAILABLE');
	}
	const account = await prisma.atlasAuthAccount.findUnique({
		where: { id: claimed.userId },
		select: {
			id: true,
			schoolId: true,
			role: true,
			email: true,
			employeeId: true,
			accountName: true,
			facultyId: true,
			isActive: true,
			faculty: {
				select: {
					id: true,
					externalId: true,
					firstName: true,
					lastName: true,
					employeeId: true,
					contactInfo: true,
					isActiveForScheduling: true,
					isStale: true,
					schoolId: true,
				},
			},
		},
	});
	if (!account || !account.isActive) {
		throw new CompanionSsoError('COMPANION_SSO_ACCOUNT_UNAVAILABLE');
	}

	const schoolId = account.schoolId;
	const mirrors = await prisma.enrollProSchoolYearMirror.findMany({
		where: { schoolId, isActive: true, isArchived: false },
		select: { enrollProSchoolYearId: true, yearLabel: true },
	});
	if (mirrors.length !== 1) {
		throw new CompanionSsoError(mirrors.length === 0 ? 'ACTIVE_SCHOOL_YEAR_REQUIRED' : 'ACTIVE_SCHOOL_YEAR_CONFLICT');
	}

	const nameParts = resolveAccountNameParts(account);

	return {
		assertion: {
			success: true,
			issuer: COMPANION_SSO_ISSUER,
			identity: {
				subject: `ATLAS_USER:${account.id}`,
				employeeId: account.employeeId ?? account.faculty?.employeeId ?? null,
				lrn: null,
				firstName: nameParts.firstName,
				middleName: null,
				lastName: nameParts.lastName,
				roles: [account.role],
			},
			activeSchoolYear: {
				id: mirrors[0].enrollProSchoolYearId,
				yearLabel: mirrors[0].yearLabel,
			},
			authenticatedAt: claimed.consumedAt.toISOString(),
		},
		audit: { schoolId, actorId: account.id },
	};
}

/**
 * Derive display name parts from local, already-persisted fields only. The
 * assertion contract does not require a name, so absent values fall back to
 * empty strings rather than fabricated identity.
 */
function resolveAccountNameParts(account: {
	accountName: string | null;
	email: string;
	role: string;
	faculty: { firstName: string; lastName: string } | null;
}): { firstName: string; lastName: string } {
	if (account.faculty && (account.faculty.firstName || account.faculty.lastName)) {
		return {
			firstName: account.faculty.firstName ?? '',
			lastName: account.faculty.lastName ?? '',
		};
	}
	if (account.accountName) {
		const [first = '', ...rest] = account.accountName.trim().split(/\s+/);
		return { firstName: first, lastName: rest.join(' ') };
	}
	return { firstName: '', lastName: '' };
}
