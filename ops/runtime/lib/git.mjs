import { execFileSync } from 'node:child_process';

/**
 * Injected-git resolver semantics for the runtime pin contract.
 *
 * The reviewed `productPin` is an ANCESTOR (a reviewed milestone) of the exact
 * installed release. A commit can never contain its own SHA, so requiring
 * equality between the deployed HEAD and a commit that also contains the
 * supervisor source is unsatisfiable. These helpers model:
 *
 * - `resolveHead(sourceDir)`  -> `git -C <dir> rev-parse HEAD`
 * - `isAncestor(pin, head, sourceDir)` -> `git -C <dir> merge-base --is-ancestor <pin> <head>`
 *
 * Tests inject their own functions; the real-path control uses these against a
 * temporary real git repository.
 */
export function defaultResolveHead(sourceDir) {
	return execFileSync('git', ['-C', sourceDir, 'rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).trim();
}

export function defaultIsAncestor(productPin, head, sourceDir) {
	try {
		execFileSync('git', ['-C', sourceDir, 'merge-base', '--is-ancestor', productPin, head], { stdio: 'ignore', windowsHide: true });
		return true;
	} catch {
		// Non-zero exit means "not an ancestor"; a missing git binary also fails
		// closed here rather than silently accepting the tree.
		return false;
	}
}
