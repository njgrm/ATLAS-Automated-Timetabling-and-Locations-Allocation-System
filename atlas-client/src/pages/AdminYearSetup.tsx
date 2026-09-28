import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ShieldAlert } from 'lucide-react';

import { RolloverResetPanel } from '@/components/runtime/RolloverResetPanel';
import { PageHeader } from '@/components/app-shell/PageHeader';
import { RolloverGuidanceCard } from '@/components/runtime/RolloverGuidanceCard';
import { SchoolYearListCard } from '@/components/runtime/SchoolYearListCard';
import { CarryForwardReviewPanel } from '@/components/runtime/CarryForwardReviewPanel';
import { Button } from '@/ui/button';
import { verifySessionToken, type RolloverStatus } from '@/lib/settings';
import { clearAtlasAuthStorage, clearUserRoleCache, hasAnyAuthToken } from '@/lib/auth';
import { PLAIN_INTRO, plainStartedCopy } from '@/components/runtime/rollover-plain-copy';
import type { BridgeUser } from '@/types';

const ADMIN_ROLES = new Set(['admin', 'SYSTEM_ADMIN', 'officer']);

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
	// A7-C1: set only by the card's own `onApplied`, so the confirmation appears
	// after a real apply and never on a read.
	const [started, setStarted] = useState<RolloverStatus | null>(null);
	// A7-C2: bumped by the per-year "Keep as history" so the status CARD reloads
	// the status it already owns. The page deliberately does not fetch it again:
	// `rollover-ui-guardrails.test.ts` holds Year Setup to one status reader.
	const [reloadSignal, setReloadSignal] = useState(0);

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
					{PLAIN_INTRO}
				</p>

				{/* A7-C1 §1.4 — the plain confirmation, in visible text and not only in
				    a toast. It is triggered by the card's EXISTING `onApplied` and
				    reads only `status`, which the page already holds because the card
				    already calls `loadStatus(true)` after an apply. No request is added,
				    and no number is invented: absent counts say so in plain words. */}
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
				    today's wording byte for byte. */}
				<RolloverGuidanceCard
					schoolId={schoolId}
					dismissible={false}
					adminHref="/admin/year-setup"
					allowTestDataMarking
					plainLanguageNextStep
					reloadSignal={reloadSignal}
					onStatus={setStatus}
					onApplied={setStarted}
				/>

				{/* A7-C2 §1: EVERY school year, not only the kept ones. The c1 card
				    read `status.archivedYears`, whose server query filters
				    `isArchived: true`, so a year that was neither the active year
				    nor archived had no row anywhere — the 2026-09-28 defect. This
				    card reads the new `status.schoolYears` (R4), which lists every
				    mirrored year, and carries the per-year "Keep as history" action
				    (item 2) and the read-only Teaching Load / Timetable links
				    (item 3, R6). */}
				<SchoolYearListCard
					schoolId={schoolId}
					schoolYears={status?.schoolYears ?? []}
					onKept={() => setReloadSignal((n) => n + 1)}
				/>

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
