/**
 * Section adapter interface and implementations.
 * Mirrors the faculty-adapter pattern: EnrollPro adapter (default) with stub fallback.
 */
/* ─── Stub adapter ─── */
const STUB_SECTIONS = [
    {
        gradeLevelId: 1, gradeLevelName: 'Grade 7', displayOrder: 7,
        sections: [
            { id: 1, name: '7-Rizal', maxCapacity: 40, gradeLevelId: 1, gradeLevelName: 'Grade 7' },
            { id: 2, name: '7-Bonifacio', maxCapacity: 40, gradeLevelId: 1, gradeLevelName: 'Grade 7' },
            { id: 3, name: '7-Mabini', maxCapacity: 40, gradeLevelId: 1, gradeLevelName: 'Grade 7' },
        ],
    },
    {
        gradeLevelId: 2, gradeLevelName: 'Grade 8', displayOrder: 8,
        sections: [
            { id: 4, name: '8-Aquino', maxCapacity: 40, gradeLevelId: 2, gradeLevelName: 'Grade 8' },
            { id: 5, name: '8-Quezon', maxCapacity: 40, gradeLevelId: 2, gradeLevelName: 'Grade 8' },
            { id: 6, name: '8-Osmena', maxCapacity: 40, gradeLevelId: 2, gradeLevelName: 'Grade 8' },
        ],
    },
    {
        gradeLevelId: 3, gradeLevelName: 'Grade 9', displayOrder: 9,
        sections: [
            { id: 7, name: '9-Luna', maxCapacity: 40, gradeLevelId: 3, gradeLevelName: 'Grade 9' },
            { id: 8, name: '9-Del Pilar', maxCapacity: 40, gradeLevelId: 3, gradeLevelName: 'Grade 9' },
        ],
    },
    {
        gradeLevelId: 4, gradeLevelName: 'Grade 10', displayOrder: 10,
        sections: [
            { id: 9, name: '10-Recto', maxCapacity: 40, gradeLevelId: 4, gradeLevelName: 'Grade 10' },
            { id: 10, name: '10-Palma', maxCapacity: 40, gradeLevelId: 4, gradeLevelName: 'Grade 10' },
        ],
    },
];
export class StubSectionAdapter {
    async fetchSectionsBySchoolYear(_schoolYearId) {
        await new Promise((r) => setTimeout(r, 80));
        return STUB_SECTIONS;
    }
}
/* ─── EnrollPro adapter ─── */
export class EnrollProSectionAdapter {
    baseUrl;
    constructor(baseUrl) {
        this.baseUrl = baseUrl ?? process.env.ENROLLPRO_API_URL ?? 'http://localhost:5000/api';
    }
    async fetchSectionsBySchoolYear(schoolYearId, authToken) {
        const url = `${this.baseUrl}/sections/${schoolYearId}?level=JHS`;
        const token = authToken ?? process.env.ENROLLPRO_SERVICE_TOKEN;
        const headers = { 'Content-Type': 'application/json' };
        if (token)
            headers['Authorization'] = `Bearer ${token}`;
        const response = await fetch(url, { headers });
        if (!response.ok) {
            throw Object.assign(new Error(`EnrollPro sections API returned ${response.status}`), {
                statusCode: response.status,
                code: 'UPSTREAM_ERROR',
            });
        }
        const body = await response.json();
        const gradeLevels = body.gradeLevels ?? [];
        return gradeLevels.map((gl) => ({
            gradeLevelId: gl.gradeLevelId,
            gradeLevelName: gl.gradeLevelName,
            displayOrder: gl.displayOrder,
            sections: (gl.sections ?? []).map((s) => ({
                id: s.id,
                name: s.name,
                maxCapacity: s.maxCapacity ?? 0,
                gradeLevelId: gl.gradeLevelId,
                gradeLevelName: gl.gradeLevelName,
            })),
        }));
    }
}
/* ─── Factory ─── */
const adapterType = process.env.SECTION_ADAPTER ?? process.env.FACULTY_ADAPTER ?? 'enrollpro';
export const sectionAdapter = adapterType === 'stub'
    ? new StubSectionAdapter()
    : new EnrollProSectionAdapter();
//# sourceMappingURL=section-adapter.js.map