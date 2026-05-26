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
const OWNER_DEPARTMENT_FEATURE_PREFIX = 'OWNER_DEPT:';
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
    void value;
    return 'DEPARTMENT_FIRST';
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
    void subjectCode;
    void explicitPriority;
    return 'DEPARTMENT_FIRST';
}
export function extractAdditionalOwnerDepartments(requiredFeatures) {
    if (!Array.isArray(requiredFeatures) || requiredFeatures.length === 0) {
        return [];
    }
    const departments = new Set();
    for (const feature of requiredFeatures) {
        const normalizedFeature = (feature ?? '').trim().toUpperCase();
        if (!normalizedFeature.startsWith(OWNER_DEPARTMENT_FEATURE_PREFIX)) {
            continue;
        }
        const departmentCode = normalizeDepartmentCode(normalizedFeature.slice(OWNER_DEPARTMENT_FEATURE_PREFIX.length));
        if (departmentCode) {
            departments.add(departmentCode);
        }
    }
    return [...departments].sort();
}
export function mergeRequiredFeaturesWithAdditionalOwnerDepartments(requiredFeatures, additionalOwnerDepartments) {
    const baseFeatures = Array.isArray(requiredFeatures)
        ? requiredFeatures
            .map((value) => (value ?? '').trim())
            .filter((value) => value.length > 0)
        : [];
    const sanitizedFeatures = baseFeatures.filter((feature) => !feature.toUpperCase().startsWith(OWNER_DEPARTMENT_FEATURE_PREFIX));
    const normalizedDepartments = new Set();
    for (const value of additionalOwnerDepartments ?? []) {
        const normalized = normalizeDepartmentCode(value);
        if (normalized) {
            normalizedDepartments.add(normalized);
        }
    }
    const ownerFeatures = [...normalizedDepartments]
        .sort()
        .map((department) => `${OWNER_DEPARTMENT_FEATURE_PREFIX}${department}`);
    return [...sanitizedFeatures, ...ownerFeatures];
}
export function resolveSubjectAllowedOwnerDepartments(explicitOwnerDepartment, subjectCode, subjectName, requiredFeatures) {
    const departments = new Set();
    const ownerDepartment = normalizeDepartmentCode(explicitOwnerDepartment)
        ?? resolveSubjectOwnerDepartmentCode(subjectCode, subjectName);
    if (ownerDepartment) {
        departments.add(ownerDepartment);
    }
    for (const additionalDepartment of extractAdditionalOwnerDepartments(requiredFeatures)) {
        departments.add(additionalDepartment);
    }
    return [...departments].sort();
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
export function matchesSubjectOwnershipDepartment(facultyDepartment, subjectCode, subjectName, explicitOwnerDepartment, requiredFeatures) {
    const ownerDepartments = resolveSubjectAllowedOwnerDepartments(explicitOwnerDepartment, subjectCode, subjectName, requiredFeatures);
    if (ownerDepartments.length === 0)
        return false;
    const ownerDepartmentSet = new Set(ownerDepartments);
    const normalizedFacultyDepartment = normalizeDepartmentCode(facultyDepartment);
    if (!normalizedFacultyDepartment)
        return false;
    if (ownerDepartmentSet.has(normalizedFacultyDepartment)) {
        return true;
    }
    // Legacy generic language departments can cover both ENG and FIL ownership.
    if ((ownerDepartmentSet.has('ENG') || ownerDepartmentSet.has('FIL')) && normalizedFacultyDepartment === 'ENG') {
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
const ROTATION_TERM_RANK_BY_SUBJECT_CODE = {
    SCI_BIO: 1,
    SCI_CHEM: 2,
    SCI_ES: 3,
    TLE_ICT_EXP: 1,
    TLE_AFA_EXP: 2,
    TLE_FCS_EXP: 3,
};
function toPositiveInteger(value) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        return null;
    }
    return parsed;
}
function inferRotationTermRankFromSubjectCode(subjectCode) {
    const normalizedCode = (subjectCode ?? '').trim().toUpperCase();
    if (!normalizedCode) {
        return null;
    }
    const mapped = ROTATION_TERM_RANK_BY_SUBJECT_CODE[normalizedCode];
    if (mapped) {
        return mapped;
    }
    const suffixMatch = normalizedCode.match(/_(\d+)$/);
    if (!suffixMatch) {
        return null;
    }
    return toPositiveInteger(suffixMatch[1]);
}
function toOrdinal(value) {
    const remainder100 = value % 100;
    if (remainder100 >= 11 && remainder100 <= 13) {
        return `${value}th`;
    }
    const remainder10 = value % 10;
    if (remainder10 === 1)
        return `${value}st`;
    if (remainder10 === 2)
        return `${value}nd`;
    if (remainder10 === 3)
        return `${value}rd`;
    return `${value}th`;
}
export function formatRotationTermLabel(termRank) {
    const normalizedRank = toPositiveInteger(termRank);
    if (!normalizedRank) {
        return null;
    }
    return `${toOrdinal(normalizedRank)} Term`;
}
export function resolveRotationTermCount(termCount) {
    return toPositiveInteger(termCount);
}
export function resolveRotationTermRank(subjectCode, modularOrder, termCount) {
    const normalizedTermCount = toPositiveInteger(termCount);
    const modularRank = toPositiveInteger(modularOrder);
    const inferredRank = inferRotationTermRankFromSubjectCode(subjectCode);
    const rank = modularRank ?? inferredRank;
    if (!rank) {
        return null;
    }
    if (normalizedTermCount && rank > normalizedTermCount) {
        return null;
    }
    return rank;
}
export function resolveRotationTermGroupId(termGroupId, modularGroupId, rotationFamily) {
    const fromTermGroup = (termGroupId ?? '').trim();
    if (fromTermGroup) {
        return fromTermGroup.toUpperCase();
    }
    const fromModularGroup = (modularGroupId ?? '').trim();
    if (fromModularGroup) {
        return fromModularGroup.toUpperCase();
    }
    const fromFamily = (rotationFamily ?? '').trim();
    if (fromFamily) {
        return fromFamily.toUpperCase();
    }
    return null;
}
export function resolveRotationTermMetadata(input) {
    const normalizedFamily = (input.rotationFamily ?? '').trim().toUpperCase()
        || (resolveSubjectRotationFamily(input.subjectCode, input.modularGroupId ?? null) ?? '').trim().toUpperCase();
    if (!normalizedFamily) {
        return {
            termRank: null,
            termLabel: null,
            termCount: null,
            termGroupId: null,
        };
    }
    const normalizedTermCount = resolveRotationTermCount(input.termCount ?? null) ?? 3;
    const termRank = resolveRotationTermRank(input.subjectCode, input.modularOrder ?? null, normalizedTermCount);
    return {
        termRank,
        termLabel: formatRotationTermLabel(termRank),
        termCount: normalizedTermCount,
        termGroupId: resolveRotationTermGroupId(input.termGroupId ?? null, input.modularGroupId ?? null, normalizedFamily),
    };
}
//# sourceMappingURL=subject-ownership.service.js.map