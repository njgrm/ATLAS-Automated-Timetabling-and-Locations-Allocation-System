import { useState, useEffect, useMemo } from 'react';
import { ShieldCheck, AlertTriangle, UserMinus, BookX, Loader2, Search, ArrowRight, Clock, Box, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import atlasApi from '@/lib/api';
import { resolveActiveSchoolYearContext } from '@/lib/enrollpro-public-settings';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/ui/card';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { ScrollArea } from '@/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/tabs';

const DEFAULT_SCHOOL_ID = 1;

export default function Audit() {
	const [loading, setLoading] = useState(true);
	const [faculty, setFaculty] = useState<any[]>([]);
	const [subjects, setSubjects] = useState<any[]>([]);
	const [aliases, setAliases] = useState<any[]>([]);
	const [prefAudit, setPrefAudit] = useState<any[]>([]);
	const [sections, setSections] = useState<any[]>([]);
	const [templates, setTemplates] = useState<any[]>([]);
	const [rooms, setRooms] = useState<any[]>([]);
	const [searchQuery, setSearchQuery] = useState('');
	const [activeSchoolYearId, setActiveSchoolYearId] = useState<number | null>(null);
	const [activeYearSource, setActiveYearSource] = useState<'atlas' | 'atlas-persisted' | 'enrollpro-verified' | 'enrollpro' | 'cache'>('cache');
	const [dataSource, setDataSource] = useState<'live' | 'cached' | 'none'>('none');
	const [degradedReasons, setDegradedReasons] = useState<string[]>([]);
	const [mismatchSearch, setMismatchSearch] = useState('');
	const [clashSearch, setClashSearch] = useState('');
	const [rosterSearch, setRosterSearch] = useState('');
	const [showOnlyFacilityGaps, setShowOnlyFacilityGaps] = useState(false);
	const [utilSearch, setUtilSearch] = useState('');

	useEffect(() => {
		resolveActiveSchoolYearContext({ allowStaleOnError: true }).then((context) => {
			if (context.activeSchoolYearId) {
				setActiveSchoolYearId(context.activeSchoolYearId);
				setActiveYearSource(context.source);
			} else {
				setLoading(false);
				toast.error('No active school year found');
			}
		}).catch(() => {
			setLoading(false);
			toast.error('No active school year found');
		});
	}, []);

	useEffect(() => {
		if (activeSchoolYearId) {
			loadData();
		}
	}, [activeSchoolYearId]);

	const loadData = async () => {
		if (!activeSchoolYearId) return;
		setLoading(true);
		try {
			const [facRes, subRes, aliasRes, prefRes, secRes, templateRes, roomRes] = await Promise.allSettled([
				atlasApi.get('/faculty-assignments/summary', { params: { schoolId: DEFAULT_SCHOOL_ID, schoolYearId: activeSchoolYearId } }),
				atlasApi.get('/subjects', { params: { schoolId: DEFAULT_SCHOOL_ID } }),
				atlasApi.get(`/specialization-aliases?schoolId=${DEFAULT_SCHOOL_ID}`),
				atlasApi.get(`/preferences/${DEFAULT_SCHOOL_ID}/${activeSchoolYearId}/audit`),
				atlasApi.get(`/sections/summary/${activeSchoolYearId}`, { params: { schoolId: DEFAULT_SCHOOL_ID } }),
				atlasApi.get(`/class-templates?schoolId=${DEFAULT_SCHOOL_ID}`),
				atlasApi.get(`/map/schools/${DEFAULT_SCHOOL_ID}/buildings`)
			]);

			const reasons: string[] = [];

			if (facRes.status === 'fulfilled') {
				setFaculty(facRes.value.data.faculty ?? []);
			} else {
				reasons.push('Teaching load summary is unavailable.');
				setFaculty([]);
			}

			if (subRes.status === 'fulfilled') {
				setSubjects(subRes.value.data.subjects ?? []);
			} else {
				reasons.push('Subject catalog is unavailable.');
				setSubjects([]);
			}

			if (aliasRes.status === 'fulfilled') {
				setAliases(aliasRes.value.data.aliases ?? []);
			} else {
				reasons.push('Specialization aliases are unavailable.');
				setAliases([]);
			}

			if (prefRes.status === 'fulfilled') {
				setPrefAudit(prefRes.value.data.audit ?? []);
			} else {
				reasons.push('Preference audit is unavailable.');
				setPrefAudit([]);
			}

			let sectionSource: string | null = null;
			if (secRes.status === 'fulfilled') {
				setSections(secRes.value.data.sections ?? []);
				sectionSource = secRes.value.data.source ?? null;
			} else {
				reasons.push('Section summary is unavailable.');
				setSections([]);
			}

			if (templateRes.status === 'fulfilled') {
				setTemplates(templateRes.value.data.templates ?? []);
			} else {
				reasons.push('Class templates are unavailable.');
				setTemplates([]);
			}

			if (roomRes.status === 'fulfilled') {
				const allRooms = (roomRes.value.data.buildings || []).flatMap((b: any) => b.rooms || []);
				setRooms(allRooms);
			} else {
				reasons.push('Room map data is unavailable.');
				setRooms([]);
			}

			const hasLocalEvidence =
				facRes.status === 'fulfilled' &&
				subRes.status === 'fulfilled' &&
				secRes.status === 'fulfilled';

			if (!hasLocalEvidence) {
				setDataSource('none');
				setDegradedReasons(reasons);
				toast.error('Audit cannot run: local ATLAS evidence is incomplete for this school year.');
				return;
			}

			const isUpstreamBacked = activeYearSource === 'enrollpro' && sectionSource === 'enrollpro';
			setDataSource(isUpstreamBacked ? 'live' : 'cached');
			setDegradedReasons(reasons);
			if (!isUpstreamBacked || reasons.length > 0) {
				toast.warning('Audit loaded in degraded mode using ATLAS-cached evidence.');
			}
		} catch {
			setDataSource('none');
			setDegradedReasons(['Failed to load audit data.']);
			toast.error('Failed to load audit data');
		} finally {
			setLoading(false);
		}
	};

	const checkQualification = (f: any, s: any) => {
		const allowed = s.allowedSpecializations || [];
		if (allowed.length === 0) return 1; // Open to all

		// Tier 1: Spec
		if (f.specialization && allowed.includes(f.specialization)) return 1;
		// Tier 2: Dept
		if (f.department && allowed.includes(f.department)) return 2;
		// Tier 3: Alias
		const facultyTerms = [f.specialization, f.department].filter(Boolean);
		for (const alias of aliases) {
			if (facultyTerms.includes(alias.alias) && allowed.includes(alias.canonical)) return 3;
		}

		return null;
	};

	const mismatches = useMemo(() => {
		const list: any[] = [];
		faculty.forEach(f => {
			(f.assignments || []).forEach((a: any) => {
				const sub = subjects.find(s => s.id === a.subjectId);
				if (!sub) return;
				
				if (!checkQualification(f, sub)) {
					list.push({
						facultyId: f.id,
						facultyName: `${f.lastName}, ${f.firstName}`,
						subjectId: sub.id,
						subjectName: sub.name,
						subjectCode: sub.code,
						required: (sub.allowedSpecializations || []).join(', '),
						actual: f.specialization || f.department || 'None'
					});
				}
			});
		});
		return list;
	}, [faculty, subjects, aliases]);

	const gaps = useMemo(() => {
		return subjects.filter(s => {
			const allowed = s.allowedSpecializations || [];
			if (allowed.length === 0) return false;
			
			const qualifiedFaculty = faculty.filter(f => checkQualification(f, s));
			return qualifiedFaculty.length === 0;
		});
	}, [faculty, subjects, aliases]);

	const clashes = useMemo(() => {
		return prefAudit.filter(p => p.unavailabilityPercent > 50).map(p => {
			const qualifiedSubjects = subjects.filter(s => {
				const allowed = s.allowedSpecializations || [];
				return allowed.length > 0 && ((p.specialization && allowed.includes(p.specialization)) || (p.department && allowed.includes(p.department)));
			});
			return { ...p, qualifiedSubjects };
		}).filter(p => p.qualifiedSubjects.length > 0);
	}, [prefAudit, subjects]);

	const rosterGaps = useMemo(() => {
		const missing: any[] = [];
		sections.forEach(sec => {
			const template = templates.find(t => t.programType === sec.programCode);
			if (!template) return;

			template.subjects.forEach((reqSub: any) => {
				const isAssigned = faculty.some(f => 
					(f.assignments || []).some((a: any) => 
						a.subjectId === reqSub.id && (a.sectionIds || []).includes(sec.id)
					)
				);

				if (!isAssigned) {
					missing.push({
						sectionId: sec.id,
						sectionName: sec.name,
						gradeLevel: sec.displayOrder,
						subjectId: reqSub.id,
						subjectName: reqSub.name,
						subjectCode: reqSub.code
					});
				}
			});
		});
		return missing;
	}, [sections, templates, faculty]);

	const optimizationIssues = useMemo(() => {
		const issues: any[] = [];
		faculty.forEach(spec => {
			const specSubjs = subjects.filter(s => checkQualification(spec, s) === 1);
			if (specSubjs.length === 0) return;

			const hasGeneralLoad = (spec.assignments || []).some((a: any) => {
				const sub = subjects.find(s => s.id === a.subjectId);
				const tier = sub ? checkQualification(spec, sub) : null;
				return tier === 3 || tier === null;
			});

			if (hasGeneralLoad) {
				specSubjs.forEach(s => {
					const assignedToOther = faculty.some(other => 
						other.id !== spec.id && 
						(other.assignments || []).some((oa: any) => oa.subjectId === s.id) &&
						checkQualification(other, s) !== 1
					);

					if (assignedToOther) {
						issues.push({
							specialistName: `${spec.lastName}, ${spec.firstName}`,
							specialization: spec.specialization || spec.department,
							subjectName: s.name,
							subjectCode: s.code,
							reason: `This specialist has capacity for ${s.name} but is assigned other work while non-specialists teach it.`
						});
					}
				});
			}
		});
		return issues;
	}, [faculty, subjects, aliases]);

	const facilityGaps = useMemo(() => {
		return subjects.filter(s => s.requiredFeatures?.length > 0).map(s => {
			const compatible = rooms.filter(r => 
				r.type === s.preferredRoomType && 
				s.requiredFeatures.every((f: string) => (r.features || []).includes(f))
			);
			return { ...s, compatibleCount: compatible.length };
		}).filter(s => s.compatibleCount === 0);
	}, [subjects, rooms]);

	const syncIssues = useMemo(() => {
		return faculty.filter(f => !f.employeeId || f.employeeId.length !== 7).map(f => ({
			id: f.id,
			name: `${f.lastName}, ${f.firstName}`,
			reason: !f.employeeId ? 'Missing Employee ID' : 'Invalid ID format (must be 7 digits)'
		}));
	}, [faculty]);

	const criticalCount = mismatches.length + facilityGaps.length;
	const isReady = criticalCount === 0;

	if (loading) return <div className="p-6 flex items-center justify-center h-full"><Loader2 className="animate-spin" /></div>;

	return (
		<div className="h-[calc(100svh-3.5rem)] flex flex-col overflow-hidden bg-background">
			{/* Page Header */}
			<header className="shrink-0 border-b bg-muted/30 px-6 py-3">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="size-8 rounded-lg bg-emerald-600/10 flex items-center justify-center">
							<ShieldCheck className="size-5 text-emerald-600" />
						</div>
						<div>
							<h1 className="text-lg font-bold tracking-tight">Readiness Audit</h1>
							<p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">System Validation & Health Check</p>
						</div>
					</div>
					<div className="flex items-center gap-3">
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<Badge
										variant={dataSource === 'live' ? 'secondary' : 'outline'}
										className="h-6 px-2 text-[0.7rem] uppercase tracking-wide font-bold cursor-help"
									>
										{dataSource === 'live' ? 'Verified Live' : dataSource === 'cached' ? 'Working from Saved Data' : 'No Saved Data'}
									</Badge>
								</TooltipTrigger>
								<TooltipContent side="bottom" className="text-[0.65rem] font-semibold p-2">
									{dataSource === 'live' 
										? 'Data freshly verified with EnrollPro.' 
										: 'Using data saved in ATLAS. Changes will sync when EnrollPro returns.'}
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
						<Button variant="outline" size="sm" className="h-8 gap-2" onClick={loadData}>
							<RefreshCw className="size-3.5" />
							Refresh
						</Button>
						{isReady && (
							<Button asChild size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700">
								<Link to="/timetable/generate">Proceed to Generator</Link>
							</Button>
						)}
					</div>
				</div>
			</header>

			{degradedReasons.length > 0 && (
				<div className="shrink-0 mx-6 mt-3 flex items-center gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 shadow-sm">
					<div className="size-5 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
						<AlertTriangle className='size-3 text-amber-600' />
					</div>
					<div className="flex-1">
						<p className="text-xs font-bold">Running with saved data</p>
						<p className="text-[11px] mt-0.5 opacity-90">Some live records are currently unreachable. Audit is using saved ATLAS evidence. Missing: {degradedReasons.join(' ')}</p>
					</div>
				</div>
			)}

			<div className="flex-1 flex overflow-hidden">
				{/* Left Rail - Summaries & Verdict */}
				<aside className="w-80 shrink-0 border-r bg-muted/10 flex flex-col overflow-hidden">
					<ScrollArea className="flex-1">
						<div className="p-6 space-y-6">
							{/* Verdict Card */}
							<Card className={`border-l-4 shadow-sm ${isReady ? 'border-l-emerald-500 bg-emerald-50/50' : 'border-l-red-500 bg-red-50/50'}`}>
								<CardContent className="p-4">
									<div className="flex items-start gap-3">
										<div className={`size-8 rounded-full shrink-0 flex items-center justify-center ${isReady ? 'bg-emerald-100' : 'bg-red-100'}`}>
											{isReady ? <CheckCircle2 className="size-5 text-emerald-600" /> : <XCircle className="size-5 text-red-600" />}
										</div>
										<div>
											<h3 className={`text-sm font-bold ${isReady ? 'text-emerald-900' : 'text-red-900'}`}>
												{isReady ? 'System Ready' : 'Blockers Found'}
											</h3>
											<p className={`text-[11px] mt-1 leading-relaxed ${isReady ? 'text-emerald-800/70' : 'text-red-800/70'}`}>
												{isReady 
													? 'All critical checks passed. You can proceed to generate the schedule.' 
													: `Found ${criticalCount} critical issue${criticalCount === 1 ? '' : 's'} that will block schedule generation.`}
											</p>
										</div>
									</div>
								</CardContent>
							</Card>

							<div className="space-y-3">
								<label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">Health Indicators</label>
								
								<Card className="shadow-none border-none bg-red-50/50">
									<CardContent className="p-4 flex items-center justify-between">
										<div className="space-y-1">
											<div className="text-xs font-medium text-red-800 flex items-center gap-2">
												<AlertTriangle className="size-3.5" /> Critical Errors
											</div>
											<div className="text-2xl font-bold text-red-700">{criticalCount}</div>
										</div>
										<div className="text-right">
											<p className="text-[10px] text-red-600/70">{mismatches.length} Mismatches</p>
											<p className="text-[10px] text-red-600/70">{facilityGaps.length} Facility Gaps</p>
										</div>
									</CardContent>
								</Card>

								<Card className="shadow-none border-none bg-orange-50/50">
									<CardContent className="p-4 flex items-center justify-between">
										<div className="space-y-1">
											<div className="text-xs font-medium text-orange-800 flex items-center gap-2">
												<Clock className="size-3.5" /> Constraint Clashes
											</div>
											<div className="text-2xl font-bold text-orange-700">{clashes.length}</div>
										</div>
										<p className="text-[10px] text-orange-600/70 text-right w-24 leading-tight">
											Specialists with {'>'}50% blocked
										</p>
									</CardContent>
								</Card>

								<Card className="shadow-none border-none bg-amber-50/50">
									<CardContent className="p-4 flex items-center justify-between">
										<div className="space-y-1">
											<div className="text-xs font-medium text-amber-800 flex items-center gap-2">
												<BookX className="size-3.5" /> Roster Gaps
											</div>
											<div className="text-2xl font-bold text-amber-700">{rosterGaps.length}</div>
										</div>
										<p className="text-[10px] text-amber-600/70 text-right w-24 leading-tight">
											Sections missing core subjects
										</p>
									</CardContent>
								</Card>

								<Card className="shadow-none border-none bg-blue-50/50">
									<CardContent className="p-4 flex items-center justify-between">
										<div className="space-y-1">
											<div className="text-xs font-medium text-blue-800 flex items-center gap-2">
												<RefreshCw className="size-3.5" /> Sync Health
											</div>
											<div className="text-2xl font-bold text-blue-700">{syncIssues.length}</div>
										</div>
										<p className="text-[10px] text-blue-600/70 text-right w-24 leading-tight">
											Invalid or missing IDs
										</p>
									</CardContent>
								</Card>
							</div>

							{/* Utilization Summary in Rail */}
							<Card className="bg-primary/5 border-primary/10 shadow-none">
								<CardHeader className="p-4 pb-2">
									<CardTitle className="text-xs font-bold uppercase tracking-wider text-primary/70">Average Roster Load</CardTitle>
								</CardHeader>
								<CardContent className="p-4 pt-0">
									{(() => {
										const avgLoad = faculty.reduce((sum, f) => sum + f.loadPercentage, 0) / (faculty.length || 1);
										return (
											<div className="space-y-2">
												<div className="text-2xl font-bold text-primary">{avgLoad.toFixed(1)}%</div>
												<p className="text-[10px] text-primary/70 leading-relaxed italic">
													{avgLoad > 95 ? 'Capacity is tight. Generation may struggle.' : 
													 avgLoad < 70 ? 'Significant excess capacity detected.' : 
													 'Roster capacity is in the optimal range.'}
												</p>
											</div>
										);
									})()}
								</CardContent>
							</Card>
						</div>
					</ScrollArea>
				</aside>

				{/* Main Workspace - Data Lists */}
				<main className="flex-1 flex flex-col overflow-hidden">
					<Tabs defaultValue="mismatches" className="flex-1 flex flex-col overflow-hidden">
						<div className="px-6 pt-4 border-b bg-background shrink-0">
							<TabsList className="w-fit bg-muted/50 p-1">
								<TabsTrigger value="mismatches" className="text-xs gap-2 px-4 h-8">
									Mismatches {mismatches.length > 0 && <Badge variant="secondary" className="px-1 py-0 h-4 text-[9px] bg-red-100 text-red-700 border-red-200">{mismatches.length}</Badge>}
								</TabsTrigger>
								<TabsTrigger value="clashes" className="text-xs gap-2 px-4 h-8">
									Clashes {clashes.length > 0 && <Badge variant="secondary" className="px-1 py-0 h-4 text-[9px] bg-orange-100 text-orange-700 border-orange-200">{clashes.length}</Badge>}
								</TabsTrigger>
								<TabsTrigger value="roster" className="text-xs gap-2 px-4 h-8">
									Roster {rosterGaps.length > 0 && <Badge variant="secondary" className="px-1 py-0 h-4 text-[9px] bg-amber-100 text-amber-700 border-amber-200">{rosterGaps.length}</Badge>}
								</TabsTrigger>
								<TabsTrigger value="facilities" className="text-xs gap-2 px-4 h-8">
									Facilities {facilityGaps.length > 0 && <Badge variant="secondary" className="px-1 py-0 h-4 text-[9px] bg-red-100 text-red-700 border-red-200">{facilityGaps.length}</Badge>}
								</TabsTrigger>
								<TabsTrigger value="optimization" className="text-xs gap-2 px-4 h-8">
									Optimization {optimizationIssues.length > 0 && <Badge variant="secondary" className="px-1 py-0 h-4 text-[9px]">{optimizationIssues.length}</Badge>}
								</TabsTrigger>
								<TabsTrigger value="utilization" className="text-xs px-4 h-8">Utilization</TabsTrigger>
								<TabsTrigger value="sync" className="text-xs gap-2 px-4 h-8">
									Sync {syncIssues.length > 0 && <Badge variant="secondary" className="px-1 py-0 h-4 text-[9px] bg-blue-100 text-blue-700 border-blue-200">{syncIssues.length}</Badge>}
								</TabsTrigger>
							</TabsList>
						</div>
						
						<div className="flex-1 overflow-hidden">
							<TabsContent value="mismatches" className="h-full m-0 p-0 focus-visible:ring-0">
								<div className="h-full flex flex-col overflow-hidden">
									<div className="px-6 py-3 border-b bg-muted/20 flex items-center justify-between">
										<div className="relative flex-1 max-w-sm">
											<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
											<Input 
												placeholder="Search faculty or subjects..." 
												value={mismatchSearch}
												onChange={(e) => setMismatchSearch(e.target.value)}
												className="pl-8 h-8 text-xs bg-background"
											/>
										</div>
										<p className="text-[11px] text-muted-foreground italic">Critical issues that block schedule generation</p>
									</div>
									<ScrollArea className="flex-1">
										<div className="divide-y px-6">
										{(() => {
											const filtered = mismatches.filter(m => !mismatchSearch ||
												m.facultyName.toLowerCase().includes(mismatchSearch.toLowerCase()) ||
												m.subjectName.toLowerCase().includes(mismatchSearch.toLowerCase()));
											if (filtered.length === 0) return (
												<div className="py-20 text-center">
													<ShieldCheck className="size-10 text-emerald-500/20 mx-auto mb-3" />
													<p className="text-sm text-muted-foreground italic">
														{mismatchSearch ? 'No mismatches match your search.' : 'No critical qualification mismatches found.'}
													</p>
												</div>
											);
											return filtered.map((m, i) => (
													<div key={i} className="py-4 flex items-center justify-between hover:bg-muted/30 transition-colors group px-2 -mx-2 rounded-lg">
														<div className="space-y-1">
															<div className="flex items-center gap-2">
																<span className="font-bold text-sm">{m.facultyName}</span>
																<ArrowRight className="size-3 text-muted-foreground" />
																<span className="font-semibold text-sm text-primary">{m.subjectName} ({m.subjectCode})</span>
															</div>
															<div className="flex items-center gap-4">
																<div className="flex items-center gap-1.5">
																	<span className="text-[10px] text-muted-foreground uppercase font-bold">Required</span>
																	<Badge variant="outline" className="text-[10px] text-red-700 border-red-200 bg-red-50 py-0 h-4">{m.required}</Badge>
																</div>
																<div className="flex items-center gap-1.5">
																	<span className="text-[10px] text-muted-foreground uppercase font-bold">Actual</span>
																	<Badge variant="outline" className="text-[10px] py-0 h-4">{m.actual}</Badge>
																</div>
															</div>
														</div>
														<Button asChild variant="outline" size="sm" className="h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
															<Link to={`/teaching-load?facultyId=${m.facultyId}`}>Fix in Teaching Load →</Link>
														</Button>
													</div>
												));
										})()}
										</div>
									</ScrollArea>
								</div>
							</TabsContent>

							<TabsContent value="clashes" className="h-full m-0 p-0 focus-visible:ring-0">
								<div className="h-full flex flex-col overflow-hidden">
									<div className="px-6 py-3 border-b bg-muted/20">
										<div className="relative max-w-sm">
											<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
											<Input 
												placeholder="Search faculty..." 
												value={clashSearch}
												onChange={(e) => setClashSearch(e.target.value)}
												className="pl-8 h-8 text-xs bg-background"
											/>
										</div>
									</div>
									<ScrollArea className="flex-1">
										<div className="divide-y px-6">
										{(() => {
											const filtered = clashes.filter(c => !clashSearch ||
												c.name.toLowerCase().includes(clashSearch.toLowerCase()));
											if (filtered.length === 0) return (
												<div className="py-20 text-center text-muted-foreground italic">
													{clashSearch ? 'No bottlenecks match your search.' : 'No preference bottlenecks detected.'}
												</div>
											);
											return filtered.map((c, i) => (
													<div key={i} className="py-4 flex items-center justify-between hover:bg-muted/30 transition-colors group px-2 -mx-2 rounded-lg">
														<div className="space-y-1 flex-1">
															<div className="flex items-center gap-2">
																<span className="font-bold text-sm">{c.name}</span>
																<Badge variant="destructive" className="text-[9px] py-0 h-4 uppercase font-bold tracking-wider">{c.unavailabilityPercent}% Unavailable</Badge>
															</div>
															<div className="text-[11px] text-muted-foreground">
																Blocks scheduling for: <span className="font-semibold">{c.qualifiedSubjects.map((s: any) => s.code).join(', ')}</span>
															</div>
														</div>
														<Button asChild variant="outline" size="sm" className="h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
															<Link to={`/faculty/preferences?facultyId=${c.facultyId}`}>Review Preferences →</Link>
														</Button>
													</div>
												));
										})()}
										</div>
									</ScrollArea>
								</div>
							</TabsContent>

							<TabsContent value="roster" className="h-full m-0 p-0 focus-visible:ring-0">
								<div className="h-full flex flex-col overflow-hidden">
									<div className="px-6 py-3 border-b bg-muted/20">
										<div className="relative max-w-sm">
											<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
											<Input 
												placeholder="Search sections or subjects..." 
												value={rosterSearch}
												onChange={(e) => setRosterSearch(e.target.value)}
												className="pl-8 h-8 text-xs bg-background"
											/>
										</div>
									</div>
									<ScrollArea className="flex-1">
										<div className="divide-y px-6">
										{(() => {
											const filtered = rosterGaps.filter(r => !rosterSearch ||
												r.sectionName.toLowerCase().includes(rosterSearch.toLowerCase()) ||
												r.subjectName.toLowerCase().includes(rosterSearch.toLowerCase()));
											if (filtered.length === 0) return (
												<div className="py-20 text-center text-muted-foreground italic">
													{rosterSearch ? 'No roster gaps match your search.' : 'All sections have full subject coverage.'}
												</div>
											);
											return filtered.map((r, i) => (
													<div key={i} className="py-4 flex items-center justify-between hover:bg-muted/30 transition-colors group px-2 -mx-2 rounded-lg">
														<div className="space-y-1">
															<div className="flex items-center gap-2">
																<Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 py-0 h-4 text-[10px] font-bold">G{r.gradeLevel}</Badge>
																<span className="font-bold text-sm">{r.sectionName}</span>
															</div>
															<div className="text-[11px] text-muted-foreground">
																Missing teacher for: <span className="font-semibold text-red-600">{r.subjectName} ({r.subjectCode})</span>
															</div>
														</div>
														<Button asChild variant="outline" size="sm" className="h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
															<Link to={`/teaching-load?sectionId=${r.sectionId}`}>Assign Teacher →</Link>
														</Button>
													</div>
												));
										})()}
										</div>
									</ScrollArea>
								</div>
							</TabsContent>

							<TabsContent value="facilities" className="h-full m-0 p-0 focus-visible:ring-0">
								<div className="h-full flex flex-col overflow-hidden">
									<div className="px-6 py-3 border-b bg-muted/20 flex items-center justify-between">
										<div className="flex items-center gap-2">
											<input 
												type="checkbox" 
												id="gap-only"
												checked={showOnlyFacilityGaps}
												onChange={(e) => setShowOnlyFacilityGaps(e.target.checked)}
												className="size-3.5 rounded border-input accent-emerald-600"
											/>
											<label htmlFor="gap-only" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground cursor-pointer">Show only Facility Gaps</label>
										</div>
									</div>
									<ScrollArea className="flex-1">
										<div className="divide-y px-6">
											{(() => {
												const list = subjects.filter(s => s.requiredFeatures?.length > 0).map((s) => {
													const compatibleRooms = rooms.filter(r => 
														r.type === s.preferredRoomType && 
														s.requiredFeatures.every((f: string) => (r.features || []).includes(f))
													);
													return { ...s, compatibleRooms, hasGap: compatibleRooms.length === 0 };
												});
												
												const filtered = showOnlyFacilityGaps ? list.filter(l => l.hasGap) : list;
												
												if (filtered.length === 0) {
													return (
														<div className="py-20 text-center text-muted-foreground italic">
															{showOnlyFacilityGaps 
																? 'No subjects currently have room matching gaps.' 
																: 'No subjects have required facility features defined.'}
														</div>
													);
												}

												return filtered.map((s) => (
													<div key={s.id} className="py-4 flex items-center justify-between hover:bg-muted/30 transition-colors group px-2 -mx-2 rounded-lg">
														<div className="space-y-1">
															<div className="flex items-center gap-2">
																<span className="font-bold text-sm">{s.name} ({s.code})</span>
																{s.hasGap && <Badge variant="destructive" className="text-[9px] py-0 h-4 uppercase font-bold tracking-wider">Facility Gap</Badge>}
															</div>
															<div className="flex flex-wrap gap-1.5 mt-1">
																<span className="text-[10px] text-muted-foreground uppercase font-bold">Requires:</span>
																{s.requiredFeatures.map((f: string) => (
																	<Badge key={f} variant="secondary" className="text-[9px] bg-amber-50 text-amber-700 border-amber-100 py-0 h-4 font-semibold">{f}</Badge>
																))}
															</div>
															<div className="text-[11px] text-muted-foreground mt-1">
																{s.hasGap 
																	? 'Zero rooms meet all feature requirements in current map.' 
																	: `${s.compatibleRooms.length} compatible room(s) identified.`}
															</div>
														</div>
														<Button asChild variant="outline" size="sm" className="h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
															<Link to={s.hasGap ? "/map" : "/subjects"}>{s.hasGap ? "Fix Map →" : "View Subject →"}</Link>
														</Button>
													</div>
												));
											})()}
										</div>
									</ScrollArea>
								</div>
							</TabsContent>

							<TabsContent value="optimization" className="h-full m-0 p-0 focus-visible:ring-0">
								<div className="h-full flex flex-col overflow-hidden">
									<div className="px-6 py-3 border-b bg-muted/20">
										<p className="text-[11px] text-muted-foreground italic">Suggestions for better utilization of specialized faculty</p>
									</div>
									<ScrollArea className="flex-1">
										<div className="divide-y px-6">
											{optimizationIssues.length === 0 ? (
												<div className="py-20 text-center">
													<ShieldCheck className="size-10 text-emerald-500/20 mx-auto mb-3" />
													<p className="text-sm text-muted-foreground italic">Specialized faculty are optimally utilized.</p>
												</div>
											) : (
												optimizationIssues.map((opt, i) => (
													<div key={i} className="py-4 flex items-center justify-between hover:bg-muted/30 transition-colors group px-2 -mx-2 rounded-lg">
														<div className="space-y-1">
															<div className="flex items-center gap-2">
																<span className="font-bold text-sm">{opt.specialistName}</span>
																<Badge variant="outline" className="text-[9px] bg-indigo-50 text-indigo-700 border-indigo-200 py-0 h-4 font-bold uppercase tracking-wider">{opt.specialization} Specialist</Badge>
															</div>
															<p className="text-[11px] text-muted-foreground max-w-xl italic leading-relaxed">
																{opt.reason}
															</p>
														</div>
														<Button asChild variant="outline" size="sm" className="h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
															<Link to="/teaching-load">Optimize Load →</Link>
														</Button>
													</div>
												))
											)}
										</div>
									</ScrollArea>
								</div>
							</TabsContent>

							<TabsContent value="utilization" className="h-full m-0 p-0 focus-visible:ring-0">
								<div className="h-full flex flex-col overflow-hidden">
									<div className="px-6 py-3 border-b bg-muted/20 flex items-center justify-between">
										<div className="relative flex-1 max-w-sm">
											<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
											<Input 
												placeholder="Filter by name..." 
												value={utilSearch}
												onChange={(e) => setUtilSearch(e.target.value)}
												className="pl-8 h-8 text-xs bg-background"
											/>
										</div>
										{/* Mini stats for utilization */}
										{(() => {
											const overloaded = faculty.filter(f => f.loadPercentage > 100).length;
											return (
												<div className="flex items-center gap-4">
													<div className="flex items-center gap-1.5">
														<div className="size-2 rounded-full bg-red-500" />
														<span className="text-[10px] font-bold uppercase text-red-700">{overloaded} Overloaded</span>
													</div>
												</div>
											);
										})()}
									</div>
									<ScrollArea className="flex-1">
										<div className="divide-y px-6">
											{faculty
												.filter(f => f.lastName.toLowerCase().includes(utilSearch.toLowerCase()) || f.firstName.toLowerCase().includes(utilSearch.toLowerCase()))
												.sort((a, b) => b.loadPercentage - a.loadPercentage)
												.map((f) => (
												<div key={f.id} className="py-4 flex items-center justify-between hover:bg-muted/30 transition-colors group px-2 -mx-2 rounded-lg">
													<div className="space-y-1">
														<div className="font-bold text-sm">{f.lastName}, {f.firstName}</div>
														<div className="flex items-center gap-3">
															{f.department && <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">{f.department}</div>}
															{f.specialization && <div className="text-[10px] text-primary/70 font-semibold">{f.specialization} Specialist</div>}
														</div>
													</div>
													<div className="flex items-center gap-6">
														<div className="text-right">
															<div className={`text-sm font-bold ${f.loadPercentage > 100 ? 'text-red-600' : f.loadPercentage > 90 ? 'text-amber-600' : 'text-emerald-600'}`}>{f.loadPercentage}%</div>
															<div className="text-[10px] text-muted-foreground uppercase font-medium">{f.subjectHours} / {f.maxHoursPerWeek} hrs</div>
														</div>
														<div className="w-32 h-1.5 bg-muted rounded-full overflow-hidden">
															<div 
																className={`h-full transition-all ${f.loadPercentage > 100 ? 'bg-red-500' : f.loadPercentage > 90 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
																style={{ width: `${Math.min(f.loadPercentage, 100)}%` }} 
															/>
														</div>
														<Button asChild variant="outline" size="sm" className="h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
															<Link to={`/teaching-load?facultyId=${f.id}`}>View Details →</Link>
														</Button>
													</div>
												</div>
											))}
										</div>
									</ScrollArea>
								</div>
							</TabsContent>

							<TabsContent value="sync" className="h-full m-0 p-0 focus-visible:ring-0">
								<div className="h-full flex flex-col overflow-hidden">
									<div className="px-6 py-3 border-b bg-muted/20">
										<p className="text-[11px] text-muted-foreground italic">Verification of data synchronization with EnrollPro</p>
									</div>
									<ScrollArea className="flex-1">
										<div className="divide-y px-6">
											{syncIssues.length === 0 ? (
												<div className="py-20 text-center text-muted-foreground italic">All faculty records have valid Employee IDs.</div>
											) : (
												syncIssues.map((issue) => (
													<div key={issue.id} className="py-4 flex items-center justify-between hover:bg-muted/30 transition-colors group px-2 -mx-2 rounded-lg">
														<div className="space-y-1">
															<div className="font-bold text-sm">{issue.name}</div>
															<div className="text-[11px] text-red-600 flex items-center gap-1.5 font-medium">
																<AlertTriangle className="size-3" />
																{issue.reason}
															</div>
														</div>
														<Button asChild variant="ghost" size="sm" className="h-7 text-xs">
															<Link to="/faculty">Fix in Faculty Profile →</Link>
														</Button>
													</div>
												))
											)}
										</div>
									</ScrollArea>
								</div>
							</TabsContent>
						</div>
					</Tabs>
				</main>
			</div>
		</div>
	);
}
