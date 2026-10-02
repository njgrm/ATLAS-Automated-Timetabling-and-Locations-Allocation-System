import { UNLABELLED_RULE_SENTENCE } from '@/lib/timetable-plain-language';
import { resolveBlockerDestination, resolvePlacementReasonFilter } from '@/components/timetable/simplePublishReadiness';
import type { SimpleReadinessRepairDeps } from '@/components/timetable/simple/SimpleHeaderReadinessTypes';

/** Shared routing for readiness repairs from the timetable header and setup pane. */
export function dispatchSimpleReadinessRepair(context: SimpleReadinessRepairDeps): void {
	const {
		href,
		reason,
		identity,
		groupCount,
		navigate,
		violations,
		setBlockerReasonFilter,
		startPlaceUnresolvedTask,
		startReviewIssuesTask,
		setSelectedViolation,
		setSeverityFilter,
		issueReviewEnabled,
		onSetRepairOrigin,
	} = context;
	const plainReason = reason === 'NO_AVAILABLE_SLOT' ? 'No available slot'
		: reason === 'FACULTY_OVERLOADED' ? 'Teachers are overloaded'
		: reason === 'NO_QUALIFIED_FACULTY' ? 'No qualified teacher'
		: reason === 'NO_COMPATIBLE_ROOM' ? 'No compatible room'
		: reason === 'ROOM_CAPACITY_EXCEEDED' ? 'Room capacity exceeded'
		: reason ? UNLABELLED_RULE_SENTENCE : 'Unknown issue';
	onSetRepairOrigin?.({ reason: reason ?? 'UNKNOWN', plainReason, groupCount: groupCount ?? null });
	const destination = resolveBlockerDestination(reason, href);
	if (destination.kind === 'teaching-load') {
		const params = new URLSearchParams();
		if (identity?.facultyId != null) params.set('facultyId', String(identity.facultyId));
		if (identity?.sectionId != null) params.set('sectionId', String(identity.sectionId));
		if (identity?.subjectId != null) params.set('subjectId', String(identity.subjectId));
		params.set('task', 'missing-load');
		navigate(`/teaching-load?${params.toString()}`);
		return;
	}
	if (destination.kind === 'rooms') {
		navigate('/map');
		return;
	}
	if (destination.kind === 'placement') {
		const reasonFilter = resolvePlacementReasonFilter(destination);
		context.setUnassignedReasonFilter(reasonFilter);
		setBlockerReasonFilter(reasonFilter);
		startPlaceUnresolvedTask();
		return;
	}
	const match = destination.code
		? violations.find((violation) => violation.code === destination.code && violation.severity === 'HARD')
			?? violations.find((violation) => violation.code === destination.code)
		: undefined;
	if (match) setSelectedViolation(match);
	setSeverityFilter('hard');
	if (issueReviewEnabled) startReviewIssuesTask();
	else if (destination.href) navigate(destination.href);
}
