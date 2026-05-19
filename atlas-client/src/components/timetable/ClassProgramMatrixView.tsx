import type { ReactNode } from 'react';

import { Badge } from '@/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card';
import { ScrollArea } from '@/ui/scroll-area';
import { cn, formatTime } from '@/lib/utils';
import type { ScheduledEntry } from '@/types';

const DAYS: Array<'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY'> = [
	'MONDAY',
	'TUESDAY',
	'WEDNESDAY',
	'THURSDAY',
	'FRIDAY',
];

const DAY_SHORT: Record<string, string> = {
	MONDAY: 'Mon',
	TUESDAY: 'Tue',
	WEDNESDAY: 'Wed',
	THURSDAY: 'Thu',
	FRIDAY: 'Fri',
};

type MatrixSection = {
	sectionId: number;
	sectionLabel: string;
	gradeLabel: string;
	entriesByDay: Record<string, ScheduledEntry[]>;
	entryCount: number;
};

type MatrixBand = {
	gradeLabel: string;
	sections: MatrixSection[];
};

type ClassProgramMatrixViewProps = {
	entries: ScheduledEntry[];
	sectionLabel: (sectionId: number) => string;
	gradeForSection: (sectionId: number) => number | null;
	subjectLabel: (subjectId: number) => string;
	roomLabelShort: (roomId: number) => string;
	entryContextLabel: (entry: ScheduledEntry) => string;
	onEntryClick: (entry: ScheduledEntry) => void;
	selectedEntryId: string | null;
	header?: ReactNode;
};

function getGradeTone(gradeLabel: string) {
	if (gradeLabel === 'Grade 7') return 'bg-green-50 border-green-200 text-green-800';
	if (gradeLabel === 'Grade 8') return 'bg-yellow-50 border-yellow-200 text-yellow-800';
	if (gradeLabel === 'Grade 9') return 'bg-red-50 border-red-200 text-red-800';
	if (gradeLabel === 'Grade 10') return 'bg-blue-50 border-blue-200 text-blue-800';
	return 'bg-muted/30 border-border text-foreground';
}

function getSectionTone(grade: number | null) {
	if (grade === 7) return 'bg-green-50/70 border-green-200';
	if (grade === 8) return 'bg-yellow-50/70 border-yellow-200';
	if (grade === 9) return 'bg-red-50/70 border-red-200';
	if (grade === 10) return 'bg-blue-50/70 border-blue-200';
	return 'bg-background border-border';
}

function buildBands(entries: ScheduledEntry[], sectionLabel: (sectionId: number) => string, gradeForSection: (sectionId: number) => number | null): MatrixBand[] {
	const sectionMap = new Map<number, MatrixSection>();

	for (const entry of entries) {
		const existing = sectionMap.get(entry.sectionId);
		const grade = gradeForSection(entry.sectionId);
		const gradeLabel = grade ? `Grade ${grade}` : 'Unassigned';
		if (!existing) {
			sectionMap.set(entry.sectionId, {
				sectionId: entry.sectionId,
				sectionLabel: sectionLabel(entry.sectionId),
				gradeLabel,
				entriesByDay: {
					MONDAY: [],
					TUESDAY: [],
					WEDNESDAY: [],
					THURSDAY: [],
					FRIDAY: [],
				},
				entryCount: 0,
			});
		}
		const target = sectionMap.get(entry.sectionId)!;
		target.entriesByDay[entry.day]?.push(entry);
		target.entryCount += 1;
	}

	for (const section of sectionMap.values()) {
		for (const day of DAYS) {
			section.entriesByDay[day].sort((left, right) => left.startTime.localeCompare(right.startTime) || left.subjectId - right.subjectId);
		}
	}

	const bands = new Map<string, MatrixSection[]>();
	for (const section of Array.from(sectionMap.values()).sort((left, right) => {
		const leftGrade = Number.parseInt(left.gradeLabel.replace(/\D+/g, ''), 10) || 99;
		const rightGrade = Number.parseInt(right.gradeLabel.replace(/\D+/g, ''), 10) || 99;
		if (leftGrade !== rightGrade) return leftGrade - rightGrade;
		return left.sectionLabel.localeCompare(right.sectionLabel);
	})) {
		const list = bands.get(section.gradeLabel) ?? [];
		list.push(section);
		bands.set(section.gradeLabel, list);
	}

	return Array.from(bands.entries()).map(([gradeLabel, sections]) => ({
		gradeLabel,
		sections,
	}));
}

export function ClassProgramMatrixView({
	entries,
	sectionLabel,
	gradeForSection,
	subjectLabel,
	roomLabelShort,
	entryContextLabel,
	onEntryClick,
	selectedEntryId,
	header,
}: ClassProgramMatrixViewProps) {
	const bands = buildBands(entries, sectionLabel, gradeForSection);
	const sectionCount = bands.reduce((sum, band) => sum + band.sections.length, 0);
	const totalEntries = entries.length;

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-3">
			<div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
				<Badge variant="outline" className="h-5 px-1.5 text-[0.625rem] uppercase">Class Program Matrix</Badge>
				<span>{bands.length} section bands</span>
				<span className="text-border">•</span>
				<span>{sectionCount} sections</span>
				<span className="text-border">•</span>
				<span>{totalEntries} scheduled entries</span>
				{header}
			</div>

			<ScrollArea className="flex-1 min-h-0">
				<div className="space-y-4 p-4 pt-0">
					{bands.map((band) => (
						<Card key={band.gradeLabel} className="overflow-hidden border-border/80 shadow-sm">
							<CardHeader className={cn('border-b border-border/70 py-3', getGradeTone(band.gradeLabel))}>
								<CardTitle className="flex items-center justify-between gap-2 text-sm">
									<span>{band.gradeLabel}</span>
									<Badge variant="outline" className="h-5 px-1.5 text-[0.625rem]">{band.sections.length} sections</Badge>
								</CardTitle>
							</CardHeader>
							<CardContent className="p-0">
								<div className="overflow-auto">
									<table className="min-w-230 w-full border-collapse text-xs">
										<colgroup>
											<col className="w-48" />
											{DAYS.map((day) => <col key={day} />)}
										</colgroup>
										<thead className="sticky top-0 z-10 bg-background">
											<tr>
												<th className="sticky left-0 z-20 border-b border-r border-border bg-background px-3 py-2 text-left text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
													Section
												</th>
												{DAYS.map((day) => (
													<th key={day} className="border-b border-border px-2 py-2 text-left text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
														{DAY_SHORT[day] ?? day}
													</th>
												))}
											</tr>
										</thead>
										<tbody>
											{band.sections.map((section) => (
												<tr key={section.sectionId} className="align-top">
													<th className={cn('sticky left-0 z-10 border-b border-r border-border px-3 py-2 text-left', getSectionTone(gradeForSection(section.sectionId)))}>
														<div className="space-y-0.5">
															<div className="font-semibold text-foreground">{section.sectionLabel}</div>
															<div className="text-[0.625rem] uppercase tracking-[0.08em] text-muted-foreground">{section.gradeLabel} · {section.entryCount} entries</div>
														</div>
													</th>
													{DAYS.map((day) => {
														const dayEntries = section.entriesByDay[day] ?? [];
														return (
															<td key={`${section.sectionId}-${day}`} className="border-b border-border px-1.5 py-1 align-top">
																{dayEntries.length === 0 ? (
																	<div className="rounded border border-dashed border-border/70 px-2 py-3 text-center text-[0.625rem] text-muted-foreground">
																		Open
																	</div>
																) : (
																	<div className="space-y-1">
																		{dayEntries.map((entry) => {
																			const isSelected = selectedEntryId === entry.entryId;
																			return (
																				<button
																				type="button"
																				key={entry.entryId}
																				aria-label={`${section.sectionLabel} ${DAY_SHORT[day] ?? day} ${formatTime(entry.startTime)} to ${formatTime(entry.endTime)} ${subjectLabel(entry.subjectId)} ${roomLabelShort(entry.roomId)}`}
																				onClick={() => onEntryClick(entry)}
																				className={cn(
																				'block w-full rounded-md border px-2 py-1.5 text-left shadow-sm transition-colors hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
																				isSelected ? 'border-primary bg-primary/10' : 'border-border bg-background',
																				entry.entryKind === 'COHORT' ? 'ring-1 ring-sky-200' : '',
																			)}
																			>
																				<div className="flex items-center justify-between gap-2">
																					<span className="font-semibold text-foreground">{subjectLabel(entry.subjectId)}</span>
																					<span className="text-[0.625rem] text-muted-foreground">{formatTime(entry.startTime)}-{formatTime(entry.endTime)}</span>
																				</div>
																				<div className="mt-0.5 text-[0.625rem] text-muted-foreground">{roomLabelShort(entry.roomId)}</div>
																				<div className="mt-0.5 text-[0.625rem] text-muted-foreground/80">{entryContextLabel(entry)}</div>
																			</button>
																		);
																		})}
																	</div>
																)}
															</td>
														);
													})}
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			</ScrollArea>
		</div>
	);
}
