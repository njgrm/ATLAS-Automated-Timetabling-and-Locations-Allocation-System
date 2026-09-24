import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const css = readFileSync(resolve(import.meta.dirname, '../../index.css'), 'utf8');

test('global native scrollbars use thin token-driven styling without opting into a component class', () => {
	const baseLayer = css.match(/@layer base\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
	assert.match(baseLayer, /:where\(\*\)/, 'global low-specificity selector covers native scroll containers');
	assert.match(baseLayer, /scrollbar-width:\s*thin/);
	assert.match(baseLayer, /scrollbar-color:\s*hsl\(var\(--primary\)\)\s+hsl\(var\(--muted\)\)/);
	assert.match(baseLayer, /:where\(\*\)\s*::-webkit-scrollbar\s*\{[^}]*width:\s*6px;[^}]*height:\s*6px;/s);
	assert.match(baseLayer, /:where\(\*\)\s*::-webkit-scrollbar-track\s*\{[^}]*background:\s*hsl\(var\(--muted\)\)/s);
	assert.match(baseLayer, /:where\(\*\)\s*::-webkit-scrollbar-thumb\s*\{[^}]*background:\s*hsl\(var\(--primary\)\)/s);

	const explicitUtility = css.match(/\.scrollbar-thin\s*\{[^}]*\}/)?.[0] ?? '';
	assert.match(explicitUtility, /scrollbar-width:\s*thin/);
	assert.match(explicitUtility, /scrollbar-color:\s*hsl\(var\(--primary\)\)\s+hsl\(var\(--muted\)\)/);
});
