import { Link } from 'react-router-dom';
import {
	AlertTriangle,
	CheckCircle2,
	ChevronRight,
	Info,
	MapIcon,
	RefreshCw,
	Users,
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';
import { gradeLabel, GRADE_COLORS } from '@/lib/grade-labels';
import { programFullLabel } from '@/lib/deped-glossary';
import { ROOM_TYPE_LABELS } from '@/lib/subject-constants';
import type { Subject } from '@/types';

export type SubjectCoverageDetail = {
	assigned: Array<{
		facultyId: number;
		name: string;
		grades: number[];
		load: number;
		sections: string[];
	}>;
	uncoveredGrades: number[];
	programScopes: string[];
};

function resolveSubjectTermLabel(subject: Pick<Subject, 'rotationTermLabel' | 'rotationTermRank' | 'modularOrder'>): string | null {
	const explicit = (subject.rotationTermLabel ?? '').trim();
	if (explicit.length > 0) {
		const rankMatch = explicit.match(/(\d+)/);
		if (rankMatch) {
			const parsed = Number(rankMatch[1]);
			if (Number.isInteger(parsed) && parsed > 0) {
				return `Term ${parsed}`;
			}
		}
		return explicit;
	}
	if (typeof subject.rotationTermRank === 'number' && subject.rotationTermRank > 0) {
		return `Term ${subject.rotationTermRank}`;
	}
	if (typeof subject.modularOrder === 'number' && subject.modularOrder > 0) {
		return `Term ${subject.modularOrder}`;
	}
	return null;
}

type SubjectCoverageSheetProps = {
	subject: Subject | null;
	loading: boolean;
	detail: SubjectCoverageDetail | null;
	errorBySubjectId: Map<number, string>;
	onRetry: (subjectId: number) => void;
	onClose: () => void;
};

export function SubjectCoverageSheet({
	subject,
	loading,
	detail,
	errorBySubjectId,
	onRetry,
	onClose,
}: SubjectCoverageSheetProps) {
	return (
		<Sheet open={!!subject} onOpenChange={(open) => !open && onClose()}>
			<SheetContent className="w-full sm:max-w-md overflow-y-auto">
				<SheetHeader className="pb-6 border-b">
					<SheetTitle className="flex items-center gap-2 text-xl font-bold">
						<Users className="size-5 text-primary" />
						Subject coverage
					</SheetTitle>
					<SheetDescription>
						Assigned teachers and uncovered grade/program scope for <span className="font-bold text-foreground">{subject?.name}</span>.
					</SheetDescription>
				</SheetHeader>

				<div className="py-6 space-y-8">
					{loading ? (
						<div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
							<RefreshCw className="size-8 animate-spin opacity-20" />
							<p className="text-sm animate-pulse">Analyzing teacher qualifications...</p>
						</div>
					) : subject && (
						<>
							{/* Phase 2.3: in-drawer error panel (audit Sub-5). Distinct
								from the "no teachers assigned" empty state below so a
								network failure is not misclassified as a coverage gap. */}
							{errorBySubjectId.has(subject.id) ? (
								<div
									role="alert"
									data-testid="coverage-drawer-error"
									className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
								>
									<AlertTriangle className="size-5 shrink-0 mt-0.5" />
									<div className="space-y-1">
										<p className="font-semibold">Could not load coverage right now.</p>
										<p className="text-xs opacity-90">{errorBySubjectId.get(subject.id)}</p>
										<Button
											type="button"
											size="sm"
											variant="outline"
											className="mt-2 h-8 font-bold"
											onClick={() => onRetry(subject.id)}
										>
											<RefreshCw className="mr-1 size-3" /> Try again
										</Button>
									</div>
								</div>
							) : null}

							{/* Phase 2.3: only render the Term rotation panel for subjects
								with a rotation family. The italic body line that
								always rendered was confusing for non-rotating subjects. */}
							{subject.rotationFamily ? (
								<div className="rounded-xl border border-violet-100 bg-violet-50/30 p-4 space-y-3">
									<div className="flex items-center justify-between">
										<p className="text-xs font-semibold uppercase tracking-widest text-violet-700/80">Term rotation</p>
										<Tooltip>
											<TooltipTrigger asChild>
												<div className="flex items-center gap-1.5 cursor-help">
													<Info className="size-3 text-violet-400" />
													<span className="text-xs font-bold text-violet-600 uppercase tracking-tight">Rotates by term</span>
												</div>
											</TooltipTrigger>
											<TooltipContent side="top" className="text-xs font-bold max-w-50">
												This subject shares a weekly schedule lane with related subjects across terms.
											</TooltipContent>
										</Tooltip>
									</div>
									<div className="flex flex-wrap gap-1.5">
										<Badge variant="outline" className="bg-white text-violet-700 border-violet-200 font-bold text-xs uppercase px-1.5 h-5 shadow-none">
											{subject.code}
										</Badge>
										<Badge variant="outline" className="bg-violet-100 text-violet-900 border-violet-300 font-semibold text-xs uppercase px-1.5 h-5 shadow-none">
											Rotating
										</Badge>
										{resolveSubjectTermLabel(subject) && (
											<Badge variant="outline" className="bg-violet-100 text-violet-900 border-violet-300 font-semibold text-xs uppercase px-1.5 h-5 shadow-none">
												{resolveSubjectTermLabel(subject)}
											</Badge>
										)}
									</div>
									<p className="text-xs text-violet-800/80 leading-relaxed font-medium italic">
										Rotating subjects share time across terms, so check both assigned teachers and uncovered grades before generation.
									</p>
								</div>
							) : null}

							{/* Assigned Teachers */}
							<div className="space-y-4">
								<h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
									<div className="size-1.5 rounded-full bg-emerald-500" />
									Assigned teachers
									<Badge variant="secondary" className="ml-auto bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border-emerald-100 font-bold">
										{detail?.assigned.length ?? 0}
									</Badge>
								</h4>

								{(detail?.assigned.length ?? 0) > 0 ? (
									<div className="space-y-3">
										{detail?.assigned.map((t) => (
											<div key={t.facultyId} className="group p-4 rounded-xl border border-emerald-100 bg-emerald-50/20 shadow-sm space-y-3">
												<div className="flex items-start justify-between gap-4 border-b border-emerald-100/50 pb-2">
													<div className="min-w-0">
														<p className="text-sm font-bold truncate leading-tight">{t.name}</p>
														<div className="flex flex-wrap gap-1 mt-1.5">
															{t.grades.map((g) => (
																<Badge key={g} variant="outline" className={`text-xs px-1.5 py-0 h-4 font-bold border-opacity-40 ${GRADE_COLORS[String(g)] ?? ''}`}>
																	{gradeLabel(g)}
																</Badge>
															))}
														</div>
													</div>
													<Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 shadow-none border-emerald-200 font-bold">
														{t.load}% Load
													</Badge>
												</div>

												{t.sections.length > 0 ? (
													<div className="space-y-1.5">
														<p className="text-xs font-bold text-emerald-700/70 uppercase tracking-wider">Assigned Sections</p>
														<div className="flex flex-wrap gap-1.5">
															{t.sections.map((section, idx) => (
																<div key={idx} className="flex items-center gap-1.5 px-2 py-1 rounded bg-white border border-emerald-100/50 shadow-sm">
																	<span className="text-xs font-semibold text-foreground">{section}</span>
																</div>
															))}
														</div>
													</div>
												) : (
													<p className="text-xs text-muted-foreground italic">No sections explicitly mapped.</p>
												)}
											</div>
										))}
									</div>
								) : (
									<div className="p-10 rounded-xl border border-dashed text-center bg-muted/5">
										<p className="text-sm text-muted-foreground italic">No teachers assigned to this subject yet.</p>
										<Link to={`/teaching-load?view=subjects&subjectId=${subject.id}&filter=missing-coverage`} className="mt-3 inline-flex">
											<Button size="sm" className="gap-2 bg-primary text-primary-foreground shadow-primary-glow hover:bg-primary/90">
												Fix in Teaching Load
												<ChevronRight className="size-3.5" />
											</Button>
										</Link>
									</div>
								)}
							</div>

							<div className="space-y-4">
								<h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
									<div className={`size-1.5 rounded-full ${(detail?.uncoveredGrades.length ?? 0) > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
									Section coverage
								</h4>
								<div className={(detail?.uncoveredGrades.length ?? 0) > 0 ? 'rounded-xl border border-amber-200 bg-amber-50 p-4' : 'rounded-xl border border-emerald-200 bg-emerald-50 p-4'}>
									{(detail?.uncoveredGrades.length ?? 0) > 0 ? (
										<div className="space-y-3">
											<p className="text-sm font-bold text-amber-900">Some required sections still need a teacher for this subject.</p>
											<div className="flex flex-wrap gap-1.5">
												{detail?.uncoveredGrades.map((grade) => (
													<Badge key={grade} variant="outline" className={`font-bold ${GRADE_COLORS[String(grade)] ?? ''}`}>{gradeLabel(grade)}</Badge>
												))}
											</div>
											<Link to={`/teaching-load?view=subjects&subjectId=${subject.id}&filter=missing-coverage`} className="inline-flex">
												<Button size="sm" variant="outline" className="gap-2 border-amber-300 text-amber-900 hover:bg-amber-100">
													Fix coverage in Teaching Load
													<ChevronRight className="size-3.5" />
												</Button>
											</Link>
										</div>
									) : (detail?.programScopes.length ?? 0) > 0 ? (
										<div className="flex items-start gap-3 text-amber-900">
											<AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
											<div>
												<p className="text-sm font-bold">All required sections have assigned teachers.</p>
												<p className="text-xs font-medium text-amber-800">This subject is scoped to specific programs. Review section coverage in Teaching Load before generation.</p>
											</div>
										</div>
									) : (
										<div className="flex items-start gap-3 text-emerald-900">
											<CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
											<div>
												<p className="text-sm font-bold">All required sections have assigned teachers.</p>
											</div>
										</div>
									)}
								</div>
								<div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
									<span className="font-bold uppercase tracking-wider">Program scope:</span>
									{detail?.programScopes.map((scope) => (
										<Badge key={scope} variant="outline" className="bg-white text-slate-700 shadow-none" aria-label={programFullLabel(scope)}>{programFullLabel(scope)}</Badge>
									))}
								</div>
								<Link to={`/teaching-load?view=subjects&subjectId=${subject.id}&filter=missing-coverage`} className="inline-flex">
									<Button size="sm" variant="outline" className="gap-2">
										Open in Teaching Load
										<ChevronRight className="size-3.5" />
									</Button>
								</Link>
							</div>

							{/* Phase 2.3: render Resource requirements for non-classroom
								subjects AND for subjects with required room features
								(audit Sub-6 -- the old code only gated on
								preferredRoomType !== 'CLASSROOM', silently dropping
								subjects that needed a feature but used a standard room). */}
							{((subject.preferredRoomType !== 'CLASSROOM') || (subject.requiredFeatures.length > 0)) && (
								<div className="p-4 rounded-xl bg-muted/40 border border-muted/50 flex items-start gap-3 shadow-sm">
									<MapIcon className="size-5 text-muted-foreground shrink-0 mt-0.5" />
									<div className="space-y-1">
										<p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Resource requirements</p>
										{subject.preferredRoomType !== 'CLASSROOM' ? (
											<p className="text-sm font-medium">Requires <span className="font-bold text-primary">{ROOM_TYPE_LABELS[subject.preferredRoomType] ?? subject.preferredRoomType}</span> facilities.</p>
										) : null}
										{subject.requiredFeatures.length > 0 ? (
											<p className="text-sm font-medium">
												Needs {subject.requiredFeatures.length} room feature{subject.requiredFeatures.length === 1 ? '' : 's'}:{' '}
												<span className="font-bold text-primary">{subject.requiredFeatures.join(', ')}</span>
											</p>
										) : null}
										<Link to="/map" className="text-xs text-primary font-bold flex items-center gap-1 hover:underline pt-1 uppercase tracking-tight">
											View occupancy map
											<ChevronRight className="size-3" />
										</Link>
									</div>
								</div>
							)}
						</>
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
}
