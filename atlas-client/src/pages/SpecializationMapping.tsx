import { useEffect, useMemo, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { CheckCircle2, Loader2, RefreshCw, Save, ShieldAlert, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import atlasApi from '@/lib/api';
import type {
	SpecializationAlias,
	SpecializationCatalogDepartment,
	SpecializationCatalogResponse,
	Subject,
} from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/ui/dialog';
import { Label } from '@/ui/label';
import { ScrollArea } from '@/ui/scroll-area';
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/ui/select';

const DEFAULT_SCHOOL_ID = 1;
const NONE_VALUE = '__NONE__';

export default function SpecializationMapping() {
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [subjects, setSubjects] = useState<Subject[]>([]);
	const [aliases, setAliases] = useState<SpecializationAlias[]>([]);
	const [departments, setDepartments] = useState<SpecializationCatalogDepartment[]>([]);
	const [orphans, setOrphans] = useState<string[]>([]);
	const [selectionBySpecialization, setSelectionBySpecialization] = useState<Record<string, string>>({});
	const [initialSelectionBySpecialization, setInitialSelectionBySpecialization] = useState<Record<string, string>>({});
	const [pendingRouteExit, setPendingRouteExit] = useState(false);

	const isDirty = useMemo(
		() => JSON.stringify(selectionBySpecialization) !== JSON.stringify(initialSelectionBySpecialization),
		[selectionBySpecialization, initialSelectionBySpecialization],
	);

	const blocker = useBlocker(
		({ currentLocation, nextLocation }) =>
			isDirty && currentLocation.pathname !== nextLocation.pathname,
	);

	useEffect(() => {
		const onBeforeUnload = (event: BeforeUnloadEvent) => {
			if (!isDirty) {
				return;
			}
			event.preventDefault();
			event.returnValue = '';
		};

		window.addEventListener('beforeunload', onBeforeUnload);
		return () => window.removeEventListener('beforeunload', onBeforeUnload);
	}, [isDirty]);

	useEffect(() => {
		setPendingRouteExit(blocker.state === 'blocked');
	}, [blocker.state]);

	useEffect(() => {
		void loadData();
	}, []);

	const loadData = async () => {
		setLoading(true);
		try {
			const [catalogRes, aliasRes, subjectRes] = await Promise.all([
				atlasApi.get<SpecializationCatalogResponse>(`/faculty/specialization-catalog?schoolId=${DEFAULT_SCHOOL_ID}`),
				atlasApi.get<{ aliases: SpecializationAlias[] }>(`/specialization-aliases?schoolId=${DEFAULT_SCHOOL_ID}`),
				atlasApi.get<{ subjects: Subject[] }>(`/subjects?schoolId=${DEFAULT_SCHOOL_ID}`),
			]);

			setAliases(aliasRes.data.aliases);
			setSubjects(subjectRes.data.subjects);
			setDepartments(catalogRes.data.departments);
			setOrphans(catalogRes.data.orphans);

			const nextSelection: Record<string, string> = {};
			for (const department of catalogRes.data.departments) {
				for (const item of department.items) {
					const firstMappedCode = item.mappedSubjectCodes[0] ?? NONE_VALUE;
					nextSelection[item.specialization] = firstMappedCode;
				}
			}
			setSelectionBySpecialization(nextSelection);
			setInitialSelectionBySpecialization(nextSelection);
		} catch {
			toast.error('Unable to load specialization and subject mapping data.');
		} finally {
			setLoading(false);
		}
	};

	const handleSelectionChange = (specialization: string, subjectCode: string) => {
		setSelectionBySpecialization((previous) => ({
			...previous,
			[specialization]: subjectCode,
		}));
	};

	const saveAllChanges = async () => {
		if (!isDirty) {
			toast.info('No changes to save.');
			return;
		}

		setSaving(true);
		try {
			const existingAliasesBySpecialization = aliases.reduce<Record<string, SpecializationAlias[]>>((acc, alias) => {
				const list = acc[alias.alias] ?? [];
				list.push(alias);
				acc[alias.alias] = list;
				return acc;
			}, {});

			const specializationKeys = Array.from(
				new Set([
					...Object.keys(selectionBySpecialization),
					...Object.keys(initialSelectionBySpecialization),
				]),
			);

			for (const specialization of specializationKeys) {
				const selectedCode = selectionBySpecialization[specialization] ?? NONE_VALUE;
				const initialCode = initialSelectionBySpecialization[specialization] ?? NONE_VALUE;
				if (selectedCode === initialCode) {
					continue;
				}

				const existing = existingAliasesBySpecialization[specialization] ?? [];
				for (const alias of existing) {
					await atlasApi.delete(`/specialization-aliases/${alias.id}`);
				}

				if (selectedCode !== NONE_VALUE) {
					await atlasApi.post('/specialization-aliases', {
						schoolId: DEFAULT_SCHOOL_ID,
						alias: specialization,
						canonical: selectedCode,
					});
				}
			}

			await loadData();
			toast.success('Specialization to subject mappings saved.');
		} catch (error: any) {
			toast.error(error?.response?.data?.message || 'Failed to save mappings. Please retry.');
		} finally {
			setSaving(false);
		}
	};

	const mappedCount = useMemo(() => {
		let count = 0;
		for (const value of Object.values(selectionBySpecialization)) {
			if (value !== NONE_VALUE) {
				count += 1;
			}
		}
		return count;
	}, [selectionBySpecialization]);

	const totalSpecializations = useMemo(
		() => departments.reduce((sum, department) => sum + department.specializationCount, 0),
		[departments],
	);

	if (loading) {
		return (
			<div className='h-[calc(100svh-3.5rem)] flex items-center justify-center'>
				<Loader2 className='size-8 animate-spin text-primary' />
			</div>
		);
	}

	return (
		<div className='h-[calc(100svh-3.5rem)] flex flex-col overflow-hidden bg-background'>
			<header className='shrink-0 border-b bg-muted/30 px-6 py-3'>
				<div className='flex items-center gap-3 justify-between'>
					<div className='space-y-1'>
						<div className='flex items-center gap-2'>
							<Sparkles className='size-4 text-primary' />
							<h1 className='text-lg font-bold tracking-tight'>Specialization to Subject Mapping</h1>
						</div>
						<p className='text-xs text-muted-foreground'>
							Pick one subject for each specialization. Groups are auto-loaded from live EnrollPro department data.
						</p>
					</div>
					<div className='flex items-center gap-2'>
						<Badge variant='secondary' className='h-7 px-3 text-xs font-semibold'>
							{mappedCount}/{totalSpecializations} mapped
						</Badge>
						<Button variant='outline' size='sm' className='h-8 gap-2' onClick={() => void loadData()} disabled={saving}>
							<RefreshCw className='size-3.5' />
							Refresh
						</Button>
						<Button size='sm' className='h-8 gap-2' disabled={!isDirty || saving} onClick={() => void saveAllChanges()}>
							{saving ? <Loader2 className='size-3.5 animate-spin' /> : <Save className='size-3.5' />}
							Save All Changes
						</Button>
					</div>
				</div>
			</header>

			<div className='shrink-0 px-6 py-2 border-b bg-background/70 flex items-center gap-3 text-xs'>
				<Badge variant='outline' className='font-semibold'>
					{departments.length} departments
				</Badge>
				<Badge variant='outline' className='font-semibold'>
					{totalSpecializations} specializations
				</Badge>
				{orphans.length > 0 && (
					<Badge variant='secondary' className='bg-amber-100 text-amber-800 border-amber-200 font-semibold'>
						<ShieldAlert className='size-3 mr-1' />
						{orphans.length} specialization(s) still need mapping
					</Badge>
				)}
			</div>

			<ScrollArea className='flex-1 min-h-0'>
				<div className='p-6 space-y-5'>
					{departments.map((department) => (
						<Card key={department.departmentName} className='shadow-sm'>
							<CardHeader className='pb-3'>
								<div className='flex items-center justify-between gap-2'>
									<div>
										<CardTitle className='text-base'>{department.departmentName}</CardTitle>
										<CardDescription>
											{department.specializationCount} specialization{department.specializationCount !== 1 ? 's' : ''}
										</CardDescription>
									</div>
									{department.departmentCode && (
										<Badge variant='outline' className='font-mono text-xs'>
											{department.departmentCode}
										</Badge>
									)}
								</div>
							</CardHeader>
							<CardContent className='pt-0'>
								<div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3'>
									{department.items.map((item) => {
										const selected = selectionBySpecialization[item.specialization] ?? NONE_VALUE;
										const statusTone = selected === NONE_VALUE ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-emerald-100 text-emerald-800 border-emerald-200';
										return (
											<Card key={item.specialization} className='border-muted/80'>
												<CardContent className='p-4 space-y-3'>
													<div className='space-y-1'>
														<p className='text-sm font-semibold leading-tight'>{item.specialization}</p>
														<Badge className={`h-5 text-[10px] font-semibold border ${statusTone}`}>
															{selected === NONE_VALUE ? 'Needs subject' : 'Mapped'}
														</Badge>
													</div>
													<div className='space-y-1'>
														<Label className='text-[11px] font-semibold'>Subject</Label>
														<Select value={selected} onValueChange={(value) => handleSelectionChange(item.specialization, value)}>
															<SelectTrigger className='h-8 text-xs'>
																<SelectValue placeholder='Select subject' />
															</SelectTrigger>
															<SelectContent>
																<SelectGroup>
																	<SelectItem value={NONE_VALUE}>No subject selected</SelectItem>
																	{subjects.map((subject) => (
																		<SelectItem key={subject.code} value={subject.code}>
																			{subject.name} ({subject.code})
																		</SelectItem>
																	))}
																</SelectGroup>
															</SelectContent>
														</Select>
													</div>
													{item.mappedSubjects.length > 0 && (
														<div className='text-[11px] text-muted-foreground'>
															Current: {item.mappedSubjects.map((entry) => `${entry.name} (${entry.code})`).join(', ')}
														</div>
													)}
												</CardContent>
											</Card>
										);
									})}
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			</ScrollArea>

			<Dialog open={pendingRouteExit} onOpenChange={setPendingRouteExit}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Unsaved mapping changes</DialogTitle>
						<DialogDescription>
							You changed specialization to subject mappings. Save first to avoid losing your updates.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant='outline'
							onClick={() => {
								if (typeof blocker.reset === 'function') {
									blocker.reset();
								}
							}}
						>
							Stay on this page
						</Button>
						<Button
							variant='secondary'
							onClick={() => {
								setSelectionBySpecialization(initialSelectionBySpecialization);
								if (typeof blocker.proceed === 'function') {
									blocker.proceed();
								}
							}}
						>
							Discard changes
						</Button>
						<Button
							disabled={saving}
							onClick={async () => {
								await saveAllChanges();
								if (blocker.state === 'blocked') {
									if (typeof blocker.proceed === 'function') {
										blocker.proceed();
									}
								}
							}}
						>
							Save and leave
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
