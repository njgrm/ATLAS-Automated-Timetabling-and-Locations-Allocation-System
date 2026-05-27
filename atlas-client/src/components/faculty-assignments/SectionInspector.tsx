import { CheckCircle2, AlertTriangle, Layout, Star, Info } from 'lucide-react';
import { Badge } from '@/ui/badge';
import { cn } from '@/lib/utils';
import { gradeLabel, GRADE_COLORS } from '@/lib/grade-labels';
import { getAssignmentOwnershipKey, type FacultyOwnershipState } from '@/lib/faculty-assignment-helpers';
import type { ExternalSection, SectionAssignedClassesResult } from '@/types';

type SectionInspectorProps = {
	section: ExternalSection | null;
	sectionContract: SectionAssignedClassesResult | null;
	savedOwnershipMap: Record<string, FacultyOwnershipState>;
	pendingOwnershipMap: Record<string, FacultyOwnershipState>;
};

export function SectionInspector({
	section,
	sectionContract,
	savedOwnershipMap,
	pendingOwnershipMap
}: SectionInspectorProps) {
	if (!section) {
		return (
			<div className="flex h-full flex-col items-center justify-center p-8 text-center bg-muted/5">
				<div className="size-12 rounded-full bg-muted flex items-center justify-center mb-4">
					<Layout className="size-6 text-muted-foreground/40" />
				</div>
				<p className="text-sm font-bold uppercase tracking-widest text-muted-foreground/40">Select a section<br/>to inspect staffing</p>
			</div>
		);
	}

	const contractRows = [
		...(sectionContract?.classes ?? []).map((entry) => ({
			id: entry.subjectId,
			subjectCode: entry.subjectCode,
			subjectName: entry.subjectName,
			specializationLabel: entry.specializationLabel,
		})),
		...((sectionContract?.unassignedExpectedClasses ?? []).map((entry) => ({
			id: entry.subjectId,
			subjectCode: entry.subjectCode,
			subjectName: entry.subjectName,
			specializationLabel: null,
		}))),
	];

	const staffing = contractRows.map((subject) => {
		const key = getAssignmentOwnershipKey(subject.id, section.id);
		const saved = savedOwnershipMap[key];
		const pending = pendingOwnershipMap[key];
		return {
			subject,
			owner: pending || saved || null,
			isPending: !!pending
		};
	});

	const assignedCount = staffing.filter(s => s.owner).length;
	const missingCount = staffing.length - assignedCount;
	const gradeColorClass = GRADE_COLORS[section.displayOrder.toString()]?.split(' ')[1] || 'text-muted-foreground';

	return (
		<div className="flex h-full flex-col bg-background border-l border-border/50">
			<div className="shrink-0 p-6 border-b border-border/40 space-y-4">
				<div className="flex items-center justify-between">
					<h3 className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Section Staffing</h3>
					<Badge variant="outline" className={cn("h-5 font-black uppercase tracking-tighter shadow-none", missingCount === 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200")}>
						{missingCount === 0 ? "Fully Staffed" : `${missingCount} Subjects Missing`}
					</Badge>
				</div>

				<div className="flex items-center gap-4">
					<div className={cn("size-12 rounded-xl flex items-center justify-center text-lg font-black border shadow-sm", 
						section.displayOrder === 7 ? "bg-green-50 border-green-200 text-green-700" :
						section.displayOrder === 8 ? "bg-yellow-50 border-yellow-200 text-yellow-700" :
						section.displayOrder === 9 ? "bg-red-50 border-red-200 text-red-700" :
						"bg-blue-50 border-blue-200 text-blue-700"
					)}>
						{section.name[0]}
					</div>
					<div className="min-w-0">
						<h4 className="text-base font-black uppercase tracking-tight truncate leading-tight">
							{section.name}
						</h4>
						<div className="flex items-center gap-2 mt-0.5">
							<span className={cn("text-[0.65rem] font-black uppercase tracking-widest", gradeColorClass)}>
								{gradeLabel(section.displayOrder)}
							</span>
							<span className="text-muted-foreground/30">•</span>
							<span className="text-[0.65rem] font-bold text-muted-foreground uppercase tracking-widest">
								{section.programName || 'Regular Program'}
							</span>
						</div>
					</div>
				</div>

				{section.adviserName && (
					<div className="bg-primary/5 border border-primary/10 rounded-lg p-2.5 flex items-center gap-3">
						<div className="size-7 rounded-md bg-primary/10 flex items-center justify-center border border-primary/20 shadow-sm">
							<Star className="size-3.5 text-primary fill-primary/20" />
						</div>
						<div className="min-w-0">
							<p className="text-[0.55rem] font-black text-primary/60 uppercase tracking-widest leading-none mb-1">Class Adviser</p>
							<p className="text-[0.7rem] font-black text-primary uppercase truncate">
								{section.adviserName}
							</p>
						</div>
					</div>
				)}
			</div>

			<div className="flex-1 overflow-auto p-6 space-y-6 no-scrollbar">
				{/* Staffing Overview */}
				<div className="grid grid-cols-2 gap-3">
					<div className="p-4 rounded-xl border border-border/40 bg-muted/5 space-y-1">
						<span className="text-[0.55rem] font-bold text-muted-foreground/60 uppercase tracking-widest block">Assigned</span>
						<p className="text-xl font-black tracking-tight tabular-nums">{assignedCount}</p>
					</div>
					<div className="p-4 rounded-xl border border-border/40 bg-muted/5 space-y-1">
						<span className="text-[0.55rem] font-bold text-muted-foreground/60 uppercase tracking-widest block">Missing</span>
						<p className={cn("text-xl font-black tracking-tight tabular-nums", missingCount > 0 ? 'text-rose-600' : 'text-emerald-600')}>
							{missingCount}
						</p>
					</div>
				</div>

				{/* Subjects List */}
				<section className="space-y-4">
					<h5 className="text-[0.6rem] font-black uppercase tracking-[0.2em] text-muted-foreground/60 border-b border-border/40 pb-2">Subject Coverage</h5>
					<div className="space-y-2">
						{staffing.map(({ subject, owner, isPending }) => (
							<div key={subject.id} className={cn(
								"flex items-center gap-3 p-2.5 rounded-lg border transition-all",
								owner 
									? "bg-background border-border/40 shadow-sm" 
									: "bg-muted/10 border-dashed border-border/60 opacity-60"
							)}>
								<div className={cn("size-8 rounded bg-muted flex items-center justify-center shrink-0 border border-border/20", 
									owner && (isPending ? "bg-sky-50 border-sky-100" : "bg-primary/5 border-primary/10")
								)}>
									<span className={cn("text-[0.6rem] font-black", owner ? "text-primary" : "text-muted-foreground/40")}>
										{subject.subjectCode}
									</span>
								</div>
								
								<div className="flex-1 min-w-0">
									<p className="text-[0.7rem] font-black uppercase truncate leading-tight">
										{subject.subjectName}
									</p>
									<div className="flex items-center gap-1.5 mt-0.5">
										{owner ? (
											<>
												<span className={cn("text-[0.6rem] font-bold uppercase truncate", isPending ? "text-sky-600" : "text-muted-foreground")}>
													{owner.facultyName}
												</span>
												{isPending && (
													<Badge variant="secondary" className="h-3.5 px-1 text-[8px] font-black uppercase bg-sky-100 text-sky-700 animate-pulse">Draft</Badge>
												)}
											</>
										) : (
											<span className="text-[0.6rem] font-bold text-rose-500 uppercase tracking-widest italic">Unassigned</span>
										)}
										{subject.specializationLabel ? (
											<Badge variant="outline" className="h-3.5 px-1 text-[8px] font-black uppercase bg-background">
												{subject.specializationLabel}
											</Badge>
										) : null}
									</div>
								</div>

								{!owner && (
									<AlertTriangle className="size-3.5 text-amber-500 shrink-0" />
								)}
							</div>
						))}
					</div>
				</section>

				{/* Guidance */}
				<div className="p-4 rounded-xl border border-dashed border-border bg-muted/20">
					<h6 className="text-[0.6rem] font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
						<Info className="size-3.5" />
						Staffing Guidance
					</h6>
					<p className="text-[0.7rem] text-muted-foreground/80 font-medium leading-relaxed italic">
						{missingCount > 0 
							? "Identify available teachers from the qualified department list. Prioritize those with lower load percentages."
							: "This section is fully covered. Review individual teacher loads for potential optimizations."}
					</p>
				</div>
			</div>
		</div>
	);
}
