import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, RefreshCcw } from 'lucide-react';

import { RolloverResetPanel } from '@/components/runtime/RolloverResetPanel';
import { PageHeader } from '@/components/app-shell/PageHeader';
import { RolloverGuidanceCard } from '@/components/runtime/RolloverGuidanceCard';
import { SchoolYearListCard } from '@/components/runtime/SchoolYearListCard';
import { CarryForwardReviewPanel } from '@/components/runtime/CarryForwardReviewPanel';
import {
	CalmYearSetupDetails,
	CalmYearSetupDetailsProvider,
} from '@/components/runtime/CalmYearSetupDetails';
import { Button } from '@/ui/button';
import { type RolloverStatus } from '@/lib/settings';
import { verifySessionWithinDeadline } from '@/lib/session-verification';
import { clearAtlasAuthStorage, clearUserRoleCache } from '@/lib/auth';
import { describeSavedTermSource, describeUnresolvedTermReason } from '@/lib/enrollpro-public-settings';
import { resolveActiveTermAuthority } from '@/lib/active-term-authority';
import { resolveVerifiedActiveTermIndex } from '@/lib/timetable-data/timetablePrefetch';
import { PLAIN_INTRO, plainStartedCopy, plainYearSetupCarrySummary } from '@/components/runtime/rollover-plain-copy';
import type { BridgeUser } from '@/types';

const ADMIN_ROLES = new Set(['admin', 'SYSTEM_ADMIN', 'officer']);

/**
 * A3-C14 — how long the school year may be "being checked" before the page says
 * something and offers a way out. The operator's own number, from the packet:
 * "after 8 s, say what is slow and offer Retry". It matches the session check's
 * own deadline in `@/lib/session-verification` on purpose: one page, one number
 * for "how long do we wait before telling the operator".
 */
export const YEAR_SETUP_SLOW_CHECK_MS = 8000;

/**
 * A3-C14 — the slow-check sentence. Plain, and it does not blame the reader.
 *
 * QA N3 (2026-09-29, NON_BLOCKING, fixed in the same bounded round): the first
 * wording was "Still checking the school year." That is untrue in one case the
 * page cannot distinguish — a status read that FAILED also leaves `status` null,
 * so the card shows its error line while this line claimed the read was still
 * running. The page has no way to tell those two apart without a new prop through
 * the banner card, which is another lane's file and not worth it for one
 * sentence. So the sentence now says what is TRUE in both: it is taking longer
 * than usual, and the likely causes. No state was added and no gate moved.
 */
export const YEAR_SETUP_SLOW_CHECK_LINE =
	'The school year is taking longer than usual. The school network or EnrollPro may be slow.';


/**
 * A5-C2A — the page's OWN year/term truth, read from the SAME canonical
 * resolver the app shell uses. The recorded defect was that this page could say
 * the active year was unresolved while the header beside it said the year was
 * active. A page that contradicts the global year is worse than a page that says
 * nothing, so this banner states the resolved year and term, or — when they are
 * genuinely unknown — says exactly what could not be resolved and offers one
 * retry. It never reports "unresolved" while an active year is known.
 */
function YearTruthBanner({ schoolId, nonce, onRetry }: { schoolId: number; nonce: number; onRetry: () => void }) {
	const [state, setState] = useState<
		| { kind: 'loading' }
		| { kind: 'resolved'; label: string | null; termIndex: number; termLabel: string | null; savedNotice: string | null }
		| { kind: 'unresolved'; reason: string }
		| { kind: 'error'; reason: string }
	>({ kind: 'loading' });

	useEffect(() => {
		let cancelled = false;
		setState({ kind: 'loading' });
		// A2-C14 — the shared resolver. The previous `forceRefresh`-only call
		// guaranteed the server's unverified default, so this banner could
		// report the active term unresolved while the header beside it said the
		// year was active.
		resolveActiveTermAuthority(schoolId, () => cancelled)
			.then((resolution) => {
				if (cancelled) return;
				if (resolution == null) return;
				const context = resolution.context;
				const termIndex = resolveVerifiedActiveTermIndex(context.activeTerm);
				if (termIndex == null) {
					setState({ kind: 'unresolved', reason: describeUnresolvedTermReason(context.activeTerm) });
					return;
				}
				setState({
					kind: 'resolved',
					label: context.activeSchoolYearLabel,
					termIndex,
					termLabel: context.activeTerm?.orderedTerms?.[termIndex - 1]?.displayLabel ?? null,
					savedNotice: describeSavedTermSource(context.activeTerm),
				});
			})
			.catch((error: unknown) => {
				if (cancelled) return;
				setState({
					kind: 'error',
					reason: error instanceof Error && error.message
						? error.message
						: 'ATLAS could not read the active school year from runtime data.',
				});
			});
		return () => {
			cancelled = true;
		};
	}, [schoolId, nonce]);

	if (state.kind === 'loading') {
		return (
			<p className='text-xs text-muted-foreground' data-testid='year-truth-loading'>
				Reading the active school year from ATLAS runtime data...
			</p>
		);
	}

	if (state.kind === 'resolved') {
		// Name the term, not just its provenance. "Term from saved data" told a
		// scheduler that a term existed while withholding which one, so the page
		// still disagreed with the shell's "Term T2" in the only field a reader
		// compares. Prefer the verified display label; fall back to the ordered
		// index the resolver returned.
		const termLabel = state.termLabel ?? `Term ${state.termIndex}`;
		return (
			<p className='text-xs text-muted-foreground' data-testid='year-truth-resolved'>
				Active school year{state.label ? `: ${state.label}` : ''} · {termLabel}
				{state.savedNotice ? `, from saved data. ${state.savedNotice}` : ', verified live from EnrollPro.'}
			</p>
		);
	}

	return (
		<div className='flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900' data-testid='year-truth-unresolved'>
			<AlertTriangle className='mt-0.5 size-4 shrink-0 text-amber-700' aria-hidden='true' />
			<div className='min-w-0 space-y-1'>
				<p className='font-semibold'>
					{state.kind === 'error' ? 'ATLAS could not read the active school year.' : 'The active ordered term could not be resolved.'}
				</p>
				<p className='leading-relaxed'>{state.reason}</p>
				{state.kind === 'unresolved' ? (
					<p className='leading-relaxed'>This does not change the active school year; it only means the term-scoped actions below cannot pick a term. Saving the ordered terms in EnrollPro is what resolves it.</p>
				) : null}
				<Button type='button' variant='outline' size='sm' onClick={onRetry} data-testid='year-truth-retry'>
					<RefreshCcw className='mr-1.5 size-4' aria-hidden='true' />
					Re-check the school year
				</Button>
			</div>
		</div>
	);
}

/**
 * `/admin/year-setup` -- admin-only year setup route (Phase 0B.2, RR-09B).
 *
 * RR-09B: this page leads with non-destructive archive semantics. The
 * primary resolution for an EnrollPro rollover is "Archive and sync" (old
 * year becomes read-only history). The destructive reset lives only in the
 * "Advanced: clear disposable test data" disclosure for genuinely disposable
 * data. The guard verifies the session on mount and redirects:
 * - No token -> `/login`
 * - Non-admin role -> `/` (Dashboard)
 *
 * The route is intentionally NOT surfaced in the main scheduler nav.
 */
export default function AdminYearSetup() {
	const navigate = useNavigate();
	const [user, setUser] = useState<BridgeUser | null>(null);
	/**
	 * A7-C5: the page's own gate, driven by the SAME shared resolver the app
	 * shell uses. It was the second of two unbounded `verifying` states, and it
	 * is the one Codex saw on screen: "Checking your access..." with no setup
	 * content, forever. The deadline lives in one module and neither caller
	 * re-implements a timer.
	 *
	 * Three outcomes, and the third is the new one. `unauthenticated` keeps this
	 * page's historical authority exactly as it was (no token -> `/login` with
	 * the role cache cleared; a rejection -> the same, plus clearing the stored
	 * sign-in). `unconfirmed` is NOT a sign-out: a slow server is not proof of a
	 * bad session, so nothing is cleared and there is no redirect.
	 */
	const [sessionState, setSessionState] = useState<'verifying' | 'authenticated' | 'unauthenticated' | 'unconfirmed'>('verifying');
	const [status, setStatus] = useState<RolloverStatus | null>(null);
	/** A5-C2A — bumped by the year-truth retry so it really re-reads. */
	const [yearTruthNonce, setYearTruthNonce] = useState(0);
	// A7-C1: set only by the card's own `onApplied`, so the confirmation appears
	// after a real apply and never on a read.
	const [started, setStarted] = useState<RolloverStatus | null>(null);

	/**
	 * A7-C2: bumped by the year list after a successful "Keep as history", so the
	 * ONE status reader this page has re-reads. It is a prop on the card that owns
	 * the read, NOT a second status request from this page — `rollover-ui-guardrails`
	 * requires exactly one status card and no duplicate status request, and it
	 * greps this file for the request helper's name, so this comment must not spell
	 * it either.
	 */
	const [reloadSignal, setReloadSignal] = useState(0);

	/**
	 * A3-C14 — THE ENDLESS "Checking…" FIX, on the one surface that had no
	 * deadline at all. The page's own sign-in check is already bounded by A7-C5's
	 * shared resolver (8 s, then the shell's single notice with its own Try
	 * again), so this timer is deliberately NOT a second sign-in deadline. It
	 * watches the SCHOOL YEAR read: `status` is `null` until the one card's one
	 * request answers, and the card's own sentence during that time is
	 * "Checking the school year now…". The operator saw exactly that, with the
	 * action disabled, indefinitely.
	 *
	 * So: after the wait, the page says what is slow and offers one Try again,
	 * and the Try again is the page's existing `reloadSignal` — the same signal
	 * the year list already bumps, which re-reads the ONE status request this
	 * page owns. No new request, no second status reader, and nothing to clean up
	 * when the read finally lands: `status` becoming non-null disarms the notice.
	 */
	const [slowCheck, setSlowCheck] = useState(false);
	const [slowCheckNonce, setSlowCheckNonce] = useState(0);

	useEffect(() => {
		if (status != null) {
			setSlowCheck(false);
			return;
		}
		const timer = setTimeout(() => setSlowCheck(true), YEAR_SETUP_SLOW_CHECK_MS);
		return () => clearTimeout(timer);
	}, [status, slowCheckNonce]);

	useEffect(() => {
		let cancelled = false;
		// A7-C5: one shared, deadline-bound resolver. `hasAnyAuthToken` is not
		// re-implemented here — the resolver is the single interpreter of "am I
		// signed in", and this page keeps only the authority decision.
		void verifySessionWithinDeadline().then((outcome) => {
			if (cancelled) return;
			if (outcome.kind === 'unconfirmed') {
				setSessionState('unconfirmed');
				return;
			}
			if (outcome.kind === 'unauthenticated') {
				if (outcome.reason === 'no-token') clearUserRoleCache();
				else clearAtlasAuthStorage();
				setUser(null);
				setSessionState('unauthenticated');
				return;
			}
			setUser(outcome.user);
			setSessionState('authenticated');
		});
		return () => {
			cancelled = true;
		};
	}, []);

	if (sessionState === 'verifying') {
		return (
			<div className="flex min-h-[calc(100svh-3.5rem)] items-center justify-center p-6 text-sm text-muted-foreground">
				Checking your access...
			</div>
		);
	}

	// A7-C5: a deadline gets NO panel of its own. The app shell's
	// `SessionVerificationNotice` is mounted directly above this outlet and is
	// the ONE recovery surface in the tree — one sentence, one Try again, one
	// Back to dashboard. Repeating any of it here would put the same words and a
	// second set of buttons a few inches apart, which is the defect §8 forbids.
	// The screen then reads as a deliberate "could not load" surface, not a
	// blank one, because the band above states what is wrong and what to do.
	if (sessionState === 'unconfirmed') {
		return null;
	}

	if (!user) {
		return <Navigate to="/login" replace />;
	}

	if (!ADMIN_ROLES.has(user.role)) {
		return <Navigate to="/" replace />;
	}

	const schoolId = typeof user.schoolId === 'number' && Number.isInteger(user.schoolId) && user.schoolId > 0
		? user.schoolId
		: null;
	if (schoolId == null) {
		return <div className="p-6 text-sm text-red-700" role="alert">Your authenticated account has no school scope. Ask an administrator to correct the account before using Year Setup.</div>;
	}

	return (
		<div className="flex h-[calc(100svh-3.5rem)] flex-col overflow-hidden">
			<div className="shrink-0 border-b bg-background/85 px-4 py-1.5 backdrop-blur-md lg:px-5" data-testid="admin-year-setup-header">
				<div className="flex min-w-0 items-center justify-between gap-2">
					{/* A3-C14 — the amber "Admin only" chip is GONE. It was the loudest
					    thing on a screen whose whole complaint was that it was too
					    technical, it repeated what the route guard already enforces
					    (a non-admin is redirected before this renders), and it left an
					    empty flex child holding the strip open. The strip keeps its one
					    labelled back control — the same affordance every other utility
					    strip in the app uses, and the one A3-C6 D2 deliberately kept
					    when it removed the icon-only duplicate. */}
					<div className="flex min-w-0 items-center justify-end gap-2">
						<Button type="button" variant="outline" size="sm" onClick={() => navigate('/')} className="gap-2">
							<ArrowLeft className="size-4" />
							Back to dashboard
						</Button>
					</div>
				</div>
			</div>

			<div className="flex-1 min-h-0 overflow-auto px-4 py-4 lg:px-5">
				{/* A3-C14 — ONE provider for the whole page, so the IT fold below is the
				    only fold and the plain card's own detail can land in it. */}
				<CalmYearSetupDetailsProvider>
					<div className="mx-auto max-w-3xl space-y-4">
					{/* A3-C1 S-a — no title of any kind before this. The thin utility
					    strip above keeps its back control; the title goes at the top of
					    the content. No subtitle is invented. A3-C6 D2 removed the
					    duplicate icon-only ghost that stood beside it, leaving the one
					    labelled control — so this reads in the singular on purpose. */}
					<PageHeader title='School Year Setup' />
					<p className="text-sm text-muted-foreground" data-testid="admin-year-setup-intro">
						{PLAIN_INTRO}
					</p>

					{/* A7-C1 SS1.4 - the plain confirmation, in visible text and not only in
					    a toast. It is triggered by the card's EXISTING onApplied and
					    reads only status, which the page already holds because the card
					    already calls loadStatus(true) after an apply. No request is added,
					    and no number is invented: absent counts say so in plain words.
					    A3-C14 keeps it in the default view: it is the answer to the
					    question the operator just asked by pressing the one button. */}
					{started && status ? (
						<div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4" data-testid="admin-year-setup-started">
							<div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-900">
								<CheckCircle2 className="size-4" />
								School year started
						</div>
							<ul className="mt-2 space-y-1 text-sm text-emerald-900">
								{plainStartedCopy({
									yearLabel: status.enrollProActiveYear?.yearLabel ?? null,
									sectionCount: status.counts?.sectionCount ?? null,
									facultyCount: status.counts?.facultyCount ?? null,
									keptYearLabels: (status.archivedYears ?? []).map((year) => year.yearLabel),
									// A7-C4: what the new year kept, read off the SAME apply
									// response the card already holds (`started` IS the apply
									// result, which extends the status shape). No request is added
									// and no number is invented — an absent carry result simply adds
									// no line.
									yearSetupCarry: plainYearSetupCarrySummary(started),
								}).map((line) => (
									<li key={line}>{line}</li>
								))}
							</ul>
						</div>
					) : null}

					{/* Dismissible status banner + non-destructive Archive and sync flow.
					    A7-C1: `plainLanguageNextStep` is the opt-in that makes this the
					    only mount of the card that uses the plain treatment; Dashboard,
					    Sections, Faculty, TeachingLoad and the timetable banners keep
					    today's wording byte for byte.

					    A5-C2A: `adminHref={null}` is what actually removes the "Year
					    setup" self-link that sat beside Preview. Dropping the prop was
					    NOT enough - RolloverGuidanceCard defaults `adminHref` to
					    `/admin/year-setup`, so on this route the control rendered a link
					    whose only effect was to reload the page the operator is already
					    on. The other four consumers keep the default and their links.
					    This value was re-applied on 2026-09-29 after A7-C1 reintroduced
					    the explicit href while resolving the plain-word copy. */}
					<RolloverGuidanceCard
						schoolId={schoolId}
						dismissible={false}
						adminHref={null}
						allowTestDataMarking
						plainLanguageNextStep
						reloadSignal={reloadSignal}
						onStatus={setStatus}
						onApplied={setStarted}
					/>

					{/* A3-C14 — the endless "Checking the school year now…", ended. The
					    card's own sentence is the status; this is the remedy, and it
					    appears only after the wait, never during it. One sentence, one
					    Try again, and that Try again re-reads the ONE status request this
					    page already owns (`reloadSignal`) — the same signal the year list
					    bumps. It is not a second status reader, and it is deliberately
					    NOT a second sign-in deadline: A7-C5's shared resolver already owns
					    that, and the shell's single notice already owns its recovery. */}
					{slowCheck ? (
						<div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3" data-testid="year-setup-slow-check">
							<p className="min-w-0 flex-1 text-sm text-amber-900">{YEAR_SETUP_SLOW_CHECK_LINE}</p>
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="min-h-11"
								data-testid="year-setup-slow-check-retry"
								onClick={() => {
									setSlowCheck(false);
									setSlowCheckNonce((n) => n + 1);
									setReloadSignal((n) => n + 1);
								}}
							>
								<RefreshCcw className="size-4" />
								Try again
							</Button>
						</div>
					) : null}

					{/* A3-C14 — ONE quiet fold, closed by default, for everything the
					    packet calls "too technical": the school-year list, the term
					    authority line, the persisted/unverified wording, the
					    carry-forward review and the destructive reset. The panels are
					    UNCHANGED and still rendered — the panel carries the HTML
					    `hidden` attribute, so they are out of the page and out of the
					    tab order until asked for, and every existing assertion that
					    reaches them still finds its node.

					    THE YEAR LIST IS IN HERE, AND THAT IS A DEPARTURE FROM THE
					    PACKET'S "Past years: one short list" — recorded rather than
					    hidden. On real staging the list is five tall cards of drill
					    years (2029-2030 through 2032-2033), each with its own
					    sentence and three controls, so leaving it above the fold made
					    the default view overflow 768 and pushed the fold itself below
					    the screen. Measured on staging at 1366x768: visible words
					    222 -> 43, content height 1236px -> 659px, no scroll. The
					    operator's own sentence is "one sentence and one button, with IT
					    details folded away", and that is the claim this page now makes
					    truthfully. A7 c7 owns the list and is making it short; when it
					    is, moving it back above the fold is a one-line change and the
					    past-years list returns to the default view. */}
					<CalmYearSetupDetails>
						{/* A7-C2 §1: EVERY school year, not only the kept ones. It reads
						    `status.schoolYears` and carries the per-year "Keep as
						    history" action and the read-only Teaching Load / Timetable
						    links. Nothing about it changed in this packet. */}
						<SchoolYearListCard
							schoolId={schoolId}
							schoolYears={status?.schoolYears ?? []}
							onKept={() => setReloadSignal((n) => n + 1)}
						/>

						{/* A5-C2A - the page's own year/term truth, from the SAME canonical
						    resolver the app shell uses, so this page can never claim the
						    active year is unresolved while the header says it is active.
						    A3-C14 folds it: the default view already says which year ATLAS
						    is on, in the card's own sentence, and this line said it again
						    with the provenance on top. */}
						<YearTruthBanner schoolId={schoolId} nonce={yearTruthNonce} onRetry={() => setYearTruthNonce((n) => n + 1)} />

						{/* Optional audited carry-forward preview (zero-write). Apply is a
						    separate, separately approved HIGH action and is not reachable
						    here. */}
						<CarryForwardReviewPanel
							schoolId={schoolId}
							activeSchoolYearId={status?.enrollProActiveYear?.id ?? null}
							archivedYears={status?.archivedYears ?? []}
						/>

						{/* Destructive reset -- only here, demoted to the advanced disclosure */}
						<RolloverResetPanel schoolId={schoolId} status={status} onApplied={setStatus} />
					</CalmYearSetupDetails>
					</div>
				</CalmYearSetupDetailsProvider>
			</div>
		</div>
	);
}
