/**
 * Section service — bridge to section adapter.
 * Returns a summary of sections by grade level sourced from the enrollment service.
 * Wave 3.5: includes fetchedAt, isStale, and special program metadata.
 */
import { type SectionSummary } from './section-adapter.js';
export declare function getSectionSummary(schoolYearId: number, schoolId: number, authToken?: string): Promise<SectionSummary>;
