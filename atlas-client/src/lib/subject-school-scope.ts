/**
 * SCA-01.1 — Subjects catalog read scope.
 *
 * The Subjects page may only read the catalog for the authenticated actor's
 * school. While the actor scope is unresolved there is NO valid school to
 * read: callers must render a bounded loading/unavailable state and must not
 * issue a request. A hard-coded school-1 fallback here would silently show
 * one school's catalog to another school's operator.
 */

export type SubjectsReadScope =
	| { ready: true; schoolId: number }
	| { ready: false; schoolId: null };

export function resolveSubjectsReadScope(actorSchoolId: number | null | undefined): SubjectsReadScope {
	if (typeof actorSchoolId === 'number' && Number.isInteger(actorSchoolId) && actorSchoolId > 0) {
		return { ready: true, schoolId: actorSchoolId };
	}
	return { ready: false, schoolId: null };
}
