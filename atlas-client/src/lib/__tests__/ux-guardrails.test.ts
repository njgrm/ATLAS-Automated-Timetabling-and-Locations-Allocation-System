import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '../../..');

function source(path: string): string {
	return readFileSync(resolve(root, path), 'utf8');
}

test('shared controls use the older-user-safe default target sizes', () => {
	const buttonVariants = source('src/ui/button-variants.ts');
	const input = source('src/ui/input.tsx');

	assert.match(buttonVariants, /sm:\s*["'][^"']*h-10/);
	assert.match(buttonVariants, /'icon-sm':\s*["'][^"']*size-10/);
	assert.match(input, /flex h-10 w-full/);
});

test('the global typography contract does not force negative tracking', () => {
	const css = source('src/index.css');

	assert.doesNotMatch(css, /letter-spacing:\s*-0\.0/);
	assert.match(css, /focus-visible[^}]*outline/i);
});

test('faculty room-request zoom controls use accessible labels instead of title help', () => {
	const layout = source('src/components/faculty-room-preferences/DesktopRoomRequestLayout.tsx');

	assert.doesNotMatch(layout, /title=['"](?:Zoom Out|Zoom In|Reset)['"]/);
	assert.match(layout, /aria-label=['"]Zoom out campus view['"]/);
	assert.match(layout, /aria-label=['"]Zoom in campus view['"]/);
	assert.match(layout, /aria-label=['"]Reset campus zoom['"]/);
});

test('scheduler room-request preview uses plain-language conflict labels', () => {
	const page = source('src/pages/OfficerRoomPreferences.tsx');

	assert.doesNotMatch(page, /Hard (?:Δ|Î”)/);
	assert.doesNotMatch(page, /Soft (?:Δ|Î”)/);
	assert.match(page, /Blocking conflicts/);
	assert.match(page, /Warnings/);
});

test('faculty room-request surfaces use project controls instead of raw interactive elements', () => {
	const directory = resolve(root, 'src/components/faculty-room-preferences');
	const combined = readdirSync(directory)
		.filter((name) => name.endsWith('.tsx'))
		.map((name) => readFileSync(resolve(directory, name), 'utf8'))
		.join('\n');

	assert.doesNotMatch(combined, /<button\b/);
	assert.doesNotMatch(combined, /<input\b/);
});
