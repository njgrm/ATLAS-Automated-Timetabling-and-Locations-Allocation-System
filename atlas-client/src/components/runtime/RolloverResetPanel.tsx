import { useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { resetDummyRolloverYear, type RolloverDummyYearResetResult, type RolloverStatus } from '@/lib/settings';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/ui/accordion';
import { Button } from '@/ui/button';
import { Checkbox } from '@/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/ui/dialog';
import { Label } from '@/ui/label';

const DUMMY_YEAR_RESET_CONFIRMATION_TEXT = ['RESET', 'DUMMY', 'SCHOOL', 'YEAR', '1'].join('_');

type RolloverResetPanelProps = {
	schoolId: number;
	status: RolloverStatus | null;
	onApplied?: (status: RolloverStatus) => void;
};

type ResetRowCount = { label: string; value: number };

function resetCountRows(result: RolloverDummyYearResetResult | null): ResetRowCount[] {
	const counts = result?.reset.counts;
	if (!counts) return [];
	return [
		{ label: 'Sections', value: counts.sectionMirrors },
		{ label: 'Generated timetables', value: counts.generationRuns },
		{ label: 'Teaching Load assignments', value: counts.teachingLoadOwnerships },
		{ label: 'Teacher load rows', value: counts.teachingLoadFacultySubjects },
		{ label: 'Policies', value: counts.schedulingPolicies },
		{ label: 'Notes and flags', value: counts.followUpFlags },
		{ label: 'Draft locks', value: counts.lockedSessions },
		{ label: 'Cohorts', value: counts.instructionalCohorts },
		{ label: 'Audit log entries', value: counts.auditLogs },
	].filter((row) => row.value > 0);
}

/** Destructive test-data cleanup only. The parent owns the single status read. */
export function RolloverResetPanel({ schoolId, status, onApplied }: RolloverResetPanelProps) {
	const [resetOpen, setResetOpen] = useState(false);
	const [resetting, setResetting] = useState(false);
	const [showResetCounts, setShowResetCounts] = useState(false);
	const [resetPreview, setResetPreview] = useState<RolloverDummyYearResetResult | null>(null);
	const [confirmAcknowledged, setConfirmAcknowledged] = useState(false);

	if (status?.canResetDummyYear !== true) return null;

	const resetBlocked = Boolean(resetPreview?.reset.publishedResetBlocked || resetPreview?.reset.blockers.length);
	const resetRows = resetCountRows(resetPreview);

	const handlePreviewReset = async () => {
		setResetting(true);
		try {
			const result = await resetDummyRolloverYear(schoolId, { confirmReset: false });
			setResetPreview(result);
			setConfirmAcknowledged(false);
			setShowResetCounts(false);
			setResetOpen(true);
		} catch (error: any) {
			toast.error(error?.response?.data?.message ?? 'ATLAS could not preview the test-data reset.');
		} finally {
			setResetting(false);
		}
	};

	const handleResetAndSync = async () => {
		setResetting(true);
		try {
			const result = await resetDummyRolloverYear(schoolId, { confirmReset: true, confirmationText: DUMMY_YEAR_RESET_CONFIRMATION_TEXT });
			setResetPreview(result);
			setResetOpen(false);
			onApplied?.(result);
			toast.success(`Cleared disposable test data and synced ${result.enrollProActiveYear?.yearLabel ?? 'the active school year'} from EnrollPro.`);
		} catch (error: any) {
			toast.error(error?.response?.data?.message ?? error?.response?.data?.actionHint ?? 'ATLAS could not clear the disposable test data.');
		} finally {
			setResetting(false);
		}
	};

	return (
		<>
			<Accordion type="single" collapsible className="rounded-xl border border-dashed border-amber-200 bg-amber-50/40 px-4" data-testid="rollover-reset-advanced">
				<AccordionItem value="advanced-reset" className="border-0">
					<AccordionTrigger className="min-h-11 py-2 text-left text-sm font-semibold text-amber-900 hover:no-underline">Advanced: clear disposable test data</AccordionTrigger>
					<AccordionContent className="space-y-3 pb-4 text-sm text-amber-950">
						<p>Only use this for genuinely disposable test data. Real school-year history must be archived, not erased.</p>
						<Button type="button" variant="destructive" size="sm" className="min-h-11" onClick={() => void handlePreviewReset()} disabled={resetting} data-testid="rollover-reset-preview">
							{resetting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Trash2 className="mr-2 size-4" />}Clear disposable test data
						</Button>
					</AccordionContent>
				</AccordionItem>
			</Accordion>

			<Dialog open={resetOpen} onOpenChange={setResetOpen}>
				<DialogContent className="w-[calc(100%-2rem)] sm:max-w-2xl" data-testid="rollover-reset-dialog">
					<DialogHeader>
						<DialogTitle>Erase ATLAS disposable test data and sync the new school year</DialogTitle>
						<DialogDescription>This affects ATLAS only. It does not change EnrollPro and cannot be undone.</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><p className="font-semibold">Teaching Load will be cleared and must be rebuilt before timetable generation.</p></div>
						{resetRows.length > 0 ? (
							<div>
								<Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={() => setShowResetCounts((show) => !show)} aria-expanded={showResetCounts} aria-controls="rollover-reset-counts">{showResetCounts ? 'Hide what will be erased' : 'Show what will be erased'}</Button>
								{showResetCounts ? <div id="rollover-reset-counts" className="mt-2 grid gap-2 sm:grid-cols-2">{resetRows.map((row) => <div key={row.label} className="rounded-xl border bg-white p-3"><p className="text-xs text-slate-500">{row.label}</p><p className="text-lg font-semibold">{row.value}</p></div>)}</div> : null}
							</div>
						) : <p className="rounded-xl border bg-slate-50 p-3 text-sm">No disposable test-data records were found.</p>}
						{resetPreview?.reset.blockers.length ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert"><p className="font-semibold">Reset is blocked</p><ul className="mt-1 list-disc pl-5">{resetPreview.reset.blockers.map((blocker) => <li key={blocker.code}>{blocker.message}</li>)}</ul></div> : null}
						<div className="flex items-start gap-2">
							<Checkbox id="rollover-reset-confirm" checked={confirmAcknowledged} onCheckedChange={(checked) => setConfirmAcknowledged(checked === true)} disabled={resetBlocked || resetting} />
							<Label htmlFor="rollover-reset-confirm" className="text-sm leading-relaxed">I understand this permanently erases ATLAS disposable test data.</Label>
						</div>
					</div>
					<DialogFooter>
						<Button type="button" variant="outline" className="min-h-11" onClick={() => setResetOpen(false)} disabled={resetting}>Cancel</Button>
						<Button type="button" variant="destructive" className="min-h-11" onClick={() => void handleResetAndSync()} disabled={resetBlocked || !confirmAcknowledged || resetting} data-testid="rollover-reset-confirm-button">{resetting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}Yes, erase and sync</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
