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
		authToken?: string,
	): Promise<FacultyFetchResult> {
		const token = authToken ?? process.env.ENROLLPRO_SERVICE_TOKEN;
		const headers: Record<string, string> = { 'Content-Type': 'application/json' };
		if (token) {
			headers.Authorization = `Bearer ${token}`;
		}

		const res = await fetch(`${this.baseUrl}/teachers/atlas/faculty-sync?schoolYearId=${schoolYearId}`, { headers });

		if (!res.ok) {
			throw new Error(`EnrollPro API returned ${res.status}: ${res.statusText}`);
		}

		const data = (await res.json()) as {
			teachers: Array<{
				teacherId: number;
				firstName: string;
				lastName: string;
				email?: string | null;
				contactNumber?: string | null;
				department?: string | null;
				specialization: string | null;
				isActive: boolean;
				advisoryEquivalentHoursPerWeek?: number | null;
				isTeachingExempt?: boolean;
				advisedSectionId?: number | null;
				advisedSectionName?: string | null;
			}>;
		};

		const teachers = data.teachers
			.filter((t) => t.isActive)
			.map((t) => ({
				id: t.teacherId,
				firstName: t.firstName,
				lastName: t.lastName,
				department: t.department ?? t.specialization ?? null,
				employmentStatus: 'PERMANENT' as const,
				isClassAdviser: !!t.advisedSectionId,
				advisoryEquivalentHours: t.advisoryEquivalentHoursPerWeek ?? (t.advisedSectionId ? 5 : 0),
				canTeachOutsideDepartment: !!t.isTeachingExempt,
				contactInfo: t.contactNumber ?? t.email ?? null,
				advisedSectionId: t.advisedSectionId ?? null,
				advisedSectionName: t.advisedSectionName ?? null,
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
