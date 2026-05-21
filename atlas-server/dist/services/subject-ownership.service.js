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
export function normalizeSubjectQualificationPriority(value) {
    return value === 'SPECIALIZATION_PRIMARY' ? 'SPECIALIZATION_PRIMARY' : 'DEPARTMENT_FIRST';
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
export function resolveSubjectQualificationPriority(subjectCode, explicitPriority) {
    if (explicitPriority) {
        return normalizeSubjectQualificationPriority(explicitPriority);
    }
    return isSpecializationPrimarySubjectCode(subjectCode) ? 'SPECIALIZATION_PRIMARY' : 'DEPARTMENT_FIRST';
}
export function resolveSubjectOutputLabel(subjectCode, subjectName, modularGroupId) {
    const code = (subjectCode ?? '').trim().toUpperCase();
    const name = (subjectName ?? '').trim().toUpperCase();
    const modular = (modularGroupId ?? '').trim().toUpperCase();
    if (code === 'SPA_SPEC' || code === 'SPS_SPEC') {
        return 'SPECIALIZATION';
    }
    if (code === 'STE_RESEARCH' || code.startsWith('RESEARCH') || name.includes('RESEARCH')) {
        return 'RESEARCH';
    }
    if (modular === 'SCIENCE' || code.startsWith('SCI_')) {
        return 'SCIENCE';
    }
    if (modular === 'TLE_EXPLORATORY' || code === 'TLE' || code.startsWith('TLE_') || code.startsWith('TLE_SPEC_')) {
        return 'TLE';
    }
    if (code.length > 0) {
        return code;
    }
    if (name.length > 0) {
        return name;
    }
    return 'UNKNOWN SUBJECT';
}
export function resolveSubjectContractDefaults(input) {
    const code = (input.subjectCode ?? '').trim().toUpperCase();
    const rotationFamily = resolveSubjectRotationFamily(code, input.modularGroupId ?? null);
    return {
        ownerDepartment: resolveSubjectOwnerDepartmentCode(code, input.subjectName),
        qualificationPriority: resolveSubjectQualificationPriority(code),
        rotationFamily,
        outputLabel: resolveSubjectOutputLabel(code, input.subjectName, input.modularGroupId ?? null),
        isSystemManaged: code.startsWith('TLE_SPEC_') || code.endsWith('_EXP'),
    };
}
export function matchesSubjectOwnershipDepartment(facultyDepartment, subjectCode, subjectName, explicitOwnerDepartment) {
    const ownerDepartment = normalizeDepartmentCode(explicitOwnerDepartment) ?? resolveSubjectOwnerDepartmentCode(subjectCode, subjectName);
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