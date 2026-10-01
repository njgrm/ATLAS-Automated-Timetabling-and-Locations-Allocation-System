import type { Violation } from '@/types';

export function formatRailConstraintMessage(
	message: string,
	violation: Violation | undefined,
	labels: {
		formatConstraintMessage: (message: string) => string;
		subjectLabel: (id: number) => string;
		sectionLabel: (id: number) => string;
	roomLabelShort: (id: number) => string;
	formatFacultyInitials: (id: number) => string;
	},
): string {
	let formatted = labels.formatConstraintMessage(message)
		.replace(/^Entry\s+entry-[^:]+:\s*/i, '')
		.replace(/\bentry-[a-z0-9_-]+\b/gi, 'this class');
	const replacements = [
		['subjectId', 'subject', labels.subjectLabel],
		['sectionId', 'section', labels.sectionLabel],
		['roomId', 'room', labels.roomLabelShort],
		['facultyId', 'faculty', labels.formatFacultyInitials],
	] as const;
	for (const [idKey, noun, format] of replacements) {
		const id = violation?.entities?.[idKey];
		if (typeof id === 'number') formatted = formatted.replace(new RegExp(`\\b${noun}\\s+#?${id}\\b`, 'gi'), format(id));
	}
	return formatted
		.replace(/\bsubject\s+#?\d+\b/gi, 'this subject')
		.replace(/\bsection\s+#?\d+\b/gi, 'this section')
		.replace(/\broom\s+#?\d+\b/gi, 'this room')
		.replace(/\bfaculty\s+#?\d+\b/gi, 'this teacher');
}
