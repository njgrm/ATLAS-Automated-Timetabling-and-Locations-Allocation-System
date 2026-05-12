import { useState, useEffect, useMemo } from 'react';
import { ShieldCheck, AlertTriangle, UserMinus, BookX, Loader2, Search, ArrowRight, Clock, Box } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import atlasApi from '@/lib/api';
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

	useEffect(() => {
		loadData();
	}, []);

	const loadData = async () => {
		setLoading(true);
		try {
			const [facRes, subRes, aliasRes, prefRes, secRes, templateRes, roomRes] = await Promise.all([
				atlasApi.get('/faculty-assignments/summary', { params: { schoolId: DEFAULT_SCHOOL_ID, schoolYearId: 1 } }),
				atlasApi.get('/subjects', { params: { schoolId: DEFAULT_SCHOOL_ID } }),
				atlasApi.get(`/specialization-aliases?schoolId=${DEFAULT_SCHOOL_ID}`),
				atlasApi.get(`/preferences/${DEFAULT_SCHOOL_ID}/1/audit`),
				atlasApi.get('/sections/summary/1', { params: { schoolId: DEFAULT_SCHOOL_ID } }),
				atlasApi.get(`/class-templates?schoolId=${DEFAULT_SCHOOL_ID}`),
				atlasApi.get(`/map/buildings?schoolId=${DEFAULT_SCHOOL_ID}`)
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
							reason: 'Specialist is teaching general load while specialty is assigned to non-specialists.'
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

	if (loading) return <div className="p-6 flex items-center justify-center h-full"><Loader2 className="animate-spin" /></div>;

	return (
		<div className="p-6 max-w-6xl mx-auto space-y-6 h-full flex flex-col overflow-hidden">
			<div className="flex items-center justify-between shrink-0">
				<div className="flex items-center gap-3">
					<ShieldCheck className="size-6 text-emerald-600" />
					<h1 className="text-2xl font-bold tracking-tight">Qualification Audit</h1>
				</div>
				<Button variant="outline" size="sm" onClick={loadData}>Refresh Data</Button>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0">
				<Card className="bg-red-50/50 border-red-100">
					<CardHeader className="py-4">
						<CardTitle className="text-sm font-medium text-red-800 flex items-center gap-2">
							<AlertTriangle className="size-4" /> Critical Errors
						</CardTitle>
					</CardHeader>
					<CardContent className="py-2">
						<div className="text-2xl font-bold text-red-700">{mismatches.length + facilityGaps.length}</div>
						<p className="text-xs text-red-600/70">Mismatches & Facility Gaps</p>
					</CardContent>
				</Card>

				<Card className="bg-orange-50/50 border-orange-100">
					<CardHeader className="py-4">
						<CardTitle className="text-sm font-medium text-orange-800 flex items-center gap-2">
							<Clock className="size-4" /> Constraint Clashes
						</CardTitle>
					</CardHeader>
					<CardContent className="py-2">
						<div className="text-2xl font-bold text-orange-700">{clashes.length}</div>
						<p className="text-xs text-orange-600/70">Specialists with &gt;50% blocked</p>
					</CardContent>
				</Card>

				<Card className="bg-amber-50/50 border-amber-100">
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

				<Card className="bg-blue-50/50 border-blue-100">
					<CardHeader className="py-4">
						<CardTitle className="text-sm font-medium text-blue-800 flex items-center gap-2">
							<Box className="size-4" /> Optimization
						</CardTitle>
					</CardHeader>
					<CardContent className="py-2">
						<div className="text-2xl font-bold text-blue-700">{optimizationIssues.length}</div>
						<p className="text-xs text-blue-600/70">Under-utilized specialists</p>
					</CardContent>
				</Card>
			</div>

			<Tabs defaultValue="mismatches" className="flex-1 min-h-0 flex flex-col">
				<TabsList className="shrink-0 w-fit">
					<TabsTrigger value="mismatches">Mismatches</TabsTrigger>
					<TabsTrigger value="clashes">Constraint Clashes</TabsTrigger>
					<TabsTrigger value="roster">Roster Integrity</TabsTrigger>
					<TabsTrigger value="facilities">Facilities</TabsTrigger>
					<TabsTrigger value="optimization">Optimization</TabsTrigger>
					<TabsTrigger value="utilization">Utilization</TabsTrigger>
				</TabsList>
				
				<TabsContent value="mismatches" className="flex-1 min-h-0 pt-4">
					<Card className="h-full flex flex-col overflow-hidden">
						<ScrollArea className="flex-1">
							<div className="divide-y">
								{mismatches.length === 0 ? (
									<div className="p-8 text-center text-muted-foreground italic">No critical qualification mismatches found.</div>
								) : (
									mismatches.map((m, i) => (
										<div key={i} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
											<div className="space-y-1">
												<div className="flex items-center gap-2">
													<span className="font-semibold">{m.facultyName}</span>
													<ArrowRight className="size-3 text-muted-foreground" />
													<span className="font-medium text-primary">{m.subjectName} ({m.subjectCode})</span>
												</div>
												<div className="flex items-center gap-4 text-xs">
													<span className="text-muted-foreground">Required: <Badge variant="outline" className="text-red-700 border-red-200 bg-red-50">{m.required}</Badge></span>
													<span className="text-muted-foreground">Actual: <Badge variant="outline">{m.actual}</Badge></span>
												</div>
											</div>
											<Button asChild variant="ghost" size="sm">
												<Link to={`/assignments?facultyId=${m.facultyId}`}>Fix →</Link>
											</Button>
										</div>
									))
								)}
							</div>
						</ScrollArea>
					</Card>
				</TabsContent>

				<TabsContent value="clashes" className="flex-1 min-h-0 pt-4">
					<Card className="h-full flex flex-col overflow-hidden">
						<ScrollArea className="flex-1">
							<div className="divide-y">
								{clashes.length === 0 ? (
									<div className="p-8 text-center text-muted-foreground italic">No preference bottlenecks detected.</div>
								) : (
									clashes.map((c, i) => (
										<div key={i} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
											<div className="space-y-1 flex-1">
												<div className="flex items-center gap-2">
													<span className="font-semibold">{c.name}</span>
													<Badge variant="destructive" className="text-[0.65rem]">{c.unavailabilityPercent}% Unavailable</Badge>
												</div>
												<div className="text-xs text-muted-foreground">
													Blocks scheduling for: {c.qualifiedSubjects.map((s: any) => s.code).join(', ')}
												</div>
											</div>
											<Button asChild variant="ghost" size="sm">
												<Link to={`/faculty/preferences?facultyId=${c.facultyId}`}>Review Prefs →</Link>
											</Button>
										</div>
									))
								)}
							</div>
						</ScrollArea>
					</Card>
				</TabsContent>

				<TabsContent value="roster" className="flex-1 min-h-0 pt-4">
					<Card className="h-full flex flex-col overflow-hidden">
						<ScrollArea className="flex-1">
							<div className="divide-y">
								{rosterGaps.length === 0 ? (
									<div className="p-8 text-center text-muted-foreground italic">All sections have full subject coverage.</div>
								) : (
									rosterGaps.map((r, i) => (
										<div key={i} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
											<div className="space-y-1">
												<div className="flex items-center gap-2">
													<Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">G{r.gradeLevel}</Badge>
													<span className="font-semibold">{r.sectionName}</span>
												</div>
												<div className="text-xs text-muted-foreground">
													Missing teacher for: <span className="font-medium text-destructive">{r.subjectName} ({r.subjectCode})</span>
												</div>
											</div>
											<Button asChild variant="ghost" size="sm">
												<Link to={`/assignments?sectionId=${r.sectionId}`}>Assign →</Link>
											</Button>
										</div>
									))
								)}
							</div>
						</ScrollArea>
					</Card>
				</TabsContent>

				<TabsContent value="facilities" className="flex-1 min-h-0 pt-4">
					<Card className="h-full flex flex-col overflow-hidden">
						<ScrollArea className="flex-1">
							<div className="divide-y">
								{subjects.filter(s => s.requiredFeatures?.length > 0).map((s) => {
									const compatibleRooms = rooms.filter(r => 
										r.type === s.preferredRoomType && 
										s.requiredFeatures.every((f: string) => (r.features || []).includes(f))
									);
									const hasGap = compatibleRooms.length === 0;

									return (
										<div key={s.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
											<div className="space-y-1">
												<div className="flex items-center gap-2">
													<span className="font-semibold">{s.name} ({s.code})</span>
													{hasGap && <Badge variant="destructive" className="text-[0.6rem]">Facility Gap</Badge>}
												</div>
												<div className="flex flex-wrap gap-1.5 mt-1">
													<span className="text-[0.65rem] text-muted-foreground uppercase">Requires:</span>
													{s.requiredFeatures.map((f: string) => (
														<Badge key={f} variant="secondary" className="text-[0.55rem] bg-amber-50 text-amber-700 border-amber-100">{f}</Badge>
													))}
												</div>
												<div className="text-[0.65rem] text-muted-foreground">
													{hasGap 
														? 'Zero rooms meet all feature requirements.' 
														: `${compatibleRooms.length} compatible room(s) found.`}
												</div>
											</div>
											<Button asChild variant="ghost" size="sm">
												<Link to={hasGap ? "/map" : "/subjects"}>{hasGap ? "Fix Map →" : "View →"}</Link>
											</Button>
										</div>
									);
								})}
							</div>
						</ScrollArea>
					</Card>
				</TabsContent>

				<TabsContent value="optimization" className="flex-1 min-h-0 pt-4">
					<Card className="h-full flex flex-col overflow-hidden">
						<ScrollArea className="flex-1">
							<div className="divide-y">
								{optimizationIssues.length === 0 ? (
									<div className="p-8 text-center text-muted-foreground italic">Specialized faculty are optimally utilized.</div>
								) : (
									optimizationIssues.map((opt, i) => (
										<div key={i} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
											<div className="space-y-1">
												<div className="flex items-center gap-2">
													<span className="font-semibold">{opt.specialistName}</span>
													<Badge variant="outline" className="text-[0.6rem] bg-indigo-50 text-indigo-700 border-indigo-200">{opt.specialization} Specialist</Badge>
												</div>
												<p className="text-xs text-muted-foreground max-w-xl">
													{opt.reason} — <span className="font-medium text-primary">{opt.subjectName} ({opt.subjectCode})</span> is taught by others.
												</p>
											</div>
											<Button asChild variant="ghost" size="sm">
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
					<Card className="h-full flex flex-col overflow-hidden">
						<div className="p-4 border-b bg-muted/20">
							<div className="relative">
								<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
								<Input 
									placeholder="Search faculty..." 
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									className="pl-8 h-8 max-w-xs"
								/>
							</div>
						</div>
						<ScrollArea className="flex-1">
							<div className="divide-y">
								{faculty.filter(f => f.lastName.toLowerCase().includes(searchQuery.toLowerCase()) || f.firstName.toLowerCase().includes(searchQuery.toLowerCase())).map((f) => (
									<div key={f.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
										<div className="space-y-1">
											<div className="font-semibold">{f.lastName}, {f.firstName}</div>
											<div className="text-xs text-muted-foreground">{f.specialization || f.department || 'General'} Specialist</div>
										</div>
										<div className="flex items-center gap-4">
											<div className="text-right">
												<div className="text-sm font-bold">{f.loadPercentage}%</div>
												<div className="text-[0.65rem] text-muted-foreground uppercase">{f.subjectHours} / {f.maxHoursPerWeek} hrs</div>
											</div>
											<div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
												<div 
													className={`h-full transition-all ${f.loadPercentage > 100 ? 'bg-red-500' : f.loadPercentage > 90 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
													style={{ width: `${Math.min(f.loadPercentage, 100)}%` }} 
												/>
											</div>
											<Button asChild variant="ghost" size="sm">
												<Link to={`/assignments?facultyId=${f.id}`}>View Load →</Link>
											</Button>
										</div>
									</div>
								))}
							</div>
						</ScrollArea>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}
