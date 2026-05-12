/**
 * Faculty adapter interface and stub implementation.
 * In v1 the stub returns realistic mock data.
 * Swap to EnrollProFacultyAdapter when the real API is available.
 */

export interface ExternalFaculty {
	id: number;
	employeeId: string | null;
	firstName: string;
	lastName: string;
	/** Academic department (e.g. "Mathematics") — from EnrollPro `department` field */
	department: string | null;
	/** Subject specialization (e.g. "Algebra") — from EnrollPro `specialization` field */
	specialization: string | null;
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
	{ id: 101, employeeId: '1000001', firstName: 'Maria', lastName: 'Santos', department: 'Languages', specialization: 'Filipino', contactInfo: 'maria.santos@school.edu.ph' },
	{ id: 102, employeeId: '1000002', firstName: 'Jose', lastName: 'Cruz', department: 'Languages', specialization: 'English', contactInfo: 'jose.cruz@school.edu.ph' },
	{ id: 103, employeeId: '1000003', firstName: 'Ana', lastName: 'Reyes', department: 'Mathematics', specialization: 'Mathematics', contactInfo: 'ana.reyes@school.edu.ph' },
	{ id: 104, employeeId: '1000004', firstName: 'Pedro', lastName: 'Garcia', department: 'Science', specialization: 'Science', contactInfo: 'pedro.garcia@school.edu.ph' },
	{ id: 105, employeeId: '1000005', firstName: 'Rosa', lastName: 'Mendoza', department: 'Social Studies', specialization: 'Araling Panlipunan', contactInfo: 'rosa.mendoza@school.edu.ph' },
	{ id: 106, employeeId: '1000006', firstName: 'Juan', lastName: 'Dela Cruz', department: 'MAPEH', specialization: 'MAPEH', contactInfo: 'juan.delacruz@school.edu.ph' },
	{ id: 107, employeeId: '1000007', firstName: 'Luz', lastName: 'Villanueva', department: 'TLE', specialization: 'TLE/ICT', contactInfo: 'luz.villanueva@school.edu.ph' },
	{ id: 108, employeeId: '1000008', firstName: 'Carlos', lastName: 'Ramos', department: 'Values Education', specialization: 'EsP', contactInfo: 'carlos.ramos@school.edu.ph' },
	{ id: 109, employeeId: '1000009', firstName: 'Elena', lastName: 'Bautista', department: 'Mathematics', specialization: 'Mathematics', contactInfo: 'elena.bautista@school.edu.ph' },
	{ id: 110, employeeId: '1000010', firstName: 'Miguel', lastName: 'Fernandez', department: 'Science', specialization: 'Science/STE', contactInfo: 'miguel.fernandez@school.edu.ph' },
	{ id: 111, employeeId: '1000011', firstName: 'Carmen', lastName: 'Aquino', department: 'Languages', specialization: 'English', contactInfo: 'carmen.aquino@school.edu.ph' },
	{ id: 112, employeeId: '1000012', firstName: 'Roberto', lastName: 'Lim', department: 'Languages', specialization: 'Filipino', contactInfo: 'roberto.lim@school.edu.ph' },
	{ id: 113, employeeId: '1000013', firstName: 'Teresa', lastName: 'Tan', department: 'Social Studies', specialization: 'Araling Panlipunan', contactInfo: 'teresa.tan@school.edu.ph' },
	{ id: 114, employeeId: '1000014', firstName: 'Rafael', lastName: 'Navarro', department: 'MAPEH', specialization: 'MAPEH', contactInfo: 'rafael.navarro@school.edu.ph' },
	{ id: 115, employeeId: '1000015', firstName: 'Isabella', lastName: 'De Leon', department: 'Science', specialization: 'Science/STE', contactInfo: 'isabella.deleon@school.edu.ph' },
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
		_schoolYearId: number,
		authToken?: string,
	): Promise<FacultyFetchResult> {
		// Use the public integration/v1/faculty endpoint — no auth required
		const url = `${this.baseUrl}/integration/v1/faculty`;
		const token = authToken ?? process.env.ENROLLPRO_SERVICE_TOKEN;
		const res = await fetch(url, {
			headers: token ? { Authorization: `Bearer ${token}` } : undefined,
		});

		if (!res.ok) {
			throw new Error(`EnrollPro API returned ${res.status}: ${res.statusText}`);
		}

		const data = (await res.json()) as {
			data: Array<{
				teacherId: number;
				employeeId?: string | null;
				firstName: string;
				lastName: string;
				email?: string | null;
				contactNumber?: string | null;
				department?: string | null;
				specialization: string | null;
				isActive: boolean;
				isTeachingExempt?: boolean;
				isClassAdviser?: boolean;
				advisoryEquivalentHoursPerWeek?: number | null;
				advisorySectionId?: number | null;
				advisorySectionName?: string | null;
			}>;
		};

		const teachers = (data.data ?? [])
			.filter((t) => t.isActive)
			.map((t) => ({
				id: t.teacherId,
				employeeId: t.employeeId || null,
				firstName: t.firstName,
				lastName: t.lastName,
				department: t.department ?? null,
				specialization: t.specialization ?? null,
				employmentStatus: 'PERMANENT' as const,
				isClassAdviser: !!(t.isClassAdviser || t.advisorySectionId),
				advisoryEquivalentHours: t.advisoryEquivalentHoursPerWeek ?? (t.advisorySectionId ? 5 : 0),
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
