import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldAlert } from 'lucide-react';

import { RolloverResetPanel } from '@/components/runtime/RolloverResetPanel';
import { RolloverGuidanceCard } from '@/components/runtime/RolloverGuidanceCard';
import { Button } from '@/ui/button';
import { verifySessionToken } from '@/lib/settings';
import { clearAtlasAuthStorage, clearUserRoleCache, hasAnyAuthToken } from '@/lib/auth';
import type { BridgeUser } from '@/types';

const ADMIN_ROLES = new Set(['admin', 'SYSTEM_ADMIN', 'officer']);

/**
 * `/admin/year-setup` -- admin-only year setup route (Phase 0B.2).
 *
 * Holds the destructive rollover reset panel that setup pages link to via
 * "Open year setup". The guard verifies the session on mount and redirects:
 * - No token -> `/login`
 * - Non-admin role -> `/` (Dashboard)
 *
 * The route is intentionally NOT surfaced in the main scheduler nav.
 */
export default function AdminYearSetup() {
	const navigate = useNavigate();
	const [user, setUser] = useState<BridgeUser | null>(null);
	const [verifying, setVerifying] = useState(true);

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
						<h1 className="shrink-0 text-lg font-bold text-slate-900 lg:text-xl">Year setup</h1>
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
					<p className="text-sm text-muted-foreground">
						This page holds the actions that clear ATLAS sample data and reset the school year. Normal setup pages link here with "Open year setup" so destructive actions never appear beside routine work.
					</p>

					{/* Dismissible status banner (non-destructive) */}
					<RolloverGuidanceCard schoolId={schoolId} dismissible={false} adminHref="/admin/year-setup" />

					{/* Destructive reset flow -- only here */}
					<RolloverResetPanel schoolId={schoolId} />
				</div>
			</div>
		</div>
	);
}