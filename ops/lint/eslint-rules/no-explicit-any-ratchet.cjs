/**
 * CLIENT-QUALITY-C01 — per-file `@typescript-eslint/no-explicit-any` ratchet.
 *
 * `@typescript-eslint/no-explicit-any` cannot express "error, except for the
 * count grandfathered in this file". This local rule reads the checked-in
 * baseline and reports each `TSAnyKeyword` beyond the recorded count for that
 * file, so the existing offenders are tolerated while the total may only
 * decrease. Files absent from the baseline are covered by the official rule at
 * `error` (see eslint.config.js).
 *
 * The visitor key `TSAnyKeyword` is the AST node emitted by the typescript-eslint
 * parser, which the flat config supplies for all linted files.
 */
const baseline = require('../no-explicit-any-ratchet.json');

const CLIENT_PREFIX = 'atlas-client/';

function relativeClientPath(filename) {
	const normalized = String(filename).replace(/\\/g, '/');
	const index = normalized.indexOf(CLIENT_PREFIX);
	return index >= 0 ? normalized.slice(index) : normalized;
}

module.exports = {
	meta: {
		type: 'problem',
		docs: {
			description: 'Enforce the checked-in per-file no-explicit-any ratchet baseline.',
		},
		schema: [],
		messages: {
			over: '{{file}} has {{seen}} `any` node(s) but the ratchet baseline allows {{allowed}}. Remove the new `any` or lower the baseline; never raise it.',
		},
	},
	create(context) {
		const file = relativeClientPath(context.filename ?? context.getFilename());
		const allowed = Object.prototype.hasOwnProperty.call(baseline.files, file) ? baseline.files[file] : 0;
		let seen = 0;
		return {
			TSAnyKeyword(node) {
				seen += 1;
				if (seen > allowed) {
					context.report({ node, messageId: 'over', data: { file, seen, allowed } });
				}
			},
		};
	},
};
