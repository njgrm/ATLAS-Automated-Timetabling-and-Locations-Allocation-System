import type { FacultyPortalObjectiveState } from '@/types';
import { Badge } from '@/ui/badge';
import { Card, CardContent } from '@/ui/card';

const STATE_STYLE: Record<FacultyPortalObjectiveState['code'], string> = {
	NO_TEACHING_LOAD: 'border-amber-200 bg-amber-50/70 text-amber-950',
	LOAD_WAITING_FOR_DRAFT: 'border-sky-200 bg-sky-50/70 text-sky-950',
	LOAD_WITHOUT_DRAFT_ENTRIES: 'border-sky-200 bg-sky-50/70 text-sky-950',
	DRAFT_ENTRIES_READY: 'border-emerald-200 bg-emerald-50/70 text-emerald-950',
	PUBLISHED_SCHEDULE_AVAILABLE: 'border-emerald-200 bg-emerald-50/70 text-emerald-950',
};

type FacultyObjectiveStateCardProps = {
	objectiveState: FacultyPortalObjectiveState;
	compact?: boolean;
};

export default function FacultyObjectiveStateCard({ objectiveState, compact = false }: FacultyObjectiveStateCardProps) {
	return (
		<Card className={`rounded-2xl shadow-sm ${STATE_STYLE[objectiveState.code]}`}>
			<CardContent className={compact ? 'space-y-2 p-3' : 'space-y-3 p-4'}>
				<div className='flex items-start justify-between gap-3'>
					<div className='min-w-0'>
						<p className={compact ? 'text-sm font-bold' : 'text-base font-bold'}>{objectiveState.title}</p>
						<p className='mt-1 text-xs leading-relaxed opacity-80'>{objectiveState.message}</p>
					</div>
					<Badge variant={objectiveState.hasDraftEntries ? 'success' : objectiveState.hasTeachingLoad ? 'warning' : 'outline'} className='shrink-0'>
						{objectiveState.nextActionLabel}
					</Badge>
				</div>
				<p className='rounded-xl border border-current/10 bg-background/60 px-3 py-2 text-xs leading-relaxed text-foreground/80'>
					{objectiveState.roomRequestMessage}
				</p>
			</CardContent>
		</Card>
	);
}
