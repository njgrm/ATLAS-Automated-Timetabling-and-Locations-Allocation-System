/**
 * Subject Program Scope Service
 *
 * Resolves which program types (REGULAR, STE, SPA, etc.) a subject belongs to.
 *
 * Priority:
 *  1. Stored programScopes from Subject record (explicit, data-driven)
 *  2. Heuristic inference from subject code/name (legacy fallback only)
 *
 * For new subjects, always set programScopes explicitly.
 * Heuristic inference is preserved only for backward compatibility with
 * subjects seeded before programScopes was introduced.
 */
export type SubjectProgramScope = 'REGULAR' | 'STE' | 'SPS' | 'SPA' | 'OTHER';
/** Heuristic inference — fallback only, not for new data. */
export declare function inferSubjectProgramScopes(subjectCode: string, subjectName?: string): SubjectProgramScope[];
/**
 * Determine whether a subject is allowed for a given section's program type.
 *
 * @param subjectCode      - Subject code string
 * @param sectionProgramCode - Section's program type code (e.g. 'STE', 'SPA', 'REGULAR')
 * @param storedScopes     - Explicit programScopes from the Subject DB record (preferred)
 */
export declare function isSubjectAllowedForSectionProgram(subjectCode: string, sectionProgramCode: string | null | undefined, storedScopes?: string[] | null): boolean;
