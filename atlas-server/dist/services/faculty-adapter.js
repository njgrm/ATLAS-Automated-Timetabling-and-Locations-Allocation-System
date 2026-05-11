/**
 * Faculty adapter interface and stub implementation.
 * In v1 the stub returns realistic mock data.
 * Swap to EnrollProFacultyAdapter when the real API is available.
 */
// Realistic stub data for development
const STUB_FACULTY = [
    { id: 101, firstName: 'Maria', lastName: 'Santos', department: 'Languages', specialization: 'Filipino', contactInfo: 'maria.santos@school.edu.ph' },
    { id: 102, firstName: 'Jose', lastName: 'Cruz', department: 'Languages', specialization: 'English', contactInfo: 'jose.cruz@school.edu.ph' },
    { id: 103, firstName: 'Ana', lastName: 'Reyes', department: 'Mathematics', specialization: 'Mathematics', contactInfo: 'ana.reyes@school.edu.ph' },
    { id: 104, firstName: 'Pedro', lastName: 'Garcia', department: 'Science', specialization: 'Science', contactInfo: 'pedro.garcia@school.edu.ph' },
    { id: 105, firstName: 'Rosa', lastName: 'Mendoza', department: 'Social Studies', specialization: 'Araling Panlipunan', contactInfo: 'rosa.mendoza@school.edu.ph' },
    { id: 106, firstName: 'Juan', lastName: 'Dela Cruz', department: 'MAPEH', specialization: 'MAPEH', contactInfo: 'juan.delacruz@school.edu.ph' },
    { id: 107, firstName: 'Luz', lastName: 'Villanueva', department: 'TLE', specialization: 'TLE/ICT', contactInfo: 'luz.villanueva@school.edu.ph' },
    { id: 108, firstName: 'Carlos', lastName: 'Ramos', department: 'Values Education', specialization: 'EsP', contactInfo: 'carlos.ramos@school.edu.ph' },
    { id: 109, firstName: 'Elena', lastName: 'Bautista', department: 'Mathematics', specialization: 'Mathematics', contactInfo: 'elena.bautista@school.edu.ph' },
    { id: 110, firstName: 'Miguel', lastName: 'Fernandez', department: 'Science', specialization: 'Science/STE', contactInfo: 'miguel.fernandez@school.edu.ph' },
    { id: 111, firstName: 'Carmen', lastName: 'Aquino', department: 'Languages', specialization: 'English', contactInfo: 'carmen.aquino@school.edu.ph' },
    { id: 112, firstName: 'Roberto', lastName: 'Lim', department: 'Languages', specialization: 'Filipino', contactInfo: 'roberto.lim@school.edu.ph' },
    { id: 113, firstName: 'Teresa', lastName: 'Tan', department: 'Social Studies', specialization: 'Araling Panlipunan', contactInfo: 'teresa.tan@school.edu.ph' },
    { id: 114, firstName: 'Rafael', lastName: 'Navarro', department: 'MAPEH', specialization: 'MAPEH', contactInfo: 'rafael.navarro@school.edu.ph' },
    { id: 115, firstName: 'Isabella', lastName: 'De Leon', department: 'Science', specialization: 'Science/STE', contactInfo: 'isabella.deleon@school.edu.ph' },
];
export class StubFacultyAdapter {
    async fetchFacultyBySchoolYear(_schoolId, _schoolYearId) {
        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 200));
        return {
            teachers: STUB_FACULTY,
            source: 'stub',
            fetchedAt: new Date(),
        };
    }
}
export class EnrollProFacultyAdapter {
    baseUrl;
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
    }
    async fetchFacultyBySchoolYear(_schoolId, _schoolYearId, _authToken) {
        // Use the ATLAS faculty-sync endpoint which returns both department and specialization
        const url = `${this.baseUrl}/teachers/atlas/faculty-sync`;
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`EnrollPro API returned ${res.status}: ${res.statusText}`);
        }
        const data = (await res.json());
        const teachers = (data.teachers ?? [])
            .filter((t) => t.isActive)
            .map((t) => ({
            id: t.teacherId,
            firstName: t.firstName,
            lastName: t.lastName,
            department: t.department ?? null,
            specialization: t.specialization ?? null,
            employmentStatus: 'PERMANENT',
            isClassAdviser: !!t.advisedSectionId,
            advisoryEquivalentHours: t.advisoryEquivalentHoursPerWeek ?? (t.advisedSectionId ? 5 : 0),
            canTeachOutsideDepartment: false,
            contactInfo: t.email ?? t.contactNumber ?? null,
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
export function createFacultyAdapter() {
    const useStub = process.env.FACULTY_ADAPTER === 'stub';
    if (useStub) {
        return new StubFacultyAdapter();
    }
    const baseUrl = process.env.ENROLLPRO_API ?? 'http://localhost:5000/api';
    return new EnrollProFacultyAdapter(baseUrl);
}
//# sourceMappingURL=faculty-adapter.js.map