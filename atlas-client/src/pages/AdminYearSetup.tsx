import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Archive, ArrowLeft, ShieldAlert } from 'lucide-react';

import { RolloverResetPanel } from '@/components/runtime/RolloverResetPanel';
import { RolloverGuidanceCard } from '@/components/runtime/RolloverGuidanceCard';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { verifySessionToken, type RolloverStatus } from '@/lib/settings';
import { clearAtlasAuthStorage, clearUserRoleCache, hasAnyAuthToken } from '@/lib/auth';
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

	const schoolId = user.schoolId ?? 1;

	return (
		<div className="flex h-[calc(100svh-3.5rem)] flex-col overflow-hidden">
			<div className="shrink-0 border-b bg-background/85 px-4 py-1.5 backdrop-blur-md lg:px-5" data-testid="admin-year-setup-header">
				<div className="flex min-w-0 items-center justify-between gap-2">
					<div className="flex min-w-0 items-center gap-2">
						<Button type="button" variant="ghost" size="icon-sm" className="shrink-0" aria-label="Back to dashboard" onClick={() => navigate('/', { replace: false })}>
							<ArrowLeft className="size-4" />
						</Button>
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
					<p className="text-sm text-muted-foreground" data-testid="admin-year-setup-intro">
						This page moves the old school year to read-only history (Archive and sync) and syncs the new school year from EnrollPro. Normal setup pages link here so year actions never appear beside routine work. The advanced destructive reset is reserved for genuinely disposable test data only.
					</p>

					{/* Dismissible status banner + non-destructive Archive and sync flow */}
					<RolloverGuidanceCard
						schoolId={schoolId}
						dismissible={false}
						adminHref="/admin/year-setup"
						allowTestDataMarking
						onStatus={setStatus}
					/>

					{/* RR-09B: archived school years shown as read-only history */}
					{status?.archivedYears?.length ? (
						<div className="rounded-xl border border-slate-200 bg-white/80 p-4" data-testid="admin-year-setup-archived">
							<div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
								<Archive className="size-4 text-slate-500" />
								Archived school years
							</div>
							<p className="mt-1 text-xs text-muted-foreground">
								These years are read-only history. Their schedules, sections, and teaching-load data are preserved and never win the active-year election.
							</p>
							<ul className="mt-2 flex flex-wrap gap-2">
								{status.archivedYears.map((year) => (
									<li key={year.enrollProSchoolYearId}>
										<Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
											{year.yearLabel} (#{year.enrollProSchoolYearId})
											{year.preservedCounts?.publishedGenerationRuns ? ` - ${year.preservedCounts.publishedGenerationRuns} published run(s)` : ''}
										</Badge>
									</li>
								))}
							</ul>
						</div>
					) : null}

					{/* Destructive reset -- only here, demoted to the advanced disclosure */}
					<RolloverResetPanel schoolId={schoolId} />
				</div>
			</div>
		</div>
	);
}
