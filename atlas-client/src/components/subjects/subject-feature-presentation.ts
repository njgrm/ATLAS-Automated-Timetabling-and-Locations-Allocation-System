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
 * a fabricated learning area — and because there is then no learning area to
 * name, the word "department" is withheld too (see `hasNamedOwnerDepartments`).
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

/**
 * True when EVERY ownership code resolved to a canonical plain name.
 *
 * The word "department" is a claim that a learning area by that name exists and
 * owns the subject. `departmentLabel` echoes the raw code back when the glossary
 * has no entry, so an unmapped code gives `label === code` — there is no name to
 * assert. The rule is all-or-nothing: one unmapped code in a list withholds the
 * noun for the whole phrase rather than half-naming a department that may not
 * exist.
 */
export function hasNamedOwnerDepartments(ownerDepartments: OwnerDepartmentRef[]): boolean {
	return ownerDepartments.length > 0 && ownerDepartments.every((owner) => owner.label !== owner.code);
}

/**
 * `Araling Panlipunan department` / `department` when there is more than one.
 *
 * With an unmapped code there is no learning area to name, so the phrase is the
 * stored markers themselves and carries no "department" noun: the operator sees
 * the identifier the data actually holds instead of prose asserting a
 * department that the glossary cannot vouch for.
 */
export function ownerDepartmentPhrase(ownerDepartments: OwnerDepartmentRef[]): string {
	if (ownerDepartments.length === 0) return '';
	if (!hasNamedOwnerDepartments(ownerDepartments)) {
		return ownerDepartments.map((owner) => owner.raw).join(', ');
	}
	const names = ownerDepartments.map((owner) => owner.label);
	if (names.length === 1) return `${names[0]} department`;
	return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} departments`;
}

/**
 * A5-C2B / demo-walk item 7: the operator's **primary** read of ownership.
 *
 * `ownerDepartmentPhrase` above is deliberately the STORED-MARKER phrase — it
 * yields `OWNER_DEPT:MAPEH` for a code the glossary cannot expand, and A3-C4
 * controls 1e/1f pin that behaviour on purpose. Keeping it as the primary read
 * is what the operator reported: the Subjects table showed a stored enum as a
 * room decision, and a teacher reading the room column saw `OWNER_DEPT:MAPEH`
 * rather than a department.
 *
 * This function is the narrower, honest replacement for the PRIMARY line only:
 * it names the department where the glossary vouches for one, and otherwise
 * shows the **department code itself** — `MAPEH` is the identifier a school
 * scheduler writes on a timetable and reads back all day, so it is a readable
 * department name, not implementation language. The internal `OWNER_DEPT:`
 * prefix is a storage detail and never appears here; the full stored marker
 * stays reachable in the `@/ui` detail affordance through `subjectFeatureHelp`.
 *
 * This is why the two functions coexist rather than one replacing the other:
 * the primary read is prose a scheduler scans, and the detail is the diagnostic
 * an officer needs when a code is wrong.
 */
export function ownerDepartmentRead(ownerDepartments: OwnerDepartmentRef[]): string {
	if (ownerDepartments.length === 0) return '';
	if (hasNamedOwnerDepartments(ownerDepartments)) {
		return ownerDepartmentPhrase(ownerDepartments);
	}
	// No plain name is available, so the phrase withholds the "department" noun
	// (A3-C4-1e). The code alone is still a true statement about the data, and
	// unlike the marker it is something the operator recognises.
	return ownerDepartments.map((owner) => owner.code).join(', ');
}

/**
 * The calm, plain sentence for a subject's feature needs. Carries BOTH the
 * plain names and the raw codes, so the diagnostic survives the copy fix.
 *
 * There is deliberately NO clause about how the subject is scheduled. Nothing
 * in this file, or anywhere on the client, reads a scheduling relationship out
 * of `requiredFeatures`: an `OWNER_DEPT` marker records OWNERSHIP, and ATLAS
 * schedules a section against teacher and room availability, so a subject owned
 * by a department can legitimately be taught by another department's teacher in
 * another department's room. A trailing "is scheduled against its owning
 * department" therefore asserted something the data cannot support, and it was
 * appended even for a subject with only a room feature and no owner marker at
 * all. Ownership, where it is known, is already stated above; the honest
 * sentence stops there.
 */
export function subjectFeatureHelp(split: SubjectFeatureSplit): string {
	const parts: string[] = [];
	const { roomFeatures, ownerDepartments } = split;

	if (roomFeatures.length > 0) {
		parts.push(
			`This subject needs ${roomFeatures.length} special room feature${roomFeatures.length === 1 ? '' : 's'}: ${roomFeatures.join(', ')}.`,
		);
	}
	if (ownerDepartments.length > 0) {
		const raw = ownerDepartments.map((owner) => owner.raw).join(', ');
		const counted = ownerDepartments.length === 1 ? 'this' : 'these';
		// A5-C2B / demo-walk item 7: the unmapped branch used to read "… and has
		// no plain name for that code, so it is shown as stored." That sentence
		// PUT the gap on screen as the answer, so the page's own text admitted
		// there was nothing to read. It now states the owning code, which is the
		// true fact, and stops there. The marker itself is still spelled out —
		// reachability is what A3-C4-1c requires, and it is why this sentence
		// remains the DETAIL rather than the primary read.
		parts.push(
			hasNamedOwnerDepartments(ownerDepartments)
				? `It is owned by the ${ownerDepartmentPhrase(ownerDepartments)}. ATLAS records ${counted} as ${raw}.`
				: `ATLAS records the owning code as ${raw}.`,
		);
	}
	if (parts.length === 0) return `This subject needs no special room features.`;
	return parts.join(' ');
}
