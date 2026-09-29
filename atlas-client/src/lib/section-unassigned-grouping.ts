/**
 * A9 c5 (2026-09-30) — the section-details `UNASSIGNED CLASSES` list, grouped by term.
 *
 * Operator (`section.docx` item 2): *"after making it as a modal, notice the unassigned classes.
 * Improve the UI. Maybe do it per term instead of per subject if that is better."* On the operator's
 * screenshot the list was flat — one row per subject, `MAPEH` printed twice (name over code), then
 * `SCIENCE`/`TERM 2`, `SCIENCE`/`TERM 3`, `TLE_ROTATION`/`TERM 2`, `TLE_ROTATION`/`TERM 3` as violet
 * pills, each with `225 min` right-aligned.
 *
 * WHAT THIS MODULE DECIDES, and why it is pure. Both the GROUPING and the one-line subject identity
 * are data transforms, not markup, so putting them here lets a control call them directly and assert
 * the return value — the same split `home-room-review-copy.ts` uses, and for the same `AGENTS.md` §11
 * reason: a source-text assertion is not evidence for a user-facing change. The component keeps only
 * the rendering.
 *
 * TERM ORDER. Rows that carry a rotation term are grouped under `Term N` ascending; the classes that
 * run all year (no rotation term) form one `All year` group, placed last because it is the base case
 * rather than a term. A row whose term cannot be read from either `rotationTermLabel` or
 * `rotationTermRank` degrades to the `All year` group rather than inventing a term — a truthful
 * fallback, never a fabricated `Term 1`.
 */

/** The minimum a row needs for this grouping; `SectionUnassignedExpectedClassRow` satisfies it. */
export type UnassignedTermInput = {
	rotationFamily?: string | null;
	rotationTermLabel?: string | null;
	rotationTermRank?: number | null;
};

/** The heading used for classes that are not tied to a rotation term. */
export const ALL_YEAR_HEADING = 'All year';

/**
 * The term label a row carries, or `null`. Kept here (moved out of the sheet in A9 c5) so the
 * grouping and the rendering read the SAME resolution — a term cannot be `Term 2` in one place and
 * `null` in the other.
 */
export function resolveRotationTermLabel(
	input: { rotationTermLabel?: string | null; rotationTermRank?: number | null },
): string | null {
	const explicitLabel = (input.rotationTermLabel ?? '').trim();
	if (explicitLabel.length > 0) {
		const rankMatch = explicitLabel.match(/(\d+)/);
		if (rankMatch) {
			const parsed = Number(rankMatch[1]);
			if (Number.isInteger(parsed) && parsed > 0) {
				return `Term ${parsed}`;
			}
		}
		return explicitLabel;
	}
	if (
		typeof input.rotationTermRank === 'number' &&
		Number.isInteger(input.rotationTermRank) &&
		input.rotationTermRank > 0
	) {
		return `Term ${input.rotationTermRank}`;
	}
	return null;
}

/**
 * The integer rank of a row's term, for ordering; `null` when the row is not term-bound.
 *
 * The rank comes from the resolved label's digit when there is one (`TERM 3`), and otherwise from
 * the row's own `rotationTermRank` — so a label with no digit (`Second Term`) still sorts into its
 * term rather than dropping to the all-year group.
 */
export function unassignedTermRank(input: UnassignedTermInput): number | null {
	const label = resolveRotationTermLabel(input);
	const match = label?.match(/(\d+)/);
	if (match) {
		const parsed = Number(match[1]);
		if (Number.isInteger(parsed) && parsed > 0) return parsed;
	}
	if (
		typeof input.rotationTermRank === 'number' &&
		Number.isInteger(input.rotationTermRank) &&
		input.rotationTermRank > 0
	) {
		return input.rotationTermRank;
	}
	return null;
}

/**
 * ONE line for a subject's identity, so the operator's `MAPEH` over `MAPEH` duplication is gone.
 *
 * The code is dropped only when it IS the name (case-insensitive exact equality) — the operator's
 * `MAPEH` over `MAPEH`. An abbreviation that merely appears inside a longer name is NOT redundant
 * (`Mathematics` + `MATH` keeps the code), because collapsing on a substring would delete a real
 * code from every subject whose name happens to contain it.
 */
export function subjectIdentityLabel(
	name: string | null | undefined,
	code: string | null | undefined,
): { primary: string; secondary: string | null } {
	const primary = (name ?? '').trim() || (code ?? '').trim();
	const trimmedCode = (code ?? '').trim();
	if (!trimmedCode || !primary) return { primary, secondary: null };
	if (trimmedCode.toLowerCase() === primary.toLowerCase()) return { primary, secondary: null };
	return { primary, secondary: trimmedCode };
}

export type UnassignedTermGroup<T> = {
	/** A stable React key: the term label, or `__all_year__`. */
	key: string;
	/** The rendered heading: `Term N`, or `All year`. */
	heading: string;
	/** The term rank, or `null` for the all-year group (sorted last). */
	rank: number | null;
	rows: T[];
};

/**
 * Group unassigned expected classes by term, term groups ascending, `All year` last.
 *
 * Order inside a group is the input order, so the server's own ordering is preserved.
 */
export function groupUnassignedByTerm<T extends UnassignedTermInput>(
	rows: readonly T[],
): UnassignedTermGroup<T>[] {
	const groups = new Map<string, UnassignedTermGroup<T>>();
	for (const row of rows) {
		const label = resolveRotationTermLabel(row);
		const rank = unassignedTermRank(row);
		const key = label ?? '__all_year__';
		let group = groups.get(key);
		if (!group) {
			group = { key, heading: label ?? ALL_YEAR_HEADING, rank, rows: [] };
			groups.set(key, group);
		}
		if (group.rank == null && rank != null) group.rank = rank;
		group.rows.push(row);
	}
	return [...groups.values()].sort((a, b) => {
		const aRank = a.rank ?? Number.POSITIVE_INFINITY;
		const bRank = b.rank ?? Number.POSITIVE_INFINITY;
		if (aRank !== bRank) return aRank - bRank;
		return a.heading.localeCompare(b.heading);
	});
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * A9 c5 R1 (2026-09-30) — ONE ROW PER ROTATING FAMILY, NO RAW CODES ON SCREEN.
 *
 * The per-term grouping above (`groupUnassignedByTerm`) was the A9 c5 first cut; the
 * operator then asked for the OPPOSITE structure (section.docx item 5): a rotating
 * family is ONE row whose per-term subjects read inline —
 * `Science (rotates): Chemistry T2, Earth Science T3` — and no raw code
 * (`SCI_CHEM`, `TLE_AFA_EXP`, `TLE_ROTATION`) may reach the screen.
 *
 * These functions are what the dialog renders and what the controls call; the old
 * per-term grouping is kept (still true, still tested) but is no longer the production
 * path. `a9-c5-unassigned-grouping.test.ts` marks the superseded rows in place.
 * ═══════════════════════════════════════════════════════════════════════════════ */

/** The minimum a row needs for the family grouping; `SectionUnassignedExpectedClassRow` satisfies it. */
export type UnassignedFamilyInput = UnassignedTermInput & {
	subjectId?: number | null;
	subjectName?: string | null;
	subjectDisplayLabel?: string | null;
	subjectCode?: string | null;
	rotationTermGroupId?: string | null;
	minMinutesPerWeek?: number | null;
};

/** The known family tokens the server emits, mapped to the operator's plain name. */
const FAMILY_NAMES: ReadonlyArray<readonly [RegExp, string]> = [
	[/^SCI/i, 'Science'],
	[/^TLE/i, 'TLE'],
	[/APPLIED[\s_]?CHEM/i, 'Applied Chemistry'],
	[/^STE$/i, 'STE'],
	[/^MAPEH$/i, 'MAPEH'],
	[/^ESP$/i, 'ESP'],
];

/** `SCIENCE` -> `Science`, `TLE_ROTATION` -> `TLE Rotation`, `TLE` -> `TLE`. */
function titleCaseWords(token: string): string {
	return token
		.replace(/[_-]+/g, ' ')
		.split(/\s+/)
		.filter(Boolean)
		.map((word) =>
			word.length <= 3 && word === word.toUpperCase()
				? word
				: word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
		)
		.join(' ');
}

/**
 * A stored family token or a leading subject word, as the operator reads it. Known
 * tokens map to a proper noun (`SCIENCE` -> `Science`); anything else is title-cased
 * with its underscores removed, so no raw code survives.
 */
export function humanizeFamilyToken(token: string | null | undefined): string {
	const trimmed = (token ?? '').trim();
	if (!trimmed) return '';
	for (const [pattern, label] of FAMILY_NAMES) {
		if (pattern.test(trimmed)) return label;
	}
	return titleCaseWords(trimmed);
}

/** The plain family name for a rotating row: `Science`, `TLE`, `Applied Chemistry`. */
export function rotationFamilyPlainName(input: UnassignedFamilyInput): string {
	const nameLeading = (input.subjectName ?? '').trim().split(/\s+/).filter(Boolean)[0] ?? '';
	const displayLeading = (input.subjectDisplayLabel ?? '').trim().split(/\s+/).filter(Boolean)[0] ?? '';
	return (
		humanizeFamilyToken(nameLeading) ||
		humanizeFamilyToken(displayLeading) ||
		humanizeFamilyToken(input.rotationFamily) ||
		humanizeFamilyToken(input.subjectCode) ||
		''
	);
}

/** A raw code token (`SCI_CHEM`, `TLE_AFA_EXP`), which must never reach the screen. */
function looksLikeCodeToken(value: string): boolean {
	return /^[A-Z0-9]+(?:_[A-Z0-9_]+)+$/.test(value.trim());
}

/** The short term the member label carries: `T2`. */
function shortTerm(input: UnassignedTermInput): string | null {
	const rank = unassignedTermRank(input);
	return rank != null ? `T${rank}` : null;
}

/** True when a row belongs to a term-rotating family rather than a plain all-year class. */
export function isRotatingClass(input: UnassignedFamilyInput): boolean {
	return Boolean(input.rotationFamily) || Boolean(input.rotationTermGroupId) || shortTerm(input) != null;
}

/**
 * ONE member's inline label: the plain subject words plus its term — `Chemistry T2`,
 * `Earth Science T3`, `Bread and Pastry T2` — never a raw code. When a rotating row's
 * own name leads with the family word (`Science Chemistry`) that word is dropped
 * against `familyPlainName`; the label never becomes blank (it degrades to the row's
 * own words) and a term is never invented (a non-rotating row gets no suffix).
 */
export function unassignedMemberLabel(
	input: UnassignedFamilyInput,
	familyPlainName?: string | null,
): string {
	const raw =
		(input.subjectName ?? '').trim() ||
		(input.subjectDisplayLabel ?? '').trim() ||
		(input.subjectCode ?? '').trim();
	const words = raw.split(/\s+/).filter(Boolean);
	let label = raw;
	if (words.length >= 2 && familyPlainName) {
		const leading = humanizeFamilyToken(words[0]);
		if (leading && leading.toLowerCase() === familyPlainName.toLowerCase()) {
			const rest = words.slice(1).join(' ');
			if (rest) label = rest;
		}
	}
	if (!label || looksLikeCodeToken(label)) {
		label = titleCaseWords(label || raw || input.subjectCode || '');
	}
	// A9 c2 R2 (2026-09-30): a FULLY BLANK rotating row used to return '', so the
	// family row rendered `Science (rotates): ` with a trailing empty member. Fall
	// back to the family's plain name, which is the only identity such a row
	// truthfully has (the row is unreachable from today's non-null server shape;
	// the guard is here regardless). No term is invented: `term` below comes only
	// from the row's own data.
	if (!label.trim()) {
		label = (familyPlainName ?? '').trim() || rotationFamilyPlainName(input);
	}
	const term = shortTerm(input);
	return (term ? `${label} ${term}` : label).trim();
}

/** The truthful weekly-minutes figure for a group: `225 min`, or `150–225 min`. */
export function unassignedMinutesLabel(
	minutesPerWeek: readonly (number | null | undefined)[],
): string {
	const values = minutesPerWeek.filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
	if (values.length === 0) return '';
	const min = Math.min(...values);
	const max = Math.max(...values);
	return min === max ? `${min} min` : `${min}–${max} min`;
}

export type UnassignedFamilyGroup<T> = {
	/** A stable React key. */
	key: string;
	/** `Science (rotates)` for a family, or the plain subject label for a non-rotating row. */
	heading: string;
	/** The plain family name (no `(rotates)`), or `null` for a non-rotating row. */
	familyName: string | null;
	/** True when this row represents a term-rotating family. */
	rotates: boolean;
	rows: T[];
	/** Each constituent's inline label, in input order: `Chemistry T2`, `Earth Science T3`. */
	members: string[];
	/** The group's truthful `min` figure: `225 min` or `150–225 min`. */
	minutesLabel: string;
};

/**
 * Group unassigned expected classes so a rotating family is ONE row and every other
 * class keeps its own plain row. Rows are keyed by `rotationTermGroupId ?? rotationFamily`
 * and appear in first-appearance (server) order.
 */
export function groupUnassignedByRotationFamily<T extends UnassignedFamilyInput>(
	rows: readonly T[],
): UnassignedFamilyGroup<T>[] {
	const groups: UnassignedFamilyGroup<T>[] = [];
	const familyIndex = new Map<string, number>();

	for (const row of rows) {
		if (!isRotatingClass(row)) {
			const label = unassignedMemberLabel(row, null);
			groups.push({
				key: `plain:${row.subjectId ?? groups.length}`,
				heading: label,
				familyName: null,
				rotates: false,
				rows: [row],
				members: [label],
				minutesLabel: unassignedMinutesLabel([row.minMinutesPerWeek]),
			});
			continue;
		}

		const familyKey = (row.rotationTermGroupId ?? row.rotationFamily ?? `subject:${row.subjectId ?? ''}`).trim();
		const familyName = rotationFamilyPlainName(row);
		let index = familyIndex.get(familyKey);
		if (index == null) {
			index = groups.length;
			familyIndex.set(familyKey, index);
			groups.push({
				key: `family:${familyKey}`,
				heading: `${familyName} (rotates)`,
				familyName,
				rotates: true,
				rows: [],
				members: [],
				minutesLabel: '',
			});
		}
		const group = groups[index];
		group.rows.push(row);
		// A9 c2 R2 (2026-09-30): never emit an EMPTY member label. The function
		// above already falls back to the family's plain name; this is the
		// grouping-side guarantee, so `members` can never carry a dangling ''.
		const memberLabel = unassignedMemberLabel(row, familyName);
		if (memberLabel) group.members.push(memberLabel);
	}

	for (const group of groups) {
		if (group.rotates) {
			group.minutesLabel = unassignedMinutesLabel(group.rows.map((r) => r.minMinutesPerWeek));
		}
	}
	return groups;
}
