import { X, Lightbulb, AlertTriangle, ShieldAlert } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

import type { Violation, UnassignedItem, ViolationCode } from '@/types';
import { Button } from '@/ui/button';
import { ScrollArea } from '@/ui/scroll-area';
import { isBlockingHardViolation, isInformationalHardViolation } from '@/components/timetable/simplePublishReadiness';
import { VIOLATION_PRESENTATION, formatIdentityFallbackText, formatWarningMessageText } from '@/lib/violation-presentation';

/* ─── Human-readable explanations per violation code ─── */

export const VIOLATION_EXPLANATIONS: Record<string, { why: string; fix: string }> = Object.fromEntries(
	Object.entries(VIOLATION_PRESENTATION).map(([code, copy]) => [code, { why: copy.meaning, fix: copy.action }]),
);

const UNASSIGNED_EXPLANATIONS: Record<string, { why: string; whatItMeans: string }> = {
	NO_QUALIFIED_FACULTY: {
		why: 'No teacher is currently assigned to this subject at this grade level, or all assigned teachers are already fully booked at every available time slot.',
		whatItMeans: 'This session cannot be placed until a qualified teacher becomes available. Check Teaching Load to ensure someone is assigned.',
	},
	FACULTY_OVERLOADED: {
		why: 'Teachers who can teach this subject have already reached their maximum weekly or daily teaching hours.',
		whatItMeans: 'Either increase their hour limits in Teacher settings, or assign additional teachers to this subject.',
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
	/**
	 * WARNING-READABILITY-C01-R1 (F1): optional caller-supplied formatter with
	 * reference-map resolution (the workspace passes its constraint-message
	 * formatter so the drawer shows teacher names, not ids). When absent the
	 * drawer still satisfies R2 via the map-less fallback: no `Faculty 16`
	 * ids, no bare `min`/`h`, no shouted weekday names.
	 */
	formatMessage?: (message: string, violation?: Violation) => string;
}

export function ExplainabilityDrawer({
	open,
	onClose,
	violation,
	unassignedItem,
	contextLabel,
	formatMessage,
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
									{(() => {
										// C07B/B5 — publication semantics come from the server allowlist,
										// never from HARD severity alone.
										const blocksPublish = isBlockingHardViolation(violation);
										const informationalHard = isInformationalHardViolation(violation);
										return (
									<div className="space-y-3">
										<div className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium ${
											blocksPublish
												? 'bg-red-50 text-red-700 border border-red-200'
												: 'bg-amber-50 text-amber-700 border border-amber-200'
										}`} data-violation-severity={violation.severity} data-publish-blocker={blocksPublish ? 'true' : 'false'}>
											<ShieldAlert className="size-3.5 shrink-0" />
											{blocksPublish ? 'Hard Violation' : informationalHard ? 'Hard Violation (informational)' : 'Soft Violation'}
											{blocksPublish && (
												<span className="ml-auto text-[0.625rem] opacity-75" data-testid="explain-publish-blocker">Publish blocker</span>
											)}
											{informationalHard && (
												<span className="ml-auto text-[0.625rem] opacity-75" data-testid="explain-not-publish-blocker">Not a publish blocker</span>
											)}
										</div>

										<div>
											<h4 className="text-xs font-semibold text-foreground mb-1">What happened</h4>
											<p className="text-xs text-muted-foreground leading-relaxed">
												{formatMessage
													? formatMessage(violation.message, violation)
													: formatWarningMessageText(formatIdentityFallbackText(violation.message))}
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

										{Boolean(violation.meta && (violation.meta.cohortCode != null || violation.meta.cohortName != null)) && (
											<div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-[0.625rem] text-sky-900">
												Cohort context: {String((violation.meta?.cohortCode as string | number | boolean | null | undefined) ?? (violation.meta?.cohortName as string | number | boolean | null | undefined) ?? '')}
												{violation.meta?.cohortName && violation.meta?.cohortCode ? ` · ${String(violation.meta.cohortName as string | number | boolean)}` : ''}
											</div>
										)}

										{contextLabel && (
											<div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-[0.625rem] text-muted-foreground">
												Context: {contextLabel}
											</div>
										)}
									</div>
										);
									})()}
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

										{(unassignedItem.entryKind === 'COHORT' || unassignedItem.adviserName || unassignedItem.programType) && (
											<div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-[0.625rem] text-muted-foreground space-y-1">
												{unassignedItem.entryKind === 'COHORT' && unassignedItem.cohortCode && (
													<div>Cohort: {unassignedItem.cohortCode}{unassignedItem.cohortName ? ` · ${unassignedItem.cohortName}` : ''}</div>
												)}
												{unassignedItem.programType && unassignedItem.programType !== 'REGULAR' && (
													<div>Program: {unassignedItem.programCode ?? unassignedItem.programType}</div>
												)}
												{unassignedItem.adviserName && <div>Adviser: {unassignedItem.adviserName}</div>}
											</div>
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
