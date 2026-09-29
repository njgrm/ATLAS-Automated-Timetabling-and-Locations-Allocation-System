/**
 * A6 c10 — THE COVER-CLASS CONTRACT, and every decision the window makes, in one
 * pure module with no React and no API client.
 *
 * WHY PURE. Three of the packet's requirements are statements about what a
 * scheduler READS, and none of them is provable by reading a JSX file
 * (AGENTS.md §11: "a test that only asserts source text is not acceptance
 * evidence"). The three are:
 *
 *  1. PLACEHOLDERS ARE NEVER A CANDIDATE. Not last, not greyed — absent. The
 *     operator's words: a to-be-hired fallback must be "an absolute last resort,
 *     when there are no identifiable teachers that can cover a class based on the
 *     scheduler's decision". So the rule is enforced on the ARRAY, before any
 *     grouping, and `groupCoverCandidates` is the only way the window gets its
 *     rows.
 *
 *  2. AN OVER-CAP TEACHER IS SHOWN, NOT HIDDEN. The packet says "Over-cap rows
 *     are shown greyed with the reason, not hidden" while the server's own
 *     wording says "has room". A8 c4 resolved this in the client's favour
 *     (contract §0.1): over-cap rows are IN the list with `overCapAfter: true`,
 *     ranked last inside their tier. So the grey is a per-ROW decision here and
 *     the Assign control is disabled on that row ONLY — a greyed row is still a
 *     row a scheduler can read and learn from.
 *
 *  3. A CROSS-DEPARTMENT TEACHER IS OFFERED, NOT REFUSED. `OTHER_DEPARTMENT` and
 *     `ANYONE` both need a permission to be assigned, and the permission and the
 *     assignment are ONE act from the client's point of view (contract §0.3). So
 *     choosing one is never blocked — it raises the one Allow prompt, and the
 *     retry that answers it writes both. `permissionPrompt` owns that sentence,
 *     and it is assembled from the SERVER's own 409 body rather than from the
 *     candidate row, because the 409 is the authority on who was refused.
 *
 * WHY THE TIER ORDER IS NOT RE-DERIVED HERE. Contract §1 fixes the ranking —
 * tier, then `hasRoom`, then `hoursAfter`, then `name` — and says "do not
 * re-sort". `groupCoverCandidates` therefore PRESERVES the server's order inside
 * each tier and only partitions. Re-sorting client-side would be a second
 * authority on "who is the best candidate", which is precisely the class of
 * defect §11 warns about.
 */
/**
 * A8 c4's contract, `docs/handoffs/lane-c-to-a2.md` §1–§2 (2026-09-29), typed
 * here and ONLY here.
 *
 * The first nine `CoverCandidate` keys are the packet's verbatim list and are
 * non-optional, because A8 c4 guarantees all nine on every row and a field the
 * contract promises must not be typed as maybe-absent — that is how a client
 * grows a fallback for a field the server does send, and two answers to one
 * value. The extras below it are A8 c4's own guarantees for the same reason.
 *
 * `reason` is optional on purpose and is the ONE exception: it is a sentence the
 * server assembles, and an older server (or a tier that needs no explanation)
 * may omit it. `coverCandidateBlockedReason` has a real fallback for it and is
 * the only reader.
 */
export type CoverCandidateTier = 'QUALIFIED' | 'OTHER_DEPARTMENT' | 'ANYONE';

export type CoverCandidate = {
	facultyId: number;
	name: string;
	department: string | null;
	tier: CoverCandidateTier;
	hoursNow: number;
	hoursAfter: number;
	cap: number;
	overCapAfter: boolean;
	reason?: string | null;
	specialization: string;
	isPlaceholder: false;
	hasRoom: boolean;
	needsPermission: boolean;
	permissionGranted: boolean;
	canTeachOutsideDepartment: boolean;
	qualificationAuthority: string | null;
	version: number;
};

export type CoverCandidatesResponse = {
	schoolId: number;
	schoolYearId: number;
	subject: { id: number; code: string; name: string };
	section: { id: number; name: string; displayOrder: number; programType: string | null };
	/** Exact integer minutes this class adds per week. Absent until A8 c4's route is deployed. */
	weeklyMinutes?: number;
	candidates: CoverCandidate[];
	counts: { QUALIFIED: number; OTHER_DEPARTMENT: number; ANYONE: number; total: number };
};

/** Contract §2's typed refusal, which is the data the Allow prompt is built from. */
export type NeedsPermissionBody = {
	code: 'NEEDS_PERMISSION';
	facultyId: number;
	facultyName: string;
	department: string | null;
	subjectId: number;
	subjectCode: string;
	subjectName: string;
	canTeachOutsideDepartment: boolean;
};

export type CoverAssignmentResult = {
	facultyId: number;
	subjectId: number;
	sectionId: number;
	permissionCreated: boolean;
	assignmentVersion: number;
	weeklyMinutes: number;
};

/** The three groups, in the order the packet names them. The last is a fallback, not a tier. */
export type CoverCandidateGroupId = 'QUALIFIED' | 'OTHER_DEPARTMENT' | 'ANYONE';

export type CoverCandidateGroup = {
	id: CoverCandidateGroupId;
	/** The heading, exactly as the packet words it. */
	title: string;
	/** The quiet sub-line under the heading — never a second count of the same thing. */
	hint: string;
	candidates: CoverCandidate[];
};

/** The window's LAST element, and it is a link-button, not a group of people. */
export const COVER_LAST_RESORT_LABEL = 'No one can take this class?  Add a to-be-hired teacher';

const GROUP_COPY: Record<CoverCandidateGroupId, { title: string; hint: string }> = {
	QUALIFIED: {
		title: 'Teachers for this subject',
		hint: 'They are already qualified for it.',
	},
	OTHER_DEPARTMENT: {
		title: 'Teachers from other departments',
		hint: 'They need your permission to teach it once.',
	},
	ANYONE: {
		title: 'Anyone with free hours',
		hint: 'Not qualified for it. They need your permission too.',
	},
};

/**
 * The one place a placeholder is excluded, and it is excluded on the ARRAY.
 *
 * A row whose `isPlaceholder` is true, or whose id is in `placeholderFacultyIds`
 * (the roster's own flag, which is the authority the shortage count already
 * uses), is dropped before the tiers are built. The window therefore CANNOT
 * render one, and there is no ordering that puts one last — a to-be-hired record
 * is not a candidate at all, and the way to add one is the last-resort link.
 */
export function removePlaceholderCandidates(
	candidates: ReadonlyArray<CoverCandidate> | null | undefined,
	placeholderFacultyIds?: ReadonlySet<number>,
): CoverCandidate[] {
	const list = Array.isArray(candidates) ? candidates : [];
	return list.filter((row) => {
		if (!row || typeof row.facultyId !== 'number') return false;
		if (row.isPlaceholder === true) return false;
		if (placeholderFacultyIds?.has(row.facultyId)) return false;
		return true;
	});
}

/**
 * The three groups, in packet order, preserving the server's ranking inside each.
 *
 * A tier with no candidates after the placeholder filter is OMITTED rather than
 * rendered empty: an empty "Anyone with free hours" heading above a quiet
 * last-resort link is noise, and §8's "less on screen" is the whole point. The
 * caller can tell an omitted group from an empty response because
 * `groupCoverCandidates` returns only the groups it actually built.
 */
export function groupCoverCandidates(
	candidates: ReadonlyArray<CoverCandidate> | null | undefined,
	placeholderFacultyIds?: ReadonlySet<number>,
): CoverCandidateGroup[] {
	const real = removePlaceholderCandidates(candidates, placeholderFacultyIds);
	const order: CoverCandidateGroupId[] = ['QUALIFIED', 'OTHER_DEPARTMENT', 'ANYONE'];
	return order
		.map((id) => ({ id, ...GROUP_COPY[id], candidates: real.filter((row) => row.tier === id) }))
		.filter((group) => group.candidates.length > 0);
}

/**
 * `18 h → 22 h of 30 h` — the load consequence, in the order a scheduler reads it.
 *
 * The three numbers are the server's (`hoursNow`, `hoursAfter`, `cap`), never a
 * client recomputation: contract §1 says the capacity maths is not the client's
 * to re-derive, and a client that added the two numbers itself would be able to
 * disagree with the write it is about to make. A missing or non-finite figure
 * DROPS the clause rather than printing `NaN` or `0`.
 *
 * The arrow is a real character, not an ASCII `->`: this is the one place the
 * before/after is visible, and `18 h -> 22 h of 30 h` reads like a shell prompt
 * to the older scheduler the packet is written for.
 */
export function coverCandidateHoursLine(candidate: CoverCandidate): string {
	const now = round1(candidate.hoursNow);
	const after = round1(candidate.hoursAfter);
	const cap = round1(candidate.cap);
	if (now == null || after == null || cap == null) return '';
	return `${formatHours(now)} → ${formatHours(after)} of ${formatHours(cap)}`;
}

function round1(value: unknown): number | null {
	if (typeof value !== 'number' || !Number.isFinite(value)) return null;
	return Math.round(value * 10) / 10;
}

function formatHours(value: number): string {
	return Number.isInteger(value) ? `${value} h` : `${value.toFixed(1)} h`;
}

/** The department, or nothing. `null` is a real answer: a teacher with no department. */
export function coverCandidateDepartment(candidate: CoverCandidate): string | null {
	const label = typeof candidate.department === 'string' ? candidate.department.trim() : '';
	return label === '' ? null : label;
}

/** The row's whole identity line: name, then department or specialisation. */
export function coverCandidateNameLine(candidate: CoverCandidate): { name: string; context: string | null } {
	const name = (typeof candidate.name === 'string' && candidate.name.trim()) || 'Unnamed teacher';
	const department = coverCandidateDepartment(candidate);
	const specialisation = typeof candidate.specialization === 'string' ? candidate.specialization.trim() : '';
	if (department && specialisation) return { name, context: `${department} dept · ${specialisation}` };
	if (department) return { name, context: `${department} dept` };
	if (specialisation) return { name, context: specialisation };
	return { name, context: null };
}

/**
 * The reason a row is greyed, or null when it is not.
 *
 * The server's `reason` is used verbatim when it is present, because it is the
 * authority on why that teacher is in the list at all. The client's own text is
 * the fallback and it NAMES THE OVERRUN, because a greyed row with no readable
 * reason is a row a scheduler cannot act on and therefore ignores.
 */
export function coverCandidateBlockedReason(candidate: CoverCandidate): string | null {
	if (candidate.overCapAfter !== true) return null;
	const server = typeof candidate.reason === 'string' ? candidate.reason.trim() : '';
	if (server !== '') return server;
	const after = round1(candidate.hoursAfter);
	const cap = round1(candidate.cap);
	if (after != null && cap != null) {
		const over = Math.round((after - cap) * 10) / 10;
		return `This would put them ${formatHours(over)} over their ${formatHours(cap)} weekly maximum.`;
	}
	return 'This would put them over their weekly maximum.';
}

/** Whether this row's Assign control is disabled, and if so why. */
export function coverCandidateAssignDisabled(
	candidate: CoverCandidate,
	writeBlockedReason: string | null,
): { disabled: boolean; reason: string | null } {
	if (writeBlockedReason) return { disabled: true, reason: writeBlockedReason };
	const blocked = coverCandidateBlockedReason(candidate);
	if (blocked) return { disabled: true, reason: blocked };
	return { disabled: false, reason: null };
}

export type PermissionPrompt = {
	/** `Allow Maria Reyes to teach MAPEH?` — the question, exactly. */
	question: string;
	/** `She is in Science. She will be allowed to teach MAPEH from now on.` */
	detail: string;
	/** The positive control's label. The packet words it; it is not reworded. */
	confirmLabel: string;
	/** The negative control. Cancel is the safe answer and says so. */
	cancelLabel: string;
};

export const PERMISSION_ALLOW_LABEL = 'Allow and assign';

/**
 * The ONE prompt, assembled from the server's 409 body (contract §2).
 *
 * Every field is the server's — `facultyName`, `department`, `subjectCode` — so
 * the sentence cannot describe a different person than the one the server
 * refused. A missing department degrades to a sentence that still asks, rather
 * than to a broken clause: "Allow Maria Reyes to teach MAPEH?" is a complete
 * question on its own, and the department clause is a courtesy, not the decision.
 */
export function permissionPrompt(details: {
	facultyName?: string | null;
	department?: string | null;
	subjectCode?: string | null;
	subjectName?: string | null;
}): PermissionPrompt {
	const name = (details.facultyName ?? '').trim() || 'This teacher';
	const subject = (details.subjectCode ?? details.subjectName ?? '').trim() || 'this subject';
	const department = (details.department ?? '').trim();
	return {
		question: `Allow ${name} to teach ${subject}?`,
		detail: department
			? `${name} is in ${department}. They will be allowed to teach ${subject} from now on.`
			: `${name} will be allowed to teach ${subject} from now on.`,
		confirmLabel: PERMISSION_ALLOW_LABEL,
		cancelLabel: 'Cancel',
	};
}

/**
 * A candidate's tier, as the ONE word a scheduler can act on.
 *
 * `QUALIFIED` renders no word at all: the group heading already said it, and
 * repeating it on every row is the "two chips that say the same thing" §8
 * forbids. The other two render their department, which is the fact the
 * scheduler is actually being asked to weigh.
 */
export function coverCandidateTierBadge(candidate: CoverCandidate): string | null {
	if (candidate.tier === 'QUALIFIED') return null;
	const department = coverCandidateDepartment(candidate);
	return department ? `${department} dept` : candidate.tier === 'ANYONE' ? 'No subject match' : 'Other department';
}

/**
 * THE COUNTING RULE, one function, so no surface can disagree with another.
 *
 * A class is OPEN when nobody owns it OR a to-be-hired record owns it. The Codex
 * audit's BLOCKING finding was that placeholders were counted as staffed, so
 * "Needs staffing" showed 0 while the header said 72 — two numbers, one screen,
 * no way to reconcile them. `openClassIsUnstaffed` is the one predicate both
 * sides must call, and it takes the holder's identity rather than a boolean
 * already computed by the caller, because the whole defect is a caller passing
 * `heldBy != null` instead of this.
 */
export function openClassIsUnstaffed(holder: {
	facultyId?: number | null;
	isPlaceholder?: boolean | null;
} | null | undefined): boolean {
	if (!holder) return true;
	if (holder.isPlaceholder === true) return true;
	return holder.facultyId == null;
}

/**
 * `unowned + placeholderOwned = total` — the arithmetic the audit could not
 * reconcile, made checkable. Used by the tests and by the coverage count, which
 * is where a placeholder-owned class used to be counted as covered.
 */
export function reconcileOpenClassCounts(input: {
	total: number;
	unowned: number;
	placeholderOwned: number;
}): { reconciled: boolean; open: number } {
	const open = Math.max(0, input.unowned) + Math.max(0, input.placeholderOwned);
	return { reconciled: open === Math.max(0, input.total), open };
}

/**
 * How many of a subject's classes are held by a to-be-hired record.
 *
 * The client's own roster is the authority here (contract §3 is A8 c4's read,
 * and it is not on staging yet), so the shape is deliberately small: the page
 * already fetches `/faculty-assignments/summary` for the coverage detail and
 * this is the same rows with the placeholder flag kept. A subject whose
 * placeholder-held count is zero is FULLY covered, and the page may say so; a
 * subject with any is NOT, and may not — which is exactly the "Full coverage"
 * line the audit called false reassurance.
 */
export function placeholderHeldClassCount(input: {
	subjectId: number;
	rows: ReadonlyArray<{ isPlaceholder: boolean; sectionIds: ReadonlyArray<number> }>;
}): number {
	return input.rows.reduce(
		(total, row) => (row.isPlaceholder ? total + row.sectionIds.length : total),
		0,
	);
}
