import { useEffect, useState, useCallback } from 'react';
import {
	BookOpen,
	RefreshCw,
	Users,
	AlertTriangle,
	ClipboardList,
	Home,
	Building2,
	CheckCircle2,
} from 'lucide-react';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from '@/ui/sheet';
import { Skeleton } from '@/ui/skeleton';
import atlasApi from '@/lib/api';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { getDepartmentColor } from '@/lib/department-colors';
import { departmentLabel } from '@/lib/deped-glossary';
import type { SectionDetail } from './SectionRow';
import type { RoomOption } from './SectionRoomPicker';
import { cn } from '@/lib/utils';

/* ─── Types (matching server) ─── */
export interface SectionAssignedClassRow {
	subjectId: number;
	subjectCode: string;
	subjectName: string;
	subjectDisplayLabel: string;
	minMinutesPerWeek: number;
	rotationFamily: string | null;
	rotationTermRank: number | null;
	rotationTermLabel: string | null;
	rotationTermGroupId: string | null;
	rotationTermCount: number | null;
	facultyId: number;
	facultyName: string;
	facultyDepartment: string | null;
	facultySpecialization: string | null;
	assignmentKind: 'REAL_OWNERSHIP';
	specializationCode: string | null;
	specializationLabel: string | null;
}

export interface SectionUnassignedExpectedClassRow {
	subjectId: number;
	subjectCode: string;
	subjectName: string;
	subjectDisplayLabel: string;
	minMinutesPerWeek: number;
	rotationFamily: string | null;
	rotationTermRank: number | null;
	rotationTermLabel: string | null;
	rotationTermGroupId: string | null;
	rotationTermCount: number | null;
}

export interface SectionAssignedClassesTotals {
	assignedClassCount: number;
	rotationFamilyClassCount: number;
	unassignedClassCount: number;
}

export interface SectionAssignedClassesResult {
	sectionId: number;
	sectionName: string;
	gradeLevel: number;
	programType: string;
	schoolYearId: number;
	classes: SectionAssignedClassRow[];
	totals: SectionAssignedClassesTotals;
	unassignedExpectedClasses?: SectionUnassignedExpectedClassRow[];
}

interface SectionDetailsSheetProps {
	sectionId: number | null;
	sectionName: string | null;
	section?: SectionDetail | null;
	homeRoom?: RoomOption | null;
	schoolYearId: number | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

const GRADE_BADGE_COLORS: Record<string, string> = {
	'7': 'bg-green-100/80 text-green-700 border-green-200',
	'8': 'bg-yellow-100/80 text-yellow-700 border-yellow-200',
	'9': 'bg-red-100/80 text-red-700 border-red-200',
	'10': 'bg-blue-100/80 text-blue-700 border-blue-200',
};

function resolveRotationTermLabel(input: { rotationTermLabel?: string | null; rotationTermRank?: number | null }): string | null {
	const explicitLabel = (input.rotationTermLabel ?? '').trim();
	if (explicitLabel.length > 0) {
		const rankMatch = explicitLabel.match(/(\d+)/);
		if (rankMatch) {
			const parsed = Number(rankMatch[1]);
			if (Number.isInteger(parsed) && parsed > 0) {
				return `Term ${parsed}`;
			}
		}
		return explicitLabel;
	}
	if (typeof input.rotationTermRank === 'number' && Number.isInteger(input.rotationTermRank) && input.rotationTermRank > 0) {
		return `Term ${input.rotationTermRank}`;
	}
	return null;
}

export function SectionDetailsSheet({
	sectionId,
	sectionName,
	section,
	homeRoom,
	schoolYearId,
	open,
	onOpenChange,
}: SectionDetailsSheetProps) {
	const [loading, setLoading] = useState(false);
	const [data, setData] = useState<SectionAssignedClassesResult | null>(null);
	const selectedGradeKey = String(section?.gradeLevelName?.match(/\d+/)?.[0] ?? data?.gradeLevel ?? '');

	const fetchDetails = useCallback(async () => {
		if (!sectionId || !schoolYearId) return;
		setLoading(true);
		try {
			const { data } = await atlasApi.get<SectionAssignedClassesResult>(
				`/sections/${sectionId}/assigned-classes`,
				{ params: { schoolYearId, includeDiagnostics: true } }
			);
			setData(data);
		} catch (err) {
			toast.error('Failed to load section class details');
			onOpenChange(false);
		} finally {
			setLoading(false);
		}
	}, [sectionId, schoolYearId, onOpenChange]);

	useEffect(() => {
		if (open) {
			fetchDetails();
		} else {
			setData(null);
		}
	}, [open, fetchDetails]);

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="w-full overflow-y-auto sm:max-w-xl">
				<SheetHeader className="pb-6 border-b">
					<SheetTitle className="flex items-center gap-2 text-xl font-bold">
						<Users className="size-5 text-primary" />
						{sectionName ?? 'Section details'}
					</SheetTitle>
					<SheetDescription>
						Class coverage, teacher assignments, and home-room context for this section.
					</SheetDescription>
				</SheetHeader>

				<div className="py-6 space-y-8">
					{loading ? (
						<div className="space-y-6">
							{Array.from({ length: 5 }).map((_, i) => (
								<div key={i} className="space-y-3">
									<Skeleton className="h-4 w-1/3" />
									<Skeleton className="h-20 w-full rounded-xl" />
								</div>
							))}
						</div>
					) : data ? (
						<>
							{/* Section Context */}
							<div className="space-y-3 rounded-2xl border bg-primary/5 p-4">
								<div className="flex flex-wrap items-center gap-2">
									<Badge variant="outline" className={cn('rounded-full shadow-none', GRADE_BADGE_COLORS[selectedGradeKey] ?? 'bg-slate-100 text-slate-700 border-slate-200')}>
										Grade {section?.gradeLevelName?.replace(/^Grade\s+/i, '') ?? data.gradeLevel}
									</Badge>
									<Badge variant="outline" className="rounded-full bg-white text-slate-700 shadow-none">
										{section?.isSpecialProgram ? section.programName || section.programCode || data.programType : 'Regular Program'}
									</Badge>
								</div>
								<div className="grid gap-3 sm:grid-cols-2">
									<div className="rounded-xl border bg-white p-3">
										<div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-500">
											<Home className="size-3.5 text-primary" />
											Current home room
										</div>
										<p className="mt-1 text-sm font-bold text-slate-900">{homeRoom?.name ?? 'Not assigned yet'}</p>
										<p className="text-xs font-medium text-slate-500">{homeRoom ? 'This section has a home room for normal classes.' : 'Assign a home room before schedule generation.'}</p>
									</div>
									<div className="rounded-xl border bg-white p-3">
										<div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-500">
											<Building2 className="size-3.5 text-primary" />
											Building context
										</div>
										<p className="mt-1 text-sm font-bold text-slate-900">{homeRoom?.buildingName ?? 'No building selected'}</p>
										<p className="text-xs font-medium text-slate-500">{section?.buildingZoneId ? `Zone ${section.buildingZoneId}` : 'Building is based on the selected home room.'}</p>
									</div>
								</div>
							</div>

							{/* Summary Stats */}
							<div className="grid grid-cols-2 gap-4">
								<div className="p-4 rounded-xl border bg-muted/20">
									<p className="text-[0.65rem] font-bold text-muted-foreground uppercase tracking-wider">Assigned Classes</p>
									<p className="text-2xl font-bold tabular-nums">{data.totals.assignedClassCount}</p>
								</div>
								<div className="p-4 rounded-xl border bg-muted/20">
									<p className="text-[0.65rem] font-bold text-muted-foreground uppercase tracking-wider">Unassigned</p>
									<p className={`text-2xl font-bold tabular-nums ${data.totals.unassignedClassCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
										{data.totals.unassignedClassCount}
									</p>
								</div>
							</div>

							{/* Assigned Classes */}
							<div className="space-y-4">
								<h4 className="text-[0.7rem] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
									<div className="size-1.5 rounded-full bg-emerald-500" />
									Assigned Classes
								</h4>
								
								{data.classes.length > 0 ? (
									<div className="space-y-3">
										{data.classes.map((cls, idx) => {
											const deptColor = getDepartmentColor(cls.facultyDepartment);
											return (
												<div key={idx} className="group p-4 rounded-xl border border-emerald-100 bg-emerald-50/20 shadow-sm space-y-3 transition-all hover:border-emerald-200">
													<div className="flex items-start justify-between gap-4 border-b border-emerald-100/50 pb-2">
														<div className="min-w-0">
															<div className="flex items-center gap-2">
																<p className="text-sm font-bold truncate leading-tight">{cls.subjectName}</p>
																<code className="text-[0.6rem] font-mono text-muted-foreground uppercase px-1.5 py-0.5 bg-background rounded border">{cls.subjectCode}</code>
																{cls.rotationFamily && (
																	<Badge variant="outline" className="h-4 px-1.5 text-[0.55rem] font-black uppercase bg-violet-50 text-violet-700 border-violet-200 shadow-none">
																		Rotating
																	</Badge>
																)}
																{resolveRotationTermLabel(cls) && (
																	<Badge variant="outline" className="h-4 px-1.5 text-[0.55rem] font-black uppercase bg-violet-100 text-violet-900 border-violet-300 shadow-none">
																		{resolveRotationTermLabel(cls)}
																	</Badge>
																)}
															</div>
															<div className="flex items-center gap-1.5 mt-1">
																<Users className="size-3 text-muted-foreground" />
																<span className="text-xs font-semibold text-foreground">{cls.facultyName}</span>
																<Badge variant="outline" className={`text-[0.6rem] font-bold py-0 h-4 px-1 border-opacity-50 ${deptColor.bg} ${deptColor.text} ${deptColor.border}`}>
																	{departmentLabel(cls.facultyDepartment)}
																</Badge>
															</div>
														</div>
														<div className="text-right shrink-0">
															<p className="text-sm font-bold tabular-nums">{cls.minMinutesPerWeek} min</p>
															<p className="text-[0.6rem] text-muted-foreground uppercase font-bold tracking-tighter">Weekly</p>
														</div>
													</div>
													{cls.specializationLabel && (
														<div className="flex items-center gap-1.5">
															<Badge variant="outline" className="text-[0.6rem] font-bold py-0 h-4 bg-background">
																{cls.specializationLabel}
															</Badge>
														</div>
													)}
												</div>
											);
										})}
									</div>
								) : (
									<div className="p-10 rounded-xl border border-dashed text-center bg-muted/5">
										<p className="text-sm text-muted-foreground italic">No classes assigned to this section yet.</p>
									</div>
								)}
							</div>

							{/* Unassigned Expected Classes */}
							{data.unassignedExpectedClasses && data.unassignedExpectedClasses.length > 0 && (
								<div className="space-y-4 pt-4 border-t border-dashed">
									<h4 className="text-[0.7rem] font-bold text-amber-700 uppercase tracking-widest flex items-center gap-2">
										<AlertTriangle className="size-3 text-amber-600" />
										Unassigned Classes
									</h4>
									<div className="space-y-2">
										{data.unassignedExpectedClasses.map((cls, idx) => (
											<div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-amber-100 bg-amber-50/30">
												<div className="flex items-center gap-3">
													<div className="flex size-7 items-center justify-center rounded bg-amber-100/50">
														<BookOpen className="size-3.5 text-amber-700" />
													</div>
													<div>
														<p className="text-xs font-bold text-amber-900">{cls.subjectName}</p>
														<div className="flex flex-wrap items-center gap-1 mt-0.5">
															<p className="text-[0.6rem] text-amber-700/70 font-mono">{cls.subjectCode}</p>
															{cls.rotationFamily && (
																<Badge variant="outline" className="h-4 px-1 text-[0.55rem] font-bold uppercase bg-violet-50 text-violet-700 border-violet-200">
																	{cls.rotationFamily}
																</Badge>
															)}
															{resolveRotationTermLabel(cls) && (
																<Badge variant="outline" className="h-4 px-1 text-[0.55rem] font-bold uppercase bg-violet-100 text-violet-900 border-violet-300">
																	{resolveRotationTermLabel(cls)}
																</Badge>
															)}
														</div>
													</div>
												</div>
												<div className="text-right">
													<p className="text-xs font-bold tabular-nums">{cls.minMinutesPerWeek} min</p>
												</div>
											</div>
										))}
									</div>
								</div>
							)}
							{(!data.unassignedExpectedClasses || data.unassignedExpectedClasses.length === 0) && (
								<div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
									<CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
									<div>
										<p className="font-bold">No uncovered expected classes found.</p>
										<p className="text-xs font-medium leading-5 text-emerald-700">This section's expected class list is covered by current teacher assignments.</p>
									</div>
								</div>
							)}

							<div className="pt-6 border-t">
								<Link to={`/teaching-load?sectionId=${data.sectionId}`}>
									<Button className="w-full gap-2 font-bold shadow-sm">
										<ClipboardList className="size-4" />
										Manage Section Teaching Load
									</Button>
								</Link>
							</div>
						</>
					) : (
						<div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
							<RefreshCw className="size-8 opacity-20" />
							<p className="text-sm italic">Failed to load data.</p>
						</div>
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
}
