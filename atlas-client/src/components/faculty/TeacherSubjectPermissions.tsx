/**
 * A6 c10 — `Teaching permissions`: the one place a scheduler grants and revokes a
 * teacher's ability to teach outside their own department.
 *
 * THE DEFECT, from the Codex audit of 2026-09-29 (release `e75d6b8f`), finding 6,
 * rated MAJOR: "A real profile shows DEPARTMENT Filipino, SUBJECTS 2, assigned
 * subjects and sections, hours, and CLOSE PROFILE. No edit control, `can teach
 * outside their department` setting, or subject-permission control appears."
 *
 * The server half existed and had no front door. Lane C's fact list: a
 * `CrossDepartmentPermission` row (per teacher × subject) is READ by the
 * qualification evaluator, the teaching-load automation, carry-forward,
 * reconciliation and the suggestion proposal — "but nothing in the server or
 * client can create or delete one". The operator's own sentence: "those controls
 * must be enabled — there was something like that before." So this is the missing
 * front door, and the same window a scheduler reaches from `Cover this class` when
 * a cross-department assignment needs one permission.
 *
 * THE SHAPE, and why it is a panel and not a form.
 *
 *  · ONE switch, plainly labelled `Can teach outside their department`, with the
 *    consequence in the words that matter: turning it OFF does not withdraw a
 *    subject they already have, it means a FUTURE cross-department subject needs
 *    its own permission. A switch whose effect a scheduler cannot predict is a
 *    switch they will not touch.
 *  · The subject list is the real, named list — `MAPEH · Education` — sorted by
 *    subject code, with a REMOVE on each row. The list is the same one Subjects'
 *    `Review coverage` edits (A8 c4 contract §4), because it is the same
 *    `cross_department_permissions` table read through one hook.
 *  · Adding is a picker, not a free-text field, and it is SECONDARY: a permission
 *    is normally granted from the cover window, where the class that needs it is
 *    the reason. This is the maintenance surface.
 *
 * WHEN THE SERVER HAS NO SUCH ROUTE YET. A8 c4's writes are not deployed, so on
 * staging this panel renders ONE quiet grey line saying so, and no control that
 * would fail. It does not render an empty list: an empty list beside the heading
 * `Subjects they may also teach` reads as "this teacher may not teach anything
 * else", which is a claim, and an unavailable control must not make claims.
 */
import { useState } from 'react';
import { Loader2, Plus, X } from 'lucide-react';

import { Button } from '@/ui/button';
import { Label } from '@/ui/label';
import { Switch } from '@/ui/switch';
import { SearchableSelect } from '@/ui/searchable-select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';

import type { Subject } from '@/types';
import type { useSubjectPermissions } from '@/hooks/useSubjectPermissions';

type Permissions = ReturnType<typeof useSubjectPermissions>;

/** The switch's label. The operator's words, not a shortened form of them. */
export const CAN_TEACH_OUTSIDE_LABEL = 'Can teach outside their department';
/** The heading over the per-subject list. Also the operator's. */
export const MAY_ALSO_TEACH_HEADING = 'Subjects they may also teach';
/** The one line that renders when the server has no permission routes yet. */
export const PERMISSIONS_UNAVAILABLE_LINE =
	'Teaching permissions are not available on this server yet.';

export type TeacherSubjectPermissionsProps = {
	permissions: Permissions;
	/** The school's subjects, for the add picker. Filtered here, not by the caller. */
	subjects: ReadonlyArray<Subject>;
	/** True while the add-picker's own subject list is still loading. */
	subjectsLoading?: boolean;
	/** This teacher's own `version`, required by `PUT /faculty/:facultyId`'s CAS. */
	facultyVersion: number;
	/** The teacher's display name, so each row's action names its object. */
	facultyName: string;
};

export function TeacherSubjectPermissions({
	permissions,
	subjects,
	subjectsLoading,
	facultyVersion,
	facultyName,
}: TeacherSubjectPermissionsProps) {
	const [pickerOpen, setPickerOpen] = useState(false);

	const granted = new Set(permissions.permissions.map((row) => row.subjectId));
	/*
	 * A subject the teacher OWNS is not a permission — they are qualified for it
	 * already, and offering to grant them their own subject would be a control that
	 * writes a row nobody asked for. The picker offers only the subjects that are
	 * neither owned nor already granted, so every option is a real decision.
	 */
	const offerable = subjects
		.filter((row) => row.isActive && row.code !== 'HG' && !granted.has(row.id))
		.map((row) => ({ value: String(row.id), label: `${row.code} · ${row.name}` }));
	/*
	 * `SearchableSelect`, not `FilterPicker`, and the reason is the shape of the
	 * decision. A filter names a subset of everything ("Grade: All grades") and its
	 * empty state is a member of its own list; this names ONE subject to add, and
	 * "no subject chosen" is a different kind of nothing. A5 C3's own comment says
	 * the grouped/chooser case is "a different component with a different job" —
	 * and `SearchableSelect` is that component, and it is what `/timetable` already
	 * uses. One look per control still holds: it IS the shared primitive.
	 */
	const subjectChoices = [{ value: '', label: 'Choose a subject…' }, ...offerable];

	return (
		<section className="space-y-3" data-testid="teacher-subject-permissions">
			{/*
			 * A3 c17 (2026-09-29). This block renders INSIDE the Teacher profile
			 * dialog, so it inherits that surface's 14px floor (AGENTS.md §8, and
			 * A3 c17 row 6 "no Profile text under 14px"). `text-[0.7rem]` is
			 * 11.2px. Raised to `text-sm` and de-shouted to sentence case, matching
			 * the sibling section headings in the same dialog so the two agree.
			 */}
			<h4 className="text-sm font-bold text-muted-foreground">
				Teaching permissions
			</h4>

			{permissions.unavailable ? (
				<p className="text-sm text-muted-foreground" data-testid="teacher-permissions-unavailable">
					{PERMISSIONS_UNAVAILABLE_LINE}
				</p>
			) : (
				<>
					{/*
					 * ONE switch, with its consequence stated where the decision is
					 * made — beside the control, not under it as a helper sentence
					 * (AGENTS.md §8), and not in a Tooltip the scheduler has to hunt
					 * for. `Label` is the shared primitive and `Switch` is the shared
					 * switch, so this looks like every other switch in ATLAS.
					 */}
					<div className="flex items-start justify-between gap-4 rounded-lg border border-border/60 px-3 py-2.5">
						<div className="min-w-0">
							<Label htmlFor="can-teach-outside-department" className="text-sm font-semibold text-foreground">
								{CAN_TEACH_OUTSIDE_LABEL}
							</Label>
							<p className="mt-0.5 text-xs text-muted-foreground">
								{permissions.canTeachOutsideDepartment
									? 'On. They can be offered any subject, including ones outside their department.'
									: 'Off. A subject outside their department needs its own permission, granted one at a time below.'}
							</p>
						</div>
						<Switch
							id="can-teach-outside-department"
							checked={permissions.canTeachOutsideDepartment}
							disabled={Boolean(permissions.writeBlockedReason)}
							data-testid="teacher-can-teach-outside"
							aria-label={CAN_TEACH_OUTSIDE_LABEL}
							onCheckedChange={(next) => {
								void permissions.setCanTeachOutsideDepartment(next === true, facultyVersion);
							}}
						/>
					</div>

					<div className="space-y-2">
						<div className="flex flex-wrap items-center justify-between gap-2">
							<h5 className="text-xs font-semibold text-foreground">{MAY_ALSO_TEACH_HEADING}</h5>
							{pickerOpen ? (
								<div className="flex items-center gap-2">
									<SearchableSelect
										ariaLabel="Choose a subject they may also teach"
										items={subjectChoices}
										value=""
										placeholder="Choose a subject…"
										onValueChange={(value) => {
											setPickerOpen(false);
											if (value) void permissions.grant(Number(value));
										}}
									/>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="h-7 cursor-pointer px-2 text-xs"
										data-testid="teacher-permissions-add-cancel"
										onClick={() => setPickerOpen(false)}
									>
										Cancel
									</Button>
								</div>
							) : (
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="h-7 cursor-pointer gap-1.5 px-2.5 text-xs"
									disabled={subjectsLoading || offerable.length === 0 || Boolean(permissions.writeBlockedReason)}
									data-testid="teacher-permissions-add-open"
									onClick={() => setPickerOpen(true)}
								>
									<Plus className="size-3.5" aria-hidden="true" />
									Add a subject
								</Button>
							)}
						</div>

						{permissions.loading && (
							<p className="flex items-center gap-1.5 text-xs text-muted-foreground">
								<Loader2 className="size-3 animate-spin" aria-hidden="true" />
								Loading permissions…
							</p>
						)}

						{!permissions.loading && permissions.permissions.length === 0 && (
							<p className="text-sm text-muted-foreground" data-testid="teacher-permissions-empty">
								No extra subjects yet. Grant one from the cover window, or add one here.
							</p>
						)}

						<ul className="divide-y divide-border/40" data-testid="teacher-permissions-list">
							{permissions.permissions.map((row) => (
								<li
									key={row.subjectId}
									className="flex items-center justify-between gap-3 py-1.5"
									data-testid={`teacher-permission-${row.subjectId}`}
								>
									<p className="min-w-0 truncate text-sm text-foreground">
										<span className="font-medium">{row.code}</span>
										<span className="text-muted-foreground">
											{row.ownerDepartment ? ` · ${row.ownerDepartment} dept` : ''}
										</span>
									</p>
									<Tooltip>
										<TooltipTrigger asChild>
											<span className="shrink-0">
												<Button
													type="button"
													variant="ghost"
													size="sm"
													className="h-7 cursor-pointer gap-1 px-2 text-xs"
													disabled={permissions.revokingSubjectId === row.subjectId || Boolean(permissions.writeBlockedReason)}
													data-testid={`teacher-permission-remove-${row.subjectId}`}
													onClick={() => { void permissions.revoke(row.subjectId); }}
												>
													{permissions.revokingSubjectId === row.subjectId
														? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
														: <X className="size-3.5" aria-hidden="true" />}
													Remove
												</Button>
											</span>
										</TooltipTrigger>
										<TooltipContent side="bottom" className="max-w-72 font-semibold">
											{`Stop ${facultyName} being offered ${row.name}. Subjects they already teach are not affected.`}
										</TooltipContent>
									</Tooltip>
								</li>
							))}
						</ul>
					</div>
				</>
			)}
		</section>
	);
}
