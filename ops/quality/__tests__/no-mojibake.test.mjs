// Fails when product source contains mis-decoded UTF-8 ("mojibake"): an em dash that went through CP437 prints as
// "ΓÇö", through Windows-1252 as "â€”". 2026-09-29: "Not a problem ΓÇö this teacher…" shipped to live in the Teachers
// Review load window, and a PowerShell-mangled recovery patch carried it into four more files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const PATTERNS = ['ΓÇ', 'â€', 'Ã¢', 'Ã©', 'Â·'];

test('no mojibake in client or server source (tests excluded)', () => {
	const hits = [];
	for (const p of PATTERNS) {
		let out = '';
		try {
			out = execFileSync('git', ['grep', '-n', '-F', p, '--', 'atlas-client/src', 'atlas-server/src', ':(exclude)**/__tests__/**'], { encoding: 'utf8' });
		} catch (e) {
			if (e.status !== 1) throw e; // 1 = no match
		}
		if (out.trim()) hits.push(out.trim());
	}
	assert.equal(hits.join('\n'), '', 'mis-decoded UTF-8 found; replace with the real character');
});
