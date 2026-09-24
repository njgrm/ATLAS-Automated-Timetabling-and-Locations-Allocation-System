import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

/**
 * S4-client / D4 — the revision dialog contract. The dialog is presentational
 * (its caller owns the request), so this suite pins the operator-visible
 * contract: the optional identity-delta summary, the bounded reason-required
 * withdraw surface, and the honest typed-failure sentences. The real request
 * shapes are covered by the client-contract suite and the integrated S4-server
 * route tests.
 */
const clientRoot = resolve(import.meta.dirname, '../../..');

function source(path: string): string {
	return readFileSync(resolve(clientRoot, path), 'utf8');
}

const dialog = source('src/components/timetable/PublishedRevisionDialog.tsx');
const client = source('src/lib/published-revision-client.ts');

test('the revision dialog states the optional identity delta truthfully', () => {
	assert.match(dialog, /data-testid="published-revision-identity-overrides"/);
	assert.match(dialog, /Identity changes after this date/);
	assert.match(dialog, /identityOverrideFieldLabel/);
	assert.match(dialog, /The original published revision and its frozen identity stay unchanged for earlier dates/);
});

test('the revision dialog carries the bounded reason-required withdraw surface', () => {
	assert.match(dialog, /data-testid="published-revision-withdraw"/);
	assert.match(dialog, /data-testid="published-revision-withdraw-reason"/);
	assert.match(dialog, /data-testid="published-revision-withdraw-submit"/);
	assert.match(dialog, /data-testid="published-revision-withdraw-feedback"/);
	// The base immutable contract is stated to the operator, not hidden.
	assert.match(dialog, /The original publication can never be withdrawn/);
	// The submit is gated locally on a reason, never dispatched blank.
	assert.match(dialog, /Boolean\(withdrawSuccess\) \|\| !\(withdrawReason \?\? ''\)\.trim\(\)/);
});

test('typed failures surface through the shared honest sentences', () => {
	assert.match(dialog, /data-testid="published-revision-identity-overrides-error"/);
	assert.match(client, /PUBLISHED_IDENTITY_OVERRIDE_INVALID/);
	assert.match(client, /PUBLISHED_IDENTITY_OVERRIDE_INCONSISTENT/);
	assert.match(client, /CROSS_SCHOOL_DENIED/);
	assert.match(client, /PUBLISHED_REVISION_BASE_IMMUTABLE/);
	assert.match(client, /REVISION_REASON_REQUIRED/);
});

test('the revision client exposes the withdraw + effective-identity routes', () => {
	assert.match(client, /published-revisions\/\$\{input\.revisionId\}\/withdraw/);
	assert.match(client, /published-revisions\/effective-identity/);
	assert.match(client, /IDENTITY_OVERRIDES_METADATA_KEY/);
});
