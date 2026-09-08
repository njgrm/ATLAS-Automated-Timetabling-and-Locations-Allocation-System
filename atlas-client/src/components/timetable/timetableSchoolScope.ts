export function requireTimetableSchoolScope(schoolId: number | null): number {
	if (typeof schoolId !== 'number' || !Number.isInteger(schoolId) || schoolId <= 0) {
		throw new Error('Authenticated school scope is unavailable.');
	}
	return schoolId;
}

export function buildTimetableGenerationPath(schoolId: number | null, schoolYearId: number, suffix = ''): string {
	const actorSchoolId = requireTimetableSchoolScope(schoolId);
	return `/generation/${actorSchoolId}/${schoolYearId}${suffix}`;
}

export function createTimetableScopedClient<T extends object>(schoolId: number | null, client: T): T {
	return new Proxy(client, {
		get(target, property, receiver) {
			const value = Reflect.get(target, property, receiver);
			if (typeof value !== 'function') return value;
			return (...args: unknown[]) => {
				requireTimetableSchoolScope(schoolId);
				return Reflect.apply(value, target, args);
			};
		},
	});
}
