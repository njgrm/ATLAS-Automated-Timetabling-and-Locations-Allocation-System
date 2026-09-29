import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/ui/accordion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card';

import { RunBlockerTile, type RunReviewChecklistItem } from '@/pages/Dashboard';

/**
 * A7 C6 — one row of the setup checklist.
 *
 * `RunReviewChecklistItem` and the plain checklist literals share this shape.
 * `statusSlot === 'run-blocker'` means the row is the timetable-review step and
 * renders `RunBlockerTile` — the ONE truthful sentence for the run's violation
 * state — instead of a second, differently-worded copy of the same fact.
 */
export type ReadinessRow = {
	label: string;
	done: boolean;
	unresolved?: boolean;
	href: string;
	hint?: string;
	statusSlot?: RunReviewChecklistItem['statusSlot'];
};

type Props = {
	rows: ReadinessRow[];
	/** The run's violation state, forwarded to `RunBlockerTile` where needed. */
	generationAvailable: boolean;
	hardViolationCount: number | null;
	softViolationCount: number | null;
};

/**
 * A7 C6 — the three buckets, as a pure function so the promise this card makes
 * is directly testable without rendering it.
 *
 * A row is UNRESOLVED when the read behind its `done` predicate never came
 * back. Such a row is neither done nor outstanding: the data established only
 * that it could not be read, so listing it as outstanding work tells an older
 * scheduler their published timetable is broken when ATLAS simply does not know.
 * Every row lands in exactly one bucket, and the three partition the input.
 */
export function bucketReadinessRows(rows: ReadinessRow[]) {
	return {
		done: rows.filter((r) => r.done),
		outstanding: rows.filter((r) => !r.done && r.unresolved !== true),
		unresolved: rows.filter((r) => !r.done && r.unresolved === true),
	};
}

/**
 * A7 C6 — the header string. It COUNTS; it never enumerates the outstanding
 * labels. Round 1 enumerated them and the line became seven rows of ALL-CAPS
 * in a 333px rail.
 */
export function readinessHeaderText(rows: ReadinessRow[]): string {
	const { done, outstanding, unresolved } = bucketReadinessRows(rows);
	const total = rows.length;
	const parts = [`${done.length} of ${total} ready`];
	if (outstanding.length > 0) parts.push(`${outstanding.length} step${outstanding.length === 1 ? '' : 's'} to go`);
	if (unresolved.length > 0) parts.push(`${unresolved.length} ATLAS could not check`);
	if (outstanding.length === 0 && unresolved.length === 0) parts.push('nothing left to do');
	return parts.join(' · ');
}

/**
 * A7 C6 — the setup-readiness card, extracted from `pages/Dashboard.tsx` when
 * that file crossed the AGENTS.md 1000-physical-line cap. Pure extraction: same
 * JSX, same classes, same order, same strings.
 *
 * The outstanding rows directly beneath the header ARE the naming: expanded,
 * in demo-story order, one link each to the page that fixes that step. Nothing
 * is behind a click. Only the already-done rows are collapsed.
 */
export function ReadinessCard({ rows, generationAvailable, hardViolationCount, softViolationCount }: Props) {
	const { outstanding: notReady, unresolved: unresolvedItems, done: doneItems } = bucketReadinessRows(rows);
	const runBlocker = <RunBlockerTile generationAvailable={generationAvailable} hardViolationCount={hardViolationCount} softViolationCount={softViolationCount} />;
	const rowBody = (item: ReadinessRow) =>
		item.statusSlot === 'run-blocker' ? runBlocker : item.hint ? (
			<p className='flex items-center gap-1 text-xs text-amber-600 mt-1'>
				<AlertTriangle className='w-3 h-3 shrink-0' />
				{item.hint}
			</p>
		) : null;

	return (
		<Card data-testid='dashboard-readiness-hub'>
			<CardHeader className='border-b border-slate-100 px-6 py-4'>
				<CardTitle className='text-lg text-foreground'>Setup readiness</CardTitle>
				<CardDescription data-testid='dashboard-readiness-count'>
					{readinessHeaderText(rows)}
				</CardDescription>
			</CardHeader>
			<CardContent className='p-2'>
				{notReady.length === 0 && unresolvedItems.length === 0 ? (
					<p className='px-4 py-4 text-sm text-muted-foreground'>Every step is done. Teachers and students see the timetable once it is published.</p>
				) : null}
				{notReady.length > 0 && (
					<ul className='divide-y divide-slate-100' data-testid='dashboard-not-ready-list'>
						{notReady.map((item, idx) => (
							<li key={item.label}>
								<Link to={item.href} data-testid={`dashboard-not-ready-${idx + 1}`} className={`flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-slate-50/80 sm:px-4 sm:py-3 ${idx === 0 ? 'ring-2 ring-amber-300 bg-amber-50/20' : ''}`}>
									<div className='mt-0.5 p-1 rounded-full bg-slate-100'>
										<div className='w-4 h-4 rounded-full border-2 border-slate-300' />
									</div>
									<div className='flex-1 min-w-0'>
										<p className='text-sm font-medium text-foreground'>{item.label}</p>
										{rowBody(item)}
									</div>
									<ChevronRight className='w-4 h-4 text-slate-300 mt-1' />
								</Link>
							</li>
						))}
					</ul>
				)}
				{unresolvedItems.length > 0 && (
					<>
						<p className='px-4 pt-3 text-xs font-semibold text-muted-foreground' data-testid='dashboard-unresolved-heading'>
							ATLAS could not check these
						</p>
						<ul className='divide-y divide-slate-100' data-testid='dashboard-unresolved-list'>
							{unresolvedItems.map((item, idx) => (
								<li key={item.label}>
									<Link to={item.href} data-testid={`dashboard-unresolved-${idx + 1}`} className='flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-slate-50/80 sm:px-4 sm:py-3'>
										<div className='mt-0.5 p-1 rounded-full bg-slate-100'>
											<div className='w-4 h-4 rounded-full border-2 border-dashed border-slate-300' />
										</div>
										<div className='flex-1 min-w-0'>
											<p className='text-sm font-medium text-muted-foreground'>{item.label}</p>
											{item.statusSlot === 'run-blocker' ? runBlocker : item.hint ? (
												<p className='flex items-center gap-1 text-xs text-muted-foreground mt-1'>
													<AlertTriangle className='w-3 h-3 shrink-0' />
													{item.hint}
												</p>
											) : null}
										</div>
										<ChevronRight className='w-4 h-4 text-slate-300 mt-1' />
									</Link>
								</li>
							))}
						</ul>
					</>
				)}
				{doneItems.length > 0 && (
					<Accordion type='single' collapsible className='border-t border-slate-100 px-3 sm:px-4'>
						<AccordionItem value='done'>
							<AccordionTrigger className='py-3'>
								{doneItems.length} already done
							</AccordionTrigger>
							<AccordionContent>
								<ul className='divide-y divide-slate-100'>
									{doneItems.map((item) => (
										<li key={item.label}>
											<Link to={item.href} className='flex items-start gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-slate-50/80'>
												<div className='mt-0.5 shrink-0 p-1 rounded-full bg-emerald-100'>
													<CheckCircle2 className='w-4 h-4 text-emerald-600' />
												</div>
												{/* The label and the hint STACK. As siblings in one
												    flex row a hint longer than its label wrapped
												    underneath and the two overlapped. */}
												<div className='min-w-0 flex-1'>
													<p className='text-sm font-medium text-muted-foreground'>{item.label}</p>
													{item.hint ? <p className='text-xs text-muted-foreground mt-0.5 leading-relaxed'>{item.hint}</p> : null}
												</div>
											</Link>
										</li>
									))}
								</ul>
							</AccordionContent>
						</AccordionItem>
					</Accordion>
				)}
			</CardContent>
		</Card>
	);
}

export default ReadinessCard;
