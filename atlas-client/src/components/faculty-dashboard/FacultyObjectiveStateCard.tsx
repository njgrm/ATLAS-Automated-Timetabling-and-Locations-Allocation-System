import type { FacultyPortalObjectiveState } from '@/types';
import { Badge } from '@/ui/badge';
import { Card, CardContent } from '@/ui/card';

const STATE_STYLE: Record<FacultyPortalObjectiveState['code'], string> = {
	NO_TEACHING_LOAD: 'border-amber-200 bg-amber-50 text-amber-900',
	LOAD_WAITING_FOR_DRAFT: 'border-sky-200 bg-sky-50 text-sky-900',
	LOAD_WITHOUT_DRAFT_ENTRIES: 'border-sky-200 bg-sky-50 text-sky-900',
	DRAFT_ENTRIES_READY: 'border-emerald-200 bg-emerald-50 text-emerald-900',
	PUBLISHED_SCHEDULE_AVAILABLE: 'border-emerald-200 bg-emerald-50 text-emerald-900',
};

type FacultyObjectiveStateCardProps = {
	objectiveState: FacultyPortalObjectiveState;
	compact?: boolean;
};

export default function FacultyObjectiveStateCard({ objectiveState, compact = false }: FacultyObjectiveStateCardProps) {
	return (
		<Card className={`overflow-hidden rounded-2xl border shadow-sm ${STATE_STYLE[objectiveState.code]}`}>
			<CardContent className={compact ? 'space-y-2 p-4' : 'space-y-3 p-5'}>
				<div className='flex items-start justify-between gap-3'>
					<div className='min-w-0'>
						<p className={compact ? 'text-[13px] font-semibold leading-tight' : 'text-[15px] font-semibold leading-tight'}>{objectiveState.title}</p>
						<p className='mt-1 text-[12px] leading-snug opacity-85'>{objectiveState.message}</p>
					</div>
					<Badge variant={objectiveState.hasDraftEntries ? 'success' : objectiveState.hasTeachingLoad ? 'warning' : 'outline'} className='shrink-0'>
						{objectiveState.nextActionLabel}
					</Badge>
				</div>
				<p className='rounded-xl bg-white/70 px-3 py-2 text-[12px] leading-snug text-foreground/80'>
					{objectiveState.roomRequestMessage}
				</p>
			</CardContent>
		</Card>
	);
}
