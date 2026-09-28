import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AlertTriangle, Archive, ArrowLeft, RefreshCcw, ShieldAlert } from 'lucide-react';

import { RolloverResetPanel } from '@/components/runtime/RolloverResetPanel';
import { PageHeader } from '@/components/app-shell/PageHeader';
import { RolloverGuidanceCard } from '@/components/runtime/RolloverGuidanceCard';
import { CarryForwardReviewPanel } from '@/components/runtime/CarryForwardReviewPanel';
import { Button } from '@/ui/button';
import { verifySessionToken, type RolloverStatus } from '@/lib/settings';
import { clearAtlasAuthStorage, clearUserRoleCache, hasAnyAuthToken } from '@/lib/auth';
import { describeSavedTermSource, describeUnresolvedTermReason, resolveActiveSchoolYearContext } from '@/lib/enrollpro-public-settings';
import { resolveVerifiedActiveTermIndex } from '@/lib/timetable-data/timetablePrefetch';
import type { BridgeUser } from '@/types';

const ADMIN_ROLES = new Set(['admin', 'SYSTEM_ADMIN', 'officer']);

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
		resolveActiveSchoolYearContext({ schoolId, allowStaleOnError: true, allowEnrollProFallback: false, forceRefresh: true })
			.then((context) => {
				if (cancelled) return;
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
	const [verifying, setVerifying] = useState(true);
	const [status, setStatus] = useState<RolloverStatus | null>(null);
	/** A5-C2A — bumped by the year-truth retry so it really re-reads. */
	const [yearTruthNonce, setYearTruthNonce] = useState(0);

	useEffect(() => {
		if (!hasAnyAuthToken()) {
			clearUserRoleCache();
			setVerifying(false);
			return;
		}
		let cancelled = false;
		verifySessionToken()
			.then((u) => {
				if (cancelled) return;
				setUser(u);
				setVerifying(false);
			})
			.catch(() => {
				if (cancelled) return;
				clearAtlasAuthStorage();
				setUser(null);
				setVerifying(false);
			});
		return () => {
			cancelled = true;
		};
	}, []);

	if (verifying) {
		return (
			<div className="flex min-h-[calc(100svh-3.5rem)] items-center justify-center p-6 text-sm text-muted-foreground">
				Checking your access...
			</div>
		);
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
					{/* A3-C6 D2 — this strip used to render TWO back-to-dashboard
					    controls with one destination: an icon-only ghost button
					    (aria-label only) on the left and this labelled outline button
					    on the right. The labelled one is kept, because every other
					    back affordance in the app that sits in a utility strip is
					    labelled (`ManualEditPanel`, `SchedulingPolicyPane`,
					    `CampusMapOverview`, `CampusReadinessCard` all pair the arrow
					    with visible text), and a labelled control is discoverable
					    without hovering or knowing the icon. The icon-only control had
					    no advantage here: it duplicated the destination and added a
					    second focus stop for no added meaning. */}
					<div className="flex min-w-0 items-center gap-2">
						<span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 text-[0.65rem] font-bold uppercase tracking-wide text-amber-700">
							<ShieldAlert className="size-3.5" />
							Admin only
						</span>
					</div>
					<Button type="button" variant="outline" size="sm" onClick={() => navigate('/')} className="gap-2">
						<ArrowLeft className="size-4" />
						Back to dashboard
					</Button>
				</div>
			</div>

			<div className="flex-1 min-h-0 overflow-auto px-4 py-4 lg:px-5">
				<div className="mx-auto max-w-3xl space-y-4">
				{/* A3-C1 S-a — no title of any kind before this. The thin utility
				    strip above keeps its back control; the title goes at the top of
				    the content. No subtitle is invented. A3-C6 D2 removed the
				    duplicate icon-only ghost that stood beside it, leaving the one
				    labelled control — so this reads in the singular on purpose. */}
					<PageHeader title='School Year Setup' />
					<p className="text-sm text-muted-foreground" data-testid="admin-year-setup-intro">
						This page moves the old school year to read-only history (Archive and sync) and syncs the new school year from EnrollPro. Normal setup pages link here so year actions never appear beside routine work. The advanced destructive reset is reserved for genuinely disposable test data only.
					</p>

					{/* A5-C2A — the page's own year/term truth, from the SAME canonical
					    resolver the app shell uses, so this page can never claim the
					    active year is unresolved while the header says it is active. */}
					<YearTruthBanner schoolId={schoolId} nonce={yearTruthNonce} onRetry={() => setYearTruthNonce((n) => n + 1)} />

					{/* Dismissible status banner + non-destructive Archive and sync flow.
					    A5-C2A: the `adminHref` self-link is removed. It pointed at
					    `/admin/year-setup` — the page the operator is already on — so it
					    rendered a "Year setup" control beside Preview whose only effect
					    was to reload the current route. It is a dead-looking
					    affordance, not a destination. */}
					{/* A5-C2A: `adminHref={null}` is what actually removes the "Year setup"
					    self-link. Dropping the prop was NOT enough - the card defaulted
					    it to `/admin/year-setup`, so the dead control still rendered
					    beside Preview. The other four consumers (Dashboard, Faculty,
					    Sections, Teaching Load) keep the default and their links. */}
					<RolloverGuidanceCard
						schoolId={schoolId}
						dismissible={false}
						allowTestDataMarking
						adminHref={null}
						onStatus={setStatus}
					/>

					{/* RR-09B: archived school years shown as read-only history */}
					{status?.archivedYears?.length ? (
						<div className="rounded-xl border border-slate-200 bg-white/80 p-4" data-testid="admin-year-setup-archived">
							<div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
								<Archive className="size-4 text-muted-foreground" />
								Archived school years
							</div>
							<p className="mt-1 text-xs text-muted-foreground">
								These years are read-only history. Their schedules, sections, and teaching-load data are preserved and never win the active-year election.
							</p>
							<ul className="mt-2 grid gap-2 sm:grid-cols-2">
								{status.archivedYears.map((year) => (
									<li key={year.enrollProSchoolYearId}>
										<Button asChild type="button" variant="outline" className="h-auto min-h-11 w-full justify-start whitespace-normal px-3 py-2 text-left" data-testid={`year-setup-history-${year.enrollProSchoolYearId}`}>
											<Link to={`/teaching-load/history?schoolYearId=${year.enrollProSchoolYearId}`}>
												<span><span className="font-semibold">{year.yearLabel}</span><span className="block text-xs text-muted-foreground">Open read-only Teaching Load{year.preservedCounts?.publishedGenerationRuns ? ` · ${year.preservedCounts.publishedGenerationRuns} published run(s)` : ''}</span></span>
											</Link>
										</Button>
									</li>
								))}
							</ul>
						</div>
					) : null}

					{/* Optional audited carry-forward preview (zero-write). Apply is a
						separate, separately approved HIGH action and is not reachable here. */}
					<CarryForwardReviewPanel
						schoolId={schoolId}
						activeSchoolYearId={status?.enrollProActiveYear?.id ?? null}
						archivedYears={status?.archivedYears ?? []}
					/>

					{/* Destructive reset -- only here, demoted to the advanced disclosure */}
					<RolloverResetPanel schoolId={schoolId} status={status} onApplied={setStatus} />
				</div>
			</div>
		</div>
	);
}
