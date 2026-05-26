const FACULTY_IDENTITY_CACHE_KEY = 'atlas:faculty-identity:v1';

type FacultyIdentityRecord = {
	schoolId: number;
	facultyId: number;
	cachedAt: string;
};

type FacultyIdentityEnvelope = {
	entries: FacultyIdentityRecord[];
};

function readEnvelope(): FacultyIdentityEnvelope {
	try {
		const raw = localStorage.getItem(FACULTY_IDENTITY_CACHE_KEY);
		if (!raw) return { entries: [] };
		const parsed = JSON.parse(raw) as FacultyIdentityEnvelope;
		if (!parsed || !Array.isArray(parsed.entries)) return { entries: [] };
		return {
			entries: parsed.entries.filter((entry): entry is FacultyIdentityRecord => {
				if (!entry || typeof entry !== 'object') return false;
				return (
					typeof entry.schoolId === 'number'
					&& typeof entry.facultyId === 'number'
					&& typeof entry.cachedAt === 'string'
				);
			}),
		};
	} catch {
		return { entries: [] };
	}
}

function writeEnvelope(envelope: FacultyIdentityEnvelope): void {
	try {
		localStorage.setItem(FACULTY_IDENTITY_CACHE_KEY, JSON.stringify(envelope));
	} catch {
		// Ignore storage restrictions.
	}
}

export function readCachedFacultyIdentity(schoolId: number): FacultyIdentityRecord | null {
	const envelope = readEnvelope();
	return envelope.entries.find((entry) => entry.schoolId === schoolId) ?? null;
}

export function cacheFacultyIdentity(schoolId: number, facultyId: number): void {
	const envelope = readEnvelope();
	const filtered = envelope.entries.filter((entry) => entry.schoolId !== schoolId);
	filtered.push({
		schoolId,
		facultyId,
		cachedAt: new Date().toISOString(),
	});
	writeEnvelope({ entries: filtered.slice(-12) });
}
