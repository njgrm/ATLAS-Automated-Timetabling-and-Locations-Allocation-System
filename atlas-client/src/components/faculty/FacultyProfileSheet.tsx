import {
	BookOpen,
	CalendarDays,
	User,
	Briefcase,
	Clock,
	CheckCircle2,
	AlertTriangle,
	ChevronRight,
	ClipboardList,
	Star
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
import { Separator } from '@/ui/separator';
import type { FacultySummary } from '@/types';
import { Link } from 'react-router-dom';
import { GRADE_COLORS, gradeLabel } from '@/lib/grade-labels';

interface FacultyProfileSheetProps {
	faculty: FacultySummary | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function FacultyProfileSheet({
	faculty,
	open,
	onOpenChange,
}: FacultyProfileSheetProps) {
	if (!faculty) return null;

	const subjectCount = faculty.subjectCount ?? 0;
	const sectionCount = faculty.sectionCount ?? 0;
	
	const weeklyHours = faculty.policyCreditedHours ?? 0;
	const maxHours = faculty.maxHoursPerWeek;
	const loadPercent = Math.round((weeklyHours / Math.max(maxHours, 1)) * 100);
	
	const loadColor =
		weeklyHours === 0 ? 'bg-muted text-muted-foreground'
		: weeklyHours > maxHours ? 'bg-red-100 text-red-700'
		: weeklyHours >= maxHours * 0.85 ? 'bg-amber-100 text-amber-700'
		: 'bg-emerald-100 text-emerald-700';

	const loadProgressColor = 
		weeklyHours > maxHours ? 'bg-red-500'
		: weeklyHours >= maxHours * 0.85 ? 'bg-amber-500'
		: 'bg-emerald-500';

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="w-full sm:max-w-md overflow-y-auto">
				<SheetHeader className="pb-6 border-b">
					<div className="flex items-center gap-4">
						<div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary">
							{faculty.firstName[0]}{faculty.lastName[0]}
						</div>
						<div className="min-w-0">
							<div className="flex items-center gap-2">
								<SheetTitle className="text-xl font-bold truncate">
									{faculty.firstName} {faculty.lastName}
								</SheetTitle>
								{faculty.isClassAdviser && (
									<Star className="size-4 fill-amber-400 text-amber-500 shrink-0" />
								)}
							</div>
							<SheetDescription className="flex items-center gap-2 mt-1">
								<Badge variant="outline" className="text-xs font-mono">
									{faculty.employeeId || 'ID Pending'}
								</Badge>
								{faculty.isActiveForScheduling ? (
									<span className="flex items-center gap-1 text-xs font-bold text-emerald-600">
										<CheckCircle2 className="size-3" /> ACTIVE
									</span>
								) : (
									<span className="flex items-center gap-1 text-xs font-bold text-muted-foreground">
										<AlertTriangle className="size-3" /> EXCLUDED
									</span>
								)}
							</SheetDescription>
							{faculty.isClassAdviser && (
								<div className="mt-2">
									<Badge className="bg-amber-50 text-amber-800 hover:bg-amber-100 shadow-none border-amber-200">
										<Star className="size-3 fill-amber-500 text-amber-600 mr-1.5" />
										{faculty.advisedSectionName ? `Adviser: ${faculty.advisedSectionName}` : 'Class Adviser'}
									</Badge>
								</div>
							)}
						</div>
					</div>
				</SheetHeader>

				<div className="py-6 space-y-8">
					{/* Identity Section */}
					<div className="space-y-4">
						<h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Identity & Department</h4>
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-1">
								<p className="text-xs text-muted-foreground flex items-center gap-1.5">
									<Briefcase className="size-3" /> Department
								</p>
								<p className="text-sm font-semibold">{faculty.department || '-'}</p>
							</div>
							<div className="space-y-1">
								<p className="text-xs text-muted-foreground flex items-center gap-1.5">
									<User className="size-3" /> Specialization
								</p>
								<p className="text-sm font-semibold">{faculty.specialization || '-'}</p>
							</div>
						</div>
					</div>

					<Separator className="opacity-50" />

					{/* Workload Section */}
					<div className="space-y-4">
						<h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Teaching Load Summary</h4>
						
						<div className={`p-4 rounded-xl border flex flex-col gap-3 ${loadColor} bg-opacity-30 border-current border-opacity-10`}>
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<Clock className="size-4" />
									<span className="text-sm font-bold">Policy Credited Hours</span>
								</div>
								<span className="text-lg font-black tracking-tight">{weeklyHours}h <span className="text-xs font-normal opacity-70">/ {maxHours}h max</span></span>
							</div>
							
							<div className="h-1.5 w-full bg-black/10 rounded-full overflow-hidden">
								<div 
									className={`h-full ${loadProgressColor} transition-all`} 
									style={{ width: `${Math.min(100, loadPercent)}%` }}
								/>
							</div>
							
							<div className="flex items-center justify-between text-xs font-bold uppercase tracking-tight">
								<span>Current Load: {loadPercent}%</span>
								{weeklyHours > maxHours && (
									<span className="text-red-700">OVERLOADED</span>
								)}
							</div>
							{faculty.isClassAdviser && (
								<p className="text-xs font-bold opacity-80 mt-1 uppercase">Includes {faculty.advisoryEquivalentHours}h Advisory Credit</p>
							)}
						</div>

						<div className="grid grid-cols-2 gap-4 pt-2">
							<div className="p-3 rounded-lg border bg-muted/30">
								<p className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5 mb-1">
									<BookOpen className="size-3" /> Subjects
								</p>
								<p className="text-xl font-black">{subjectCount}</p>
							</div>
							<div className="p-3 rounded-lg border bg-muted/30">
								<p className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5 mb-1">
									<CalendarDays className="size-3" /> Total Sections
								</p>
								<p className="text-xl font-black">{sectionCount}</p>
							</div>
						</div>
					</div>

					<Separator className="opacity-50" />

					{/* Assigned Subjects List */}
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Current Assignments</h4>
							<Link to={`/teaching-load?facultyId=${faculty.id}`}>
								<Button variant="link" size="sm" className="h-auto p-0 text-xs font-bold uppercase tracking-tight">
									Manage <ChevronRight className="size-3 ml-0.5" />
								</Button>
							</Link>
						</div>

						{faculty.assignments && faculty.assignments.length > 0 ? (
							<div className="space-y-3">
								{faculty.assignments.map((fs) => (
									<div key={fs.id} className="p-3 rounded-lg border border-border bg-background shadow-sm space-y-2">
										<div className="flex items-start justify-between gap-2 border-b pb-2 mb-2 border-border/50">
											<div className="min-w-0">
												<p className="text-sm font-bold truncate leading-tight">{fs.subject?.name || 'Unknown Subject'}</p>
												<code className="text-xs text-muted-foreground font-mono">{fs.subject?.code}</code>
											</div>
											<Badge variant="secondary" className="text-xs px-1.5 py-0.5">
												{fs.subject?.minMinutesPerWeek || 0}m
											</Badge>
										</div>
										<div className="flex flex-col gap-1">
											{fs.sections && fs.sections.length > 0 ? (
												fs.sections.map((sec) => (
													<div key={sec.id} className="flex items-center gap-2">
														<Badge variant="outline" className={`text-[0.6rem] min-w-10 justify-center border-opacity-40 ${GRADE_COLORS[String(sec.displayOrder)] ?? ''}`}>
															{gradeLabel(sec.displayOrder)}
														</Badge>
														<span className="text-xs text-foreground font-medium truncate">{sec.name}</span>
													</div>
												))
											) : (
												<span className="text-xs text-muted-foreground italic">No sections explicitly mapped.</span>
											)}
										</div>
									</div>
								))}
							</div>
						) : (
							<div className="py-10 text-center border rounded-lg border-dashed bg-muted/10">
								<p className="text-xs text-muted-foreground italic">No subjects assigned yet.</p>
							</div>
						)}
					</div>

					{/* Secondary Actions */}
					<div className="pt-4 pb-8 flex flex-col gap-2">
						<Link to={`/teaching-load?facultyId=${faculty.id}`} className="w-full">
							<Button className="w-full h-10 gap-2 font-bold shadow-md">
								<ClipboardList className="size-4" />
								Manage Teaching Load
							</Button>
						</Link>
						<Button variant="secondary" className="h-10 text-muted-foreground font-semibold" onClick={() => onOpenChange(false)}>
							Close Profile
						</Button>
					</div>
				</div>
			</SheetContent>
		</Sheet>
	);
}