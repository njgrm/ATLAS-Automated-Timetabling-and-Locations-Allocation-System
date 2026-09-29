/**
 * A7 c13 — no text on the Class Schedule is cut off with an ellipsis; it wraps.
 *
 * The screen is read by an older, mouse-first scheduler. Every string exercised
 * here is one they must read to act ("what changed", "which ceremony occupies
 * the slot", "who teaches the class", "what the drawer asks me to confirm"), so
 * a trailing `…` is a defect, not a density choice (AGENTS.md §8).
 *
 * These are STRUCTURAL rows, decided on class tokens: jsdom has no layout engine
 * and cannot measure a line. The declared wrap contract is what is asserted, and
 * the rendered pixel line count is a Lane C browser row.
 *
 * Run: `npm run test:a7-c13-clip`.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

import { SimpleChangeNotice, changeNoticeSentence } from '../simple/SimpleChangeNotice';

const clientRoot = resolve(import.meta.dirname, '../../../..');
function source(path: string): string {
	return readFileSync(resolve(clientRoot, path), 'utf8');
}

function classTokens(tag: string): Set<string> {
	const match = tag.match(/class="([^"]*)"/);
	return new Set((match?.[1] ?? '').split(/\s+/).filter(Boolean));
}

function tagFor(markup: string, testid: string): string {
	return markup.match(new RegExp(`<[a-z]+[^>]*data-testid="${testid}"[^>]*>`))?.[0] ?? '';
}

const CLIP_TOKENS = ['truncate', 'lg:truncate', 'text-ellipsis', 'overflow-hidden', 'line-clamp-1'];

function assertWraps(tokens: Set<string>, label: string): void {
	for (const clip of CLIP_TOKENS) {
		assert.equal(tokens.has(clip), false, `${label} must not carry \`${clip}\` (it would clip with an ellipsis)`);
	}
	const wraps = tokens.has('break-words') || tokens.has('whitespace-normal');
	assert.ok(wraps, `${label} must declare a wrap (\`break-words\` or \`whitespace-normal\`); got: ${[...tokens].join(' ')}`);
}

/* ── ITEM 1 — the change-notice sentence wraps ─────────────────────────────── */

test('ITEM 1: the change-notice sentence wraps at every width, never truncating the sentence', () => {
	const sentence = changeNoticeSentence(['Teaching Load', 'Teacher availability']);
	const markup = renderToStaticMarkup(createElement(SimpleChangeNotice, {
		sentence,
		changedAreas: ['Teaching Load', 'Teacher availability'],
	}));
	const tag = tagFor(markup, 'timetable-simple-drift-message');
	assert.ok(tag, 'the sentence span renders');
	assertWraps(classTokens(tag), 'the change-notice sentence');
	// The whole sentence is the text the scheduler must be able to read.
	assert.ok(markup.includes('Teaching Load and Teacher availability changed since this schedule was made.'),
		'the full two-area sentence is rendered');
});

test('ITEM 1: the historical 1-area and 3-area sentences are unchanged', () => {
	assert.equal(changeNoticeSentence(['Teaching Load']),
		'Teaching Load changed since this schedule was made.');
	assert.equal(changeNoticeSentence(['Teaching Load', 'Rooms', 'Teacher availability']),
		'Teaching Load and 2 other areas changed since this schedule was made.');
});
