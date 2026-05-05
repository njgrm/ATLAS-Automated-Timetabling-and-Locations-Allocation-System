import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, CalendarClock, ChevronLeft, Loader2, Lock, MapPin } from 'lucide-react';

import { CampusMap } from '@/components/CampusMap';
import ManualEditPanel from '@/components/ManualEditPanel';
import SchedulingPolicyPane from '@/components/SchedulingPolicyPane';
import { BuildingView, ROOM_COLORS, ROOM_TYPE_LABELS } from '@/components/BuildingView';
import { TimetableGrid } from '@/components/timetable/TimetableGrid';
import { formatTime } from '@/lib/utils';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Checkbox } from '@/ui/checkbox';
import { ResizablePanel } from '@/ui/resizable';
import { ScrollArea } from '@/ui/scroll-area';

import type { Violation } from '@/types';

type CenterWorkspaceProps = {
	centerView: 'schedule' | 'pre-generation' | 'policy' | 'manual-edit' | 'map' | 'building';
	selectedEntry: any;
	violationIndex: Map<string, Violation[]>;
	followUps: Set<string>;
	toggleFollowUp: (entryId: string) => Promise<void>;
	exitPolicyView: () => void;
	handleRefresh: () => void;
	defaultSchoolId: number;
	schoolYearId: number | null;
	pendingAction: 'CHANGE_TIMESLOT' | 'CHANGE_ROOM' | 'CHANGE_FACULTY' | null;
	roomMap: Map<number, any>;
	facultyMap: Map<number, any>;
	draftEntries: any[];
	previewEdit: (proposal: any) => Promise<any>;
	commitEdit: (proposal: any, allowSoftOverride?: boolean) => Promise<void>;
	previewLoading: boolean;
	commitLoading: boolean;
	subjectLabel: (id: number) => string;
	facultyLabel: (id: number) => string;
	sectionLabel: (id: number) => string;
	gradeForSection: (sectionId: number) => number | null;
	roomLabel: (roomId: number) => string;
	isStaleRoom: (roomId: number) => boolean;
	timeSlots: Array<{ startTime: string; endTime: string }>;
	preGenOnboarding: boolean;
	setCenterView: (view: 'schedule' | 'pre-generation' | 'policy' | 'manual-edit' | 'map' | 'building') => void;
	buildings: any[];
	mapBuildingId: number | null;
	setMapBuildingId: (id: number | null) => void;
	openBuildingWorkspace: (buildingId: number) => Promise<void>;
	selectedMapBuilding: any;
	selectedMapBuildingFloors: number[];
	mapRoomId: number | null;
	openRoomGridWorkspace: (roomId: number) => void;
	draftBoard: any;
	draft: any;
	runs: any[];
	entityFilter: string;
	pivotLabel: (id: number) => string;
	viewMode: 'section' | 'faculty' | 'room';
	setPreGenOnboarding: (value: boolean) => void;
	gridEntries: any[];
	highlightedEntryIds: Set<string>;
	handleEntryClick: (entry: any) => void;
	entryContextLabel: (entry: any) => string;
	formatFacultyInitials: (id: number) => string;
	roomLabelShort: (roomId: number) => string;
	dragItem: any;
	kbSelectedSource: any;
	handleKbPlace: (day: string, startTime: string, endTime: string) => Promise<void>;
	cellConflictMap: any;
	navToFaculty: (id: number) => void;
	navToSection: (id: number) => void;
	navToRoom: (id: number) => void;
	dropTarget: string | null;
	setDropTarget: (target: string | null) => void;
	preGenPending: any;
	preGenPreviewLoading: boolean;
	preGenPreviewError: string | null;
	preGenPreview: any;
	commitPreGenPending: () => Promise<void>;
	preGenSaving: boolean;
	setPreGenPending: (value: any) => void;
	setPreGenPreview: (value: any) => void;
	setPreGenPreviewError: (value: string | null) => void;
	setPreGenAllowSoftOverride: (value: boolean) => void;
	dayShort: Record<string, string>;
};

export function CenterWorkspace(props: CenterWorkspaceProps) {
	const {
		centerView,
		selectedEntry,
		violationIndex,
		followUps,
		toggleFollowUp,
		exitPolicyView,
		handleRefresh,
		defaultSchoolId,
		schoolYearId,
		pendingAction,
		roomMap,
		facultyMap,
		draftEntries,
		previewEdit,
		commitEdit,
		previewLoading,
		commitLoading,
		subjectLabel,
		facultyLabel,
		sectionLabel,
		gradeForSection,
		roomLabel,
		isStaleRoom,
		timeSlots,
		preGenOnboarding,
		setCenterView,
		buildings,
		mapBuildingId,
		setMapBuildingId,
		openBuildingWorkspace,
		selectedMapBuilding,
		selectedMapBuildingFloors,
		mapRoomId,
		openRoomGridWorkspace,
		draftBoard,
		draft,
		runs,
		entityFilter,
		pivotLabel,
		viewMode,
		setPreGenOnboarding,
		gridEntries,
		highlightedEntryIds,
		handleEntryClick,
		entryContextLabel,
		formatFacultyInitials,
		roomLabelShort,
		dragItem,
		kbSelectedSource,
		handleKbPlace,
		cellConflictMap,
		navToFaculty,
		navToSection,
		navToRoom,
		dropTarget,
		setDropTarget,
		preGenPending,
		preGenPreviewLoading,
		preGenPreviewError,
		preGenPreview,
		commitPreGenPending,
		preGenSaving,
		setPreGenPending,
		setPreGenPreview,
		setPreGenPreviewError,
		setPreGenAllowSoftOverride,
		dayShort,
	} = props;

	return (
		<ResizablePanel id="center-panel" order={2} defaultSize={60} className="flex-1 min-w-0 flex flex-col min-h-0 relative" data-tutorial="center-grid">
			<AnimatePresence mode="wait">
				{centerView === 'policy' ? (
					<motion.div
						key="policy"
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: 8 }}
						transition={{ duration: 0.18 }}
						className="flex flex-col min-h-0 h-full"
					>
						<SchedulingPolicyPane
							schoolId={defaultSchoolId}
							schoolYearId={schoolYearId}
							onBack={exitPolicyView}
							onPolicySaved={handleRefresh}
						/>
					</motion.div>
				) : centerView === 'manual-edit' && selectedEntry ? (
					<motion.div
						key="manual-edit"
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: 8 }}
						transition={{ duration: 0.18 }}
						className="flex flex-col min-h-0 h-full"
					>
						<ManualEditPanel
							entry={selectedEntry}
							violationIndex={violationIndex}
							followUps={followUps}
							onToggleFollowUp={toggleFollowUp}
							onClose={() => setCenterView('schedule')}
							subjectLabel={subjectLabel}
							facultyLabel={facultyLabel}
							sectionLabel={sectionLabel}
							gradeForSection={gradeForSection}
							roomLabel={roomLabel}
							isStaleRoom={isStaleRoom}
							timeSlots={timeSlots}
							roomMap={roomMap}
							facultyMap={facultyMap}
							draftEntries={draftEntries}
							onPreview={previewEdit}
							onCommit={commitEdit}
							previewLoading={previewLoading}
							commitLoading={commitLoading}
							initialAction={pendingAction}
							onForceOpen={() => {}}
						/>
					</motion.div>
				) : centerView === 'map' ? (
					<motion.div
						key="map-view"
						initial={{ opacity: 0, y: -8 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -8 }}
						transition={{ duration: 0.18 }}
						className="flex-1 min-w-0 flex flex-col min-h-0 p-3"
					>
						<div className="mb-2 flex items-center justify-between gap-2">
							<div className="flex items-center gap-2">
								<Badge variant="outline" className="h-5 px-1.5 text-[0.625rem] uppercase">Map</Badge>
								<p className="text-xs text-muted-foreground">
									{preGenOnboarding ? 'Click a building then a room to pivot the timetable grid to that room.' : 'View-only map workspace. Editing remains in `/map-editor`.'}
								</p>
							</div>
							<Button variant="outline" size="sm" className="h-7 text-xs"
								onClick={() => preGenOnboarding ? setCenterView('pre-generation') : setCenterView('schedule')}>
								<ChevronLeft className="size-3.5" />
								{preGenOnboarding ? 'Back to Grid' : 'Back to Schedule'}
							</Button>
						</div>
						<CampusMap
							buildings={buildings}
							activeBuildingId={mapBuildingId}
							onSelect={(buildingId) => {
								if (buildingId == null) {
									setMapBuildingId(null);
									return;
								}
								void openBuildingWorkspace(buildingId);
							}}
						/>
					</motion.div>
				) : centerView === 'building' && selectedMapBuilding ? (
					<motion.div
						key={`building-${selectedMapBuilding.id}`}
						initial={{ opacity: 0, y: -8 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -8 }}
						transition={{ duration: 0.18 }}
						className="flex-1 min-w-0 flex flex-col min-h-0 p-3 gap-3"
					>
						<div className="flex items-center justify-between gap-2">
							<div className="flex items-center gap-2">
								<Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setCenterView('map')}>
									<ChevronLeft className="size-3.5" />
									Back to Map
								</Button>
								<Badge variant="outline" className="h-5 px-1.5 text-[0.625rem] uppercase">Building View</Badge>
								<p className="text-xs font-medium">{selectedMapBuilding.name}</p>
							</div>
							<Button
								variant="outline"
								size="sm"
								className="h-7 text-xs"
								onClick={() => setCenterView('schedule')}
							>
								Back to Schedule
							</Button>
						</div>
						<div className="grid min-h-0 flex-1 grid-cols-12 gap-3">
							<div className="col-span-8 min-h-0 rounded-lg border border-border bg-card p-2">
								<BuildingView
									building={selectedMapBuilding}
									height={420}
									showToolbar
									selectedRoomId={mapRoomId}
									onRoomSelect={(room) => {
										if (!room) return;
										openRoomGridWorkspace(room.id);
									}}
								/>
							</div>
							<div className="col-span-4 min-h-0 rounded-lg border border-border bg-muted/20 p-3">
								<p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Rooms</p>
								<div className="space-y-px overflow-auto rounded-lg border border-border bg-border max-h-104">
									{selectedMapBuildingFloors.map((floor) => {
										const rooms = selectedMapBuilding.rooms
											.filter((r: any) => r.floor === floor)
											.sort((a: any, b: any) => a.floorPosition - b.floorPosition);
										return (
											<div key={floor} className="flex bg-background">
												<div className="flex w-7 shrink-0 items-center justify-center border-r border-border bg-muted/50">
													<span className="text-[0.6rem] font-bold text-muted-foreground [writing-mode:vertical-lr] rotate-180">
														F{floor}
													</span>
												</div>
												<div className="flex flex-1 gap-px bg-border min-h-10">
													{rooms.length === 0 ? (
														<div className="flex flex-1 items-center justify-center bg-background px-2">
															<span className="text-[0.625rem] text-muted-foreground/50 italic">Empty</span>
														</div>
													) : (
														rooms.map((room: any) => {
															const roomType = (room.type in ROOM_COLORS ? room.type : 'OTHER') as keyof typeof ROOM_COLORS;
															const colors = ROOM_COLORS[roomType];
															return (
																<button
																	key={room.id}
																	type="button"
																	onClick={() => openRoomGridWorkspace(room.id)}
																	className={`flex flex-1 flex-col items-center justify-center px-1 py-1 transition-all text-left ${colors.bg} hover:brightness-95`}
																>
																	<span className={`text-[0.5625rem] font-semibold truncate w-full text-center ${colors.text}`}>
																		{room.name}
																	</span>
																	<span className="text-[0.5rem] text-muted-foreground truncate w-full text-center">
																		{ROOM_TYPE_LABELS[roomType]}
																	</span>
																</button>
															);
														})
													)}
												</div>
											</div>
										);
									})}
								</div>
							</div>
						</div>
					</motion.div>
				) : (
					<motion.div
						key={centerView === 'pre-generation' ? 'pre-generation-grid' : 'schedule-grid'}
						initial={{ opacity: 0, y: -8 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -8 }}
						transition={{ duration: 0.18 }}
						className="flex-1 min-w-0 flex flex-col min-h-0"
					>
						<ScrollArea className="flex-1 min-h-0">
							{(centerView === 'pre-generation' ? draftBoard != null : draft != null) ? (
								<div className="p-4">
									{centerView === 'pre-generation' ? (
										<div className="mb-3 flex items-center gap-2 flex-wrap">
											{entityFilter && entityFilter !== 'all' ? (
												<Badge
													variant="secondary"
													className={`h-5 px-2 text-[0.625rem] max-w-36 truncate ${
														viewMode === 'faculty' ? 'bg-purple-50 text-purple-700 border-purple-200' :
														viewMode === 'room' ? 'bg-blue-50 text-blue-700 border-blue-200' :
														'bg-muted text-muted-foreground'
													}`}
													title={pivotLabel(Number(entityFilter))}
												>
													{viewMode === 'faculty' ? 'Faculty' : viewMode === 'room' ? 'Room' : 'Section'}: {pivotLabel(Number(entityFilter))}
												</Badge>
											) : null}
											<Button variant="outline" size="sm" className="h-6 px-2 text-[0.625rem] gap-1" onClick={() => { setCenterView('map'); setPreGenOnboarding(true); }}>
												<MapPin className="size-3" />
												Map
											</Button>
										</div>
									) : null}
									<TimetableGrid
										entries={gridEntries}
										timeSlots={timeSlots}
										violationIndex={violationIndex}
										highlightedEntryIds={highlightedEntryIds}
										selectedEntry={selectedEntry}
										followUps={followUps}
										onEntryClick={handleEntryClick}
										subjectLabel={subjectLabel}
										sectionLabel={sectionLabel}
										gradeForSection={gradeForSection}
										entryContextLabel={entryContextLabel}
										formatFacultyInitials={formatFacultyInitials}
										facultyLabel={facultyLabel}
										viewMode={viewMode}
										pivotLabel={pivotLabel}
										roomLabelShort={roomLabelShort}
										dragItem={dragItem}
										kbSelectedSource={kbSelectedSource}
										onKbPlace={handleKbPlace}
										conflictMap={cellConflictMap}
										onNavToFaculty={navToFaculty}
										onNavToSection={navToSection}
										onNavToRoom={navToRoom}
										dropTarget={dropTarget}
										onDropTargetChange={setDropTarget}
									/>
								</div>
							) : (
								<div className="flex min-h-56 items-center justify-center p-4">
									<div className="text-center space-y-2">
										<CalendarClock className="mx-auto size-10 text-muted-foreground/30" />
										<p className="text-sm text-muted-foreground">
											{centerView === 'pre-generation'
												? 'Pre-generation draft is empty. Drag sources from the left panel into this grid.'
												: runs.length === 0
												? 'Start with Pre-Generation Draft on the left, then Generate when ready.'
												: 'No draft entries in this run'}
										</p>
									</div>
								</div>
							)}
						</ScrollArea>
						{centerView === 'pre-generation' && preGenPending && (
							<div className="shrink-0 border-t border-border bg-muted/20 px-3 py-2 space-y-1.5">
								<div className="flex flex-wrap items-center gap-2 text-[0.6875rem]">
									<Lock className="size-3 text-primary shrink-0" />
									<span className="font-medium text-foreground truncate max-w-[16rem]">Pending: {preGenPending.sourceLabel}</span>
									{preGenPreviewLoading ? (
										<span className="inline-flex items-center gap-1 text-muted-foreground"><Loader2 className="size-3 animate-spin" />Checking…</span>
									) : preGenPreviewError ? (
										<span className="text-destructive text-[0.625rem]">{preGenPreviewError}</span>
									) : preGenPreview ? (
										<span className={preGenPreview.allowed ? 'text-emerald-700' : 'text-red-700'}>
											{preGenPreview.allowed ? '✓ No hard conflicts' : '✗ Hard conflict'}
										</span>
									) : null}
								</div>
								{preGenPreview?.humanConflicts.slice(0, 2).map((conflict: any) => (
									<div key={`${conflict.code}-${conflict.humanDetail}`} className={`rounded border px-2 py-1 text-[0.625rem] ${conflict.severity === 'HARD' ? 'border-red-300 bg-red-50 text-red-700' : 'border-amber-300 bg-amber-50 text-amber-800'}`}>
										<span className="font-medium">{conflict.humanTitle}</span> — {conflict.humanDetail}
									</div>
								))}
								{preGenPending && cellConflictMap?.get(`${preGenPending.day}-${preGenPending.startTime}`)?.kind === 'hard' && (
									<div className="flex items-start gap-1.5 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[0.625rem] text-amber-800">
										<AlertTriangle className="size-3 shrink-0 mt-0.5" />
										<span>Slot occupied — saving will add a conflict. Choose a different slot or acknowledge below.</span>
									</div>
								)}
								{preGenPreview?.softViolations.length ? (<div className="flex items-start gap-1.5 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[0.625rem] text-amber-800"><AlertTriangle className="size-3 shrink-0 mt-0.5" /><span>{preGenPreview.softViolations.length} soft warning(s) — informational only.</span></div>) : null}
								<div className="flex items-center gap-2">
									<Button
										id="pre-gen-pending-save-anchor"
										data-testid="pre-gen-pending-save-anchor"
										size="sm"
										className="h-7 text-xs"
										disabled={preGenSaving || preGenPreviewLoading || !preGenPreview || !preGenPreview.allowed}
										onClick={() => void commitPreGenPending()}
									>
										{preGenSaving ? <Loader2 className="mr-1 size-3 animate-spin" /> : <Lock className="mr-1 size-3" />}
										Save Anchor
									</Button>
									<Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setPreGenPending(null); setPreGenPreview(null); setPreGenPreviewError(null); setPreGenAllowSoftOverride(false); }}>
										Cancel
									</Button>
								</div>
							</div>
						)}
					</motion.div>
				)}
			</AnimatePresence>
		</ResizablePanel>
	);
}
