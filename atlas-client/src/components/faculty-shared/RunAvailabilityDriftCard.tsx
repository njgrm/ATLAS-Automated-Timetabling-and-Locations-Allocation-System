import { Link } from 'react-router-dom';
import { ExternalLink, ListChecks, RefreshCw } from 'lucide-react';

import { Badge } from '@/ui/badge';
import { Card, CardContent } from '@/ui/card';
import type { GenerationInputComparison } from '@/types';
import { resolveConcernDriftView } from '@/components/faculty-shared/teacher-concern-helpers';

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
 */
export default function RunAvailabilityDriftCard({ inputState, facultyName }: RunAvailabilityDriftCardProps) {
	const { drift, availabilityChanged, regenerateHref, revisionHref } = resolveConcernDriftView(inputState);

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
					<Badge variant={statusVariant(drift.status)}>{drift.status}</Badge>
				</div>

				<p className='text-xs leading-relaxed text-muted-foreground'>{drift.message}</p>
				{drift.actionHint && <p className='text-xs leading-relaxed text-muted-foreground'>{drift.actionHint}</p>}

				{availabilityChanged && (
					<p className='rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900'>
						Teacher availability changed since this run was generated. Regenerate to bind the reviewed authority, or
						start a post-publish revision if the run is already published.
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
					<Link to={regenerateHref} className='inline-flex items-center gap-1.5 text-xs font-semibold text-primary'>
						<RefreshCw className='size-3.5' aria-hidden='true' />
						Review &amp; regenerate
					</Link>
					<Link to={revisionHref} className='inline-flex items-center gap-1.5 text-xs font-semibold text-primary'>
						<ExternalLink className='size-3.5' aria-hidden='true' />
						Published revisions
					</Link>
					<Link to={drift.primaryHref} className='inline-flex items-center gap-1.5 text-xs font-semibold text-primary'>
						<ExternalLink className='size-3.5' aria-hidden='true' />
						Open owning setup
					</Link>
				</div>
			</CardContent>
		</Card>
	);
}
