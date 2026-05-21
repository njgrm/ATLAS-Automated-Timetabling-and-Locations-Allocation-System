const SUBJECT_OWNER_DEPARTMENT_BY_PREFIX = [
    { prefix: 'FIL', ownerDepartment: 'FIL' },
    { prefix: 'ENG', ownerDepartment: 'ENG' },
    { prefix: 'MATH', ownerDepartment: 'MATH' },
    { prefix: 'AP', ownerDepartment: 'AP' },
    { prefix: 'ESP', ownerDepartment: 'ESP' },
    { prefix: 'MAPEH', ownerDepartment: 'MAPEH' },
    { prefix: 'TLE', ownerDepartment: 'TLE' },
    { prefix: 'SCI', ownerDepartment: 'SCI' },
    { prefix: 'STE', ownerDepartment: 'SCI' },
    { prefix: 'SPA', ownerDepartment: 'SPA' },
    { prefix: 'SPS', ownerDepartment: 'SPS' },
];
const DEPARTMENT_NORMALIZATION = {
    SCIENCE: 'SCI',
    SCI: 'SCI',
    MATHEMATICS: 'MATH',
    MATH: 'MATH',
    ENGLISH: 'ENG',
    ENG: 'ENG',
    FILIPINO: 'FIL',
    FIL: 'FIL',
    MAPEH: 'MAPEH',
    ESP: 'ESP',
    VALUES: 'ESP',
    AP: 'AP',
    'SOCIAL STUDIES': 'AP',
    'ARALING PANLIPUNAN': 'AP',
    TLE: 'TLE',
    SPA: 'SPA',
    SPS: 'SPS',
    LANGUAGES: 'ENG',
};
export function normalizeDepartmentCode(value) {
    const normalized = (value ?? '').trim().toUpperCase();
    if (!normalized)
        return null;
    return DEPARTMENT_NORMALIZATION[normalized] ?? normalized;
}
export function isSpecializationPrimarySubjectCode(subjectCode) {
    const code = (subjectCode ?? '').trim().toUpperCase();
    return code.startsWith('SPA_') || code.startsWith('SPS_');
}
export function resolveSubjectOwnerDepartmentCode(subjectCode, subjectName) {
    const code = (subjectCode ?? '').trim().toUpperCase();
    if (!code)
        return null;
    for (const rule of SUBJECT_OWNER_DEPARTMENT_BY_PREFIX) {
        if (code.startsWith(rule.prefix)) {
            return rule.ownerDepartment;
        }
    }
    if (code === 'HG' || (subjectName ?? '').toLowerCase().includes('homeroom')) {
        return 'ESP';
    }
    if (code === 'DEVL_READING') {
        return 'ENG';
    }
    return null;
}
export function resolveSubjectQualificationPriority(subjectCode) {
    return isSpecializationPrimarySubjectCode(subjectCode) ? 'SPECIALIZATION_PRIMARY' : 'DEPARTMENT_FIRST';
}
export function matchesSubjectOwnershipDepartment(facultyDepartment, subjectCode, subjectName) {
    const ownerDepartment = resolveSubjectOwnerDepartmentCode(subjectCode, subjectName);
    if (!ownerDepartment)
        return false;
    const normalizedFacultyDepartment = normalizeDepartmentCode(facultyDepartment);
    if (!normalizedFacultyDepartment)
        return false;
    if (normalizedFacultyDepartment === ownerDepartment) {
        return true;
    }
    // Legacy generic language departments can cover both ENG and FIL ownership.
    if ((ownerDepartment === 'ENG' || ownerDepartment === 'FIL') && normalizedFacultyDepartment === 'ENG') {
        return true;
    }
    return false;
}
export function resolveSubjectRotationFamily(subjectCode, modularGroupId) {
    const code = (subjectCode ?? '').trim().toUpperCase();
    if (code.startsWith('TLE')) {
        return 'TLE_ROTATION';
    }
    return modularGroupId?.trim() || null;
}
//# sourceMappingURL=subject-ownership.service.js.map