/**
 * LockPanel — Pre-generation session pin/lock management.
 * Allows officers to lock specific section-subject-slot placements
 * that the constructor must honor before filling remaining demand.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Lock, Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import atlasApi from '@/lib/api';
import type {
	ExternalSection,
	LockedSession,
	LockedSessionInput,
	Subject,
	FacultyMirror,
	Room,
} from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { ScrollArea } from '@/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Separator } from '@/ui/separator';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/ui/dialog';

/* ─── Constants ─── */

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;
const DAY_SHORT: Record<string, string> = {
	MONDAY: 'Mon',
	TUESDAY: 'Tue',
	WEDNESDAY: 'Wed',
	THURSDAY: 'Thu',
	FRIDAY: 'Fri',
};

interface PeriodSlot {
	startTime: string;
	endTime: string;
}

const GRADE_BADGE: Record<number, string> = {
	7: 'bg-green-100 text-green-700 border-green-300',
	8: 'bg-yellow-100 text-yellow-700 border-yellow-300',
	9: 'bg-red-100 text-red-700 border-red-300',
	10: 'bg-blue-100 text-blue-700 border-blue-300',
};

/* ─── Props ─── */

interface LockPanelProps {
	schoolId: number;
	schoolYearId: number;
	sections: Map<number, ExternalSection>;
	subjects: Map<number, Subject>;
	faculty: Map<number, FacultyMirror>;
	rooms: Map<number, { id: number; name: string; buildingName: string }>;
}

/* ─── Component ─── */

export default function LockPanel({
	schoolId,
	schoolYearId,
	sections,
	subjects,
	faculty,
	rooms,
}: LockPanelProps) {
	const [locks, setLocks] = useState<LockedSession[]>([]);
	const [periodSlots, setPeriodSlots] = useState<PeriodSlot[]>([]);
	const [loading, setLoading] = useState(true);
	const [showAddDialog, setShowAddDialog] = useState(false);
	const [deleteId, setDeleteId] = useState<number | null>(null);
	const [saving, setSaving] = useState(false);

	/* ── New lock form state ── */
	const [newSectionId, setNewSectionId] = useState('');
	const [newSubjectId, setNewSubjectId] = useState('');
	const [newFacultyId, setNewFacultyId] = useState('');
	const [newRoomId, setNewRoomId] = useState('');
	const [newDay, setNewDay] = useState('');
	const [newTimeSlot, setNewTimeSlot] = useState('');

	/* ── Fetch locks ── */
	const fetchLocks = useCallback(async () => {
		try {
			setLoading(true);
			const [lockRes, slotRes] = await Promise.all([
				atlasApi.get(`/generation/${schoolId}/${schoolYearId}/locks`),
				atlasApi.get(`/generation/${schoolId}/${schoolYearId}/period-slots`),
			]);
			setLocks(lockRes.data.locks ?? []);
			setPeriodSlots(slotRes.data.slots ?? []);
		} catch {
			toast.error('Failed to load locks');
		} finally {
			setLoading(false);
		}
	}, [schoolId, schoolYearId]);

	useEffect(() => {
		if (schoolId && schoolYearId) fetchLocks();
	}, [schoolId, schoolYearId, fetchLocks]);

	/* ── Sorted section list ── */
	const sortedSections = useMemo(() => {
		return Array.from(sections.values()).sort((a, b) => a.name.localeCompare(b.name));
	}, [sections]);

	/* ── Sorted subject list ── */
	const sortedSubjects = useMemo(() => {
		return Array.from(subjects.values()).sort((a, b) => a.code.localeCompare(b.code));
	}, [subjects]);

	/* ── Create lock ── */
	const handleCreate = async () => {
		if (!newSectionId || !newSubjectId || !newDay || !newTimeSlot || !newFacultyId || !newRoomId) {
			toast.error('All fields are required: section, subject, day, time slot, faculty, and room.');
			return;
		}
		const [start, end] = newTimeSlot.split('-');
		const input: LockedSessionInput = {
			sectionId: Number(newSectionId),
			subjectId: Number(newSubjectId),
			facultyId: Number(newFacultyId),
			roomId: Number(newRoomId),
			day: newDay,
			startTime: start,
			endTime: end,
		};
		try {
			setSaving(true);
			await atlasApi.post(`/generation/${schoolId}/${schoolYearId}/locks`, input);
			toast.success('Lock created');
			setShowAddDialog(false);
			resetForm();
			fetchLocks();
		} catch (e: any) {
			const msg = e?.response?.data?.message ?? 'Failed to create lock';
			toast.error(msg);
		} finally {
			setSaving(false);
		}
	};

	/* ── Delete lock ── */
	const handleDelete = async (id: number) => {
		try {
			setSaving(true);
			await atlasApi.delete(`/generation/${schoolId}/${schoolYearId}/locks/${id}`);
			toast.success('Lock removed');
			setDeleteId(null);
			fetchLocks();
		} catch {
			toast.error('Failed to remove lock');
		} finally {
			setSaving(false);
		}
	};

	const resetForm = () => {
		setNewSectionId('');
		setNewSubjectId('');
		setNewFacultyId('');
		setNewRoomId('');
		setNewDay('');
		setNewTimeSlot('');
	};

	/* ── Group locks by section for display ── */
	const locksBySection = useMemo(() => {
		const grouped = new Map<number, LockedSession[]>();
		for (const l of locks) {
			const arr = grouped.get(l.sectionId) ?? [];
			arr.push(l);
			grouped.set(l.sectionId, arr);
		}
		return grouped;
	}, [locks]);

	return (
		<div className="flex flex-col h-full">
			{/* Header */}
			<div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-border">
				<div className="flex items-center gap-1.5">
					<Lock className="size-3.5 text-primary" />
					<span className="text-xs font-semibold">Pinned Sessions</span>
					<Badge variant="secondary" className="text-[0.5625rem] px-1.5 py-0 h-4">{locks.length}</Badge>
				</div>
				<Button variant="outline" size="sm" className="h-6 text-[0.625rem] px-2" onClick={() => setShowAddDialog(true)}>
					<Plus className="size-3 mr-1" />Pin
				</Button>
			</div>

			{/* Lock list */}
			<ScrollArea className="flex-1 min-h-0">
				{loading ? (
					<div className="flex items-center justify-center py-8">
						<Loader2 className="size-4 animate-spin text-muted-foreground" />
					</div>
				) : locks.length === 0 ? (
					<div className="text-center py-8 px-4">
						<Lock className="mx-auto size-6 text-muted-foreground/30 mb-2" />
						<p className="text-xs text-muted-foreground">No pinned sessions yet.</p>
						<p className="text-[0.625rem] text-muted-foreground/70 mt-1">
							Pin sessions before generating to lock them in place.
						</p>
					</div>
				) : (
					<div className="p-2 space-y-2">
						{Array.from(locksBySection.entries()).map(([sectionId, sectionLocks]) => {
							const section = sections.get(sectionId);
							const sectionGrade = section ? Number(section.name?.match(/^(\d+)/)?.[1]) || 0 : 0;
							return (
								<div key={sectionId} className="rounded-md border border-border bg-muted/30">
									<div className="flex items-center gap-1.5 px-2 py-1.5 bg-muted/50 rounded-t-md">
										{sectionGrade > 0 && (
											<Badge variant="outline" className={`text-[0.5rem] px-1 py-0 h-3.5 ${GRADE_BADGE[sectionGrade] ?? ''}`}>
												G{sectionGrade}
											</Badge>
										)}
										<span className="text-[0.625rem] font-medium truncate">{section?.name ?? `Section #${sectionId}`}</span>
										<Badge variant="secondary" className="text-[0.5rem] px-1 py-0 h-3.5 ml-auto">{sectionLocks.length}</Badge>
									</div>
									<div className="divide-y divide-border">
										{sectionLocks.map((l) => {
											const subj = subjects.get(l.subjectId);
											const fac = l.facultyId ? faculty.get(l.facultyId) : null;
											const room = l.roomId ? rooms.get(l.roomId) : null;
											return (
												<div key={l.id} className="px-2 py-1.5 flex items-start gap-2 group">
													<div className="flex-1 min-w-0">
														<div className="flex items-center gap-1">
															<span className="text-[0.625rem] font-medium">{subj?.code ?? `Subj#${l.subjectId}`}</span>
															<span className="text-[0.5rem] text-muted-foreground">—</span>
															<span className="text-[0.5rem] text-muted-foreground">{DAY_SHORT[l.day] ?? l.day}</span>
															<span className="text-[0.5rem] text-muted-foreground">{l.startTime}–{l.endTime}</span>
														</div>
														{(fac || room) && (
															<div className="flex items-center gap-1 mt-0.5">
																{fac && <span className="text-[0.5rem] text-muted-foreground truncate">{fac.firstName} {fac.lastName}</span>}
																{fac && room && <span className="text-[0.5rem] text-muted-foreground">·</span>}
																{room && <span className="text-[0.5rem] text-muted-foreground truncate">{room.name}</span>}
															</div>
														)}
													</div>
													<Button
														variant="ghost"
														size="sm"
														className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
														onClick={() => setDeleteId(l.id)}
														aria-label="Remove lock"
													>
														<Trash2 className="size-3" />
													</Button>
												</div>
											);
										})}
									</div>
								</div>
							);
						})}
					</div>
				)}
			</ScrollArea>

			{/* Add Lock Dialog */}
			<Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Pin Session</DialogTitle>
						<DialogDescription>Lock a section-subject assignment to a specific day/time slot. The generator will honor this placement.</DialogDescription>
					</DialogHeader>
					<div className="space-y-3">
						<div>
							<label className="text-xs font-medium mb-1 block">Section *</label>
							<Select value={newSectionId} onValueChange={setNewSectionId}>
								<SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select section" /></SelectTrigger>
								<SelectContent>
									{sortedSections.map((s) => (
										<SelectItem key={s.id} value={String(s.id)} className="text-xs">{s.name}</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div>
							<label className="text-xs font-medium mb-1 block">Subject *</label>
							<Select value={newSubjectId} onValueChange={setNewSubjectId}>
								<SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select subject" /></SelectTrigger>
								<SelectContent>
									{sortedSubjects.map((s) => (
										<SelectItem key={s.id} value={String(s.id)} className="text-xs">{s.code} — {s.name}</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="grid grid-cols-2 gap-3">
							<div>
								<label className="text-xs font-medium mb-1 block">Day *</label>
								<Select value={newDay} onValueChange={setNewDay}>
									<SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Day" /></SelectTrigger>
									<SelectContent>
										{DAYS.map((d) => (
											<SelectItem key={d} value={d} className="text-xs">{DAY_SHORT[d]}</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div>
								<label className="text-xs font-medium mb-1 block">Time Slot *</label>
								<Select value={newTimeSlot} onValueChange={setNewTimeSlot}>
									<SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Slot" /></SelectTrigger>
									<SelectContent>
									{periodSlots.map((ts) => (
										<SelectItem key={`${ts.startTime}-${ts.endTime}`} value={`${ts.startTime}-${ts.endTime}`} className="text-xs">
											{ts.startTime} – {ts.endTime}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>
						<Separator />
						<div>
							<label className="text-xs font-medium mb-1 block">Faculty *</label>
							<Select value={newFacultyId} onValueChange={setNewFacultyId}>
								<SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select faculty" /></SelectTrigger>
								<SelectContent>
									{Array.from(faculty.values())
										.sort((a, b) => a.lastName.localeCompare(b.lastName))
										.map((f) => (
											<SelectItem key={f.id} value={String(f.id)} className="text-xs">{f.lastName}, {f.firstName}</SelectItem>
										))}
								</SelectContent>
							</Select>
						</div>
						<div>
							<label className="text-xs font-medium mb-1 block">Room *</label>
							<Select value={newRoomId} onValueChange={setNewRoomId}>
								<SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select room" /></SelectTrigger>
								<SelectContent>
									{Array.from(rooms.values())
										.sort((a, b) => a.name.localeCompare(b.name))
										.map((r) => (
											<SelectItem key={r.id} value={String(r.id)} className="text-xs">{r.buildingName} — {r.name}</SelectItem>
										))}
								</SelectContent>
							</Select>
						</div>
					</div>
					<DialogFooter className="gap-2 sm:gap-0">
						<Button variant="outline" size="sm" onClick={() => { setShowAddDialog(false); resetForm(); }}>Cancel</Button>
						<Button size="sm" onClick={handleCreate} disabled={saving}>
							{saving ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Lock className="size-3.5 mr-1.5" />}
							Pin Session
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Delete Confirmation */}
			<Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
				<DialogContent className="sm:max-w-sm">
					<DialogHeader>
						<DialogTitle>Remove Pinned Session?</DialogTitle>
						<DialogDescription>This lock will be removed. The slot will be available for the generator to reassign.</DialogDescription>
					</DialogHeader>
					<DialogFooter className="gap-2 sm:gap-0">
						<Button variant="outline" size="sm" onClick={() => setDeleteId(null)}>Cancel</Button>
						<Button variant="destructive" size="sm" onClick={() => deleteId && handleDelete(deleteId)} disabled={saving}>
							{saving ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Trash2 className="size-3.5 mr-1.5" />}
							Remove
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
