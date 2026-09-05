/**
 * Deterministic canonical JSON utility for fingerprint generation.
 *
 * Solves the defects in the previous shallow JSON.stringify approach:
 * - Recursively sorts all object keys at every nesting level
 * - Preserves array contents and ordering
 * - Handles null, undefined, numbers, strings, booleans, Dates
 * - Produces identical output for logically identical data
 * - Changes output when any nested value changes
 *
 * Used by delete preview/apply, sync preview/apply, and baseline manifest.
 */

/**
 * Canonicalize a value recursively, sorting all object keys at every level.
 * Returns a value suitable for JSON.stringify with deterministic output.
 */
export function canonicalize(value: unknown): unknown {
	if (value === null || value === undefined) {
		return null;
	}

	if (value instanceof Date) {
		return value.toISOString();
	}

	if (typeof value === 'number') {
		if (!Number.isFinite(value)) {
			return null;
		}
		return value;
	}

	if (typeof value === 'boolean' || typeof value === 'string') {
		return value;
	}

	if (Array.isArray(value)) {
		return value.map((item) => canonicalize(item));
	}

	if (typeof value === 'object') {
		const obj = value as Record<string, unknown>;
		const sortedKeys = Object.keys(obj).sort();
		const result: Record<string, unknown> = {};
		for (const key of sortedKeys) {
			const val = obj[key];
			if (val !== undefined) {
				result[key] = canonicalize(val);
			}
		}
		return result;
	}

	// Unsupported types (functions, symbols, etc.) → null
	return null;
}

/**
 * Produce a deterministic canonical JSON string from any value.
 * All object keys are recursively sorted; arrays preserve order.
 */
export function canonicalStringify(value: unknown): string {
	return JSON.stringify(canonicalize(value));
}

/**
 * Compute SHA-256 hex digest of a canonical JSON representation.
 * The input is canonicalized before hashing.
 */
export async function canonicalHash(value: unknown): Promise<string> {
	const canonical = canonicalStringify(value);
	const encoder = new TextEncoder();
	const bytes = encoder.encode(canonical);
	const hash = await crypto.subtle.digest('SHA-256', bytes);
	const hex = [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
	return hex.toUpperCase();
}

/**
 * Sort an array of objects by a deterministic key extraction.
 * Used to ensure manifest arrays are in a consistent order before hashing.
 */
export function sortByKey<T>(items: T[], keyFn: (item: T) => string): T[] {
	return [...items].sort((a, b) => keyFn(a).localeCompare(keyFn(b)));
}
