import { Fragment, useEffect, useMemo, useState } from 'react';
import { Layer, Rect, Stage, Text } from 'react-konva';
import { Link } from 'react-router-dom';
import {
	AlertTriangle,
	BookOpen,
	CalendarClock,
	Check,
	CheckCircle2,
	Circle,
	ClipboardList,
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
	icon: typeof CalendarClock;
	color: string;
	bg: string;
	link?: string;
	warning?: string;
};

export default function Dashboard() {
	const [buildings, setBuildings] = useState<Building[]>([]);
	const [campusImageUrl, setCampusImageUrl] = useState<string | null>(null);
	const [campusImage, setCampusImage] = useState<HTMLImageElement | null>(null);
	const [loading, setLoading] = useState(true);
	const [selectedId, setSelectedId] = useState<number | null>(null);
	const [scale, setScale] = useState(1);
	const [position, setPosition] = useState({ x: 0, y: 0 });
	const [subjectCount, setSubjectCount] = useState<number | null>(null);
	const [facultyCount, setFacultyCount] = useState<number | null>(null);
	const [unassignedSubjectCount, setUnassignedSubjectCount] = useState<number | null>(null);

	useEffect(() => {
		setLoading(true);
		Promise.all([
			atlasApi.get<{ buildings: Building[] }>(`/map/schools/${DEFAULT_SCHOOL_ID}/buildings`),
			atlasApi.get<{ campusImageUrl: string | null }>(`/map/schools/${DEFAULT_SCHOOL_ID}/campus-image`),
			atlasApi.get<{ count: number; unassignedCount?: number }>(`/subjects/stats/${DEFAULT_SCHOOL_ID}`).catch(() => ({ data: { count: 0, unassignedCount: undefined } })),
			atlasApi.get<{ subjects: any[] }>(`/subjects?schoolId=${DEFAULT_SCHOOL_ID}`).catch(() => ({ data: { subjects: [] } })),
		])
			.then(([bRes, iRes, statsRes, subsRes]) => {
				setBuildings(bRes.data.buildings);
				setCampusImageUrl(iRes.data.campusImageUrl);
				setSubjectCount(statsRes.data.count);
				setUnassignedSubjectCount(statsRes.data.unassignedCount ?? null);
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

	const totalRooms = useMemo(() => buildings.reduce((sum, b) => sum + b.rooms.length, 0), [buildings]);
	const selected = useMemo(() => buildings.find((b) => b.id === selectedId) ?? null, [buildings, selectedId]);

	const statCards: StatCard[] = useMemo(
		() => [
			{ title: 'Subjects Configured', value: subjectCount !== null ? String(subjectCount) : '—', icon: BookOpen, color: 'text-blue-600', bg: 'bg-blue-50', link: '/subjects', warning: unassignedSubjectCount ? `${unassignedSubjectCount} need faculty` : undefined },
			{ title: 'Active Faculty', value: facultyCount !== null ? String(facultyCount) : '—', icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50', link: '/faculty' },
			{ title: 'Buildings', value: String(buildings.length), icon: MapPinned, color: 'text-amber-600', bg: 'bg-amber-50', link: '/map' },
			{ title: 'Rooms', value: String(totalRooms), icon: ClipboardList, color: 'text-violet-600', bg: 'bg-violet-50', link: '/map' },
		],
		[buildings, totalRooms, subjectCount, facultyCount, unassignedSubjectCount],
	);

	/* Setup checklist — determines if we can advance from SETUP phase */
	const currentPhase = 'SETUP'; // v1: always in setup until generation is implemented
	const setupChecklist: SetupCheck[] = useMemo(
		() => [
			{ label: 'Subjects configured', done: (subjectCount ?? 0) > 0, link: '/subjects' },
			{ label: 'Faculty synced', done: (facultyCount ?? 0) > 0, link: '/faculty' },
			{ label: 'Faculty assigned to subjects', done: unassignedSubjectCount === 0 && (subjectCount ?? 0) > 0, link: '/faculty/assignments' },
			{ label: 'Buildings & rooms set up', done: buildings.length > 0 && totalRooms > 0, link: '/map' },
		],
		[subjectCount, facultyCount, unassignedSubjectCount, buildings, totalRooms],
	);

	const setupProgress = setupChecklist.filter((c) => c.done).length;

	return (
		<div className="px-6 py-4">
			{/* Section heading */}
			<div className="mb-4 flex items-center gap-3">
				<h2 className="text-[0.625rem] font-bold uppercase tracking-wider text-muted-foreground">
					Overview
				</h2>
				<div className="h-px flex-1 bg-sidebar-accent" />
			</div>

			{/* Stats grid */}
			<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
				{statCards.map((stat) => (
					<Card key={stat.title} className="shadow-sm">
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-xs font-bold uppercase text-muted-foreground">
								{stat.title}
							</CardTitle>
							<div className={`${stat.bg} rounded-md p-2`}>
								<stat.icon className={`h-4 w-4 ${stat.color}`} />
							</div>
						</CardHeader>
						<CardContent>
							{loading ? (
								<Skeleton className="h-8 w-20" />
							) : (
								<>
									<div className="text-2xl font-black">
										{stat.link ? (
											<Link to={stat.link} className="hover:underline">{stat.value}</Link>
										) : (
											stat.value
										)}
									</div>
									{stat.warning && (
										<div className="mt-1 flex items-center gap-1 text-[0.6875rem] text-amber-600">
											<AlertTriangle className="size-3" />
											{stat.warning}
										</div>
									)}
								</>
							)}
						</CardContent>
					</Card>
				))}
			</div>

			{/* Scheduling Lifecycle Status */}
			<div className="mt-6 flex items-center gap-3">
				<h2 className="text-[0.625rem] font-bold uppercase tracking-wider text-muted-foreground">
					Scheduling Lifecycle
				</h2>
				<div className="h-px flex-1 bg-sidebar-accent" />
			</div>

			<Card className="mt-3 shadow-sm">
				<CardContent className="pt-5">
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

			{/* Campus Map */}
			<div className="mt-6 flex items-center gap-3">
				<h2 className="text-[0.625rem] font-bold uppercase tracking-wider text-muted-foreground">
					Campus Map
				</h2>
				<div className="h-px flex-1 bg-sidebar-accent" />
			</div>

			<Card className="mt-3 shadow-sm">
				<CardContent className="pt-4">
					{loading ? (
						<Skeleton className="h-[600px] w-full rounded-lg" />
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
									onClick={() => { setScale(1); setPosition({ x: 0, y: 0 }); setSelectedId(null); }}
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
							<div className="overflow-hidden rounded-md border border-border">
								<Stage
									width={CANVAS_WIDTH}
									height={CANVAS_HEIGHT}
									draggable
									x={position.x}
									y={position.y}
									scaleX={scale}
									scaleY={scale}
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
														onClick={() => setSelectedId(b.id)}
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

							{/* Building inspector */}
							{selected ? (
								<div className="mt-3 rounded-md border border-border bg-muted/50 p-3">
									<p className="text-sm font-bold text-foreground">{selected.name}</p>
									<p className="mt-1 text-[0.6875rem] font-bold uppercase tracking-wider text-muted-foreground">
										Rooms
									</p>
									<ul className="mt-1.5 space-y-1">
										{selected.rooms.map((room) => (
											<li key={room.id} className="flex items-center gap-2 text-sm text-foreground">
												<span className="size-1.5 shrink-0 rounded-full bg-primary" />
												<span className="flex-1">{room.name}</span>
												<Badge variant="outline" className="text-[0.6rem] px-1 py-0">
													{room.type?.replace(/_/g, ' ') ?? 'Classroom'}
												</Badge>
												{room.capacity && (
													<span className="text-[0.6875rem] text-muted-foreground">
														Cap: {room.capacity}
													</span>
												)}
											</li>
										))}
									</ul>
								</div>
							) : (
								<p className="mt-2 text-[0.8125rem] text-muted-foreground">
									Click a building to inspect rooms and details.
								</p>
							)}
						</>
					)}
				</CardContent>
			</Card>

			{/* Quick Actions */}
			<div className="mt-6 flex items-center gap-3">
				<h2 className="text-[0.625rem] font-bold uppercase tracking-wider text-muted-foreground">
					Quick Actions
				</h2>
				<div className="h-px flex-1 bg-sidebar-accent" />
			</div>

			<div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
				<Card className="shadow-sm">
					<CardContent className="pt-6">
						<div className="flex items-start gap-3">
							<div className="rounded-md bg-emerald-50 p-2.5">
								<Pencil className="size-5 text-emerald-600" />
							</div>
							<div className="min-w-0 flex-1">
								<p className="text-sm font-semibold">Map Editor</p>
								<p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
									Add buildings, resize, and manage rooms.
								</p>
								<Button asChild variant="outline" size="sm" className="mt-3">
									<Link to="/map">Open Editor</Link>
								</Button>
							</div>
						</div>
					</CardContent>
				</Card>

				<Card className="shadow-sm">
					<CardContent className="pt-6">
						<div className="flex items-start gap-3">
							<div className="rounded-md bg-amber-50 p-2.5">
								<Users className="size-5 text-amber-600" />
							</div>
							<div className="min-w-0 flex-1">
								<p className="text-sm font-semibold">Faculty Management</p>
								<p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
									Sync faculty from EnrollPro and manage assignments.
								</p>
								<Button asChild variant="outline" size="sm" className="mt-3">
									<Link to="/faculty">Manage Faculty</Link>
								</Button>
							</div>
						</div>
					</CardContent>
				</Card>

				<Card className="shadow-sm">
					<CardContent className="pt-6">
						<div className="flex items-start gap-3">
							<div className="rounded-md bg-blue-50 p-2.5">
								<BookOpen className="size-5 text-blue-600" />
							</div>
							<div className="min-w-0 flex-1">
								<p className="text-sm font-semibold">Subjects</p>
								<p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
									Configure MATATAG subjects and custom additions.
								</p>
								<Button asChild variant="outline" size="sm" className="mt-3">
									<Link to="/subjects">Manage Subjects</Link>
								</Button>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
