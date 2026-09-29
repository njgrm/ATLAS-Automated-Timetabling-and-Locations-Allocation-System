import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ChevronRight, RefreshCw } from 'lucide-react';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/ui/accordion';
import { Button } from '@/ui/button';
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
	/**
	 * A9 c8 (F1) — the readiness read for this school has NOT answered yet.
	 *
	 * While it is true the whole region says so, in ONE line, and publishes no count at
	 * all. The live screen this fixes published `0 OF 10 READY · 1 STEP TO GO · 9 ATLAS
	 * COULD NOT CHECK` over a request that was merely in flight (a 17.5 s event-loop stall
	 * on live), because `domainAvailability` starts all-`false` and a read that had not
	 * ARRIVED looked exactly like a read that had FAILED. "Could not check" is now earned
	 * only by a failure; the words used here are the ones the source chip and the source
	 * panel already own (`checking_source` — "Checking source"), so no second vocabulary is
	 * introduced for the same event.
	 */
	pending?: boolean;
	/**
	 * A9 c8 (F1) — the retry the "could not check" state previously lacked. A failure the
	 * scheduler cannot re-read is a dead end: the only retry lived in the page header, three
	 * regions away. It is the SAME `outline`/`sm` button the source panel's repair links
	 * already use (`AGENTS.md` §8 one look per control), and it appears only when there is
	 * something to retry.
	 */
	onRetry?: () => void;
};

/**
 * A9 c8 (F1) — THE READING LINE, as a pure function so a control can decide the exact
 * wording instead of grepping the JSX.
 *
 * It is deliberately ONE short sentence. The alternative — a spinner region, a progress
 * line, a "9 of 10 checks still running" counter — adds words and controls to the calmest
 * screen in the app to describe a wait the scheduler did not cause and cannot shorten.
 */
export function readinessPendingSentence(): string {
	return 'Checking source. This list appears as soon as the check finishes.';
}

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
export function ReadinessCard({ rows, generationAvailable, hardViolationCount, softViolationCount, pending = false, onRetry }: Props) {
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
				{/* A9 c8 (F1) — PENDING REPLACES THE COUNT, it does not sit above it. While
				    the read is in flight there is no `N of M ready`, no `N steps to go` and no
				    `N ATLAS could not check`: all three would be claims about data that does
				    not exist yet, and the third is the one the audit was called over. */}
				<CardDescription data-testid='dashboard-readiness-count'>
					{pending ? readinessPendingSentence() : readinessHeaderText(rows)}
				</CardDescription>
			</CardHeader>
			<CardContent className='p-2'>
				{pending ? null : (
					<>
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
						{/* A9 c8 (F1) — the retry lives ON the sentence that says the read
						    failed. It replaces nothing: the heading was already there, and the
						    button is the same `outline`/`sm` control the source panel's repair
						    links use, so it is a known shape rather than a new one. */}
						<div className='flex items-center justify-between gap-2 px-4 pt-3'>
							<p className='text-xs font-semibold text-muted-foreground' data-testid='dashboard-unresolved-heading'>
								ATLAS could not check these
							</p>
							{onRetry ? (
								<Button type='button' variant='outline' size='sm' onClick={onRetry} className='h-7 shrink-0 gap-1.5 px-2.5 text-xs font-semibold' data-testid='dashboard-unresolved-retry'>
									<RefreshCw className='w-3 h-3' />
									Check again
								</Button>
							) : null}
						</div>
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
					</>
				)}
			</CardContent>
		</Card>
	);
}

export default ReadinessCard;
