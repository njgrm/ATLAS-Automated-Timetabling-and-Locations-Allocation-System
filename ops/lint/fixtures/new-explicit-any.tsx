/**
 * Negative-control fixture for CLIENT-QUALITY-C01 S3.
 *
 * A new explicit `any` typed prop. `eslint` MUST exit nonzero on this file
 * (@typescript-eslint/no-explicit-any). It is intentionally broken and is
 * excluded from the default lint target (`ops/**` is ignored by
 * eslint.config.js); it is linted only by ops/lint/verify-fixtures.cjs.
 */
export function NewExplicitAnyFixture({ value }: { value: any }) {
	return <div>{String(value)}</div>;
}
