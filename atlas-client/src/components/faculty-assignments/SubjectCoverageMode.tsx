import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
	AlertTriangle,
	ArrowRight,
	CheckCircle2,
	ChevronDown,
	ChevronUp,
	FolderOpen,
	Loader2,
} from 'lucide-react';

import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card';
import { ScrollArea } from '@/ui/scroll-area';

import { fetchSubjectCoverageSummary } from '@/lib/coverage';
import type { SubjectCoverageRow, SubjectCoverageSummary, UncoveredSectionInfo } from '@/types';

export type SubjectCoverageModeProps = {
	activeSchoolYearId: number | null;
	selectedSubjectId?: number | null;
	onFocusSection?: (sectionId: number, subjectId: number) => void;
};

function CoverageBadge({ row }: { row: SubjectCoverageRow }) {
	if (row.status === 'FULL') {
		return <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 gap-1 text-[11px] font-semibold"><CheckCircle2 className="w-3 h-3" /> Full</Badge>;
	}
	if (row.status === 'PARTIAL') {
		return <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 gap-1 text-[11px] font-semibold"><AlertTriangle className="w-3 h-3" /> Partial</Badge>;
	}
	return <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700 gap-1 text-[11px] font-semibold"><AlertTriangle className="w-3 h-3" /> None</Badge>;
}

function SectionList({ sections }: { sections: UncoveredSectionInfo[] }) {
	const [expanded, setExpanded] = useState(false);
	if (sections.length === 0) return null;
	const visible = expanded ? sections : sections.slice(0, 3);
	const hidden = sections.length - visible.length;

	return (
		<div className="mt-1.5">
			<ul className="space-y-0.5">
					{visible.map((s) => (
					<li key={s.sectionId} className="flex items-center gap-1.5 text-xs text-muted-foreground">
						<span className="w-1 h-1 rounded-full bg-amber-400 shrink-0" />
						<span className="font-medium">{s.sectionName}</span>
						<span className="text-muted-foreground/60">· Gr {s.gradeLevel}</span>
					</li>
				))}
			</ul>
			{hidden > 0 && (
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="mt-1 h-auto p-0 gap-1 text-xs text-primary font-medium hover:underline"
					onClick={() => setExpanded(!expanded)}
				>
					{expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
					{expanded ? 'Show fewer' : `${hidden} more`}
				</Button>
			)}
		</div>
	);
}

function SubjectRow({
	row,
	onFocusSection,
}: {
	row: SubjectCoverageRow;
	onFocusSection?: (sectionId: number, subjectId: number) => void;
}) {
	const hasMissing = row.uncoveredSectionCount > 0;
	const firstUncovered = row.uncoveredSections[0];

	return (
		<div className={`flex items-start gap-4 p-4 rounded-xl border transition-colors ${hasMissing ? 'border-amber-200 bg-amber-50/30' : 'border-border/40 bg-background'}`}>
			<div className="shrink-0 mt-0.5">
				{hasMissing ? (
					<div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
						<AlertTriangle className="w-4 h-4 text-amber-600" />
					</div>
				) : (
					<div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
						<CheckCircle2 className="w-4 h-4 text-emerald-600" />
					</div>
				)}
			</div>

			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-2 flex-wrap">
					<span className="font-mono text-sm font-bold text-foreground">{row.subjectCode}</span>
					<span className="text-sm text-muted-foreground truncate">{row.subjectName}</span>
					<CoverageBadge row={row} />
				</div>

				<div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
					<span className="font-medium">
						{row.ownedSectionCount}/{row.relevantSectionCount} covered
					</span>
					{row.ownedByPlaceholderCount > 0 && (
						<span className="text-violet-600 font-medium">
							{row.ownedByPlaceholderCount} via placeholder
						</span>
					)}
					{row.uncoveredSectionCount > 0 && (
						<span className="text-amber-600 font-medium">
							{row.uncoveredSectionCount} uncovered
						</span>
					)}
				</div>

				{hasMissing && row.uncoveredSections.length > 0 && (
					<SectionList sections={row.uncoveredSections} />
				)}
			</div>

			{hasMissing && firstUncovered && onFocusSection && (
				<Button
					variant="outline"
					size="sm"
					className="shrink-0 h-8 gap-1 text-xs font-semibold"
					onClick={() => onFocusSection(firstUncovered.sectionId, row.subjectId)}
				>
					Focus section
					<ArrowRight className="w-3 h-3" />
				</Button>
			)}
		</div>
	);
}

export function SubjectCoverageMode({ activeSchoolYearId, selectedSubjectId, onFocusSection }: SubjectCoverageModeProps) {
	const [searchParams] = useSearchParams();
	const [summary, setSummary] = useState<SubjectCoverageSummary | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const subjectRowRefs = useRef<Map<number, HTMLDivElement>>(new Map());

	useEffect(() => {
		if (!activeSchoolYearId) {
			setLoading(false);
			return;
		}
		let cancelled = false;
		setLoading(true);
		setError(null);

		fetchSubjectCoverageSummary(activeSchoolYearId)
			.then((data) => {
				if (!cancelled) setSummary(data);
			})
			.catch((err) => {
				if (!cancelled) setError(err?.message ?? 'Failed to load coverage data.');
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});

		return () => { cancelled = true; };
	}, [activeSchoolYearId]);

	const sortedRows = useMemo(() => {
		if (!summary) return [];
		return [...summary.rows].sort((a, b) => {
			if (a.uncoveredSectionCount !== b.uncoveredSectionCount) {
				return b.uncoveredSectionCount - a.uncoveredSectionCount;
			}
			return a.subjectCode.localeCompare(b.subjectCode);
		});
	}, [summary]);

	const missingCount = summary?.rows.filter((r) => r.uncoveredSectionCount > 0).length ?? 0;
	const totalCount = summary?.rows.length ?? 0;

	const handleFocusSection = useCallback((sectionId: number, subjectId: number) => {
		onFocusSection?.(sectionId, subjectId);
	}, [onFocusSection]);

	const filterParam = searchParams.get('filter');
	const isFilteringMissing = filterParam === 'missing-coverage';

	const displayRows = useMemo(() => {
		if (!isFilteringMissing) return sortedRows;
		return sortedRows.filter((r) => r.uncoveredSectionCount > 0);
	}, [sortedRows, isFilteringMissing]);

	// Synchronize focus after async coverage rows have rendered, not merely when
	// the route intent first sets the ID.
	useEffect(() => {
		if (loading || selectedSubjectId == null) return;
		const rowEl = subjectRowRefs.current.get(selectedSubjectId);
		if (!rowEl) return;
		rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
		rowEl.focus({ preventScroll: true });
	}, [displayRows, loading, selectedSubjectId]);

	return (
		<div className="flex flex-col h-full min-h-0">
			{/* Header strip */}
			<div className="shrink-0 px-4 py-3 border-b border-border/40">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<div className="flex items-center gap-2">
						<h2 className="text-sm font-bold text-foreground flex items-center gap-2">
							<FolderOpen className="w-4 h-4 text-primary" />
							Subject coverage
						</h2>
						{!loading && summary && (
							<div className="flex flex-wrap items-center gap-1.5">
								<Badge variant="outline" className="text-[11px] font-semibold">
									{totalCount} subjects
								</Badge>
								{missingCount > 0 ? (
									<Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 text-[11px] font-semibold gap-1">
										<AlertTriangle className="w-3 h-3" />
										{missingCount} need coverage
									</Badge>
								) : (
									<Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 text-[11px] font-semibold gap-1">
										<CheckCircle2 className="w-3 h-3" />
										All covered
									</Badge>
								)}
							</div>
						)}
					</div>
					{filterParam === 'missing-coverage' && (
						<Badge variant="outline" className="text-[11px] font-semibold border-amber-200 bg-amber-50 text-amber-700">
							Filtered: missing coverage
						</Badge>
					)}
				</div>
			</div>

			{/* Content */}
			<ScrollArea className="flex-1 min-h-0">
				<div className="p-4 space-y-2">
					{loading && (
						<div className="flex items-center justify-center py-12 text-sm text-muted-foreground gap-2">
							<Loader2 className="w-4 h-4 animate-spin" />
							Loading coverage data…
						</div>
					)}

					{error && (
						<div className="flex flex-col items-center justify-center py-12 text-sm text-red-600 gap-3">
							<div className="flex items-center gap-2">
								<AlertTriangle className="w-4 h-4" />
								<span>{error}</span>
							</div>
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="h-8 px-4 text-xs font-bold uppercase tracking-tight"
								onClick={() => {
									if (!activeSchoolYearId) return;
									setLoading(true);
									setError(null);
									fetchSubjectCoverageSummary(activeSchoolYearId)
										.then((data) => setSummary(data))
										.catch((err) => setError(err?.message ?? 'Failed to load coverage data.'))
										.finally(() => setLoading(false));
								}}
							>
								Retry
							</Button>
						</div>
					)}

				{!loading && !error && sortedRows.length === 0 && (
					<div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
						No subjects found.
					</div>
				)}

				{!loading && !error && sortedRows.length > 0 && displayRows.length === 0 && isFilteringMissing && (
					<div className="flex flex-col items-center justify-center py-12 text-center gap-2">
						<CheckCircle2 className="w-8 h-8 text-emerald-500" />
						<p className="text-sm font-medium text-foreground">No subjects need coverage.</p>
						<p className="text-xs text-muted-foreground">All subjects have teachers assigned to every required section.</p>
					</div>
				)}

				{!loading && !error && displayRows.map((row) => (
					<div
						key={row.subjectId}
						data-subject-id={row.subjectId}
						data-testid="teaching-load-subject-focus-target"
						ref={(el) => {
							if (el) subjectRowRefs.current.set(row.subjectId, el);
							else subjectRowRefs.current.delete(row.subjectId);
						}}
						tabIndex={-1}
						className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-xl"
					>
						<SubjectRow
							row={row}
							onFocusSection={handleFocusSection}
						/>
					</div>
				))}
				</div>
			</ScrollArea>
		</div>
	);
}
