import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
	AlertTriangle,
	ArrowLeft,
	BookOpen,
	CheckCircle2,
	Loader2,
	Plus,
	RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'motion/react';

import atlasApi from '@/lib/api';
import { resolveActiveSchoolYearContext } from '@/lib/enrollpro-public-settings';
import { resolveActorSchoolId } from '@/lib/settings';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { ConfirmationModal } from '@/ui/confirmation-modal';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/ui/dialog';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { SearchableSelect } from '@/ui/searchable-select';
import { Skeleton } from '@/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/ui/accordion';
import { GRADE_OPTIONS, PROGRAM_SCOPE_OPTIONS } from '@/lib/subject-constants';
import { gradeLabel } from '@/lib/grade-labels';
import {
	SCOPE_STATE_LABELS,
	deriveCurriculumViewState,
	resolveCurriculumYearScope,
	scopeDisplayName,
	filterRequirementsByScope,
	buildScopeIdSets,
	type CurriculumReadiness,
} from '@/lib/curriculum-scope-states';

interface TermConfig {
	id: number;
	termCount: number;
	termIdentities: string[];
	isActive: boolean;
	updatedAt: string;
}

interface Requirement {
	id: number;
	schoolYearId: number;
	termConfigId: number;
	subjectId: number | null;
	gradeLevel: number;
	programType: string;
	sectionMirrorId: number | null;
	cohortId: number | null;
	classification: string;
	weeklyMinutes: number;
	rotationFamily: string | null;
	rotationOrder: number | null;
	termMode: string;
	isActive: boolean;
	version: number;
	termIdentities: string[];
}

interface CatalogSubject {
	id: number;
	code: string;
	name: string;
	isActive: boolean;
}

interface SectionOption {
	mirrorId: number;
	name: string;
	programType?: string | null;
	gradeLevelName?: string | null;
}

interface CohortOption {
	id: number;
	cohortCode: string;
	specializationName?: string | null;
}

interface BatchPreview {
	offerings: unknown[];
	totalCount: number;
	newCount: number;
	unchangedCount: number;
	retiredCount: number;
	termConfigValid: boolean;
	fingerprint: string;
	sourceVersions: Record<string, number>;
	termConfigRevision: { id: number; updatedAt: string } | null;
}

const CLASSIFICATIONS = ['CORE', 'SPECIALIZATION', 'EXPLORATORY', 'OTHER'];
const TERM_MODES = ['ALL', 'ROTATING_FAMILY_MEMBER', 'EMPTY'];

const SCOPE_TONES: Record<string, string> = {
	MISSING: 'bg-slate-100 text-slate-700',
	EMPTY: 'bg-sky-100 text-sky-800',
	CONFIGURED: 'bg-emerald-100 text-emerald-800',
	STALE: 'bg-amber-100 text-amber-800',
	CONFLICTING: 'bg-red-100 text-red-800',
};

export default function CurriculumRequirements() {
	const [actorSchoolId, setActorSchoolId] = useState<number | null>(null);
	const [schoolYearId, setSchoolYearId] = useState<number | null>(null);
	const [scopeBlockedReason, setScopeBlockedReason] = useState<string | null>(null);
	const refreshedOnce = useRef(false);
	const [termConfig, setTermConfig] = useState<TermConfig | null>(null);
	const [termUpdatedAt, setTermUpdatedAt] = useState<string | null>(null);
	const [requirements, setRequirements] = useState<Requirement[]>([]);
	const [readiness, setReadiness] = useState<CurriculumReadiness | null>(null);
	const [catalog, setCatalog] = useState<CatalogSubject[]>([]);
	const [sections, setSections] = useState<SectionOption[]>([]);
	const [cohorts, setCohorts] = useState<CohortOption[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [scopeFilter, setScopeFilter] = useState<string | null>(null);
	const [preview, setPreview] = useState<BatchPreview | null>(null);
	const [previewBusy, setPreviewBusy] = useState(false);
	const [applyBusy, setApplyBusy] = useState(false);
	const [confirmApply, setConfirmApply] = useState(false);
	const [retireTarget, setRetireTarget] = useState<Requirement | null>(null);
	const [addOpen, setAddOpen] = useState(false);
	const [saving, setSaving] = useState(false);

	// Term editor state (progressive disclosure step 1). Empty until the
	// persisted configuration loads — never a synthesized default.
	const [termCountText, setTermCountText] = useState('');
	const [termIdentitiesText, setTermIdentitiesText] = useState('');

	// Add-requirement form state (progressive disclosure step 3).
	const [formGrade, setFormGrade] = useState('7');
	const [formProgram, setFormProgram] = useState('REGULAR');
	const [formSubjectId, setFormSubjectId] = useState('');
	const [formClassification, setFormClassification] = useState('CORE');
	const [formMinutes, setFormMinutes] = useState('200');
	const [formTermMode, setFormTermMode] = useState('ALL');
	const [formSectionId, setFormSectionId] = useState('');
	const [formCohortId, setFormCohortId] = useState('');
	const [formRotationFamily, setFormRotationFamily] = useState('');
	const [formRotationOrder, setFormRotationOrder] = useState('1');
	const [formRotationTerm, setFormRotationTerm] = useState('');

	// SCA-02R: resolve the actor school first, then require the active-year
	// context to belong to that same school. A school-1 cache default is
	// never inherited for another actor: on mismatch we force one refresh,
	// and if it still disagrees the page blocks with an explicit state and
	// issues no year-scoped requests.
	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const actor = await resolveActorSchoolId();
				if (cancelled) return;
				setActorSchoolId(actor);
				let ctx = await resolveActiveSchoolYearContext({ allowStaleOnError: true, allowEnrollProFallback: false });
				if (cancelled) return;
				if (actor != null && ctx.schoolId != null && ctx.schoolId !== actor && !refreshedOnce.current) {
					refreshedOnce.current = true;
					ctx = await resolveActiveSchoolYearContext({ forceRefresh: true, allowStaleOnError: true, allowEnrollProFallback: false });
					if (cancelled) return;
				}
				const verdict = resolveCurriculumYearScope(actor, ctx ? { activeSchoolYearId: ctx.activeSchoolYearId ?? null, schoolId: ctx.schoolId ?? null } : null);
				if (!verdict.ok) {
					setScopeBlockedReason(
						verdict.reason === 'actor-unresolved'
							? 'ATLAS could not determine the authenticated school. No requirements were loaded.'
							: verdict.reason === 'school-mismatch'
								? 'The active-year context belongs to a different school. No requirements were loaded.'
								: 'The active school year is not configured. No requirements were loaded.',
					);
					setSchoolYearId(null);
					setLoading(false);
					return;
				}
				setScopeBlockedReason(null);
				setSchoolYearId(verdict.schoolYearId);
			} catch {
				if (!cancelled) {
					setActorSchoolId(null);
					setScopeBlockedReason('ATLAS could not determine the authenticated school. No requirements were loaded.');
					setLoading(false);
				}
			}
		})();
		return () => { cancelled = true; };
	}, []);

	const load = useCallback(async () => {
		if (actorSchoolId == null || schoolYearId == null) return;
		setLoading(true);
		setError(null);
		try {
			const [snapshotRes, readinessRes, catalogRes] = await Promise.all([
				atlasApi.get(`/curriculum-requirements/${schoolYearId}/requirements`),
				atlasApi.get(`/curriculum-requirements/${schoolYearId}/readiness`),
				atlasApi.get('/subjects', { params: { schoolId: actorSchoolId } }),
			]);
			setTermConfig(snapshotRes.data.termConfig ?? null);
			setRequirements((snapshotRes.data.requirements ?? []).filter((r: Requirement) => r.isActive));
			setReadiness(readinessRes.data.readiness);
			setCatalog((catalogRes.data.subjects ?? []).filter((s: CatalogSubject) => s.isActive));
			const cfg = snapshotRes.data.termConfig;
			if (cfg) {
				setTermCountText(String(cfg.termCount));
				setTermIdentitiesText((cfg.termIdentities as string[]).join(', '));
				setTermUpdatedAt(cfg.updatedAt ?? null);
			} else {
				setTermUpdatedAt(null);
			}
			// Override pickers degrade gracefully: a failed section/cohort
			// read disables that picker instead of blocking the page.
			try {
				const secRes = await atlasApi.get(`/sections/summary/${schoolYearId}`, { params: { schoolId: actorSchoolId } });
				setSections((secRes.data.sections ?? []).map((s: { mirrorId: number; name: string; programType?: string | null; gradeLevelName?: string | null }) => ({
					mirrorId: s.mirrorId, name: s.name, programType: s.programType ?? null, gradeLevelName: s.gradeLevelName ?? null,
				})));
			} catch {
				setSections([]);
			}
			try {
				const cohRes = await atlasApi.get('/cohorts', { params: { schoolId: actorSchoolId, schoolYearId } });
				setCohorts((cohRes.data.cohorts ?? []).map((c: { id: number; cohortCode: string; specializationName?: string | null }) => ({
					id: c.id, cohortCode: c.cohortCode, specializationName: c.specializationName ?? null,
				})));
			} catch {
				setCohorts([]);
			}
			setPreview(null);
		} catch (err: unknown) {
			const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to load Curriculum Requirements.';
			setError(message);
		} finally {
			setLoading(false);
		}
	}, [actorSchoolId, schoolYearId]);

	useEffect(() => {
		void load();
	}, [load]);

	const viewState = deriveCurriculumViewState({
		loading,
		error,
		termConfigPresent: termConfig !== null,
		requirementCount: requirements.length,
	});

	const idSets = useMemo(() => buildScopeIdSets(readiness?.scopeStates ?? []), [readiness]);
	const visibleRequirements = useMemo(
		() => filterRequirementsByScope(requirements, scopeFilter, idSets),
		[requirements, scopeFilter, idSets],
	);

	const subjectName = useMemo(() => {
		const map = new Map<number, CatalogSubject>();
		for (const s of catalog) map.set(s.id, s);
		return (id: number | null) => {
			if (id === null) return '— explicit empty —';
			const s = map.get(id);
			return s ? `${s.code} · ${s.name}` : `Subject #${id}`;
		};
	}, [catalog]);

	const sectionName = useMemo(() => {
		const map = new Map<number, SectionOption>();
		for (const s of sections) map.set(s.mirrorId, s);
		return (id: number | null) => {
			if (id === null) return null;
			return map.get(id)?.name ?? `Section #${id}`;
		};
	}, [sections]);

	const cohortName = useMemo(() => {
		const map = new Map<number, CohortOption>();
		for (const c of cohorts) map.set(c.id, c);
		return (id: number | null) => {
			if (id === null) return null;
			const c = map.get(id);
			return c ? `${c.cohortCode}${c.specializationName ? ` · ${c.specializationName}` : ''}` : `Cohort #${id}`;
		};
	}, [cohorts]);

	const handleSaveTerms = useCallback(async () => {
		if (schoolYearId == null) return;
		const termCount = Number(termCountText);
		const termIdentities = termIdentitiesText.split(',').map((s) => s.trim()).filter(Boolean);
		setSaving(true);
		try {
			const { data } = await atlasApi.put(`/curriculum-requirements/${schoolYearId}/terms`, {
				termCount,
				termIdentities,
				...(termConfig ? { expectedUpdatedAt: termUpdatedAt } : {}),
			});
			setTermConfig(data.termConfig);
			setTermUpdatedAt(data.termConfig.updatedAt ?? null);
			toast.success('Term configuration saved.');
			void load();
		} catch (err: unknown) {
			const resp = (err as { response?: { data?: { code?: string; message?: string } } })?.response?.data;
			toast.error(resp?.message ?? 'Failed to save term configuration.');
			if (resp?.code === 'STALE_WRITE') void load();
		} finally {
			setSaving(false);
		}
	}, [schoolYearId, termCountText, termIdentitiesText, termConfig, termUpdatedAt, load]);

	const rotatingValid = formTermMode !== 'ROTATING_FAMILY_MEMBER' || (
		formRotationFamily.trim().length > 0
		&& Number.isInteger(Number(formRotationOrder)) && Number(formRotationOrder) >= 1
		&& formRotationTerm !== ''
	);

	const handleAdd = useCallback(async () => {
		if (schoolYearId == null || actorSchoolId == null) return;
		const subjectId = formTermMode === 'EMPTY' ? null : Number(formSubjectId);
		if (formTermMode !== 'EMPTY' && (subjectId === null || !Number.isInteger(subjectId) || (subjectId as number) <= 0)) {
			toast.error('Choose a catalog subject for this requirement.');
			return;
		}
		if (!rotatingValid) {
			toast.error('Rotating requirements need a family, an order of at least 1, and exactly one configured term.');
			return;
		}
		setSaving(true);
		try {
			await atlasApi.post('/curriculum-requirements/requirements', {
				schoolId: actorSchoolId,
				schoolYearId,
				offering: {
					subjectId,
					gradeLevel: Number(formGrade),
					programType: formProgram,
					sectionMirrorId: formSectionId === '' ? null : Number(formSectionId),
					cohortId: formCohortId === '' ? null : Number(formCohortId),
					classification: formClassification,
					weeklyMinutes: formTermMode === 'EMPTY' ? 0 : Number(formMinutes),
					rotationFamily: formTermMode === 'ROTATING_FAMILY_MEMBER' ? formRotationFamily.trim() : null,
					rotationOrder: formTermMode === 'ROTATING_FAMILY_MEMBER' ? Number(formRotationOrder) : null,
					termMode: formTermMode,
					termIdentities: formTermMode === 'ROTATING_FAMILY_MEMBER' ? [formRotationTerm] : [],
				},
			});
			toast.success('Requirement added.');
			setAddOpen(false);
			setFormSectionId('');
			setFormCohortId('');
			setFormRotationFamily('');
			setFormRotationOrder('1');
			setFormRotationTerm('');
			void load();
		} catch (err: unknown) {
			const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to add requirement.';
			toast.error(message);
		} finally {
			setSaving(false);
		}
	}, [schoolYearId, actorSchoolId, formGrade, formProgram, formSubjectId, formClassification, formMinutes, formTermMode, formSectionId, formCohortId, formRotationFamily, formRotationOrder, formRotationTerm, rotatingValid, load]);

	const handleRetire = useCallback(async () => {
		if (!retireTarget) return;
		setSaving(true);
		try {
			await atlasApi.post(`/curriculum-requirements/requirements/${retireTarget.id}/retire`, { expectedVersion: retireTarget.version });
			toast.success('Requirement retired.');
			setRetireTarget(null);
			void load();
		} catch (err: unknown) {
			const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to retire requirement.';
			toast.error(message);
		} finally {
			setSaving(false);
		}
	}, [retireTarget, load]);

	const handlePreview = useCallback(async () => {
		if (schoolYearId == null) return;
		setPreviewBusy(true);
		try {
			const offerings = requirements.map((r) => ({
				subjectId: r.subjectId,
				gradeLevel: r.gradeLevel,
				programType: r.programType,
				sectionMirrorId: r.sectionMirrorId,
				cohortId: r.cohortId,
				classification: r.classification,
				weeklyMinutes: r.weeklyMinutes,
				rotationFamily: r.rotationFamily,
				rotationOrder: r.rotationOrder,
				termMode: r.termMode,
				termIdentities: r.termIdentities,
			}));
			const { data } = await atlasApi.post(`/curriculum-requirements/${schoolYearId}/requirements/preview`, { offerings });
			setPreview(data.preview);
		} catch (err: unknown) {
			const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Preview failed.';
			toast.error(message);
		} finally {
			setPreviewBusy(false);
		}
	}, [schoolYearId, requirements]);

	const handleApply = useCallback(async () => {
		if (schoolYearId == null || !preview) return;
		if (!preview.termConfigRevision) {
			toast.error('Preview has no term revision. Refresh the preview and review again.');
			return;
		}
		setApplyBusy(true);
		try {
			const offerings = requirements.map((r) => ({
				subjectId: r.subjectId,
				gradeLevel: r.gradeLevel,
				programType: r.programType,
				sectionMirrorId: r.sectionMirrorId,
				cohortId: r.cohortId,
				classification: r.classification,
				weeklyMinutes: r.weeklyMinutes,
				rotationFamily: r.rotationFamily,
				rotationOrder: r.rotationOrder,
				termMode: r.termMode,
				termIdentities: r.termIdentities,
			}));
			const { data } = await atlasApi.post(`/curriculum-requirements/${schoolYearId}/requirements/apply`, {
				offerings,
				expectedFingerprint: preview.fingerprint,
				expectedSourceVersions: preview.sourceVersions,
				expectedTermConfigUpdatedAt: preview.termConfigRevision.updatedAt,
			});
			toast.success(`Applied ${data.receipt.applied} requirement(s), retired ${data.receipt.retired}.`);
			setConfirmApply(false);
			void load();
		} catch (err: unknown) {
			const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Apply failed.';
			toast.error(message);
		} finally {
			setApplyBusy(false);
		}
	}, [schoolYearId, preview, requirements, load]);

	return (
		<div className="flex flex-col h-[calc(100svh-3.5rem)]">
			<div className="shrink-0 border-b px-4 py-3 flex flex-wrap items-center gap-2">
				<Button asChild variant="ghost" size="sm">
					<Link to="/subjects"><ArrowLeft className="size-4" /> Subjects</Link>
				</Button>
				<div className="min-w-0">
					<h1 className="text-base font-bold leading-tight">Curriculum Requirements</h1>
					<p className="text-xs text-muted-foreground">
						ATLAS-owned required subjects for the active school year. The subject catalog stores reusable subjects; this page decides what the year actually requires.
					</p>
				</div>
				<div className="ml-auto flex items-center gap-2 text-xs">
					<span className="text-muted-foreground">Year {schoolYearId ?? '…'}</span>
					<Button asChild variant="outline" size="sm">
						<Link to="/subjects/decision-workspace">Decision workspace</Link>
					</Button>
					{readiness && (
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<Badge className={readiness.ready ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}>
										{readiness.ready ? <CheckCircle2 className="size-3 mr-1" /> : <AlertTriangle className="size-3 mr-1" />}
										{readiness.ready ? 'Ready' : `${readiness.blockers.length} blocker(s)`}
									</Badge>
								</TooltipTrigger>
								<TooltipContent>
									{readiness.ready ? 'All scopes are configured or explicitly empty.' : readiness.blockers.map((b) => b.message).join(' ')}
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					)}
					<Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
						<RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} /> Refresh
					</Button>
				</div>
			</div>

			<div className="flex-1 min-h-0 overflow-auto px-4 py-3 space-y-3">
				{/* Inline stat banner */}
				<div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
					<span>Terms: <strong className="text-foreground">{termConfig ? `${termConfig.termCount} (${termConfig.termIdentities.join(', ')})` : 'not configured'}</strong></span>
					<span>Scopes: <strong className="text-foreground">{readiness?.scopeStates.length ?? 0}</strong></span>
					<span>Requirements: <strong className="text-foreground">{requirements.length}</strong></span>
				</div>

				{scopeBlockedReason && (
					<div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
						{scopeBlockedReason}
					</div>
				)}

				{viewState === 'loading' && !scopeBlockedReason && (
					<div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-24 w-full" /></div>
				)}

				{viewState === 'error' && (
					<div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
						{error} <Button variant="outline" size="sm" className="ml-2" onClick={() => void load()}>Retry</Button>
					</div>
				)}

				{!loading && !error && !scopeBlockedReason && actorSchoolId != null && schoolYearId != null && (
					<AnimatePresence mode="wait">
						<motion.div key={viewState} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
							{/* Step 1: terms */}
							<Accordion type="single" collapsible defaultValue={termConfig ? undefined : 'terms'}>
								<AccordionItem value="terms">
									<AccordionTrigger>Step 1 · Term configuration{termConfig ? ` — ${termConfig.termCount} term(s)` : ' — missing'}</AccordionTrigger>
									<AccordionContent>
										<div className="flex flex-wrap items-end gap-2">
											<div>
												<Label htmlFor="term-count">Term count</Label>
												<Input id="term-count" className="w-24" value={termCountText} onChange={(e) => setTermCountText(e.target.value)} inputMode="numeric" />
											</div>
											<div className="min-w-52 flex-1">
												<Label htmlFor="term-identities">Term identities (comma-separated, in order)</Label>
												<Input id="term-identities" value={termIdentitiesText} onChange={(e) => setTermIdentitiesText(e.target.value)} placeholder="e.g. Q1, Q2" />
											</div>
											<Button size="sm" onClick={() => void handleSaveTerms()} disabled={saving}>
												{saving ? <Loader2 className="size-4 animate-spin" /> : null} Save terms
											</Button>
										</div>
										<p className="mt-1 text-xs text-muted-foreground">Term count and identities are operator configuration — never defaulted. All-year subjects need no per-term assignment.</p>
									</AccordionContent>
								</AccordionItem>
							</Accordion>

							{/* Step 2: scope states */}
							<div className="rounded-md border p-3">
								<h2 className="text-sm font-bold">Step 2 · Requirement scopes</h2>
								{viewState === 'missing-config' && <p className="text-xs text-muted-foreground">Configure terms above before adding required subjects.</p>}
								{viewState === 'empty' && <p className="text-xs text-muted-foreground">No required subjects yet. Add the first requirement below, or mark a scope explicitly empty.</p>}
								<div className="mt-2 flex flex-wrap gap-1.5">
									{(readiness?.scopeStates ?? []).map((scope) => (
										<TooltipProvider key={scope.scopeKey}>
											<Tooltip>
												<TooltipTrigger asChild>
													<Button
														type="button"
														size="sm"
														variant="outline"
														onClick={() => setScopeFilter((f) => (f === scope.scopeKey ? null : scope.scopeKey))}
														className={`rounded-full text-xs font-semibold ${SCOPE_TONES[scope.state] ?? ''} ${scopeFilter === scope.scopeKey ? 'ring-2 ring-offset-1 ring-primary' : ''}`}
													>
														{scopeDisplayName(scope)} · {SCOPE_STATE_LABELS[scope.state]}
													</Button>
												</TooltipTrigger>
												<TooltipContent>{scope.detail}</TooltipContent>
											</Tooltip>
										</TooltipProvider>
									))}
								</div>
								{readiness && readiness.blockers.length > 0 && (
									<ul className="mt-2 space-y-1 text-xs text-amber-800">
										{readiness.blockers.map((b, i) => (
											<li key={i} className="flex gap-1"><AlertTriangle className="size-3.5 shrink-0 mt-0.5" />{b.message}</li>
										))}
									</ul>
								)}
							</div>

							{/* Step 3: requirements */}
							<div className="rounded-md border p-3">
								<div className="flex flex-wrap items-center gap-2">
									<h2 className="text-sm font-bold">Step 3 · Required subjects{scopeFilter ? ` — ${scopeFilter}` : ''}</h2>
									<div className="ml-auto flex gap-1.5">
										<Button variant="outline" size="sm" onClick={() => void handlePreview()} disabled={previewBusy || requirements.length === 0}>
											{previewBusy ? <Loader2 className="size-4 animate-spin" /> : null} Preview batch
										</Button>
										<Button size="sm" onClick={() => setConfirmApply(true)} disabled={!preview}>
											Apply batch
										</Button>
										<Button size="sm" variant="secondary" onClick={() => setAddOpen(true)} disabled={!termConfig}>
											<Plus className="size-4" /> Add
										</Button>
									</div>
								</div>
								{preview && (
									<p className="mt-1 text-xs text-muted-foreground">
										Preview {preview.fingerprint}: {preview.newCount} new · {preview.unchangedCount} unchanged · {preview.retiredCount} to retire.
									</p>
								)}
								{visibleRequirements.length === 0 ? (
									<p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><BookOpen className="size-4" /> No requirements in this view.</p>
								) : (
									<ul className="mt-2 divide-y text-sm">
										{visibleRequirements.map((r) => {
											const override = sectionName(r.sectionMirrorId) ?? cohortName(r.cohortId);
											return (
												<li key={r.id} className="flex flex-wrap items-center gap-2 py-1.5">
													<span className="font-semibold">{subjectName(r.subjectId)}</span>
													<Badge variant="outline">G{r.gradeLevel}</Badge>
													<Badge variant="outline">{r.programType}</Badge>
													<Badge variant="outline">{r.classification}</Badge>
													{override && <Badge variant="secondary">{override}</Badge>}
													<span className="text-xs text-muted-foreground">
														{r.termMode === 'ROTATING_FAMILY_MEMBER'
															? `${r.rotationFamily ?? ''} · order ${r.rotationOrder ?? ''} · ${r.termIdentities.join(', ') || 'no term'} · ${r.weeklyMinutes} min/wk`
															: r.termMode === 'ALL' && r.termIdentities.length === 0
																? `all-year · ${r.weeklyMinutes} min/wk`
																: `${r.termMode} · ${r.termIdentities.join(', ') || 'no terms'} · ${r.weeklyMinutes} min/wk`}
													</span>
													<span className="ml-auto text-xs text-muted-foreground">v{r.version}</span>
													<Button variant="ghost" size="sm" onClick={() => setRetireTarget(r)}>Retire</Button>
												</li>
											);
										})}
									</ul>
								)}
							</div>
						</motion.div>
					</AnimatePresence>
				)}
			</div>

			{/* Add dialog */}
			<Dialog open={addOpen} onOpenChange={setAddOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Add required subject</DialogTitle>
						<DialogDescription>Grade/program defaults, with an optional section or cohort override. Overrides narrow one scope and never change the base scope.</DialogDescription>
					</DialogHeader>
					<div className="grid gap-2">
						<div className="grid grid-cols-2 gap-2">
							<div>
								<Label>Grade</Label>
								<Select value={formGrade} onValueChange={setFormGrade}>
									<SelectTrigger><SelectValue /></SelectTrigger>
									<SelectContent>
										{GRADE_OPTIONS.map((g) => (
											<SelectItem key={String(g)} value={String(g)}>{gradeLabel(g)}</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div>
								<Label>Program</Label>
								<Select value={formProgram} onValueChange={setFormProgram}>
									<SelectTrigger><SelectValue /></SelectTrigger>
									<SelectContent>
										{PROGRAM_SCOPE_OPTIONS.map((p) => (
											<SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>
						<div>
							<Label>Term mode</Label>
							<Select value={formTermMode} onValueChange={setFormTermMode}>
								<SelectTrigger><SelectValue /></SelectTrigger>
								<SelectContent>
									{TERM_MODES.map((m) => (
										<SelectItem key={m} value={m} disabled={m === 'ROTATING_FAMILY_MEMBER' && !termConfig}>
											{m}{m === 'ROTATING_FAMILY_MEMBER' && !termConfig ? ' (configure terms first)' : ''}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						{formTermMode !== 'EMPTY' && (
							<div>
								<Label>Subject (catalog)</Label>
								<SearchableSelect
									value={formSubjectId}
									onValueChange={setFormSubjectId}
									items={catalog.map((s) => ({ value: String(s.id), label: `${s.code} · ${s.name}` }))}
									placeholder="Choose a catalog subject"
								/>
							</div>
						)}
						{formTermMode === 'ROTATING_FAMILY_MEMBER' && termConfig && (
							<div className="grid grid-cols-3 gap-2">
								<div>
									<Label>Rotation family</Label>
									<Input value={formRotationFamily} onChange={(e) => setFormRotationFamily(e.target.value)} placeholder="e.g. TLE_ROT" />
								</div>
								<div>
									<Label>Order (1–{termConfig.termCount})</Label>
									<Input value={formRotationOrder} onChange={(e) => setFormRotationOrder(e.target.value)} inputMode="numeric" />
								</div>
								<div>
									<Label>Term</Label>
									<Select value={formRotationTerm} onValueChange={setFormRotationTerm}>
										<SelectTrigger><SelectValue placeholder="Pick a term" /></SelectTrigger>
										<SelectContent>
											{termConfig.termIdentities.map((t) => (
												<SelectItem key={t} value={t}>{t}</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</div>
						)}
						<div className="grid grid-cols-2 gap-2">
							<div>
								<Label>Section override (optional)</Label>
								<SearchableSelect
									value={formSectionId}
									onValueChange={(v) => { setFormSectionId(v); if (v !== '') setFormCohortId(''); }}
									items={sections.map((s) => ({ value: String(s.mirrorId), label: `${s.name}${s.programType ? ` · ${s.programType}` : ''}` }))}
									placeholder={sections.length === 0 ? 'No sections loaded' : 'Whole grade/program'}
								/>
							</div>
							<div>
								<Label>Cohort override (optional)</Label>
								<SearchableSelect
									value={formCohortId}
									onValueChange={(v) => { setFormCohortId(v); if (v !== '') setFormSectionId(''); }}
									items={cohorts.map((c) => ({ value: String(c.id), label: `${c.cohortCode}${c.specializationName ? ` · ${c.specializationName}` : ''}` }))}
									placeholder={cohorts.length === 0 ? 'No cohorts loaded' : 'Whole grade/program'}
								/>
							</div>
						</div>
						<div className="grid grid-cols-2 gap-2">
							<div>
								<Label>Classification</Label>
								<Select value={formClassification} onValueChange={setFormClassification}>
									<SelectTrigger><SelectValue /></SelectTrigger>
									<SelectContent>
										{CLASSIFICATIONS.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
									</SelectContent>
								</Select>
							</div>
							{formTermMode !== 'EMPTY' && (
								<div>
									<Label>Minutes / week</Label>
									<Input value={formMinutes} onChange={(e) => setFormMinutes(e.target.value)} inputMode="numeric" />
								</div>
							)}
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
						<Button onClick={() => void handleAdd()} disabled={saving || !rotatingValid}>{saving ? <Loader2 className="size-4 animate-spin" /> : null} Add requirement</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<ConfirmationModal
				open={confirmApply}
				onOpenChange={setConfirmApply}
				title="Apply batch changes?"
				description={preview ? `Apply ${preview.newCount} new, keep ${preview.unchangedCount} unchanged, retire ${preview.retiredCount}. Fingerprint ${preview.fingerprint}.` : ''}
				confirmText="Apply"
				onConfirm={() => void handleApply()}
				loading={applyBusy}
			/>

			<ConfirmationModal
				open={retireTarget !== null}
				onOpenChange={(open) => { if (!open) setRetireTarget(null); }}
				title="Retire requirement?"
				description={retireTarget ? `Retire ${subjectName(retireTarget.subjectId)} for Grade ${retireTarget.gradeLevel} ${retireTarget.programType}? The row is kept for audit.` : ''}
				confirmText="Retire"
				onConfirm={() => void handleRetire()}
				loading={saving}
			/>
		</div>
	);
}
