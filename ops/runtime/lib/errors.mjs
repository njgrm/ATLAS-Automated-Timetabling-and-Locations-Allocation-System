/**
 * Typed, non-secret-bearing errors for the ATLAS runtime-supervision contract.
 *
 * Every failure carries a stable machine-readable `code` so the supervisor CLI
 * and the tests can assert exact fail-closed behavior. Messages must never
 * include secret values, database URLs, or machine usernames.
 */
export class RuntimeError extends Error {
	/**
	 * @param {string} code stable machine-readable failure code
	 * @param {string} message human-readable, secret-free message
	 * @param {Record<string, unknown>} [details] non-secret diagnostics
	 */
	constructor(code, message, details = undefined) {
		super(message);
		this.name = 'RuntimeError';
		this.code = code;
		if (details !== undefined) this.details = details;
	}
}

export function fail(code, message, details = undefined) {
	return new RuntimeError(code, message, details);
}
