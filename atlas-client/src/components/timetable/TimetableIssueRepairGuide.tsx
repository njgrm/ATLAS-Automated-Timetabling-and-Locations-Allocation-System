import { useEffect, useState } from 'react';
import { Loader2, Wand2 } from 'lucide-react';

import atlasApi from '@/lib/api';
import type { Violation, ViolationRepairOptionsResponse } from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import type { LeftRailContentContext } from '@/components/timetable/timetableContexts.types';

export function TimetableIssueRepairGuide({ context, violation }: { context: LeftRailContentContext; violation: Violation | null }) {
	const [result, setResult] = useState<ViolationRepairOptionsResponse | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const resolvedRunId = context.selectedRunId === 'latest' ? context.runs[0]?.id : Number(context.selectedRunId);

	useEffect(() => {
		let current = true;
		setResult(null);
		setError(null);
		if (!violation || !context.schoolYearId || !resolvedRunId) return () => { current = false; };
		const entities = violation.entities;
		const termIndex = violation.meta?.termIndex;
		if (typeof termIndex !== 'number' || !Number.isInteger(termIndex) || termIndex < 1 || termIndex > 4) {
			setError('This issue has no verified term scope. Refresh the schedule before requesting repair options.');
			return () => { current = false; };
		}
		setLoading(true);
		void atlasApi.post<ViolationRepairOptionsResponse>(
			`/generation/${context.defaultSchoolId}/${context.schoolYearId}/runs/${resolvedRunId}/violation-repair-options`,
			{
				code: violation.code,
				termIndex,
				entryIds: entities.entryIds ?? [],
				...(entities.facultyId ? { facultyId: entities.facultyId } : {}),
				...(entities.roomId ? { roomId: entities.roomId } : {}),
				...(entities.sectionId ? { sectionId: entities.sectionId } : {}),
				...(entities.subjectId ? { subjectId: entities.subjectId } : {}),
				...(entities.day ? { day: entities.day } : {}),
				...(entities.startTime ? { startTime: entities.startTime } : {}),
				...(entities.endTime ? { endTime: entities.endTime } : {}),
			},
		).then(({ data }) => { if (current) setResult(data); })
			.catch(() => { if (current) setError('Verified repair guidance could not be loaded. Refresh the issue list and try again.'); })
			.finally(() => { if (current) setLoading(false); });
		return () => { current = false; };
	}, [violation, context.defaultSchoolId, context.schoolYearId, resolvedRunId]);

	if (!violation) return null;
	const title = context.VIOLATION_LABELS[violation.code] ?? 'Schedule issue';
	const evidence = result?.evidence ?? [];
	const sectionIds = [...new Set(evidence.map((entry) => entry.sectionId))];
	const subjectIds = [...new Set(evidence.map((entry) => entry.subjectId))];
	const entryLocation = evidence.length
		? `${sectionIds.map(context.sectionLabel).join(', ')}${subjectIds.length ? ` · ${subjectIds.map(context.subjectLabel).join(', ')}` : ''}`
		: context.formatConstraintMessage(violation.message);

	return (
		<section className="shrink-0 border-t border-border bg-muted/20 px-3 py-2" aria-label="Selected issue repair guide" data-testid="timetable-issue-repair-guide">
			<div className="flex items-center gap-2">
				<h3 className="min-w-0 flex-1 truncate text-xs font-semibold">{title}</h3>
				{result && <Badge variant={result.status === 'REPAIRABLE' ? 'secondary' : 'outline'}>{result.status === 'REPAIRABLE' ? 'Verified option' : 'Guidance'}</Badge>}
			</div>
			<p className="mt-1 text-xs text-muted-foreground">{entryLocation}</p>
			{loading && <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin" />Checking safe repair options…</p>}
			{error && <p role="status" className="mt-1 text-xs text-amber-800">{error}</p>}
			{result?.status !== 'REPAIRABLE' && result && (
				<div className="mt-1 space-y-1 text-xs text-muted-foreground">
					<p>{result.blockers.join(' ')}</p>
					{result.status === 'POLICY_CHANGE_REQUIRED' && <p>Review the related scheduling policy or resources, then refresh this issue.</p>}
				</div>
			)}
			{result?.options.map((option) => (
				<div key={option.id} className="mt-1.5 rounded border border-border bg-background px-2 py-1.5">
					<p className="text-xs font-medium">{option.label}</p>
					<p className="mt-0.5 text-xs text-muted-foreground">{option.explanation} Projected: {option.projectedDelta.targetIssuesBefore - option.projectedDelta.targetIssuesAfter} fewer selected issue(s), {option.projectedDelta.hardAfter - option.projectedDelta.hardBefore} hard change.</p>
					<Button type="button" size="sm" variant="outline" className="mt-1 h-6 text-xs" onClick={() => void context.previewEdit(option.proposal)}>
						<Wand2 className="mr-1 size-3" />Preview
					</Button>
				</div>
			))}
		</section>
	);
}
