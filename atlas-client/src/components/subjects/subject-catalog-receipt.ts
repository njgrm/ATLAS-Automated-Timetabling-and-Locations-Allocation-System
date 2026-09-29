/**
 * A8-C5 S3 — the saved Subject catalog, and a real receipt of what was served.
 *
 * THE OPERATOR'S WORDS (`a8-c5-generation-always-fixable-2026-09-29.md`, addendum
 * 20:10): a scheduler waiting 20.5 s for `/subjects` thinks it is broken. Show the
 * saved catalog immediately, refresh in the background, and say what was served
 * and when.
 *
 * WHY A MODULE AND NOT MORE PAGE CODE. Three things have to be true at once and
 * none of them is a rendering concern:
 *
 *   1. PAINT BEFORE THE REQUEST. The catalog is read from this cache
 *      SYNCHRONOUSLY, before the network call is issued, so the first paint
 *      already carries rows. A page that shows a skeleton for 20.5 s and then
 *      swaps is the defect, and no amount of copy fixes it.
 *   2. A CACHE MISS IS NOT AN ERROR. With no saved copy there is nothing honest
 *      to paint, so the caller keeps its skeleton. Returning `null` — never a
 *      fabricated empty list — is what stops ATLAS from showing a scheduler an
 *      authoritative-looking table of zero subjects.
 *   3. THE RECEIPT IS A FACT, NOT A FEELING. What was served, how many rows, and
 *      when it was saved are read back out of the SAME record that produced the
 *      rows, so the receipt can never describe a different catalog from the one on
 *      screen.
 *
 * NO NEW AUTHORITY. This is a browser-local copy of data ATLAS already serves to
 * this actor for this school, held in that actor's own `localStorage`. It grants
 * nothing: it is not a cache of a decision, it never satisfies a write, and a
 * read that needs the truth still asks the server. The cache is keyed by the
 * resolved actor school, so one school's catalog can never be painted for
 * another, and a session change (a new school) simply misses and repaints.
 *
 * WHY NOT A SECOND RECEIPT PATTERN. There is exactly one on this surface, and it
 * is `AdminSourceStateChip`'s Popover: a two-part `description` / `nextAction`
 * pair produced by `resolveSubjectSourceCopy` and rendered in the shared
 * `AdminWorkspaceFrame`. This module supplies the FACTS; the receipt sentence is
 * composed by that existing resolver, so a scheduler reads it in the same place
 * they read every other source state on this product.
 */

/** Bumped when the stored shape changes; an unreadable version is a cache miss. */
export const SUBJECT_CATALOG_CACHE_VERSION = 1;

const STORAGE_PREFIX = 'atlas.subject-catalog.v1:';

/** What the page was actually given, and when it was true. */
export type SubjectCatalogReceipt = {
	/** `saved` = the browser copy painted first; `live` = this session's read. */
	source: 'saved' | 'live';
	/** How many rows were served. Never inferred from a filter or a page size. */
	count: number;
	/** ISO-8601. For `saved`, when it was written; for `live`, when it arrived. */
	servedAt: string;
	/**
	 * True while a refresh is still running behind an already-painted catalog.
	 * The operator can keep working, so the page must not claim to be waiting.
	 */
	refreshing: boolean;
};

type StoredCatalog = {
	version: number;
	savedAt: string;
	subjects: unknown[];
};

/** A catalog row as far as this module is concerned: an object with a numeric id. */
function isSubjectRow(value: unknown): boolean {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
		&& typeof (value as { id?: unknown }).id === 'number';
}

function storageKey(schoolId: number): string {
	return `${STORAGE_PREFIX}${schoolId}`;
}

function readStorage(): Storage | null {
	try {
		return typeof localStorage === 'undefined' ? null : localStorage;
	} catch {
		// A browser that refuses storage (private mode, blocked third-party) is a
		// CACHE MISS, not a crash. The page falls back to its skeleton.
		return null;
	}
}

/**
 * The saved catalog for one school, or null when there is nothing honest to
 * paint. Never throws, and never returns a partial or invented list.
 */
export function readSavedSubjectCatalog(schoolId: number | null | undefined): { subjects: unknown[]; savedAt: string } | null {
	if (schoolId == null || !Number.isInteger(schoolId) || schoolId <= 0) return null;
	const storage = readStorage();
	if (!storage) return null;
	let raw: string | null = null;
	try {
		raw = storage.getItem(storageKey(schoolId));
	} catch {
		return null;
	}
	if (!raw) return null;
	try {
		const parsed: unknown = JSON.parse(raw);
		if (typeof parsed !== 'object' || parsed === null) return null;
		const record = parsed as Partial<StoredCatalog>;
		if (record.version !== SUBJECT_CATALOG_CACHE_VERSION) return null;
		if (typeof record.savedAt !== 'string' || Number.isNaN(Date.parse(record.savedAt))) return null;
		if (!Array.isArray(record.subjects)) return null;
		// A stored list that no longer looks like a catalog is discarded rather
		// than half-trusted: a scheduler must never be shown a filtered subset of
		// an older catalog as though it were the whole one.
		if (!record.subjects.every(isSubjectRow)) return null;
		return { subjects: record.subjects, savedAt: record.savedAt };
	} catch {
		// Corrupt JSON is a cache miss, not an error state for the page.
		return null;
	}
}

/**
 * Record a live read as the new saved catalog. Returns the receipt so the caller
 * and the stored copy cannot disagree about when this happened.
 *
 * A storage failure is swallowed deliberately: the operator has their data either
 * way, and a full quota must not turn a successful read into an error page.
 */
export function writeSavedSubjectCatalog(
	schoolId: number | null | undefined,
	subjects: unknown[],
	now: Date = new Date(),
): SubjectCatalogReceipt {
	const servedAt = now.toISOString();
	if (schoolId != null && Number.isInteger(schoolId) && schoolId > 0 && Array.isArray(subjects)) {
		const storage = readStorage();
		if (storage) {
			const record: StoredCatalog = { version: SUBJECT_CATALOG_CACHE_VERSION, savedAt: servedAt, subjects };
			try {
				storage.setItem(storageKey(schoolId), JSON.stringify(record));
			} catch {
				// Quota or a blocked store. The live read still stands.
			}
		}
	}
	return { source: 'live', count: Array.isArray(subjects) ? subjects.length : 0, servedAt, refreshing: false };
}

/** The receipt for a catalog painted from the browser copy, still being refreshed. */
export function savedCatalogReceipt(count: number, savedAt: string, refreshing = true): SubjectCatalogReceipt {
	return { source: 'saved', count, servedAt: savedAt, refreshing };
}

/**
 * Month abbreviations are written out rather than taken from
 * `toLocaleString('en-GB', { month: 'short' })`, which returns "Sept" for
 * September in some ICU builds and "Sep" in others. A receipt that renders
 * differently depending on the machine it was read on cannot be asserted, and
 * this string is part of a test.
 */
const MONTH_ABBREVIATIONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** `14:32` today, or `29 Sep 14:32` when it is not today. Authored, never sliced. */
export function formatCatalogServedAt(iso: string, now: Date = new Date()): string {
	const when = new Date(iso);
	if (Number.isNaN(when.getTime())) return 'an unknown time';
	const time = `${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`;
	const sameDay = when.getFullYear() === now.getFullYear()
		&& when.getMonth() === now.getMonth()
		&& when.getDate() === now.getDate();
	if (sameDay) return `${time} today`;
	return `${when.getDate()} ${MONTH_ABBREVIATIONS[when.getMonth()]}, ${time}`;
}
