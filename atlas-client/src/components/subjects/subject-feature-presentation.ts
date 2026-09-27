/**
 * A3-C4: operator-facing presentation for `subject.requiredFeatures`.
 *
 * `requiredFeatures` is a MIXED list. The server folds an ownership marker
 * `OWNER_DEPT:<code>` into it
 * (atlas-server/src/services/subject-ownership.service.ts:44) alongside real
 * room features, and the server's own `roomRequiredFeatures()` filters the
 * markers back out so they never gate room selection. The Subjects UI was
 * rendering the whole mixed list as "special room features", so a scheduler saw
 * a raw enum presented as a room requirement.
 *
 * WHERE THE PLAIN PHRASE COMES FROM — not invented here. `AP` is expanded by
 * `@/lib/deped-glossary` `DEPARTMENT_LABELS`, the repository's own canonical
 * glossary, whose stated purpose is that raw internal codes never ship to
 * scheduler officers, and whose `AP: 'Araling Panlipunan'` agrees with the
 * server's `DEPARTMENT_NORMALIZATION` (`'SOCIAL STUDIES' -> 'AP'`,
 * `'ARALING PANLIPUNAN' -> 'AP'`). A code with no glossary entry falls back to
 * the code itself: an unmapped department shows its own identifier rather than
 * a fabricated learning area.
 *
 * The raw marker is never destroyed — every surface keeps it reachable in an
 * `@/ui` affordance (AGENTS.md §8 forbids a bare `title=`).
 */
import { departmentLabel } from '@/lib/deped-glossary';

/** Defined by the server; mirrored here only to recognise its own data. */
const OWNER_DEPARTMENT_PREFIX = 'OWNER_DEPT:';

export type OwnerDepartmentRef = {
	/** The bare department code, e.g. `AP`. */
	code: string;
	/** The canonical plain learning-area name, e.g. `Araling Panlipunan`. */
	label: string;
	/** The stored marker, e.g. `OWNER_DEPT:AP`, kept for diagnostics. */
	raw: string;
};

export type SubjectFeatureSplit = {
	roomFeatures: string[];
	ownerDepartments: OwnerDepartmentRef[];
};

export function isOwnerDepartmentMarker(value: string | null | undefined): boolean {
	return (value ?? '').trim().toUpperCase().startsWith(OWNER_DEPARTMENT_PREFIX);
}

/**
 * Split the mixed `requiredFeatures` list into the real room features and the
 * ownership markers, preserving input order within each group.
 */
export function splitSubjectFeatures(
	requiredFeatures: string[] | null | undefined,
): SubjectFeatureSplit {
	const roomFeatures: string[] = [];
	const ownerDepartments: OwnerDepartmentRef[] = [];

	for (const raw of requiredFeatures ?? []) {
		const value = (raw ?? '').trim();
		if (!value) continue;
		if (isOwnerDepartmentMarker(value)) {
			const code = value.slice(OWNER_DEPARTMENT_PREFIX.length).trim().toUpperCase();
			// A marker with no code carries no department claim; it is not shown
			// as one rather than shown as a department named "OWNER_DEPT:".
			if (!code) continue;
			ownerDepartments.push({ code, label: departmentLabel(code), raw: value.toUpperCase() });
			continue;
		}
		roomFeatures.push(value);
	}

	return { roomFeatures, ownerDepartments };
}

/** `Araling Panlipunan department` / `department` when there is more than one. */
export function ownerDepartmentPhrase(ownerDepartments: OwnerDepartmentRef[]): string {
	if (ownerDepartments.length === 0) return '';
	const names = ownerDepartments.map((owner) => owner.label);
	if (names.length === 1) return `${names[0]} department`;
	return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} departments`;
}

/**
 * The calm, plain sentence for a subject's feature needs. Carries BOTH the
 * plain names and the raw codes, so the diagnostic survives the copy fix.
 */
export function subjectFeatureHelp(subjectName: string, split: SubjectFeatureSplit): string {
	const parts: string[] = [];
	const { roomFeatures, ownerDepartments } = split;

	if (roomFeatures.length > 0) {
		parts.push(
			`This subject needs ${roomFeatures.length} special room feature${roomFeatures.length === 1 ? '' : 's'}: ${roomFeatures.join(', ')}.`,
		);
	}
	if (ownerDepartments.length > 0) {
		parts.push(
			`It is owned by the ${ownerDepartmentPhrase(ownerDepartments)}. ATLAS records ${ownerDepartments.length === 1 ? 'this' : 'these'} as ${ownerDepartments.map((owner) => owner.raw).join(', ')}.`,
		);
	}
	if (parts.length === 0) return `This subject needs no special room features.`;
	return `${parts.join(' ')} ${subjectName} is scheduled against its owning department.`.trim();
}
