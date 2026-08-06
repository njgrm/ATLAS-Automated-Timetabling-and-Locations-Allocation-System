import { fetchEnrollProActiveSchoolYear } from './section-adapter.js';

type ServiceError = Error & {
	statusCode: number;
	code: string;
	actionHint?: string;
	details?: Record<string, unknown>;
};

function err(
	statusCode: number,
	code: string,
	message: string,
	options?: { actionHint?: string; details?: Record<string, unknown> },
): ServiceError {
	const e = new Error(message) as ServiceError;
	e.statusCode = statusCode;
	e.code = code;
	e.actionHint = options?.actionHint;
	e.details = options?.details;
	return e;
}

export async function assertActiveSchoolYearForGeneration(
	schoolId: number,
	schoolYearId: number,
	authToken?: string,
): Promise<void> {
	const upstreamYear = await fetchEnrollProActiveSchoolYear(authToken);
	if (!upstreamYear) return;
	if (upstreamYear.id === schoolYearId) return;

	throw err(
		409,
		'ACTIVE_YEAR_DRIFT',
		`EnrollPro is now on ${upstreamYear.yearLabel}. Sync the new school year before generating schedules.`,
		{
			actionHint: 'Run EnrollPro rollover sync, review Sections and Teaching Load for the new school year, then generate the timetable again.',
			details: {
				schoolId,
				requestedSchoolYearId: schoolYearId,
				enrollProSchoolYearId: upstreamYear.id,
				enrollProSchoolYearLabel: upstreamYear.yearLabel,
				nextAction: 'RUN_ROLLOVER_SYNC',
			},
		},
	);
}
