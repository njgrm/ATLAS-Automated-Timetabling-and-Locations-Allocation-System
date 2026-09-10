import type { Subject } from '@/types';
import type { SubjectFormValues } from '@/components/subjects/SubjectFormModal';

/**
 * Convert a Subject to SubjectFormValues for the edit modal.
 */
export function subjectToFormValues(subject: Subject): SubjectFormValues {
	return {
		id: subject.id,
		code: subject.code,
		outputLabel: subject.outputLabel ?? subject.displayCode ?? '',
		name: subject.name,
		ownerDepartment: subject.ownerDepartment ?? '',
		allowedOwnerDepartments: [...(subject.allowedOwnerDepartments ?? [])],
		qualificationPriority: subject.qualificationPriority ?? 'DEPARTMENT_FIRST',
		rotationFamily: subject.rotationFamily ?? '',
		minMinutesPerWeek: subject.minMinutesPerWeek,
		preferredRoomType: subject.preferredRoomType,
		gradeLevels: [...subject.gradeLevels],
		isActive: subject.isActive,
		isSeedable: subject.isSeedable,
		isSystemManaged: subject.isSystemManaged ?? false,
		interSectionEnabled: subject.interSectionEnabled ?? false,
		interSectionGradeLevels: [...(subject.interSectionGradeLevels ?? [])],
		modularGroupId: subject.modularGroupId ?? '',
		modularOrder: subject.modularOrder ?? null,
		programScopes: [...(subject.programScopes ?? ['REGULAR'])],
		allowedSpecializations: [...(subject.allowedSpecializations ?? [])],
		requiredFeatures: [...(subject.requiredFeatures ?? [])],
	};
}
