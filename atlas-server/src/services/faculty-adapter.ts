/**
 * Faculty adapter interface and stub implementation.
 * In v1 the stub returns realistic mock data.
 * Swap to EnrollProFacultyAdapter when the real API is available.
 */

export interface ExternalFaculty {
	id: number;
	firstName: string;
	lastName: string;
	department: string;
	contactInfo: string | null;
}

export interface FacultyAdapter {
	fetchFacultyBySchool(schoolId: number): Promise<ExternalFaculty[]>;
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
	async fetchFacultyBySchool(_schoolId: number): Promise<ExternalFaculty[]> {
		// Simulate network delay
		await new Promise((resolve) => setTimeout(resolve, 200));
		return STUB_FACULTY;
	}
}

export class EnrollProFacultyAdapter implements FacultyAdapter {
	private baseUrl: string;
	private serviceToken: string;

	constructor(baseUrl: string, serviceToken: string) {
		this.baseUrl = baseUrl;
		this.serviceToken = serviceToken;
	}

	async fetchFacultyBySchool(_schoolId: number): Promise<ExternalFaculty[]> {
		const res = await fetch(`${this.baseUrl}/teachers`, {
			headers: {
				Authorization: `Bearer ${this.serviceToken}`,
				'Content-Type': 'application/json',
			},
		});

		if (!res.ok) {
			throw new Error(`EnrollPro API returned ${res.status}: ${res.statusText}`);
		}

		const data = (await res.json()) as {
			teachers: Array<{
				id: number;
				firstName: string;
				lastName: string;
				specialization: string | null;
				contactNumber: string | null;
				isActive: boolean;
			}>;
		};

		return data.teachers
			.filter((t) => t.isActive)
			.map((t) => ({
				id: t.id,
				firstName: t.firstName,
				lastName: t.lastName,
				department: t.specialization ?? 'General',
				contactInfo: t.contactNumber,
			}));
	}
}

// Factory — swap adapter here when ready
export function createFacultyAdapter(): FacultyAdapter {
	const useReal = process.env.FACULTY_ADAPTER === 'enrollpro';
	if (useReal) {
		const baseUrl = process.env.ENROLLPRO_API ?? 'http://localhost:5000/api';
		const serviceToken = process.env.ENROLLPRO_SERVICE_TOKEN ?? '';
		if (!serviceToken) {
			console.warn('ENROLLPRO_SERVICE_TOKEN not set; falling back to stub adapter.');
			return new StubFacultyAdapter();
		}
		return new EnrollProFacultyAdapter(baseUrl, serviceToken);
	}
	return new StubFacultyAdapter();
}
