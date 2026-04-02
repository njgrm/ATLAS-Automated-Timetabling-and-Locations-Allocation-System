/**
 * Section service — bridge to section adapter.
 * Returns a summary of sections by grade level sourced from the enrollment service.
 */
import { type SectionSummary } from './section-adapter.js';
export declare function getSectionSummary(schoolYearId: number, authToken?: string): Promise<SectionSummary>;
