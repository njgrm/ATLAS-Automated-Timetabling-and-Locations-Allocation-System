import { Link } from 'react-router-dom';
import { ExternalLink, ListChecks, RefreshCw } from 'lucide-react';

import { Badge } from '@/ui/badge';
import { Card, CardContent } from '@/ui/card';
import type { GenerationInputComparison } from '@/types';
import {
	concernDriftStatusLabel,
	resolveConcernDriftLinks,
	resolveConcernDriftView,
} from '@/components/faculty-shared/teacher-concern-helpers';

type RunAvailabilityDriftCardProps = {
	inputState: GenerationInputComparison | null | undefined;
	facultyName?: string | null;
};

function statusVariant(status: 'FRESH' | 'STALE' | 'UNKNOWN'): 'success' | 'warning' | 'outline' {
	if (status === 'FRESH') return 'success';
	if (status === 'STALE') return 'warning';
	return 'outline';
}

/**
 * S2 — the run's input-freshness effect on the recorded concern.
 *
 * The status, message, changed-domain chips and primary repair href all come
 * from the shared `describeRunInputDrift` (read-only). The availability flag is
 * the raw `availability` domain membership, because the shared mapping does not
 * yet carry that domain — the S4-client lane owns that extension, and this card
 * renders whatever the shared function reports without forking it.
 *
 * A3-C6: three honesty fixes, all local to this card.
 *   C2  The "Published revisions" link pointed at `/schedules`, which mounts
 *       `RoomSchedules` — a room/teacher/section browser with no revision
 *       concept. It named an errand that could not be performed from there.
 *       The revision surface is reachable from Class Schedule, so the single
 *       Class Schedule link below carries both errands honestly.
 *   C3  The badge showed the raw enum. The tone is unchanged; the words are
 *       now plain.
 *   C4  "Open owning setup" could be a self-link (`availability`) or a second
 *       copy of a destination already on this card — the Class Schedule link
 *       (`policy`) or a changed domain's own chip. `resolveConcernDriftLinks`
 *       de-duplicates the ACTION links by destination. The changed-domain chips
 *       keep navigating: each names a changed domain AND links to that domain's
 *       canonical home, so a card never names a domain it cannot route to.
 */
export default function RunAvailabilityDriftCard({ inputState, facultyName }: RunAvailabilityDriftCardProps) {
	const view = resolveConcernDriftView(inputState);
	const { drift, availabilityChanged } = view;
	const links = resolveConcernDriftLinks(view);

	return (
		<Card className='rounded-2xl border-border/60 shadow-sm'>
			<CardContent className='space-y-3 p-4'>
				<div className='flex items-start justify-between gap-3'>
					<div className='min-w-0'>
						<p className='flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
							<ListChecks className='size-3.5' aria-hidden='true' />
							Run input freshness
						</p>
						<p className='mt-1 text-sm font-semibold text-foreground'>
							{facultyName ? `${facultyName}'s availability in the current run` : 'Current run'}
						</p>
					</div>
					<Badge variant={statusVariant(drift.status)} data-testid='concern-drift-status'>
						{concernDriftStatusLabel(drift.status)}
					</Badge>
				</div>

				<p className='text-xs leading-relaxed text-muted-foreground'>{drift.message}</p>
				{drift.actionHint && <p className='text-xs leading-relaxed text-muted-foreground'>{drift.actionHint}</p>}

				{availabilityChanged && (
					<p className='rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900'>
						Teacher availability changed since this run was generated. Open Class Schedule to regenerate a draft run,
						or — when the run is already published — to start a post-publish revision from there. Revisions are
						started in the Class Schedule workspace, not from this page.
					</p>
				)}

				{drift.domains.length > 0 && (
					<div className='flex flex-wrap gap-1.5'>
						{drift.domains.map((domain) => (
							<Link key={domain.domain} to={domain.href}>
								<Badge variant='outline'>{domain.label}</Badge>
							</Link>
						))}
					</div>
				)}

				<div className='flex flex-wrap gap-2 pt-1'>
					{links.map((link) => (
						<Link
							key={link.href}
							to={link.href}
							data-testid='concern-drift-link'
							className='inline-flex items-center gap-1.5 text-xs font-semibold text-primary'
						>
							{link.href === view.regenerateHref
								? <RefreshCw className='size-3.5' aria-hidden='true' />
								: <ExternalLink className='size-3.5' aria-hidden='true' />}
							{link.label}
						</Link>
					))}
				</div>
			</CardContent>
		</Card>
	);
}
