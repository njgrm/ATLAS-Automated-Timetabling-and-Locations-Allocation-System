import type { SubjectFormValues } from '../components/subjects/SubjectFormModal';

/**
 * SCA-01R3: operator subject-create payload builder.
 *
 * This is the ONLY production path the Subjects page uses to build an
 * operator-create request body. `isSeedable` and `isSystemManaged` are
 * protected MATATAG/bootstrap classification metadata — never operator
 * input — so both are stripped here. The server additionally rejects either
 * key with 400 PROTECTED_FIELD, so even a hostile form state cannot persist
 * a forged classification. Controlled bootstrap rows keep flowing through
 * `ensureDefaultSubjects`, untouched by this builder.
 */
export function buildOperatorSubjectCreatePayload(values: SubjectFormValues): Record<string, unknown> {
	return {
		code: values.code,
		name: values.name,
		minMinutesPerWeek: values.minMinutesPerWeek,
		preferredRoomType: values.preferredRoomType,
		gradeLevels: values.gradeLevels,
		isActive: values.isActive,
		interSectionEnabled: values.interSectionEnabled,
		interSectionGradeLevels: values.interSectionGradeLevels,
		programScopes: values.programScopes,
		allowedSpecializations: values.allowedSpecializations,
		requiredFeatures: values.requiredFeatures,
		qualificationPriority: values.qualificationPriority,
		schedulingDisposition: values.schedulingDisposition,
		outputLabel: values.outputLabel?.trim() ? values.outputLabel.trim() : null,
		ownerDepartment: values.ownerDepartment?.trim() ? values.ownerDepartment.trim() : null,
		allowedOwnerDepartments: values.allowedOwnerDepartments,
		rotationFamily: values.rotationFamily?.trim() ? values.rotationFamily.trim() : null,
		modularGroupId: values.modularGroupId?.trim() ? values.modularGroupId.trim() : null,
		modularOrder: values.modularGroupId?.trim() ? values.modularOrder : null,
	};
}
