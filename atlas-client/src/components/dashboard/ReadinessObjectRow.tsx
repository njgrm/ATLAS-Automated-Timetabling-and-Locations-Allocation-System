import { AlertTriangle, BookOpen, CheckCircle2, DoorOpen, GraduationCap, Users } from 'lucide-react';

import { Card } from '@/ui/card';
import { Skeleton } from '@/ui/skeleton';

export type ReadinessObjectRowProps = {
	loading: boolean;
	subjectCount: number | null;
	facultyCount: number | null;
	sectionCount: number | null;
	unassignedSubjectCount: number | null;
	teachingRoomCount: number;
	totalRoomCount: number;
	sectionsUnreachable: boolean;
};

type ReadinessObject = {
	key: string;
	icon: typeof BookOpen;
	label: string;
	state: 'ready' | 'attention' | 'unknown';
	detail: string;
};

function classesForState(state: ReadinessObject['state']) {
	if (state === 'ready') {
		return {
			iconBg: 'bg-emerald-50 text-emerald-700',
			detail: 'text-emerald-700',
			badge: <CheckCircle2 className='size-3.5 text-emerald-600' />,
		};
	}
	if (state === 'attention') {
		return {
			iconBg: 'bg-amber-50 text-amber-700',
			detail: 'text-amber-700',
			badge: <AlertTriangle className='size-3.5 text-amber-600' />,
		};
	}
	return {
		iconBg: 'bg-muted text-muted-foreground',
		detail: 'text-muted-foreground',
		badge: null,
	};
}

export function ReadinessObjectRow({
	loading,
	subjectCount,
	facultyCount,
	sectionCount,
	unassignedSubjectCount,
	teachingRoomCount,
	totalRoomCount,
	sectionsUnreachable,
}: ReadinessObjectRowProps) {
	const objects: ReadinessObject[] = [
		{
			key: 'subjects',
			icon: BookOpen,
			label: 'Subjects',
			state: (subjectCount ?? 0) > 0 && (unassignedSubjectCount ?? 0) === 0
				? 'ready'
				: (subjectCount ?? 0) > 0 ? 'attention' : 'attention',
			detail: subjectCount == null
				? 'Loading...'
				: subjectCount === 0
					? 'No subjects yet'
					: (unassignedSubjectCount ?? 0) > 0
						? `${unassignedSubjectCount} need a teacher`
						: `${subjectCount} ready`,
		},
		{
			key: 'teachers',
			icon: Users,
			label: 'Teachers',
			state: (facultyCount ?? 0) > 0 ? 'ready' : 'attention',
			detail: facultyCount == null
				? 'Loading...'
				: facultyCount === 0
					? 'No teachers synced'
					: `${facultyCount} ready`,
		},
		{
			key: 'sections',
			icon: GraduationCap,
			label: 'Sections',
			state: sectionsUnreachable
				? 'attention'
				: (sectionCount ?? 0) > 0 ? 'ready' : 'attention',
			detail: sectionsUnreachable
				? 'Need attention'
				: sectionCount == null
					? 'Loading...'
					: sectionCount === 0
						? 'Need attention'
						: `${sectionCount} ready`,
		},
		{
			key: 'rooms',
			icon: DoorOpen,
			label: 'Rooms',
			state: teachingRoomCount > 0 ? 'ready' : 'attention',
			detail: teachingRoomCount === 0
				? 'Need attention'
				: `${teachingRoomCount} of ${totalRoomCount} ready`,
		},
	];

	return (
		<Card className='border-border shadow-xs'>
			<div className='grid grid-cols-2 md:grid-cols-4'>
				{objects.map((object) => {
					const Icon = object.icon;
					const cls = classesForState(object.state);
					return (
						<div
							key={object.key}
							className='flex items-center gap-3 border-b border-border p-4 md:border-b-0 md:border-r last:border-r-0 even:border-b-0 md:nth-[-n+2]:border-b md:nth-[n+3]:border-b-0 md:last:border-r-0'
						>
							<div className={`rounded-xl p-2 ${cls.iconBg}`}>
								<Icon className='size-4' />
							</div>
							<div className='min-w-0 flex-1'>
								<p className='text-[11px] font-medium uppercase tracking-wider text-muted-foreground'>
									{object.label}
								</p>
								{loading ? (
									<Skeleton className='h-4 w-20 mt-1' />
								) : (
									<p className={`text-sm font-semibold flex items-center gap-1 ${cls.detail}`}>
										{cls.badge}
										<span className='truncate'>{object.detail}</span>
									</p>
								)}
							</div>
						</div>
					);
				})}
			</div>
		</Card>
	);
}
