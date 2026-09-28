import { Link } from 'react-router-dom';
import {
	AlertTriangle,
	CheckCircle2,
	ChevronRight,
	GripHorizontal,
	Info,
	MapIcon,
	RefreshCw,
	Users,
} from 'lucide-react';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import { gradeLabel, GRADE_COLORS } from '@/lib/grade-labels';
import { programFullLabel } from '@/lib/deped-glossary';
import { ROOM_TYPE_LABELS } from '@/lib/subject-constants';
import { roomAuthoritySemantics } from '@/lib/room-authority-copy';
import { AccessibleInfo } from '@/components/smart/AccessibleInfo';
import { splitSubjectFeatures, subjectFeatureHelp, ownerDepartmentPhrase } from './subject-feature-presentation';
import type { Subject } from '@/types';

export type SubjectCoverageDetail = {
	assigned: Array<{
		facultyId: number;
		name: string;
		grades: number[];
		load: number;
		/**
		 * A5 (operator item 17.1): a section is STRUCTURED data, not a display
		 * string. It used to be minted as `` `${gradeCompact(displayOrder)} ${name}` ``
		 * and rendered as one text run, so the grade appeared twice per section —
		 * once in the header badge row and once inside the chip. The grade is
		 * now carried here and rendered as its own colour pill, and `name` is the
		 * section NAME ONLY, so nothing has to be parsed back out of a string.
		 *
		 * `grade` is null when the section carries no usable grade; the pill is
		 * then omitted rather than guessed.
		 */
		sections: Array<{ id: number | null; grade: number | null; name: string }>;
	}>;
	uncoveredGrades: number[];
	programScopes: string[];
};

function resolveSubjectTermLabel(subject: Pick<Subject, 'rotationTermLabel' | 'rotationTermRank' | 'modularOrder'>): string | null {
	const explicit = (subject.rotationTermLabel ?? '').trim();
	if (explicit.length > 0) return explicit;
	if (typeof subject.rotationTermRank === 'number' && subject.rotationTermRank > 0) {
		return `Term ${subject.rotationTermRank}`;
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

/**
 * A3-17: the subject coverage review surface is a centered modal Dialog, not a
 * side drawer. It is a targeted desktop review/detail surface for ONE subject
 * — reading assigned teachers and uncovered grades side by side — so it belongs
 * over the content it describes rather than beside it, where a 24rem column
 * squeezed the coverage cards and pushed "Fix coverage in Teaching Load" below
 * the fold. The dialog owns its scroll (fixed header, `flex-1 min-h-0`
 * scrollable body, fixed footer) so it never grows past the viewport and never
 * spawns a page-level scrollbar (AGENTS.md §8).
 *
 * Escape and backdrop close come from Radix `Dialog` semantics; body scroll is
 * locked by `react-remove-scroll` through `DialogPortal`.
 *
 * SCOPE: this is the only conversion. Mobile sheets elsewhere in the app are
 * untouched.
 */
export function SubjectCoverageSheet({
	subject,
	loading,
	detail,
	errorBySubjectId,
	onRetry,
	onClose,
}: SubjectCoverageSheetProps) {
	// A3-C4: `requiredFeatures` mixes real room features with the server's
	// `OWNER_DEPT:<code>` ownership markers. Only the real room features are
	// offered to room selection, so only they may be described as room
	// features here; ownership is reported separately as a plain department.
	const subjectFeatureSplit = splitSubjectFeatures(subject?.requiredFeatures);
	const subjectRoomFeatures = subjectFeatureSplit.roomFeatures;
	const subjectOwnerPhrase = ownerDepartmentPhrase(subjectFeatureSplit.ownerDepartments);
	return (
		<Dialog open={!!subject} onOpenChange={(open) => !open && onClose()}>
			<DialogContent
				/*
				 * A5 (operator item 17.1(1)) — RESIZABLE WHILE STILL CENTERED.
				 *
				 * Centring needs no JavaScript. The shared primitive positions with
				 * `left-[50%] top-[50%]` and the `animate-modal-in` keyframes in
				 * `src/index.css` hold `transform: translate(-50%,-50%)` with
				 * `forwards`, so the browser re-centres the box at whatever size
				 * it currently is — including the size CSS `resize` writes during
				 * a drag. Anyone tempted to add JS re-centring here should read
				 * that first.
				 *
				 * `resize` is set through `style`, not a Tailwind class, so it does
				 * not depend on a `resize-*` utility existing in the installed
				 * Tailwind version. `w-[42rem]` is the first-paint width the
				 * `max-w-2xl` this replaced was showing, and `overflow-hidden` keeps
				 * the drag from spilling the dialog's own children.
				 */
				className="flex w-[42rem] min-w-[500px] max-w-[95vw] min-h-[420px] max-h-[90vh] flex-col gap-0 overflow-hidden p-0"
				style={{ resize: 'both' }}
				data-testid="subject-coverage-dialog"
				data-presentation="centered-dialog"
			>
				<DialogHeader className="shrink-0 border-b px-6 py-4 text-left">
					<DialogTitle className="flex items-center gap-2 text-xl font-bold">
						<Users className="size-5 text-primary" />
						Subject coverage
					</DialogTitle>
					<DialogDescription>
						Assigned teachers and uncovered grade/program scope for <span className="font-bold text-foreground">{subject?.name}</span>.
					</DialogDescription>
				</DialogHeader>

				<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-6" data-testid="subject-coverage-scroll">
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
										{/* A3-17: this surface was previously dead code, so its
											Tooltip had no provider and would have thrown the
											 moment it was rendered. The page renders this
											component now, so the provider is supplied here. */}
										<TooltipProvider>
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
										</TooltipProvider>
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
									<div key={t.facultyId} className="group space-y-3 rounded-xl border border-emerald-100 bg-emerald-50/20 p-4 shadow-sm">
										{/*
										 * A5 (operator item 17.1(2)): the teacher's ESSENTIALS only.
										 * The grade-badge row that used to sit here is gone — every
										 * one of those grades is already carried by the section
										 * chips below as its own colour pill, so the header was
										 * saying the same thing twice. `t.grades` is still in the
										 * data (`useCoverageDetail` needs it to compute
										 * `uncoveredGrades`); it is simply not repeated here.
										 */}
										<div className="flex items-start justify-between gap-4 border-b border-emerald-100/50 pb-2">
											<p className="min-w-0 text-sm font-bold truncate leading-tight">{t.name}</p>
											<Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 shadow-none border-emerald-200 font-bold">
												{t.load}% Load
											</Badge>
										</div>

										{t.sections.length > 0 ? (
											/*
											 * A5 (item 17.1(3)): `[colour-coded grade pill] Section
											 * Name`, one pill per section, under the teacher's name.
											 * The `ASSIGNED SECTIONS` subheader is gone — the chips
											 * are self-describing and the heading duplicated the
											 * "Assigned teachers" section title above it.
											 *
											 * The pill colour comes from the ONE shared DepEd palette
											 * (`GRADE_COLORS`) and the text from the shared
											 * `gradeLabel()`, so this surface cannot drift into a
											 * second grade palette or a second spelling.
											 */
											<div className="flex flex-wrap gap-2 pt-2">
												{t.sections.map((sec, idx) => (
													<div key={sec.id ?? `section-${idx}`} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200/80">
														{sec.grade != null ? (
															<span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${GRADE_COLORS[String(sec.grade)] ?? ''}`}>
																{gradeLabel(sec.grade)}
															</span>
														) : null}
														<span className="text-xs font-medium text-slate-700">{sec.name}</span>
													</div>
												))}
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
									<div className={`size-1.5 rounded-full ${(detail?.uncoveredGrades.length ?? 0) > 0 ? 'bg-warning' : 'bg-emerald-500'}`} />
									Section coverage
								</h4>
								<div className={((detail?.uncoveredGrades.length ?? 0) > 0) ? 'rounded-xl border border-warning-border bg-warning-muted p-4' : 'rounded-xl border border-emerald-200 bg-emerald-50 p-4'}>
									{(detail?.uncoveredGrades.length ?? 0) > 0 ? (
										<div className="space-y-3">
											<p className="text-sm font-bold text-warning-foreground">Some required sections still need a teacher for this subject.</p>
											<div className="flex flex-wrap gap-1.5">
												{detail?.uncoveredGrades.map((grade) => (
													<Badge key={grade} variant="outline" className={`font-bold ${GRADE_COLORS[String(grade)] ?? ''}`}>{gradeLabel(grade)}</Badge>
												))}
											</div>
											<Link to={`/teaching-load?view=subjects&subjectId=${subject.id}&filter=missing-coverage`} className="inline-flex">
												<Button size="sm" variant="outline" className="gap-2 border-warning-border text-warning-foreground hover:bg-warning/10">
													Fix coverage in Teaching Load
													<ChevronRight className="size-3.5" />
												</Button>
											</Link>
										</div>
									) : (detail?.programScopes.length ?? 0) > 0 ? (
										<div className="flex items-start gap-3 text-warning-foreground">
											<AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
											<div>
												<p className="text-sm font-bold">All required sections have assigned teachers.</p>
												<p className="text-xs font-medium text-warning-foreground">This subject is scoped to specific programs. Review section coverage in Teaching Load before generation.</p>
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
								subjects that needed a feature but used a standard room).
								C07-R8: the wording comes from the single shared
								room-authority copy authority. A CLASSROOM authority is
								never labelled as an unconditional requirement. */}
							{((subject.preferredRoomType !== 'CLASSROOM') || (subjectRoomFeatures.length > 0)) && (
								<div className="p-4 rounded-xl bg-muted/40 border border-muted/50 flex items-start gap-3 shadow-sm">
									<MapIcon className="size-5 text-muted-foreground shrink-0 mt-0.5" />
									<div className="space-y-1">
										<p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Resource requirements</p>
										<p className="text-sm font-medium">
											<span className="font-bold text-primary">{ROOM_TYPE_LABELS[subject.preferredRoomType] ?? subject.preferredRoomType}</span>
											{' — '}
											{roomAuthoritySemantics(subject.preferredRoomType)}.
										</p>
									{subjectRoomFeatures.length > 0 ? (
										<p className="text-sm font-medium">
											Needs {subjectRoomFeatures.length} room feature{subjectRoomFeatures.length === 1 ? '' : 's'}:{' '}
											<span className="font-bold text-primary">{subjectRoomFeatures.join(', ')}</span>
										</p>
									) : null}
									{/* A3-C4: ownership is a department, not a room feature. The raw
										OWNER_DEPT code stays reachable in the @/ui tooltip. */}
									{subjectOwnerPhrase ? (
										<p className="text-sm font-medium">
											Owned by the <span className="font-bold text-primary">{subjectOwnerPhrase}</span>.
										</p>
									) : null}
									{subject && (subjectRoomFeatures.length > 0 || subjectFeatureSplit.ownerDepartments.length > 0) ? (
										<AccessibleInfo
											label={`How room features and ownership are recorded for ${subject.name}`}
											shortHelp={subjectFeatureHelp(subjectFeatureSplit)}
											size="icon-xs"
										/>
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

				{/*
				 * A5 (item 17.1(1)) — the visible resize affordance. CSS `resize`
				 * draws its own corner handle in most browsers, but an operator
				 * cannot discover a behaviour they cannot see, so the grip is
				 * explicit. It is `pointer-events-none` and `aria-hidden`: the DRAG
				 * belongs to the card underneath it, and the grip is decoration,
				 * not a control.
				 */}
				<div
					aria-hidden="true"
					data-testid="subject-coverage-resize-grip"
					className="pointer-events-none absolute bottom-1.5 right-2 flex items-center justify-center text-slate-400"
				>
					<GripHorizontal className="size-4" />
				</div>
			</DialogContent>
		</Dialog>
	);
}
