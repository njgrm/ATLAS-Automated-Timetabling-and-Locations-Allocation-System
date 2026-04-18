import { X, Lightbulb, AlertTriangle, ShieldAlert } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

import type { Violation, UnassignedItem, ViolationCode } from '@/types';
import { Button } from '@/ui/button';
import { ScrollArea } from '@/ui/scroll-area';

/* ─── Human-readable explanations per violation code ─── */

export const VIOLATION_EXPLANATIONS: Record<string, { why: string; fix: string }> = {
	FACULTY_TIME_CONFLICT: {
		why: 'This teacher is assigned to two different classes at the same time.',
		fix: 'Move one of the conflicting entries to a different time slot, or reassign one to another teacher.',
	},
	ROOM_TIME_CONFLICT: {
		why: 'Two classes are scheduled in the same room at the same time.',
		fix: 'Move one class to a different time slot, or change one of them to a different room.',
	},
	FACULTY_OVERLOAD: {
		why: "This teacher's total teaching hours exceed their configured weekly maximum.",
		fix: 'Reduce this teacher\'s load by reassigning some of their classes to other qualified faculty.',
	},
	ROOM_TYPE_MISMATCH: {
		why: "The subject requires a specific room type (e.g., Lab) but is placed in a different type (e.g., Classroom).",
		fix: 'Change the room to one that matches the subject\'s preferred room type.',
	},
	FACULTY_SUBJECT_NOT_QUALIFIED: {
		why: 'This teacher is not assigned to teach this particular subject at this grade level.',
		fix: 'Reassign to a qualified teacher, or update Faculty Assignments to add this subject to the teacher.',
	},
	FACULTY_CONSECUTIVE_LIMIT_EXCEEDED: {
		why: 'This teacher has too many consecutive teaching periods without a break.',
		fix: 'Insert a free period or move one class to create a gap. You can also adjust the consecutive limit in Scheduling Policy.',
	},
	FACULTY_BREAK_REQUIREMENT_VIOLATED: {
		why: 'After a long consecutive block, the teacher does not have a long enough break.',
		fix: 'Extend the gap between classes or move an adjacent class to a different slot.',
	},
	FACULTY_DAILY_MAX_EXCEEDED: {
		why: "This teacher's total teaching minutes on this day exceed the daily maximum.",
		fix: 'Move one of their classes on this day to a different day, or reassign to another teacher.',
	},
	FACULTY_EXCESSIVE_TRAVEL_DISTANCE: {
		why: 'Back-to-back classes are in buildings that are too far apart for a comfortable transition.',
		fix: 'Schedule consecutive classes in the same building, or insert a buffer period between them.',
	},
	FACULTY_EXCESSIVE_BUILDING_TRANSITIONS: {
		why: 'This teacher moves between too many different buildings in a single day.',
		fix: 'Cluster classes in fewer buildings, or reassign some to teachers who are already in those buildings.',
	},
	FACULTY_INSUFFICIENT_TRANSITION_BUFFER: {
		why: 'There is not enough time between back-to-back classes in different buildings for the teacher to walk there.',
		fix: 'Add a free period between the transitions, or move one class to the same building.',
	},
	FACULTY_EXCESSIVE_IDLE_GAP: {
		why: 'This teacher has too much idle (unscheduled) time between their classes during the day.',
		fix: 'Compact their schedule by moving classes closer together or reassigning one to reduce the gap.',
	},
	FACULTY_EARLY_START_PREFERENCE: {
		why: 'This teacher expressed a preference not to start too early, but their first class begins in an early slot.',
		fix: 'Move their first class to a later time slot if possible.',
	},
	FACULTY_LATE_END_PREFERENCE: {
		why: 'This teacher prefers not to end too late, but their last class finishes in a late slot.',
		fix: 'Move their last class to an earlier time slot if possible.',
	},
	FACULTY_INSUFFICIENT_DAILY_VACANT: {
		why: "This teacher does not have enough vacant (free) periods during the day for rest or preparation.",
		fix: 'Reduce their daily load or redistribute classes to other days.',
	},
	SECTION_OVERCOMPRESSED: {
		why: 'This section has too many consecutive teaching periods in a row without any break for students.',
		fix: 'Spread the section\'s classes across more time slots or add a break period.',
	},
};

const UNASSIGNED_EXPLANATIONS: Record<string, { why: string; whatItMeans: string }> = {
	NO_QUALIFIED_FACULTY: {
		why: 'No teacher is currently assigned to this subject at this grade level, or all assigned teachers are already fully booked at every available time slot.',
		whatItMeans: 'This session cannot be placed until a qualified teacher becomes available. Check Faculty Assignments to ensure someone is assigned.',
	},
	FACULTY_OVERLOADED: {
		why: 'Teachers who can teach this subject have already reached their maximum weekly or daily teaching hours.',
		whatItMeans: 'Either increase their hour limits in Faculty settings, or assign additional teachers to this subject.',
	},
	NO_AVAILABLE_SLOT: {
		why: 'Every time slot that could host this session already causes a hard conflict (teacher or room double-booking).',
		whatItMeans: 'The schedule is too dense. Consider adding more rooms, teachers, or extending the school day in your policy.',
	},
	NO_COMPATIBLE_ROOM: {
		why: 'The subject requires a specific room type (e.g., Lab), but no room of that type is free at any available time.',
		whatItMeans: 'Add more rooms of the required type, or change the subject\'s preferred room type if the subject can be taught elsewhere.',
	},
};

interface ExplainabilityDrawerProps {
	open: boolean;
	onClose: () => void;
	/** The currently selected violation to explain */
	violation?: Violation | null;
	/** The currently selected unassigned item to explain */
	unassignedItem?: UnassignedItem | null;
	/** Context label (e.g., preview result) */
	contextLabel?: string;
}

export function ExplainabilityDrawer({
	open,
	onClose,
	violation,
	unassignedItem,
	contextLabel,
}: ExplainabilityDrawerProps) {
	const hasContent = violation || unassignedItem;

	return (
		<AnimatePresence>
			{open && (
				<motion.div
					initial={{ x: '100%', opacity: 0 }}
					animate={{ x: 0, opacity: 1 }}
					exit={{ x: '100%', opacity: 0 }}
					transition={{ duration: 0.2, ease: 'easeInOut' }}
					className="fixed right-0 top-14 bottom-0 w-80 z-50 border-l border-border bg-background shadow-xl flex flex-col"
				>
					{/* Header */}
					<div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-border">
						<Lightbulb className="size-4 text-primary" />
						<span className="text-sm font-semibold flex-1">Why This Happened</span>
						<Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose}>
							<X className="size-3.5" />
						</Button>
					</div>

					<ScrollArea className="flex-1 min-h-0">
						<div className="px-4 py-4 space-y-4">
							{!hasContent ? (
								<div className="text-center py-8">
									<Lightbulb className="mx-auto size-8 text-muted-foreground/30 mb-2" />
									<p className="text-xs text-muted-foreground">
										Select a violation or unassigned item to see a plain-language explanation.
									</p>
								</div>
							) : violation ? (
								<>
									{/* Violation explanation */}
									<div className="space-y-3">
										<div className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium ${
											violation.severity === 'HARD'
												? 'bg-red-50 text-red-700 border border-red-200'
												: 'bg-amber-50 text-amber-700 border border-amber-200'
										}`}>
											<ShieldAlert className="size-3.5 shrink-0" />
											{violation.severity === 'HARD' ? 'Hard Violation' : 'Soft Violation'}
											{violation.severity === 'HARD' && (
												<span className="ml-auto text-[0.625rem] opacity-75">Publish blocker</span>
											)}
										</div>

										<div>
											<h4 className="text-xs font-semibold text-foreground mb-1">What happened</h4>
											<p className="text-xs text-muted-foreground leading-relaxed">
												{violation.message}
											</p>
										</div>

										{VIOLATION_EXPLANATIONS[violation.code] && (
											<>
												<div>
													<h4 className="text-xs font-semibold text-foreground mb-1">Why this matters</h4>
													<p className="text-xs text-muted-foreground leading-relaxed">
														{VIOLATION_EXPLANATIONS[violation.code].why}
													</p>
												</div>
												<div>
													<h4 className="text-xs font-semibold text-foreground mb-1">How to fix it</h4>
													<p className="text-xs text-muted-foreground leading-relaxed">
														{VIOLATION_EXPLANATIONS[violation.code].fix}
													</p>
												</div>
											</>
										)}

										{contextLabel && (
											<div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-[0.625rem] text-muted-foreground">
												Context: {contextLabel}
											</div>
										)}
									</div>
								</>
							) : unassignedItem ? (
								<>
									{/* Unassigned explanation */}
									<div className="space-y-3">
										<div className="flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
											<AlertTriangle className="size-3.5 shrink-0" />
											Unassigned Session
											<span className="ml-auto text-[0.625rem] opacity-75">Publish blocker</span>
										</div>

										<div>
											<h4 className="text-xs font-semibold text-foreground mb-1">Reason</h4>
											<p className="text-xs text-muted-foreground leading-relaxed font-mono">
												{unassignedItem.reason}
											</p>
										</div>

										{UNASSIGNED_EXPLANATIONS[unassignedItem.reason] && (
											<>
												<div>
													<h4 className="text-xs font-semibold text-foreground mb-1">Why this happened</h4>
													<p className="text-xs text-muted-foreground leading-relaxed">
														{UNASSIGNED_EXPLANATIONS[unassignedItem.reason].why}
													</p>
												</div>
												<div>
													<h4 className="text-xs font-semibold text-foreground mb-1">What this means for you</h4>
													<p className="text-xs text-muted-foreground leading-relaxed">
														{UNASSIGNED_EXPLANATIONS[unassignedItem.reason].whatItMeans}
													</p>
												</div>
											</>
										)}
									</div>
								</>
							) : null}
						</div>
					</ScrollArea>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
