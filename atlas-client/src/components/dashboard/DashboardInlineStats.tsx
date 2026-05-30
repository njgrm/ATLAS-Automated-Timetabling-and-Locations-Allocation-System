import { Link } from 'react-router-dom';
import { AlertTriangle, BookOpen, ClipboardList, GraduationCap, MapPinned, Users } from 'lucide-react';

import { Skeleton } from '@/ui/skeleton';

export type DashboardInlineStatsProps = {
	loading: boolean;
	subjectCount: number | null;
	facultyCount: number | null;
	sectionCount: number | null;
	teachingRooms: number;
	totalRooms: number;
	buildingsCount: number;
	unassignedSubjectCount: number | null;
	sectionsUnreachable: boolean;
};

type Item = {
	label: string;
	value: string;
	icon: typeof BookOpen;
	to: string;
	hint?: string;
};

export function DashboardInlineStats(props: DashboardInlineStatsProps) {
	const {
		loading,
		subjectCount,
		facultyCount,
		sectionCount,
		teachingRooms,
		totalRooms,
		buildingsCount,
		unassignedSubjectCount,
		sectionsUnreachable,
	} = props;

	const items: Item[] = [
		{
			label: 'Subjects',
			value: subjectCount !== null ? String(subjectCount) : '—',
			icon: BookOpen,
			to: '/subjects',
			hint: unassignedSubjectCount ? `${unassignedSubjectCount} need teachers` : undefined,
		},
		{
			label: 'Teachers',
			value: facultyCount !== null ? String(facultyCount) : '—',
			icon: Users,
			to: '/teachers',
		},
		{
			label: 'Sections',
			value: sectionCount !== null ? String(sectionCount) : '—',
			icon: GraduationCap,
			to: '/sections',
			hint: sectionsUnreachable ? 'Enrollment data cannot be reached' : undefined,
		},
		{
			label: 'Buildings',
			value: String(buildingsCount),
			icon: MapPinned,
			to: '/map',
		},
		{
			label: 'Teaching rooms',
			value: String(teachingRooms),
			icon: ClipboardList,
			to: '/map',
			hint: totalRooms > teachingRooms ? `${totalRooms} total` : undefined,
		},
	];

	return (
		<div className="grid grid-cols-2 md:grid-cols-5 gap-px overflow-hidden rounded-xl border border-border bg-border">
			{items.map((it) => {
				const Icon = it.icon;
				return (
					<Link
						key={it.label}
						to={it.to}
						className="group flex flex-col gap-1 bg-card px-4 py-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
					>
						<div className="flex items-center gap-2">
							<Icon className="size-3.5 text-muted-foreground/70" />
							<span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
								{it.label}
							</span>
						</div>
						{loading ? (
							<Skeleton className="h-6 w-12 mt-1" />
						) : (
							<div className="text-2xl font-semibold tabular-nums tracking-tight leading-none">
								{it.value}
							</div>
						)}
						{it.hint && !loading && (
							<div className="flex items-start gap-1 text-[10px] text-amber-700 leading-tight">
								<AlertTriangle className="size-3 shrink-0 mt-px" />
								<span className="truncate">{it.hint}</span>
							</div>
						)}
					</Link>
				);
			})}
		</div>
	);
}
