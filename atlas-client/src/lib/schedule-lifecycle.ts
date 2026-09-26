/**
 * SCHEDULE-LIFECYCLE-C01 — the ONE lifecycle model for a schedule.
 *
 * WHY THIS EXISTS. Four surfaces (dashboard, timetable, teacher portal, public
 * schedule) each decided for themselves what to call a schedule, and a live
 * walk of the deployed release found them disagreeing while every individual
 * sentence was defensible:
 *
 *   /                 "Schedule published" / "Published schedule is live"
 *   /timetable        "Draft"
 *   /my               60 rows badged "Live" beside "Draft schedules may still change."
 *   /public/schedules "PUBLISHED TIMETABLE" / "Live publish" / "TERM 1"
 *
 * The underlying facts were a published run 317 (revision 43, 2026-09-22) AND a
 * newer completed run 318 (2026-09-25) awaiting publication. Each surface showed
 * one half; none named the other. The teacher portal's badge was the sharpest
 * case: it was not false, because those rows *are* published, but it was
 * **unattributed** — it never said which schedule, which revision, or when —
 * so with a newer draft pending, a teacher could not tell published from draft.
 *
 * THE RULE THIS ENCODES: **a draft is never Live.** "Live" is a property of a
 * publication event, so it may only be derived from a publication that has a real
 * publication timestamp. A generated run of any status is a *draft*.
 *
 * This module is pure and derives from FACTS ONLY. It never inspects a row's
 * existence to conclude publication, and when the facts are insufficient it
 * returns UNVERIFIED so the caller states the uncertainty rather than asserting a
 * completed publication.
 *
 * The term a published revision represents is a fact ABOUT THAT REVISION
 * (`source.termIndex` / `termScope`), independent of which term is currently
 * active. That separation is deliberate: a surface stating the term of a
 * published revision is not thereby claiming that revision is the current term.
 */

export type ScheduleLifecycleKind =
	| 'UNVERIFIED'
	| 'NO_PUBLISHED_SCHEDULE'
	| 'DRAFT_ONLY'
	| 'PUBLISHED_ONLY'
	| 'PUBLISHED_WITH_NEWER_DRAFT';

export type PublicationFacts = {
	/** The generation run that was published. */
	runId: number;
	/** ISO timestamp of the publication event. Required — without it nothing is Live. */
	publishedAt: string;
	revisionId?: number | null;
	/** The term THIS published revision represents. */
	termIndex?: number | null;
	termLabel?: string | null;
	/** True only when the source verified the term it reports. */
	termVerified?: boolean;
};

export type DraftFacts = {
	runId: number;
	/** ISO timestamp the run finished, when known. */
	finishedAt?: string | null;
	status?: string | null;
	hardViolationCount?: number | null;
};

export type ScheduleLifecycle =
	| { kind: 'UNVERIFIED'; reason: 'NO_PUBLICATION_FACTS' | 'TERM_UNVERIFIED' }
	| { kind: 'NO_PUBLISHED_SCHEDULE'; publication: null; draft: DraftFacts | null }
	| { kind: 'DRAFT_ONLY'; publication: null; draft: DraftFacts }
	| { kind: 'PUBLISHED_ONLY'; publication: PublicationFacts; draft: null }
	| { kind: 'PUBLISHED_WITH_NEWER_DRAFT'; publication: PublicationFacts; draft: DraftFacts };

export type LifecycleInput = {
	publication?: Partial<PublicationFacts> | null;
	draft?: Partial<DraftFacts> | null;
};

function hasRealPublication(pub: Partial<PublicationFacts> | null | undefined): pub is PublicationFacts {
	return !!pub
		&& typeof pub.runId === 'number'
		&& typeof pub.publishedAt === 'string'
		&& pub.publishedAt.trim().length > 0;
}

function toDraft(draft: Partial<DraftFacts> | null | undefined): DraftFacts | null {
	if (!draft || typeof draft.runId !== 'number') return null;
	return {
		runId: draft.runId,
		finishedAt: draft.finishedAt ?? null,
		status: draft.status ?? null,
		hardViolationCount: typeof draft.hardViolationCount === 'number' ? draft.hardViolationCount : null,
	};
}

/**
 * Derive the lifecycle from facts.
 *
 * "Newer draft" means a draft whose publication-relevant identity differs from the
 * published run: a different run id. A draft that IS the published run is the
 * same schedule, not a newer one, and must not be described as awaiting
 * publication.
 */
export function deriveScheduleLifecycle(input: LifecycleInput): ScheduleLifecycle {
	const draft = toDraft(input.draft);

	if (!hasRealPublication(input.publication)) {
		// No publication event. A draft may still exist, and it is a draft.
		if (!draft) return { kind: 'UNVERIFIED', reason: 'NO_PUBLICATION_FACTS' };
		return { kind: 'DRAFT_ONLY', publication: null, draft };
	}

	const publication: PublicationFacts = {
		runId: input.publication.runId,
		publishedAt: input.publication.publishedAt,
		revisionId: input.publication.revisionId ?? null,
		termIndex: input.publication.termIndex ?? null,
		termLabel: input.publication.termLabel ?? null,
		termVerified: input.publication.termVerified === true,
	};

	// The publication is real, but the term it represents could not be verified.
	// Say so rather than printing an unverified term next to a real publication.
	if (publication.termIndex != null && !publication.termVerified) {
		return { kind: 'UNVERIFIED', reason: 'TERM_UNVERIFIED' };
	}

	if (!draft || draft.runId === publication.runId) {
		return { kind: 'PUBLISHED_ONLY', publication, draft: null };
	}
	return { kind: 'PUBLISHED_WITH_NEWER_DRAFT', publication, draft };
}

/** True only for a lifecycle that contains a real publication event. */
export function hasPublication(lifecycle: ScheduleLifecycle): lifecycle is Extract<ScheduleLifecycle, { publication: PublicationFacts }> {
	return lifecycle.kind === 'PUBLISHED_ONLY' || lifecycle.kind === 'PUBLISHED_WITH_NEWER_DRAFT';
}

/** A draft is never Live. This is the single place that decides. */
export function isLive(lifecycle: ScheduleLifecycle): boolean {
	return hasPublication(lifecycle);
}

function formatDay(iso: string): string {
	const parsed = new Date(iso);
	if (Number.isNaN(parsed.getTime())) return iso;
	return parsed.toISOString().slice(0, 10);
}

/**
 * One sentence describing what IS published, with its publication date and the
 * term it represents. Returns null when nothing is published, so a caller can
 * never render an empty "Live" badge.
 */
export function describePublication(lifecycle: ScheduleLifecycle): string | null {
	if (!hasPublication(lifecycle)) return null;
	const { publication } = lifecycle;
	const term = publication.termLabel ?? (publication.termIndex != null ? `term ${publication.termIndex}` : 'term not stated');
	const revision = publication.revisionId != null ? `, revision ${publication.revisionId}` : '';
	return `Published ${formatDay(publication.publishedAt)} (run ${publication.runId}${revision}, ${term})`;
}

/**
 * One sentence describing the newer draft, always labelled a draft. Returns null
 * when there is no separate newer draft.
 */
export function describeNewerDraft(lifecycle: ScheduleLifecycle): string | null {
	if (lifecycle.kind !== 'PUBLISHED_WITH_NEWER_DRAFT') return null;
	const when = lifecycle.draft.finishedAt ? ` on ${formatDay(lifecycle.draft.finishedAt)}` : '';
	const readiness = lifecycle.draft.hardViolationCount === 0
		? 'no blocking issues'
		: lifecycle.draft.hardViolationCount != null
			? `${lifecycle.draft.hardViolationCount} blocking issue(s)`
			: 'review status not stated';
	return `Newer draft awaiting publication: run ${lifecycle.draft.runId}${when} (${readiness})`;
}

/** The one lifecycle sentence, for any surface. Never says "Live" about a draft. */
export function describeLifecycle(lifecycle: ScheduleLifecycle): string {
	if (lifecycle.kind === 'UNVERIFIED') {
		return lifecycle.reason === 'TERM_UNVERIFIED'
			? 'A schedule is published, but the term it represents could not be verified, so the details are not shown.'
			: 'ATLAS could not confirm whether a schedule has been published.';
	}
	const published = describePublication(lifecycle);
	const draft = describeNewerDraft(lifecycle);
	if (published && draft) return `${published}. ${draft}.`;
	if (published) return `${published}.`;
	if (lifecycle.kind === 'NO_PUBLISHED_SCHEDULE') {
		return 'No schedule has been published yet.';
	}
	if (lifecycle.draft) return `Draft only: run ${lifecycle.draft.runId}. Not published.`;
	// Defensive: every kind is handled above, so this is unreachable by
	// construction. It must NOT fall back to any publication wording, because the
	// whole point of this module is that a claim is never made from a row's
	// existence — so an unknown kind reports ignorance rather than a default.
	return 'ATLAS could not confirm whether a schedule has been published.';
}

/**
 * The audience sentence. The handoff requires the visible audience of each page
 * to be part of the model, because "published" means different things to a
 * scheduler and to the public.
 */
export type LifecycleAudience = 'SCHEDULER' | 'TEACHER' | 'PUBLIC';

export function describeForAudience(lifecycle: ScheduleLifecycle, audience: LifecycleAudience): string {
	const base = describeLifecycle(lifecycle);
	if (lifecycle.kind === 'UNVERIFIED') return base;
	if (!hasPublication(lifecycle)) return base;
	const audienceNote: Record<LifecycleAudience, string> = {
		SCHEDULER: 'Visible to schedulers and staff.',
		TEACHER: 'Visible to teachers.',
		PUBLIC: 'Visible to students and families.',
	};
	return `${base} ${audienceNote[audience]}`;
}
