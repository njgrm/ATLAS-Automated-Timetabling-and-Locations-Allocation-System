import { useMemo } from 'react';

import type { FacultyTeachingAssignmentIdentity } from '@/types';
import { Badge } from '@/ui/badge';
import { Card, CardContent } from '@/ui/card';

type TeachingIdentityPanelProps = {
	assignments: FacultyTeachingAssignmentIdentity[];
	maxSections?: number;
	compact?: boolean;
};

type SectionGroup = {
	sectionId: number;
	sectionName: string;
	gradeLevel: number;
	assignments: FacultyTeachingAssignmentIdentity[];
};

function buildTermLabel(assignment: FacultyTeachingAssignmentIdentity) {
	if (assignment.rotationTermLabel) return assignment.rotationTermLabel;
	if (typeof assignment.rotationTermRank === 'number') return `Term ${assignment.rotationTermRank}`;
	if ((assignment.rotationTermCount ?? 0) > 1) return 'Rotates by term';
	return 'All year';
}

function isRotational(assignment: FacultyTeachingAssignmentIdentity) {
	return Boolean(
		assignment.rotationFamily
		|| assignment.rotationLaneId
		|| assignment.rotationTermLabel
		|| assignment.rotationTermGroupId
		|| (assignment.rotationTermCount ?? 0) > 1,
	);
}

export default function TeachingIdentityPanel({ assignments, maxSections = 6, compact = false }: TeachingIdentityPanelProps) {
	const groups = useMemo(() => {
		const bySection = new Map<number, SectionGroup>();
		for (const assignment of assignments) {
			const current = bySection.get(assignment.sectionId) ?? {
				sectionId: assignment.sectionId,
				sectionName: assignment.sectionName,
				gradeLevel: assignment.gradeLevel,
				assignments: [],
			};
			current.assignments.push(assignment);
			bySection.set(assignment.sectionId, current);
		}
		return [...bySection.values()]
			.map((group) => ({
				...group,
				assignments: group.assignments.sort((left, right) =>
					(left.rotationTermRank ?? 99) - (right.rotationTermRank ?? 99)
					|| left.subjectDisplayLabel.localeCompare(right.subjectDisplayLabel),
				),
			}))
			.sort((left, right) => left.gradeLevel - right.gradeLevel || left.sectionName.localeCompare(right.sectionName));
	}, [assignments]);

	if (assignments.length === 0) {
		return (
			<Card className='rounded-2xl border-amber-200 bg-amber-50/60'>
				<CardContent className={compact ? 'p-3' : 'p-4'}>
					<p className='text-sm font-bold text-amber-950'>No teaching load found</p>
					<p className='mt-1 text-xs leading-relaxed text-amber-800'>Your account is signed in, but no assignment-bearing classes are linked for this school year.</p>
				</CardContent>
			</Card>
		);
	}

	const visibleGroups = groups.slice(0, maxSections);
	const hiddenCount = Math.max(0, groups.length - visibleGroups.length);
	const hasRotation = assignments.some(isRotational);

	return (
		<Card className='rounded-2xl border-border/50 bg-muted/10'>
			<CardContent className={compact ? 'space-y-3 p-3' : 'space-y-3 p-4'}>
				<div className='flex items-center justify-between gap-3'>
					<div>
						<p className='text-xs font-bold text-muted-foreground uppercase tracking-wider'>Teaching Load</p>
						<p className='text-xs text-muted-foreground'>{assignments.length} class assignment{assignments.length === 1 ? '' : 's'} linked to your account.</p>
					</div>
					{hasRotation && <Badge variant='warning'>Rotates by term</Badge>}
				</div>
				<div className='space-y-2'>
					{visibleGroups.map((group) => (
						<div key={group.sectionId} className='rounded-xl border border-border/50 bg-background px-3 py-2'>
							<div className='flex items-start justify-between gap-2'>
								<div className='min-w-0'>
									<p className='text-xs font-bold truncate'>{group.sectionName}</p>
									<p className='text-[11px] text-muted-foreground'>Grade {group.gradeLevel}</p>
								</div>
								{group.assignments.some(isRotational) && <Badge variant='outline' className='shrink-0 text-[10px]'>Term load</Badge>}
							</div>
							<div className='mt-2 flex flex-wrap gap-1.5'>
								{group.assignments.map((assignment) => (
									<Badge
										key={`${assignment.sectionId}:${assignment.subjectId}:${assignment.rotationTermGroupId ?? assignment.rotationTermRank ?? 'all'}`}
										variant={isRotational(assignment) ? 'secondary' : 'outline'}
										className='max-w-full truncate text-[10px]'
									>
										{assignment.subjectDisplayLabel} - {buildTermLabel(assignment)}
									</Badge>
								))}
							</div>
						</div>
					))}
				</div>
				{hiddenCount > 0 && <p className='text-xs text-muted-foreground'>Showing {visibleGroups.length} sections. {hiddenCount} more section{hiddenCount === 1 ? '' : 's'} are linked.</p>}
			</CardContent>
		</Card>
	);
}
