import { fail } from './errors.mjs';

/**
 * Single source of truth for the supervised EnrollPro proxy origin.
 *
 * The origin is consumed by two production boundaries:
 * - the supervisor target builder (`ops/runtime/lib/supervisor.mjs`) which
 *   propagates `<origin>` to the production host child as
 *   `ATLAS_HOST_ENROLLPRO_TARGET`; and
 * - the production host target normalizer
 *   (`ops/runtime/lib/production-host.mjs`) which rejects a malformed value
 *   before serving a single request.
 *
 * Both use `normalizeHttpOrigin` / `normalizeEnrollProOrigin` so a value can
 * never be accepted at one boundary and rejected at the other.
 */

export const ENROLLPRO_ORIGIN_VARIABLE = 'ENROLLPRO_PROXY_ORIGIN';
export const ENROLLPRO_ORIGIN_INVALID = 'ENROLLPRO_PROXY_ORIGIN_INVALID';
export const ENROLLPRO_ORIGIN_MISSING = 'ENROLLPRO_PROXY_ORIGIN_MISSING';

const HTTP_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Validate a raw value as a normalized http(s) origin.
 *
 * - absent / `null` / blank-after-trim has **missing** semantics: returns `null`;
 * - any other present-but-invalid value throws a typed `RuntimeError` with the
 *   caller-supplied `code` (default `ENROLLPRO_PROXY_ORIGIN_INVALID`).
 *
 * A single trailing slash is normalized away, so `https://host/` and
 * `https://host` resolve to the same origin. Credentials, any non-root path,
 * query strings, fragments, non-http(s) schemes, and unparseable values are
 * rejected.
 */
export function normalizeHttpOrigin(raw, options = {}) {
	const code = options.code ?? ENROLLPRO_ORIGIN_INVALID;
	const label = options.label ?? 'origin';
	if (raw === undefined || raw === null) return null;
	const value = String(raw).trim();
	if (value === '') return null;

	let parsed;
	try {
		parsed = new URL(value);
	} catch {
		throw fail(code, `${label} must be a valid absolute http(s) origin.`);
	}
	if (!HTTP_PROTOCOLS.has(parsed.protocol)) {
		throw fail(code, `${label} must use the http or https scheme.`);
	}
	if (parsed.username !== '' || parsed.password !== '') {
		throw fail(code, `${label} must not embed credentials.`);
	}
	if (parsed.pathname !== '' && parsed.pathname !== '/') {
		throw fail(code, `${label} must be an origin only and must not include a path.`);
	}
	if (parsed.search !== '') {
		throw fail(code, `${label} must not include a query string.`);
	}
	if (parsed.hash !== '') {
		throw fail(code, `${label} must not include a fragment.`);
	}
	if (parsed.hostname === '') {
		throw fail(code, `${label} must include a host.`);
	}
	return `${parsed.protocol}//${parsed.host}`;
}

/** EnrollPro-origin-flavored wrapper over {@link normalizeHttpOrigin}. */
export function normalizeEnrollProOrigin(raw, options = {}) {
	return normalizeHttpOrigin(raw, {
		code: options.code ?? ENROLLPRO_ORIGIN_INVALID,
		label: options.label ?? ENROLLPRO_ORIGIN_VARIABLE,
	});
}

/** The reviewed contract variable name, with the documented default fallback. */
export function enrollProOriginVariable(contract) {
	const variable = contract?.upstream?.enrollProOriginVariable;
	return typeof variable === 'string' && variable.trim() !== '' ? variable : ENROLLPRO_ORIGIN_VARIABLE;
}

/**
 * Resolve the effective EnrollPro origin from a **composed child environment**
 * (`{ ...inheritedEnv, ...durableEnvValues, ...invariantEnv }`). Because the
 * durable values are composed last, a durable operator value always wins over a
 * conflicting inherited value.
 *
 * - `requireExplicit` is the supervised **launch gate**: when no value is
 *   supplied it fails closed with `ENROLLPRO_PROXY_ORIGIN_MISSING` instead of
 *   silently using the reviewed development default.
 * - Outside the launch gate (`stop`, `status`, local development) an absent
 *   value falls back to `contract.upstream.defaultEnrollProOrigin`.
 */
export function resolveEnrollProOrigin(options = {}) {
	const { contract, childEnv = {}, requireExplicit = false } = options;
	const variable = enrollProOriginVariable(contract);
	const normalized = normalizeEnrollProOrigin(childEnv[variable], { label: variable });
	if (normalized) return normalized;
	if (requireExplicit) {
		throw fail(ENROLLPRO_ORIGIN_MISSING, `Required ${variable} is not set for a supervised production launch.`);
	}
	return normalizeHttpOrigin(contract?.upstream?.defaultEnrollProOrigin, { label: `${variable} default` });
}
