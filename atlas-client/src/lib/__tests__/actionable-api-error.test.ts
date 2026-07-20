import assert from 'node:assert/strict';
import test from 'node:test';

import { getActionableApiError } from '../actionable-api-error';

test('joins the server message and recovery hint without losing either', () => {
	assert.equal(
		getActionableApiError(
			{ response: { data: { message: 'The latest draft is stale.', actionHint: 'Ask the scheduling officer to generate a fresh draft.' } } },
			'Try again later.',
		),
		'The latest draft is stale. Ask the scheduling officer to generate a fresh draft.',
	);
});

test('uses the fallback for network errors without response guidance', () => {
	assert.equal(getActionableApiError(new Error('Network Error'), 'Please reconnect and retry.'), 'Please reconnect and retry.');
});
