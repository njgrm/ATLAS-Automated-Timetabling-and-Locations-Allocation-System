import { useState, useEffect, useMemo } from 'react';
import { ShieldCheck, AlertTriangle, UserMinus, BookX, Loader2, Search, ArrowRight, Clock, Box, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import atlasApi from '@/lib/api';
import { fetchPublicSettings } from '@/lib/settings';
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
	const [mismatchSearch, setMismatchSearch] = useState('');
	const [clashSearch, setClashSearch] = useState('');
	const [rosterSearch, setRosterSearch] = useState('');
	const [showOnlyFacilityGaps, setShowOnlyFacilityGaps] = useState(false);
	const [utilSearch, setUtilSearch] = useState('');

	useEffect(() => {
		fetchPublicSettings().then(s => {
			if (s.activeSchoolYearId) {
				setActiveSchoolYearId(s.activeSchoolYearId);
			} else {
				setLoading(false);
				toast.error('No active school year found');
			}
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
			const [facRes, subRes, aliasRes, prefRes, secRes, templateRes, roomRes] = await Promise.all([
				atlasApi.get('/faculty-assignments/summary', { params: { schoolId: DEFAULT_SCHOOL_ID, schoolYearId: activeSchoolYearId } }),
				atlasApi.get('/subjects', { params: { schoolId: DEFAULT_SCHOOL_ID } }),
				atlasApi.get(`/specialization-aliases?schoolId=${DEFAULT_SCHOOL_ID}`),
				atlasApi.get(`/preferences/${DEFAULT_SCHOOL_ID}/${activeSchoolYearId}/audit`),
				atlasApi.get(`/sections/summary/${activeSchoolYearId}`, { params: { schoolId: DEFAULT_SCHOOL_ID } }),
				atlasApi.get(`/class-templates?schoolId=${DEFAULT_SCHOOL_ID}`),
				atlasApi.get(`/map/schools/${DEFAULT_SCHOOL_ID}/buildings`)
			]);
			setFaculty(facRes.data.faculty);
			setSubjects(subRes.data.subjects);
			setAliases(aliasRes.data.aliases);
			setPrefAudit(prefRes.data.audit);
			setSections(secRes.data.sections);
			setTemplates(templateRes.data.templates);
			
			// Flatten rooms from buildings
			const allRooms = (roomRes.data.buildings || []).flatMap((b: any) => b.rooms || []);
			setRooms(allRooms);
		} catch {
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
		<div className="p-6 max-w-6xl mx-auto space-y-6 h-full flex flex-col overflow-hidden">
			<div className="flex items-center justify-between shrink-0">
				<div className="flex items-center gap-3">
					<ShieldCheck className="size-6 text-emerald-600" />
					<h1 className="text-2xl font-bold tracking-tight">Scheduling Readiness Audit</h1>
				</div>
				<Button variant="outline" size="sm" onClick={loadData}>Refresh Data</Button>
			</div>

			{/* Readiness Verdict Banner */}
			<Card className={`shrink-0 border-l-4 ${isReady ? 'border-l-emerald-500 bg-emerald-50/30' : 'border-l-red-500 bg-red-50/30'}`}>
				<CardContent className="py-4 flex items-center justify-between">
					<div className="flex items-center gap-4">
						<div className={`size-10 rounded-full flex items-center justify-center ${isReady ? 'bg-emerald-100' : 'bg-red-100'}`}>
							{isReady ? <CheckCircle2 className="size-6 text-emerald-600" /> : <XCircle className="size-6 text-red-600" />}
						</div>
						<div>
							<h3 className={`font-bold ${isReady ? 'text-emerald-900' : 'text-red-900'}`}>
								{isReady ? 'Ready for Generation' : 'Action Required Before Generation'}
							</h3>
							<p className={`text-sm ${isReady ? 'text-emerald-800/70' : 'text-red-800/70'}`}>
								{isReady 
									? 'All critical checks passed. You can proceed to generate the schedule.' 
									: `Found ${criticalCount} critical issue${criticalCount === 1 ? '' : 's'} that will block schedule generation.`}
							</p>
						</div>
					</div>
					{isReady && (
						<Button asChild className="bg-emerald-600 hover:bg-emerald-700">
							<Link to="/timetable/generate">Proceed to Generator</Link>
						</Button>
					)}
				</CardContent>
			</Card>

			<div className="grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0">
				<Card className="bg-red-50/50 border-red-100 shadow-sm">
					<CardHeader className="py-4">
						<CardTitle className="text-sm font-medium text-red-800 flex items-center gap-2">
							<AlertTriangle className="size-4" /> Critical Errors
						</CardTitle>
					</CardHeader>
					<CardContent className="py-2">
						<div className="text-2xl font-bold text-red-700">{criticalCount}</div>
						<p className="text-xs text-red-600/70">{mismatches.length} Mismatches, {facilityGaps.length} Gaps</p>
					</CardContent>
				</Card>

				<Card className="bg-orange-50/50 border-orange-100 shadow-sm">
					<CardHeader className="py-4">
						<CardTitle className="text-sm font-medium text-orange-800 flex items-center gap-2">
							<Clock className="size-4" /> Constraint Clashes
						</CardTitle>
					</CardHeader>
					<CardContent className="py-2">
						<div className="text-2xl font-bold text-orange-700">{clashes.length}</div>
						<p className="text-xs text-orange-600/70">Specialists with {'>'}50% blocked</p>
					</CardContent>
				</Card>

				<Card className="bg-amber-50/50 border-amber-100 shadow-sm">
					<CardHeader className="py-4">
						<CardTitle className="text-sm font-medium text-amber-800 flex items-center gap-2">
							<BookX className="size-4" /> Roster Gaps
						</CardTitle>
					</CardHeader>
					<CardContent className="py-2">
						<div className="text-2xl font-bold text-amber-700">{rosterGaps.length}</div>
						<p className="text-xs text-amber-600/70">Sections missing core subjects</p>
					</CardContent>
				</Card>

				<Card className="bg-blue-50/50 border-blue-100 shadow-sm">
					<CardHeader className="py-4">
						<CardTitle className="text-sm font-medium text-blue-800 flex items-center gap-2">
							<RefreshCw className="size-4" /> Sync Health
						</CardTitle>
					</CardHeader>
					<CardContent className="py-2">
						<div className="text-2xl font-bold text-blue-700">{syncIssues.length}</div>
						<p className="text-xs text-blue-600/70">Missing or invalid Employee IDs</p>
					</CardContent>
				</Card>
			</div>

			<Tabs defaultValue="mismatches" className="flex-1 min-h-0 flex flex-col">
				<TabsList className="shrink-0 w-fit">
					<TabsTrigger value="mismatches" className="gap-2">
						Mismatches {mismatches.length > 0 && <Badge variant="secondary" className="px-1 py-0 h-4 text-[10px] bg-red-100 text-red-700 border-red-200">{mismatches.length}</Badge>}
					</TabsTrigger>
					<TabsTrigger value="clashes" className="gap-2">
						Clashes {clashes.length > 0 && <Badge variant="secondary" className="px-1 py-0 h-4 text-[10px] bg-orange-100 text-orange-700 border-orange-200">{clashes.length}</Badge>}
					</TabsTrigger>
					<TabsTrigger value="roster" className="gap-2">
						Roster {rosterGaps.length > 0 && <Badge variant="secondary" className="px-1 py-0 h-4 text-[10px] bg-amber-100 text-amber-700 border-amber-200">{rosterGaps.length}</Badge>}
					</TabsTrigger>
					<TabsTrigger value="facilities" className="gap-2">
						Facilities {facilityGaps.length > 0 && <Badge variant="secondary" className="px-1 py-0 h-4 text-[10px] bg-red-100 text-red-700 border-red-200">{facilityGaps.length}</Badge>}
					</TabsTrigger>
					<TabsTrigger value="optimization" className="gap-2">
						Optimization {optimizationIssues.length > 0 && <Badge variant="secondary" className="px-1 py-0 h-4 text-[10px]">{optimizationIssues.length}</Badge>}
					</TabsTrigger>
					<TabsTrigger value="utilization">Utilization</TabsTrigger>
					<TabsTrigger value="sync" className="gap-2">
						Sync {syncIssues.length > 0 && <Badge variant="secondary" className="px-1 py-0 h-4 text-[10px] bg-blue-100 text-blue-700 border-blue-200">{syncIssues.length}</Badge>}
					</TabsTrigger>
				</TabsList>
				
				<TabsContent value="mismatches" className="flex-1 min-h-0 pt-4">
					<Card className="h-full flex flex-col overflow-hidden shadow-sm">
						<div className="p-4 border-b bg-muted/20">
							<div className="relative">
								<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
								<Input 
									placeholder="Search mismatches..." 
									value={mismatchSearch}
									onChange={(e) => setMismatchSearch(e.target.value)}
									className="pl-8 h-8 max-w-xs"
								/>
							</div>
						</div>
						<ScrollArea className="flex-1">
							<div className="divide-y">
							{(() => {
								const filtered = mismatches.filter(m => !mismatchSearch ||
									m.facultyName.toLowerCase().includes(mismatchSearch.toLowerCase()) ||
									m.subjectName.toLowerCase().includes(mismatchSearch.toLowerCase()));
								if (filtered.length === 0) return (
									<div className="p-8 text-center text-muted-foreground italic">
										{mismatchSearch ? 'No mismatches match your search.' : 'No critical qualification mismatches found.'}
									</div>
								);
								return filtered.map((m, i) => (
										<div key={i} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors group">
											<div className="space-y-1">
												<div className="flex items-center gap-2">
													<span className="font-semibold">{m.facultyName}</span>
													<ArrowRight className="size-3 text-muted-foreground" />
													<span className="font-medium text-primary">{m.subjectName} ({m.subjectCode})</span>
												</div>
												<div className="flex items-center gap-4 text-xs">
													<span className="text-muted-foreground">Required: <Badge variant="outline" className="text-red-700 border-red-200 bg-red-50 py-0 h-4">{m.required}</Badge></span>
													<span className="text-muted-foreground">Actual: <Badge variant="outline" className="py-0 h-4">{m.actual}</Badge></span>
												</div>
											</div>
											<Button asChild variant="outline" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
												<Link to={`/assignments?facultyId=${m.facultyId}`}>Fix →</Link>
											</Button>
										</div>
									));
							})()}
							</div>
						</ScrollArea>
					</Card>
				</TabsContent>

				<TabsContent value="clashes" className="flex-1 min-h-0 pt-4">
					<Card className="h-full flex flex-col overflow-hidden shadow-sm">
						<div className="p-4 border-b bg-muted/20">
							<div className="relative">
								<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
								<Input 
									placeholder="Search clashes..." 
									value={clashSearch}
									onChange={(e) => setClashSearch(e.target.value)}
									className="pl-8 h-8 max-w-xs"
								/>
							</div>
						</div>
						<ScrollArea className="flex-1">
							<div className="divide-y">
							{(() => {
								const filtered = clashes.filter(c => !clashSearch ||
									c.name.toLowerCase().includes(clashSearch.toLowerCase()));
								if (filtered.length === 0) return (
									<div className="p-8 text-center text-muted-foreground italic">
										{clashSearch ? 'No bottlenecks match your search.' : 'No preference bottlenecks detected.'}
									</div>
								);
								return filtered.map((c, i) => (
										<div key={i} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors group">
											<div className="space-y-1 flex-1">
												<div className="flex items-center gap-2">
													<span className="font-semibold">{c.name}</span>
													<Badge variant="destructive" className="text-[0.65rem] py-0 h-4">{c.unavailabilityPercent}% Unavailable</Badge>
												</div>
												<div className="text-xs text-muted-foreground">
													Blocks scheduling for: {c.qualifiedSubjects.map((s: any) => s.code).join(', ')}
												</div>
											</div>
											<Button asChild variant="outline" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
												<Link to={`/faculty/preferences?facultyId=${c.facultyId}`}>Review Prefs →</Link>
											</Button>
										</div>
									));
							})()}
							</div>
						</ScrollArea>
					</Card>
				</TabsContent>

				<TabsContent value="roster" className="flex-1 min-h-0 pt-4">
					<Card className="h-full flex flex-col overflow-hidden shadow-sm">
						<div className="p-4 border-b bg-muted/20">
							<div className="relative">
								<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
								<Input 
									placeholder="Search roster gaps..." 
									value={rosterSearch}
									onChange={(e) => setRosterSearch(e.target.value)}
									className="pl-8 h-8 max-w-xs"
								/>
							</div>
						</div>
						<ScrollArea className="flex-1">
							<div className="divide-y">
							{(() => {
								const filtered = rosterGaps.filter(r => !rosterSearch ||
									r.sectionName.toLowerCase().includes(rosterSearch.toLowerCase()) ||
									r.subjectName.toLowerCase().includes(rosterSearch.toLowerCase()));
								if (filtered.length === 0) return (
									<div className="p-8 text-center text-muted-foreground italic">
										{rosterSearch ? 'No roster gaps match your search.' : 'All sections have full subject coverage.'}
									</div>
								);
								return filtered.map((r, i) => (
										<div key={i} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors group">
											<div className="space-y-1">
												<div className="flex items-center gap-2">
													<Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 py-0 h-4">G{r.gradeLevel}</Badge>
													<span className="font-semibold">{r.sectionName}</span>
												</div>
												<div className="text-xs text-muted-foreground">
													Missing teacher for: <span className="font-medium text-destructive">{r.subjectName} ({r.subjectCode})</span>
												</div>
											</div>
											<Button asChild variant="outline" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
												<Link to={`/assignments?sectionId=${r.sectionId}`}>Assign →</Link>
											</Button>
										</div>
									));
							})()}
							</div>
						</ScrollArea>
					</Card>
				</TabsContent>

				<TabsContent value="facilities" className="flex-1 min-h-0 pt-4">
					<Card className="h-full flex flex-col overflow-hidden shadow-sm">
						<div className="p-4 border-b bg-muted/20 flex items-center justify-between">
							<div className="flex items-center gap-2">
								<input 
									type="checkbox" 
									id="gap-only"
									checked={showOnlyFacilityGaps}
									onChange={(e) => setShowOnlyFacilityGaps(e.target.checked)}
									className="size-3.5 rounded border-input accent-primary"
								/>
								<label htmlFor="gap-only" className="text-xs font-medium cursor-pointer">Show only Facility Gaps</label>
							</div>
						</div>
						<ScrollArea className="flex-1">
							<div className="divide-y">
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
											<div className="p-8 text-center text-muted-foreground italic">
												{showOnlyFacilityGaps 
													? 'No subjects currently have room matching gaps.' 
													: 'No subjects have required facility features defined.'}
											</div>
										);
									}

									return filtered.map((s) => (
										<div key={s.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors group">
											<div className="space-y-1">
												<div className="flex items-center gap-2">
													<span className="font-semibold">{s.name} ({s.code})</span>
													{s.hasGap && <Badge variant="destructive" className="text-[0.6rem] py-0 h-4">Facility Gap</Badge>}
												</div>
												<div className="flex flex-wrap gap-1.5 mt-1">
													<span className="text-[0.65rem] text-muted-foreground uppercase">Requires:</span>
													{s.requiredFeatures.map((f: string) => (
														<Badge key={f} variant="secondary" className="text-[0.55rem] bg-amber-50 text-amber-700 border-amber-100 py-0 h-4">{f}</Badge>
													))}
												</div>
												<div className="text-[0.65rem] text-muted-foreground">
													{s.hasGap 
														? 'Zero rooms meet all feature requirements.' 
														: `${s.compatibleRooms.length} compatible room(s) found.`}
												</div>
											</div>
											<Button asChild variant="outline" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
												<Link to={s.hasGap ? "/map" : "/subjects"}>{s.hasGap ? "Fix Map →" : "View →"}</Link>
											</Button>
										</div>
									));
								})()}
							</div>
						</ScrollArea>
					</Card>
				</TabsContent>

				<TabsContent value="optimization" className="flex-1 min-h-0 pt-4">
					<Card className="h-full flex flex-col overflow-hidden shadow-sm">
						<ScrollArea className="flex-1">
							<div className="divide-y">
								{optimizationIssues.length === 0 ? (
									<div className="p-8 text-center text-muted-foreground italic">Specialized faculty are optimally utilized.</div>
								) : (
									optimizationIssues.map((opt, i) => (
										<div key={i} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors group">
											<div className="space-y-1">
												<div className="flex items-center gap-2">
													<span className="font-semibold">{opt.specialistName}</span>
													<Badge variant="outline" className="text-[0.6rem] bg-indigo-50 text-indigo-700 border-indigo-200 py-0 h-4">{opt.specialization} Specialist</Badge>
												</div>
												<p className="text-xs text-muted-foreground max-w-xl italic">
													{opt.reason}
												</p>
											</div>
											<Button asChild variant="outline" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
												<Link to="/assignments">Optimize →</Link>
											</Button>
										</div>
									))
								)}
							</div>
						</ScrollArea>
					</Card>
				</TabsContent>

				<TabsContent value="utilization" className="flex-1 min-h-0 pt-4">
					<div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
						<div className="md:col-span-1 space-y-6">
							<Card className="shadow-sm">
								<CardHeader className="pb-2">
									<CardTitle className="text-sm font-medium">Load Distribution</CardTitle>
								</CardHeader>
								<CardContent className="space-y-4">
									{(() => {
										const overloaded = faculty.filter(f => f.loadPercentage > 100).length;
										const heavy = faculty.filter(f => f.loadPercentage > 90 && f.loadPercentage <= 100).length;
										const underloaded = faculty.filter(f => f.loadPercentage < 50).length;
										
										return (
											<div className="space-y-3">
												<div className="flex items-center justify-between">
													<div className="flex items-center gap-2">
														<div className="size-2 rounded-full bg-red-500" />
														<span className="text-xs">Overloaded ({'>'}100%)</span>
													</div>
													<span className="text-xs font-bold">{overloaded}</span>
												</div>
												<div className="flex items-center justify-between">
													<div className="flex items-center gap-2">
														<div className="size-2 rounded-full bg-amber-500" />
														<span className="text-xs">Heavy Load (90-100%)</span>
													</div>
													<span className="text-xs font-bold">{heavy}</span>
												</div>
												<div className="flex items-center justify-between">
													<div className="flex items-center gap-2">
														<div className="size-2 rounded-full bg-emerald-500" />
														<span className="text-xs">Normal / Underloaded</span>
													</div>
													<span className="text-xs font-bold">{faculty.length - overloaded - heavy}</span>
												</div>
												<div className="pt-2 border-t flex items-center justify-between text-muted-foreground">
													<span className="text-[0.65rem] uppercase font-bold tracking-wider">Underloaded ({'<'}50%)</span>
													<span className="text-xs font-bold">{underloaded}</span>
												</div>
											</div>
										);
									})()}
								</CardContent>
							</Card>

							<Card className="bg-primary/5 border-primary/10 shadow-sm">
								<CardHeader className="pb-2">
									<CardTitle className="text-sm font-medium text-primary">Summary Verdict</CardTitle>
								</CardHeader>
								<CardContent>
									{(() => {
										const avgLoad = faculty.reduce((sum, f) => sum + f.loadPercentage, 0) / (faculty.length || 1);
										return (
											<div className="space-y-2">
												<div className="text-2xl font-bold">{avgLoad.toFixed(1)}%</div>
												<p className="text-[0.65rem] text-muted-foreground uppercase font-bold tracking-wider">Average Roster Load</p>
												<p className="text-xs text-primary/80 mt-2">
													{avgLoad > 95 ? 'Capacity is tight. Generation may struggle with constraints.' : 
													 avgLoad < 70 ? 'Significant excess capacity detected.' : 
													 'Roster capacity is in the optimal range (70-90%).'}
												</p>
											</div>
										);
									})()}
								</CardContent>
							</Card>
						</div>

						<Card className="md:col-span-2 h-full flex flex-col overflow-hidden shadow-sm">
							<div className="p-4 border-b bg-muted/20">
								<div className="relative">
									<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
									<Input 
										placeholder="Filter by name..." 
										value={utilSearch}
										onChange={(e) => setUtilSearch(e.target.value)}
										className="pl-8 h-8 max-w-xs"
									/>
								</div>
							</div>
							<ScrollArea className="flex-1">
								<div className="divide-y">
									{faculty
										.filter(f => f.lastName.toLowerCase().includes(utilSearch.toLowerCase()) || f.firstName.toLowerCase().includes(utilSearch.toLowerCase()))
										.sort((a, b) => b.loadPercentage - a.loadPercentage)
										.map((f) => (
										<div key={f.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors group">
											<div className="space-y-1">
												<div className="font-semibold">{f.lastName}, {f.firstName}</div>
												<div className="flex flex-col">
													{f.department && <div className="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground/70">{f.department}</div>}
													{f.specialization && <div className="text-xs text-muted-foreground">{f.specialization} Specialist</div>}
													{!f.specialization && !f.department && <div className="text-xs text-muted-foreground">General Specialist</div>}
												</div>
											</div>
											<div className="flex items-center gap-4">
												<div className="text-right">
													<div className={`text-sm font-bold ${f.loadPercentage > 100 ? 'text-red-600' : f.loadPercentage > 90 ? 'text-amber-600' : 'text-emerald-600'}`}>{f.loadPercentage}%</div>
													<div className="text-[0.65rem] text-muted-foreground uppercase">{f.subjectHours} / {f.maxHoursPerWeek} hrs</div>
												</div>
												<div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
													<div 
														className={`h-full transition-all ${f.loadPercentage > 100 ? 'bg-red-500' : f.loadPercentage > 90 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
														style={{ width: `${Math.min(f.loadPercentage, 100)}%` }} 
													/>
												</div>
												<Button asChild variant="outline" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
													<Link to={`/assignments?facultyId=${f.id}`}>View →</Link>
												</Button>
											</div>
										</div>
									))}
								</div>
							</ScrollArea>
						</Card>
					</div>
				</TabsContent>

				<TabsContent value="sync" className="flex-1 min-h-0 pt-4">
					<Card className="h-full flex flex-col overflow-hidden">
						<ScrollArea className="flex-1">
							<div className="divide-y">
								{syncIssues.length === 0 ? (
									<div className="p-8 text-center text-muted-foreground italic">All faculty records have valid Employee IDs.</div>
								) : (
									syncIssues.map((issue) => (
										<div key={issue.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
											<div className="space-y-1">
												<div className="font-semibold">{issue.name}</div>
												<div className="text-xs text-red-600 flex items-center gap-1.5">
													<AlertTriangle className="size-3" />
													{issue.reason}
												</div>
											</div>
											<Button asChild variant="ghost" size="sm">
												<Link to="/faculty">Fix in Faculty →</Link>
											</Button>
										</div>
									))
								)}
							</div>
						</ScrollArea>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}
