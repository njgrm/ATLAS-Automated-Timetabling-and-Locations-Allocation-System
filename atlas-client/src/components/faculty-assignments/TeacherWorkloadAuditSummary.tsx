/**
 * TeacherWorkloadAuditSummary — the `Teacher Workload Audit Summary` body of
 * `ReviewTeachersModal` (Fix 26).
 *
 * Rendered by the modal the moment `Review teachers` opens. The four counts the
 * criteria name — total, balanced, underloaded, overloaded — are four
 * `@/ui/button` controls, each a click-through filter over one scrollable list,
 * and every figure on this surface comes from `teacherWorkloadAudit`, which is
 * fed by the roster component's own current data (see that module for the
 * threshold provenance). Nothing here is a literal from the original criteria
 * document.
 *
 * A row opens that teacher's existing `WorkloadInspector` content — the modal
 * passes the SAME `children` node the page already passes, so the per-teacher
 * metrics are imported and reused, never restated here. This module renders
 * only selection chrome and the one row-level figure, which it takes from
 * `TeacherLoadReadout` (the Fix 25 extracted row primitive) so the summary and
 * the roster cannot print different hours for the same teacher.
 *
 * The three state blocks below are honest by construction: no roster published,
 * roster still loading, and roster published without a persisted teaching
 * standard. Each says which, and prints no number it does not have.
 */
import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { DialogClose, DialogFooter } from '@/ui/dialog';
import { cn } from '@/lib/utils';
import { formatFacultyInitials } from '@/components/faculty/teacherNameDisplay';
import { TeacherLoadReadout } from './TeacherLoadReadout';
import {
	TEACHER_WORKLOAD_AUDIT_FILTERS,
	selectTeacherWorkloadAuditRows,
	useTeacherWorkloadAudit,
	type TeacherWorkloadAuditBucket,
	type TeacherWorkloadAuditFilter,
} from './teacherWorkloadAudit';

/**
 * The visual treatment per bucket. One chip, one meaning, reused by count and row.
 *
 * A3-C10 planner correction: `underloaded` was authored with a raw Tailwind
 * amber pair (a 200 border, a 50 surface, a 700 label), which put a BRAND NEW
 * file into the raw-amber corpus the c8 gate exists to converge on, and did it
 * at roughly 4.9:1. The measured `--warning` family is the same signal at
 * 8.415:1 on `--warning-muted` (`index.css:234`), so this file enters the corpus
 * with zero raw amber instead of arriving with a re-pin. The rose and emerald
 * buckets are outside that ratchet, so they are unchanged.
 */
const BUCKET_STYLES: Record<TeacherWorkloadAuditBucket, { chip: string; row: string }> = {
	overloaded: { chip: 'border-rose-200 bg-rose-50 text-rose-700', row: 'hover:border-rose-200 hover:bg-rose-50/40' },
	underloaded: { chip: 'border-warning-border bg-warning-muted text-warning-foreground', row: 'hover:border-warning-border hover:bg-warning-muted' },
	balanced: { chip: 'border-emerald-200 bg-emerald-50 text-emerald-700', row: 'hover:border-emerald-200 hover:bg-emerald-50/40' },
};

/**
 * The figure for one filter control, or `null` when ATLAS does not have one.
 *
 * `null` renders as an em dash, never as a zero. That distinction is load-bearing:
 * without a persisted standard the classified population is EMPTY BY DEFINITION,
 * so a rendered `0` for `Total` would read as "this school has no teachers" — a
 * plausible wrong number. The roster size is a real measurement and is stated in
 * the explanation instead.
 */
function countFor(
	filter: TeacherWorkloadAuditFilter,
	snapshot: ReturnType<typeof useTeacherWorkloadAudit>,
): number | null {
	if (snapshot.status !== 'ready') return null;
	if (snapshot.standardHours == null || !snapshot.policyReady) return null;
	return filter === 'all' ? snapshot.total : snapshot.counts[filter];
}

/** True when a filter has real, classifiable rows behind it. */
function isClassifiable(snapshot: ReturnType<typeof useTeacherWorkloadAudit>): boolean {
	return snapshot.status === 'ready' && snapshot.standardHours != null && snapshot.policyReady;
}

export function TeacherWorkloadAuditSummary({
	onSelectTeacher,
	fill = false,
}: {
	onSelectTeacher: (facultyId: number) => void;
	/**
	 * A6 c9 (38.1) ΓÇö the host owns the scroll region.
	 *
	 * `ReviewTeachersModal` bounds this component itself, because it is the
	 * outermost frame there. The header's `Load summary` window is NOT: it is a
	 * fixed-height flex column whose body is already the ONE `overflow-y-auto`
	 * region, and a second bounded scroller inside it is the nested-scroll defect
	 * a6 C2 measured on this dialog. `fill` therefore drops this component's own
	 * `max-h` and scroller and lets the body scroll, and the roster is unchanged
	 * either way.
	 */
	fill?: boolean;
}) {
	const snapshot = useTeacherWorkloadAudit();
	const [filter, setFilter] = useState<TeacherWorkloadAuditFilter>('all');

	// When the roster stops being classifiable (a school-year change with no
	// persisted policy), a filter that no longer has rows is reset to Total
	// rather than leaving the operator staring at an empty list.
	const effectiveFilter: TeacherWorkloadAuditFilter = useMemo(
		() => (isClassifiable(snapshot) ? filter : 'all'),
		[filter, snapshot],
	);

	const rows = useMemo(
		() => selectTeacherWorkloadAuditRows(snapshot, effectiveFilter),
		[snapshot, effectiveFilter],
	);

	return (
		<div
			className={cn('flex min-h-0 flex-col', fill ? '' : 'max-h-[70vh]')}
			data-testid="workload-audit-summary"
		>
			<div className="shrink-0 space-y-3 border-b border-border/40 px-6 py-4">
				<h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground/60" data-testid="workload-audit-heading">
					Teacher Workload Audit Summary
				</h3>

				{/* AGENTS.md §8: inline stat banner, not a wall of metric cards. */}
				<div className="flex flex-wrap gap-2" role="group" aria-label="Filter teachers by workload bucket">
					{TEACHER_WORKLOAD_AUDIT_FILTERS.map((entry) => {
						const count = countFor(entry.id, snapshot);
						const isActive = effectiveFilter === entry.id;
						const styles = entry.id === 'all' ? null : BUCKET_STYLES[entry.id];
						return (
							<Button
								key={entry.id}
								type="button"
								variant="outline"
								size="sm"
								aria-pressed={isActive}
								disabled={count === null}
								onClick={() => setFilter(entry.id)}
								className={cn(
									'h-auto gap-2 px-3 py-2 font-bold shadow-none',
									isActive && 'border-primary bg-primary/5 ring-1 ring-primary/20',
									styles?.chip,
								)}
								data-testid={`workload-audit-filter-${entry.id}`}
							>
								<span className="text-[11px] uppercase tracking-tight opacity-80">{entry.label}</span>
								<span className="text-base tabular-nums" data-testid={`workload-audit-count-${entry.id}`}>
									{count === null ? '—' : count}
								</span>
							</Button>
						);
					})}
				</div>

				<AuditExplanation snapshot={snapshot} />
			</div>

			<div className={cn('px-6 py-4', fill ? '' : 'min-h-0 flex-1 overflow-y-auto')}>
				{snapshot.status === 'unavailable' || snapshot.status === 'loading' ? (
					<AuditPlaceholder status={snapshot.status} />
				) : rows.length === 0 ? (
					<p className="py-10 text-center text-sm font-semibold text-muted-foreground" data-testid="workload-audit-empty">
						No teacher in this bucket.
					</p>
				) : (
					<ul className="space-y-1.5" data-testid="workload-audit-list">
						{rows.map((row) => (
							<li key={row.facultyId}>
								<Button
									type="button"
									variant="outline"
									onClick={() => onSelectTeacher(row.facultyId)}
									className={cn(
										'h-auto w-full justify-start gap-3 border-border/40 px-3 py-2.5 text-left font-normal shadow-sm',
										BUCKET_STYLES[row.bucket].row,
									)}
									data-testid={`workload-audit-row-${row.facultyId}`}
								>
									<span
										aria-hidden="true"
										className="flex size-8 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-xs font-semibold text-primary"
									>
										{formatFacultyInitials({ firstName: row.firstName, lastName: row.lastName })}
									</span>
									<span className="min-w-0 flex-1">
										<span className="flex items-center gap-2">
											<span className="truncate text-sm font-semibold tracking-tight">{row.displayName}</span>
											{row.isClassAdviser && (
												<Badge variant="secondary" className="h-4 shrink-0 px-1.5 text-[11px] font-semibold uppercase">Adviser</Badge>
											)}
											{row.isOverCap && (
												<Badge variant="outline" className="h-4 shrink-0 border-rose-200 bg-rose-50 px-1.5 text-[11px] font-semibold uppercase text-rose-700">
													Over cap
												</Badge>
											)}
										</span>
										<span className="block truncate text-[11px] font-bold uppercase tracking-tight text-muted-foreground">
											{row.departmentLabel}
										</span>
									</span>
									{/* The FIX 25 row primitive: the summary cannot print a
									    different hours figure than the roster row. */}
									<span className="shrink-0 text-right">
										<TeacherLoadReadout
											displayHours={row.actualHours}
											utilization={Math.round((row.actualHours / row.standardHours) * 1000) / 10}
											isPlaceholder={false}
											standardHours={row.standardHours}
											policyReady
											maxHoursPerWeek={row.maxHoursPerWeek}
										/>
									</span>
									<ChevronRight className="size-4 shrink-0 text-muted-foreground/50" aria-hidden="true" />
								</Button>
							</li>
						))}
					</ul>
				)}
			</div>

			{/* Close only. Print/Export is omitted because this fence has no
			    reviewed export path to reuse, and "Proceed to Timetable" is
			    omitted because navigating away from an unsaved Teaching Load draft
			    is exactly the draft-safety failure the criteria forbid. */}
			<DialogFooter className="shrink-0 border-t border-border/40 px-6 py-3">
				<DialogClose asChild>
					<Button type="button" variant="outline" size="sm" className="font-bold" data-testid="workload-audit-close">
						Close
					</Button>
				</DialogClose>
			</DialogFooter>
		</div>
	);
}

/** States what the figures do and do not cover, in words, with no invented data. */
function AuditExplanation({ snapshot }: { snapshot: ReturnType<typeof useTeacherWorkloadAudit> }) {
	if (snapshot.status === 'unavailable') {
		return (
			<p className="text-xs font-medium text-muted-foreground" data-testid="workload-audit-note">
				The audit summary is built from the teacher roster, which is not published on this screen yet.
			</p>
		);
	}
	if (snapshot.status === 'loading') {
		return (
			<p className="text-xs font-medium text-muted-foreground" data-testid="workload-audit-note">
				Loading the teacher roster. No audit figures are shown until it arrives.
			</p>
		);
	}
	if (snapshot.standardHours == null || !snapshot.policyReady) {
		return (
			<p className="flex items-start gap-2 text-xs font-medium text-warning-foreground" data-testid="workload-audit-note">
				<AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden="true" />
				<span>
					The teaching standard is not set for this school year, so no teacher can be judged balanced,
					underloaded, or overloaded. Those counts are withheld on purpose rather than guessed — the
					roster holds {snapshot.rosterSize} {snapshot.rosterSize === 1 ? 'teacher' : 'teachers'}.
				</span>
			</p>
		);
	}
	return (
		<p className="text-xs font-medium text-muted-foreground" data-testid="workload-audit-note">
			{snapshot.standardHours}h standard, measured on current teaching hours including unsaved draft changes.
			Covers the whole roster, not the current roster filters.
			{snapshot.unclassifiedCount > 0 && ` ${snapshot.unclassifiedCount} not classified (no teaching load or temporary).`}
		</p>
	);
}

function AuditPlaceholder({ status }: { status: 'unavailable' | 'loading' }) {
	return (
		<div className="flex flex-col items-center justify-center gap-2 py-12 text-center" data-testid="workload-audit-unavailable">
			<p className="text-sm font-semibold text-muted-foreground">
				{status === 'loading' ? 'Loading the audit summary…' : 'Audit summary unavailable'}
			</p>
			<p className="max-w-sm text-xs font-medium text-muted-foreground/80">
				{status === 'loading'
					? 'No figure is shown until the roster is loaded.'
					: 'Open the teacher grid to load the roster, then open this summary again. No figure is shown until then.'}
			</p>
		</div>
	);
}
