import assert from 'node:assert/strict';
import test from 'node:test';

import { resolvePublicationActionIntent } from '../publication-approval-action';

test('scheduler controls submit an approval request while legacy officer roles keep direct publication', () => {
	assert.equal(resolvePublicationActionIntent('scheduler'), 'request-approval');
	assert.equal(resolvePublicationActionIntent('admin'), 'direct-publish');
	assert.equal(resolvePublicationActionIntent('officer'), 'direct-publish');
	assert.equal(resolvePublicationActionIntent('SYSTEM_ADMIN'), 'direct-publish');
	assert.equal(resolvePublicationActionIntent('faculty'), 'direct-publish');
});
