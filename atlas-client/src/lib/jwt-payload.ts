/**
 * COMPANION-SSO-C01 — minimal JWT payload reader.
 *
 * Used only to pick the post-SSO landing route. It does NOT verify the token:
 * the server is the only authority for token validity and `GET /auth/me`
 * re-verifies the session after routing. Returns null for any malformed token.
 */

export type DecodedJwtPayload = {
	userId?: number;
	role?: string;
	schoolId?: number;
	accountId?: number;
	authSource?: string;
	[key: string]: unknown;
};

function base64UrlDecode(segment: string): string | null {
	try {
		const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
		const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
		if (typeof atob === 'function') {
			return decodeURIComponent(
				atob(padded)
					.split('')
					.map((char) => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`)
					.join(''),
			);
		}
		return Buffer.from(padded, 'base64').toString('utf8');
	} catch {
		return null;
	}
}

export function decodeJwtPayload(token: string): DecodedJwtPayload | null {
	if (typeof token !== 'string') return null;
	const segments = token.split('.');
	if (segments.length !== 3) return null;
	const json = base64UrlDecode(segments[1]);
	if (!json) return null;
	try {
		const parsed = JSON.parse(json) as unknown;
		if (!parsed || typeof parsed !== 'object') return null;
		return parsed as DecodedJwtPayload;
	} catch {
		return null;
	}
}
