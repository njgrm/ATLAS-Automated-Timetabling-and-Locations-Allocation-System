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

/* ────────────────────────────────────────────────────────────────────────────
 * A2-UX-COPY-C2 (#59 / #17) — a drift verdict must be about the run on screen.
 *
 * THE DEFECT. "Schedule information changed. Regenerate to apply" is a claim
 * about a run: it says the setup this run was built from is no longer the setup
 * you have. It cannot be true of a run that was generated seconds ago, and it was
 * able to appear on one. The drift surface resolves `status` from
 * `GenerationInputComparison` alone, and that comparison is a CACHED value: the
 * run-data cache can hold one for its TTL, and a comparison taken BEFORE a run
 * existed still satisfies `status: 'STALE'`. A scheduler generated a draft, the
 * banner immediately said the setup had changed, and the only way to clear it was
 * to regenerate — for a difference the comparison had measured against a run that
 * did not yet exist.
 *
 * THE RULE. A comparison may only speak about a run if it was made AT OR AFTER
 * that run finished. `checkedAt` before the run's own `finishedAt`/`createdAt`
 * means the comparison describes a different, earlier state, and its verdict is
 * not evidence about this run.
 *
 * WHEN THE FACTS ARE INSUFFICIENT the verdict is NOT TRUSTWORTHY, and the caller
 * is told so rather than shown a drift claim it cannot support. That is this
 * module's standing rule, applied to freshness for the first time: ignorance is
 * reported, never resolved in favour of a confident sentence.
 *
 * ADDITIVE: nothing above this block changed, and `RunFreshnessVerdict` is a new
 * type, so every existing caller and test of this module is untouched.
 * ──────────────────────────────────────────────────────────────────────────── */

export type RunInputFreshnessStatus = 'FRESH' | 'STALE' | 'UNKNOWN';

export type RunFreshnessFacts = {
	/** ISO time the run finished generating. Preferred over `runCreatedAt`. */
	runFinishedAt?: string | null;
	/** ISO time the run was created, used when the finish time is unknown. */
	runCreatedAt?: string | null;
	/** ISO time the server compared this run's inputs with the live setup. */
	checkedAt?: string | null;
	/** The comparison's own verdict, exactly as the server sent it. */
	status?: RunInputFreshnessStatus | string | null;
};

export type RunFreshnessVerdict =
	| { trustworthy: true; status: RunInputFreshnessStatus; checkedAt: string; runFinishedAt: string | null }
	| {
			trustworthy: false;
			reason: 'NO_COMPARISON' | 'UNTIMED_COMPARISON' | 'COMPARISON_PREDATES_RUN';
			status: RunInputFreshnessStatus | null;
	  };

function parseIso(value: string | null | undefined): number | null {
	if (typeof value !== 'string' || value.trim().length === 0) return null;
	const parsed = new Date(value).getTime();
	return Number.isNaN(parsed) ? null : parsed;
}

function asFreshnessStatus(value: string | null | undefined): RunInputFreshnessStatus | null {
	return value === 'FRESH' || value === 'STALE' || value === 'UNKNOWN' ? value : null;
}

/**
 * #59 / #17 — may this comparison's verdict be shown as drift for this run?
 *
 * `trustworthy` is false whenever the comparison cannot be tied to the run on
 * screen. Every false case names WHY, so a caller can say something honest rather
 * than silently suppressing a real warning.
 */
export function deriveRunFreshness(facts: RunFreshnessFacts): RunFreshnessVerdict {
	const status = asFreshnessStatus(facts.status);
	if (status === null) {
		return { trustworthy: false, reason: facts.status == null ? 'NO_COMPARISON' : 'UNTIMED_COMPARISON', status: null };
	}
	const checkedAt = parseIso(facts.checkedAt);
	if (checkedAt === null) {
		return { trustworthy: false, reason: 'UNTIMED_COMPARISON', status };
	}
	// The run's own end time; `finishedAt` when known, else its creation.
	const runFinishedAt = parseIso(facts.runFinishedAt) ?? parseIso(facts.runCreatedAt);
	if (runFinishedAt === null) {
		// No run timestamp to compare against. The verdict cannot be proven wrong,
		// so it is kept — refusing every untimed run would hide real drift on a
		// surface that has not started recording finish times.
		return { trustworthy: true, status, checkedAt: facts.checkedAt as string, runFinishedAt: null };
	}
	if (checkedAt < runFinishedAt) {
		return { trustworthy: false, reason: 'COMPARISON_PREDATES_RUN', status };
	}
	return { trustworthy: true, status, checkedAt: facts.checkedAt as string, runFinishedAt: new Date(runFinishedAt).toISOString() };
}

/**
 * The one honest sentence for an untrustworthy comparison. `null` when the
 * verdict may be shown, so a caller has a single place to decide between "print
 * the drift claim" and "print this instead" — and cannot print both.
 */
export function runFreshnessUnverifiedSentence(verdict: RunFreshnessVerdict): string | null {
	if (verdict.trustworthy) return null;
	switch (verdict.reason) {
		// A2-UX-STATUS-C2 correction B7: these two cases got ONE sentence that said
		// "ATLAS has not re-checked this schedule", which contradicts the payload it
		// came from. A STALE comparison with no `checkedAt` is a check the SERVER
		// DID run and DID report drift on; only its moment is unusable, so the note
		// now names that actual condition instead of denying the check. The predicate
		// is untouched: an un-timed comparison still raises no alarm (it cannot be
		// tied to the run on screen), a comparison stamped after the run finished
		// still raises the real drift alarm, and real drift is never hidden.
		case 'UNTIMED_COMPARISON':
		case 'COMPARISON_PREDATES_RUN':
			return 'This check is not timed to the schedule on screen, so it may not apply to it.';
		// `NO_COMPARISON` is the one case where the claim IS true: the server sent no
		// verdict at all, so there is no check to report.
		case 'NO_COMPARISON':
		default:
			return 'ATLAS has not checked this schedule against your latest setup data.';
	}
}

/**
 * The drift claim itself, in one place, so the banner's title and its body can
 * never disagree. `null` when the comparison is not trustworthy about this run —
 * this is the guard that makes "Regenerate to apply" impossible to show on a run
 * that was generated seconds ago.
 */
export function runDriftClaimSentence(verdict: RunFreshnessVerdict): string | null {
	if (!verdict.trustworthy || verdict.status !== 'STALE') return null;
	return 'Schedule information changed. Regenerate to apply';
}
