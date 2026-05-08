/**
 * Faculty adapter interface and stub implementation.
 * In v1 the stub returns realistic mock data.
 * Swap to EnrollProFacultyAdapter when the real API is available.
 */

export interface ExternalFaculty {
	id: number;
	firstName: string;
	lastName: string;
	department: string | null;
	employmentStatus?: 'PERMANENT' | 'PROBATIONARY';
	isClassAdviser?: boolean;
	advisoryEquivalentHours?: number;
	canTeachOutsideDepartment?: boolean;
	contactInfo: string | null;
	// Wave 3.5: Adviser mapping
	advisedSectionId?: number | null;
	advisedSectionName?: string | null;
}

export interface FacultyFetchResult {
	teachers: ExternalFaculty[];
	source: 'enrollpro' | 'stub';
	fetchedAt: Date;
}

export interface FacultyAdapter {
	fetchFacultyBySchoolYear(schoolId: number, schoolYearId: number, authToken?: string): Promise<FacultyFetchResult>;
}

// Realistic stub data for development
const STUB_FACULTY: ExternalFaculty[] = [
	{ id: 101, firstName: 'Maria', lastName: 'Santos', department: 'Mathematics', contactInfo: 'maria.santos@school.edu.ph' },
	{ id: 102, firstName: 'Jose', lastName: 'Cruz', department: 'Science', contactInfo: 'jose.cruz@school.edu.ph' },
	{ id: 103, firstName: 'Ana', lastName: 'Reyes', department: 'English', contactInfo: 'ana.reyes@school.edu.ph' },
	{ id: 104, firstName: 'Pedro', lastName: 'Garcia', department: 'Filipino', contactInfo: 'pedro.garcia@school.edu.ph' },
	{ id: 105, firstName: 'Rosa', lastName: 'Mendoza', department: 'Social Studies', contactInfo: 'rosa.mendoza@school.edu.ph' },
	{ id: 106, firstName: 'Juan', lastName: 'Dela Cruz', department: 'MAPEH', contactInfo: 'juan.delacruz@school.edu.ph' },
	{ id: 107, firstName: 'Luz', lastName: 'Villanueva', department: 'TLE', contactInfo: 'luz.villanueva@school.edu.ph' },
	{ id: 108, firstName: 'Carlos', lastName: 'Ramos', department: 'Values Education', contactInfo: 'carlos.ramos@school.edu.ph' },
	{ id: 109, firstName: 'Elena', lastName: 'Bautista', department: 'Mathematics', contactInfo: 'elena.bautista@school.edu.ph' },
	{ id: 110, firstName: 'Miguel', lastName: 'Fernandez', department: 'Science', contactInfo: 'miguel.fernandez@school.edu.ph' },
	{ id: 111, firstName: 'Carmen', lastName: 'Aquino', department: 'English', contactInfo: 'carmen.aquino@school.edu.ph' },
	{ id: 112, firstName: 'Roberto', lastName: 'Lim', department: 'Filipino', contactInfo: 'roberto.lim@school.edu.ph' },
	{ id: 113, firstName: 'Teresa', lastName: 'Tan', department: 'Social Studies', contactInfo: 'teresa.tan@school.edu.ph' },
	{ id: 114, firstName: 'Rafael', lastName: 'Navarro', department: 'MAPEH', contactInfo: 'rafael.navarro@school.edu.ph' },
	{ id: 115, firstName: 'Isabella', lastName: 'De Leon', department: 'Science', contactInfo: 'isabella.deleon@school.edu.ph' },
];

export class StubFacultyAdapter implements FacultyAdapter {
	async fetchFacultyBySchoolYear(_schoolId: number, _schoolYearId: number): Promise<FacultyFetchResult> {
		// Simulate network delay
		await new Promise((resolve) => setTimeout(resolve, 200));
		return {
			teachers: STUB_FACULTY,
			source: 'stub',
			fetchedAt: new Date(),
		};
	}
}

export class EnrollProFacultyAdapter implements FacultyAdapter {
	private baseUrl: string;

	constructor(baseUrl: string) {
		this.baseUrl = baseUrl;
	}

	async fetchFacultyBySchoolYear(
		_schoolId: number,
		schoolYearId: number,
		_authToken?: string,
	): Promise<FacultyFetchResult> {
		// /integration/faculty is public and auto-resolves to the active school year
		const url = schoolYearId
			? `${this.baseUrl}/integration/v1/faculty?schoolYearId=${schoolYearId}`
			: `${this.baseUrl}/integration/v1/faculty`;
		const res = await fetch(url);

		if (!res.ok) {
			throw new Error(`EnrollPro API returned ${res.status}: ${res.statusText}`);
		}

		const data = (await res.json()) as {
			data: Array<{
				teacherId: number;
				firstName: string;
				lastName: string;
				email?: string | null;
				contactNumber?: string | null;
				specialization: string | null;
				isActive: boolean;
				isClassAdviser?: boolean;
				advisorySectionId?: number | null;
				advisorySectionName?: string | null;
			}>;
		};

		const teachers = data.data
			.filter((t) => t.isActive)
			.map((t) => ({
				id: t.teacherId,
				firstName: t.firstName,
				lastName: t.lastName,
				department: t.specialization ?? null,
				employmentStatus: 'PERMANENT' as const,
				isClassAdviser: t.isClassAdviser ?? !!t.advisorySectionId,
				advisoryEquivalentHours: t.advisorySectionId ? 5 : 0,
				canTeachOutsideDepartment: false,
				contactInfo: t.email ?? t.contactNumber ?? null,
				advisedSectionId: t.advisorySectionId ?? null,
				advisedSectionName: t.advisorySectionName ?? null,
			}));

		return {
			teachers,
			source: 'enrollpro',
			fetchedAt: new Date(),
		};
	}
}

// Factory — uses EnrollPro adapter by default in development, falls back to stub
export function createFacultyAdapter(): FacultyAdapter {
	const useStub = process.env.FACULTY_ADAPTER === 'stub';
	if (useStub) {
		return new StubFacultyAdapter();
	}
	const baseUrl = process.env.ENROLLPRO_API ?? 'http://localhost:5000/api';
	return new EnrollProFacultyAdapter(baseUrl);
}
