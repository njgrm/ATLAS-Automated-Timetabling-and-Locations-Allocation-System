import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Layer, Rect, Stage, Text } from 'react-konva';
import { Link } from 'react-router-dom';
import {
	AlertTriangle,
	BookOpen,
	Check,
	CheckCircle2,
	Circle,
	ClipboardList,
	GraduationCap,
	MapPinned,
	Minus,
	Pencil,
	Plus,
	RotateCcw,
	Users,
} from 'lucide-react';

import atlasApi from '@/lib/api';
import type { Building } from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card';
import { ScrollArea } from '@/ui/scroll-area';
import { Skeleton } from '@/ui/skeleton';

const DEFAULT_SCHOOL_ID = 1;
const CANVAS_WIDTH = 920;
const CANVAS_HEIGHT = 580;

/* ─── Lifecycle phases ─── */
const LIFECYCLE_PHASES = [
	{ key: 'SETUP', label: 'Setup', description: 'Configure subjects, faculty, rooms' },
	{ key: 'PREFERENCE_COLLECTION', label: 'Preferences', description: 'Collect faculty preferences' },
	{ key: 'GENERATION', label: 'Generation', description: 'Run schedule algorithm' },
	{ key: 'REVIEW', label: 'Review', description: 'Admin review & manual edits' },
	{ key: 'PUBLISHED', label: 'Published', description: 'Live — visible to all' },
	{ key: 'ARCHIVED', label: 'Archived', description: 'Past term archive' },
] as const;

type SetupCheck = { label: string; done: boolean; link?: string };

type StatCard = {
	title: string;
	value: string;
	icon: typeof BookOpen;
	color: string;
	bg: string;
	link?: string;
	warning?: string;
};

const LS_KEY_SELECTED_BUILDING = 'atlas_dashboard_selected_building';

export default function Dashboard() {
	const [buildings, setBuildings] = useState<Building[]>([]);
	const [campusImageUrl, setCampusImageUrl] = useState<string | null>(null);
	const [campusImage, setCampusImage] = useState<HTMLImageElement | null>(null);
	const [loading, setLoading] = useState(true);
	const [selectedId, setSelectedId] = useState<number | null>(() => {
		const stored = localStorage.getItem(LS_KEY_SELECTED_BUILDING);
		return stored ? Number(stored) : null;
	});
	const [scale, setScale] = useState(1);
	const [position, setPosition] = useState({ x: 0, y: 0 });
	const [subjectCount, setSubjectCount] = useState<number | null>(null);
	const [facultyCount, setFacultyCount] = useState<number | null>(null);
	const [unassignedSubjectCount, setUnassignedSubjectCount] = useState<number | null>(null);
	const mapContainerRef = useRef<HTMLDivElement>(null);
	const [canvasWidth, setCanvasWidth] = useState(CANVAS_WIDTH);

	// Persist selection to localStorage
	const selectBuilding = useCallback((id: number | null) => {
		setSelectedId(id);
		if (id !== null) {
			localStorage.setItem(LS_KEY_SELECTED_BUILDING, String(id));
		}
	}, []);

	useEffect(() => {
		setLoading(true);
		Promise.all([
			atlasApi.get<{ buildings: Building[] }>(`/map/schools/${DEFAULT_SCHOOL_ID}/buildings`),
			atlasApi.get<{ campusImageUrl: string | null }>(`/map/schools/${DEFAULT_SCHOOL_ID}/campus-image`),
			atlasApi.get<{ count: number; unassignedCount?: number }>(`/subjects/stats/${DEFAULT_SCHOOL_ID}`).catch(() => ({ data: { count: 0, unassignedCount: undefined } })),
			atlasApi.get<{ subjects: any[] }>(`/subjects?schoolId=${DEFAULT_SCHOOL_ID}`).catch(() => ({ data: { subjects: [] } })),
		])
			.then(([bRes, iRes, statsRes, subsRes]) => {
				const blds = bRes.data.buildings;
				setBuildings(blds);
				setCampusImageUrl(iRes.data.campusImageUrl);
				setSubjectCount(statsRes.data.count);
				setUnassignedSubjectCount(statsRes.data.unassignedCount ?? null);
				// Default-select first building if no persisted selection or stale id
				const storedId = Number(localStorage.getItem(LS_KEY_SELECTED_BUILDING));
				if (blds.length > 0) {
					const valid = blds.some((b) => b.id === storedId);
					if (!valid) selectBuilding(blds[0].id);
					else setSelectedId(storedId);
				}
				// Faculty count — try to fetch from faculty route
				atlasApi.get<{ faculty: any[] }>(`/faculty?schoolId=${DEFAULT_SCHOOL_ID}`)
					.then((fRes) => setFacultyCount(fRes.data.faculty.length))
					.catch(() => setFacultyCount(null));
			})
			.catch(() => {
				setBuildings([]);
				setCampusImageUrl(null);
			})
			.finally(() => setLoading(false));
	}, []);

	// Load campus background image
	useEffect(() => {
		if (!campusImageUrl) { setCampusImage(null); return; }
		const img = new window.Image();
		img.crossOrigin = 'anonymous';
		img.src = campusImageUrl;
		img.onload = () => setCampusImage(img);
		img.onerror = () => setCampusImage(null);
	}, [campusImageUrl]);

	// Responsive canvas sizing
	useEffect(() => {
		const el = mapContainerRef.current;
		if (!el) return;
		const observer = new ResizeObserver((entries) => {
			const width = entries[0]?.contentRect.width;
			if (width) setCanvasWidth(Math.floor(width));
		});
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	const canvasHeight = Math.round(canvasWidth * (CANVAS_HEIGHT / CANVAS_WIDTH));

	const totalRooms = useMemo(() => buildings.reduce((sum, b) => sum + b.rooms.length, 0), [buildings]);
	const teachingRooms = useMemo(
		() => buildings.reduce(
			(sum, b) => sum + (b.isTeachingBuilding !== false ? b.rooms.filter((r) => r.isTeachingSpace).length : 0),
			0,
		),
		[buildings],
	);
	const nonTeachingExcluded = totalRooms - teachingRooms;
	const selected = useMemo(() => buildings.find((b) => b.id === selectedId) ?? null, [buildings, selectedId]);

	const statCards: StatCard[] = useMemo(
		() => [
			{ title: 'Subjects Configured', value: subjectCount !== null ? String(subjectCount) : '—', icon: BookOpen, color: 'text-blue-600', bg: 'bg-blue-50', link: '/subjects', warning: unassignedSubjectCount ? `${unassignedSubjectCount} need faculty` : undefined },
			{ title: 'Active Faculty', value: facultyCount !== null ? String(facultyCount) : '—', icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50', link: '/faculty' },
			{ title: 'Sections', value: '—', icon: GraduationCap, color: 'text-pink-600', bg: 'bg-pink-50', link: '/sections' },
			{ title: 'Buildings', value: String(buildings.length), icon: MapPinned, color: 'text-amber-600', bg: 'bg-amber-50', link: '/map' },
			{ title: 'Teaching Rooms', value: String(teachingRooms), icon: ClipboardList, color: 'text-violet-600', bg: 'bg-violet-50', link: '/map', warning: nonTeachingExcluded > 0 ? `${totalRooms} total (${nonTeachingExcluded} non-teaching)` : undefined },
		],
		[buildings, teachingRooms, totalRooms, nonTeachingExcluded, subjectCount, facultyCount, unassignedSubjectCount],
	);

	/* Setup checklist — determines if we can advance from SETUP phase */
	const currentPhase = 'SETUP'; // v1: always in setup until generation is implemented
	const setupChecklist: SetupCheck[] = useMemo(
		() => [
			{ label: 'Subjects configured', done: (subjectCount ?? 0) > 0, link: '/subjects' },
			{ label: 'Faculty synced', done: (facultyCount ?? 0) > 0, link: '/faculty' },
			{ label: 'Faculty assigned to subjects', done: unassignedSubjectCount === 0 && (subjectCount ?? 0) > 0, link: '/faculty/assignments' },
			{
				label: 'Buildings & rooms set up',
				done: buildings.length > 0 && buildings.every(
					(b) => b.isTeachingBuilding === false || (!/^Building \d+$/.test(b.name) && b.rooms.length > 0),
				),
				link: '/map',
			},
		],
		[subjectCount, facultyCount, unassignedSubjectCount, buildings, totalRooms],
	);

	const setupProgress = setupChecklist.filter((c) => c.done).length;

	return (
		<div className="px-6 py-4">
			{/* ─── Top section: KPIs (left) + Lifecycle (right) ─── */}
			<div className="flex gap-4 items-stretch">
				{/* KPI stat cards — compact 2×2 grid */}
				<div className="w-[340px] shrink-0 flex flex-col gap-3">
					<div className="flex items-center gap-3">
						<h2 className="text-[0.625rem] font-bold uppercase tracking-wider text-muted-foreground">
							Overview
						</h2>
						<div className="h-px flex-1 bg-sidebar-accent" />
					</div>
					<div className="grid grid-cols-2 gap-3 flex-1">
						{statCards.map((stat) => (
							<Card key={stat.title} className="shadow-sm flex flex-col">
								<CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pt-4 pb-1">
									<CardTitle className="text-[0.625rem] font-bold uppercase text-muted-foreground leading-tight">
										{stat.title}
									</CardTitle>
									<div className={`${stat.bg} rounded-md p-1.5`}>
										<stat.icon className={`h-3.5 w-3.5 ${stat.color}`} />
									</div>
								</CardHeader>
								<CardContent className="px-4 pb-3 pt-0 flex-1 flex items-end">
									{loading ? (
										<Skeleton className="h-7 w-14" />
									) : (
										<div>
											<div className="text-xl font-black">
												{stat.link ? (
													<Link to={stat.link} className="hover:underline">{stat.value}</Link>
												) : (
													stat.value
												)}
											</div>
											{stat.warning && (
												<div className="mt-0.5 flex items-center gap-1 text-[0.6rem] text-amber-600">
													<AlertTriangle className="size-2.5" />
													{stat.warning}
												</div>
											)}
										</div>
									)}
								</CardContent>
							</Card>
						))}
					</div>
				</div>

				{/* Lifecycle + setup checklist */}
				<div className="flex-1 min-w-0 flex flex-col gap-3">
					<div className="flex items-center gap-3">
						<h2 className="text-[0.625rem] font-bold uppercase tracking-wider text-muted-foreground">
							Scheduling Lifecycle
						</h2>
						<div className="h-px flex-1 bg-sidebar-accent" />
					</div>
					<Card className="shadow-sm flex-1">
						<CardContent className="pt-5 h-full flex flex-col">
					{/* Phase stepper */}
					<div className="flex items-center gap-1">
						{LIFECYCLE_PHASES.map((phase, idx) => {
							const isCurrent = phase.key === currentPhase;
							const isPast = LIFECYCLE_PHASES.findIndex((p) => p.key === currentPhase) > idx;
							return (
								<Fragment key={phase.key}>
									{idx > 0 && (
										<div
											className={`h-0.5 flex-1 rounded ${
												isPast ? 'bg-primary' : 'bg-border'
											}`}
										/>
									)}
									<div className="flex flex-col items-center">
										<div
											className={`flex size-7 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors ${
												isCurrent
													? 'border-primary bg-primary text-primary-foreground'
													: isPast
														? 'border-primary bg-primary/10 text-primary'
														: 'border-border bg-background text-muted-foreground'
											}`}
										>
											{isPast ? (
												<Check className="size-3.5" />
											) : (
												<Circle className="size-3" fill={isCurrent ? 'currentColor' : 'none'} />
											)}
										</div>
										<span
											className={`mt-1 text-[0.5625rem] font-medium ${
												isCurrent ? 'text-primary' : 'text-muted-foreground'
											}`}
										>
											{phase.label}
										</span>
									</div>
								</Fragment>
							);
						})}
					</div>

					{/* Setup checklist (shown when in SETUP phase) */}
					{currentPhase === 'SETUP' && (
						<div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
							<div className="flex items-center justify-between mb-2">
								<p className="text-sm font-semibold text-foreground">Setup Checklist</p>
								<Badge
									variant="secondary"
									className={`text-xs ${
										setupProgress === setupChecklist.length
											? 'bg-emerald-100 text-emerald-700'
											: 'bg-amber-100 text-amber-700'
									}`}
								>
									{setupProgress}/{setupChecklist.length} complete
								</Badge>
							</div>
							<ul className="space-y-1.5">
								{setupChecklist.map((item) => (
									<li key={item.label} className="flex items-center gap-2 text-sm">
										{item.done ? (
											<CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
										) : (
											<Circle className="size-4 text-muted-foreground/40 shrink-0" />
										)}
										{item.link ? (
											<Link
												to={item.link}
												className={`hover:underline ${item.done ? 'text-muted-foreground line-through' : 'text-foreground'}`}
											>
												{item.label}
											</Link>
										) : (
											<span className={item.done ? 'text-muted-foreground line-through' : 'text-foreground'}>
												{item.label}
											</span>
										)}
									</li>
								))}
							</ul>
						</div>
					)}
				</CardContent>
			</Card>
				</div>
			</div>

			{/* Campus Map — side-by-side layout with building inspector on right */}
			<div className="mt-4 flex items-center gap-3">
				<h2 className="text-[0.625rem] font-bold uppercase tracking-wider text-muted-foreground">
					Campus Map
				</h2>
				<div className="h-px flex-1 bg-sidebar-accent" />
			</div>

			<div className="mt-3 flex gap-4">
				{/* Map canvas */}
				<Card className="flex-1 min-w-0 shadow-sm">
					<CardContent className="pt-4">
						{loading ? (
							<Skeleton className="h-[400px] w-full rounded-lg" />
						) : (
							<>
								{/* Map toolbar */}
								<div className="mb-2 flex items-center gap-2">
									<Button variant="outline" size="sm" onClick={() => setScale((s) => Math.min(s + 0.15, 2.5))}>
										<Plus className="size-3.5" />
									</Button>
									<Button variant="outline" size="sm" onClick={() => setScale((s) => Math.max(s - 0.15, 0.4))}>
										<Minus className="size-3.5" />
									</Button>
									<Button
										variant="outline"
										size="sm"
										onClick={() => { setScale(1); setPosition({ x: 0, y: 0 }); }}
									>
										<RotateCcw className="size-3.5" />
									</Button>
									<span className="ml-auto text-[0.6875rem] text-muted-foreground tabular-nums">
										{Math.round(scale * 100)}%
									</span>
									<Button asChild variant="outline" size="sm">
										<Link to="/map">
											<Pencil className="size-3.5" /> Edit Map
										</Link>
									</Button>
								</div>

								{/* Canvas */}
								<div ref={mapContainerRef} className="overflow-hidden rounded-md border border-border">
									<Stage
										width={canvasWidth}
										height={canvasHeight}
										draggable
										x={position.x}
										y={position.y}
										scaleX={scale * (canvasWidth / CANVAS_WIDTH)}
										scaleY={scale * (canvasHeight / CANVAS_HEIGHT)}
										onDragEnd={(e) => setPosition({ x: e.target.x(), y: e.target.y() })}
									>
										<Layer>
											{campusImage ? (
												<Rect
													name="bg"
													x={0}
													y={0}
													width={CANVAS_WIDTH}
													height={CANVAS_HEIGHT}
													fillPatternImage={campusImage}
													fillPatternScaleX={CANVAS_WIDTH / campusImage.width}
													fillPatternScaleY={CANVAS_HEIGHT / campusImage.height}
												/>
											) : (
												<Rect x={0} y={0} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="hsl(40 30% 95%)" cornerRadius={8} />
											)}
											{buildings.map((b) => {
												const isSelected = selectedId === b.id;
												return (
													<Fragment key={b.id}>
														<Rect
															x={b.x}
															y={b.y}
															width={b.width}
															height={b.height}
															fill={b.color}
															opacity={isSelected ? 0.95 : 0.78}
															cornerRadius={8}
															stroke={isSelected ? '#111827' : '#ffffff'}
															strokeWidth={isSelected ? 4 : 2}
															shadowColor="rgba(0,0,0,0.1)"
															shadowBlur={3}
															shadowOffsetY={1}
															onClick={() => selectBuilding(b.id)}
														/>
														<Text
															x={b.x + 6}
															y={b.y + 6}
															text={b.name}
															fontSize={Math.min(14, b.width / 8, b.height / 5)}
															fill="#ffffff"
															fontStyle="bold"
															width={b.width - 12}
															height={b.height - 30}
															wrap="word"
															ellipsis
															listening={false}
														/>
														<Text
															x={b.x + 6}
															y={b.y + b.height - 18}
															text={`${b.rooms.length} room${b.rooms.length !== 1 ? 's' : ''}`}
															fontSize={Math.min(11, b.width / 10)}
															fill="rgba(255,255,255,0.8)"
															width={b.width - 12}
															wrap="none"
															ellipsis
															listening={false}
														/>
													</Fragment>
												);
											})}
										</Layer>
									</Stage>
								</div>
							</>
						)}
					</CardContent>
				</Card>

				{/* Building inspector — right side panel */}
				<Card className="w-72 shrink-0 shadow-sm">
					<CardContent className="pt-4">
						{loading ? (
							<div className="space-y-3">
								<Skeleton className="h-5 w-32" />
								<Skeleton className="h-4 w-20" />
								<Skeleton className="h-24 w-full" />
							</div>
						) : !selected ? (
							<p className="text-sm text-muted-foreground">No buildings yet.</p>
						) : (
							<>
								{/* Building selector tabs */}
								<div className="mb-3">
									<p className="text-[0.625rem] font-bold uppercase tracking-wider text-muted-foreground mb-2">Buildings</p>
									<div className="flex flex-wrap gap-1">
										{buildings.map((b) => (
											<button
												key={b.id}
												onClick={() => selectBuilding(b.id)}
												className={`rounded-md px-2 py-1 text-[0.6875rem] font-medium transition-all duration-150 ${
													selectedId === b.id
														? 'bg-primary text-primary-foreground shadow-sm'
														: 'bg-muted text-muted-foreground hover:bg-muted/80'
												}`}
											>
												{b.name.length > 12 ? b.name.slice(0, 12) + '…' : b.name}
											</button>
										))}
									</div>
								</div>

								{/* Selected building details */}
								<div className="rounded-lg border border-border bg-muted/30 p-3">
									<div className="flex items-center gap-2 mb-2">
										<div
											className="size-3 rounded-sm"
											style={{ backgroundColor: selected.color }}
										/>
										<p className="text-sm font-bold text-foreground">{selected.name}</p>
									</div>
									<p className="text-[0.6875rem] text-muted-foreground mb-1">
										{selected.rooms.length} room{selected.rooms.length !== 1 ? 's' : ''} ·{' '}
										{selected.width}×{selected.height}
									</p>
								</div>

								{/* Room list */}
								<div className="mt-3">
									<p className="text-[0.625rem] font-bold uppercase tracking-wider text-muted-foreground mb-2">
										Rooms
									</p>
									{selected.rooms.length === 0 ? (
										<p className="text-[0.8125rem] text-muted-foreground">No rooms configured.</p>
									) : (
										<ScrollArea className="max-h-[340px]">
											<ul className="space-y-1.5 pr-2">
												{selected.rooms.map((room) => (
													<li
														key={room.id}
														className="flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-2 text-sm transition-colors hover:bg-muted/50"
													>
														<span className="size-1.5 shrink-0 rounded-full bg-primary" />
														<span className="min-w-0 flex-1 truncate font-medium">{room.name}</span>
														<Badge variant="outline" className="shrink-0 text-[0.6rem] px-1.5 py-0">
															{room.type?.replace(/_/g, ' ') ?? 'Classroom'}
														</Badge>
														{room.capacity != null && (
															<span className="shrink-0 text-[0.6875rem] text-muted-foreground tabular-nums">
																{room.capacity}
															</span>
														)}
													</li>
												))}
											</ul>
										</ScrollArea>
									)}
								</div>

								{/* Edit link */}
								<Button asChild variant="outline" size="sm" className="mt-4 w-full">
									<Link to="/map">
										<Pencil className="size-3.5" /> Edit in Map Editor
									</Link>
								</Button>
							</>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
