/**
 * Negative-control fixture for CLIENT-QUALITY-C01 S2.
 *
 * A hook (`useCallback`) is declared AFTER an early return, which is the
 * canonical react-hooks/rules-of-hooks violation and the exact shape that
 * produced the live `/timetable` React #310. `eslint` MUST exit nonzero on this
 * file. It is intentionally broken and is excluded from the default lint target
 * (`ops/**` is ignored by eslint.config.js); it is linted only by
 * ops/lint/verify-fixtures.cjs.
 */
import { useCallback, useState } from 'react';

export function HookAfterEarlyReturnFixture({ ready }: { ready: boolean }) {
	const [count] = useState(0);
	if (!ready) {
		return null;
	}
	const increment = useCallback(() => count + 1, [count]);
	return (
		<button type="button" onClick={() => void increment()}>
			{count}
		</button>
	);
}
