import { useEffect, useMemo, useRef, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { CheckCircle2, ChevronDown, Loader2, RefreshCw, Save, Search, ShieldAlert, Sparkles, TriangleAlert, X } from 'lucide-react';
import { toast } from 'sonner';

import atlasApi from '@/lib/api';
import type {
	SpecializationCatalogDepartment,
	SpecializationCatalogResponse,
	Subject,
} from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card';
import { Checkbox } from '@/ui/checkbox';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/ui/dialog';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover';
import { ScrollArea } from '@/ui/scroll-area';
import { Switch } from '@/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';

const DEFAULT_SCHOOL_ID = 1;
const NONE_LABEL = 'No ATLAS Learning Area selected';

type MappingOption = {
	code: string;
	name: string;
	isActive: boolean;
	groupLabel: string;
};

type MappingGroup = {
	label: string;
	items: MappingOption[];
};

type BatchMappingPayload = {
	alias: string;
	canonicalCodes: string[];
};

function normalizeTerm(value: string): string {
	return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function termTokens(value: string): string[] {
	return normalizeTerm(value).split(' ').filter(Boolean);
}

function buildGroupedOptions(
	subjectList: Subject[],
	departmentName: string,
	selectedCodes: string[],
	query: string,
): MappingGroup[] {
	const normalizedDepartment = normalizeTerm(departmentName);
	const queryValue = normalizeTerm(query);

	const visibleSubjects = subjectList
		.filter((subject) => subject.isActive || selectedCodes.includes(subject.code))
		.filter((subject) => {
			if (!queryValue) {
				return true;
			}
			const haystack = `${subject.name} ${subject.code} ${subject.allowedSpecializations.join(' ')}`.toLowerCase();
			return haystack.includes(queryValue);
		})
		.map<MappingOption>((subject) => {
			const firstScope = subject.programScopes[0] || 'Other';
			return {
				code: subject.code,
				name: subject.name,
				isActive: subject.isActive,
				groupLabel: firstScope,
			};
		});

	const departmentTokens = new Set(termTokens(normalizedDepartment));
	const isSuggested = (option: MappingOption) => {
		const optionTokens = new Set(termTokens(`${option.name} ${option.code}`));
		for (const token of departmentTokens) {
			if (optionTokens.has(token)) {
				return true;
			}
		}
		return false;
	};

	const suggested = visibleSubjects
		.filter((option) => isSuggested(option))
		.sort((a, b) => a.name.localeCompare(b.name));

	const byGroup = visibleSubjects
		.filter((option) => !isSuggested(option))
		.reduce<Record<string, MappingOption[]>>((acc, option) => {
			const key = option.groupLabel || 'Other';
			const next = acc[key] ?? [];
			next.push(option);
			acc[key] = next;
			return acc;
		}, {});

	const groups: MappingGroup[] = [];
	if (suggested.length > 0) {
		groups.push({ label: 'Suggested', items: suggested });
	}

	for (const label of Object.keys(byGroup).sort((a, b) => a.localeCompare(b))) {
		groups.push({
			label,
			items: byGroup[label].sort((a, b) => a.name.localeCompare(b.name)),
		});
	}

	return groups;
}

type MappingMultiSelectProps = {
	departmentName: string;
	selectedCodes: string[];
	subjects: Subject[];
	onChange: (nextCodes: string[]) => void;
};

function MappingMultiSelect({
	departmentName,
	selectedCodes,
	subjects,
	onChange,
}: MappingMultiSelectProps) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState('');
	const inputRef = useRef<HTMLInputElement>(null);

	const groups = useMemo(
		() => buildGroupedOptions(subjects, departmentName, selectedCodes, query),
		[subjects, departmentName, selectedCodes, query],
	);

	const selectedLabels = useMemo(() => {
		const lookup = new Map(subjects.map((subject) => [subject.code, subject.name]));
		return selectedCodes.map((code) => lookup.get(code) || code);
	}, [selectedCodes, subjects]);

	const selectedInactiveCount = useMemo(() => {
		const activeLookup = new Map(subjects.map((subject) => [subject.code, subject.isActive]));
		return selectedCodes.filter((code) => activeLookup.get(code) === false).length;
	}, [selectedCodes, subjects]);

	return (
		<div className='space-y-2'>
			<Popover
				open={open}
				onOpenChange={(nextOpen) => {
					setOpen(nextOpen);
					if (!nextOpen) {
						setQuery('');
					}
				}}
			>
				<PopoverTrigger asChild>
					<Button variant='outline' className='h-8 w-full justify-between text-xs font-normal'>
						<span className='truncate'>
							{selectedCodes.length > 0
								? `${selectedCodes.length} selected`
								: NONE_LABEL}
						</span>
						<ChevronDown className='size-3.5 opacity-60' />
					</Button>
				</PopoverTrigger>
				<PopoverContent
					className='w-105 max-w-[calc(100vw-2rem)] p-0'
					onOpenAutoFocus={(event) => {
						event.preventDefault();
						inputRef.current?.focus();
					}}
				>
					<div className='border-b p-2'>
						<div className='flex items-center gap-2 rounded-md border px-2'>
							<Search className='size-3.5 text-muted-foreground' />
							<Input
								ref={inputRef}
								value={query}
								onChange={(event) => setQuery(event.target.value)}
								placeholder='Search ATLAS Learning Areas'
								className='h-7 border-0 px-0 text-xs shadow-none focus-visible:ring-0'
							/>
						</div>
					</div>
					<ScrollArea className='max-h-72'>
						<div className='space-y-2 p-2'>
							{groups.length === 0 && (
								<p className='py-4 text-center text-xs text-muted-foreground'>No results found.</p>
							)}
							{groups.map((group) => (
								<div key={group.label} className='space-y-1'>
									<p className='px-1 text-[10px] uppercase tracking-wider text-muted-foreground'>
										{group.label}
									</p>
									<div className='space-y-1'>
										{group.items.map((item) => {
											const checked = selectedCodes.includes(item.code);
											return (
												<Button
													key={item.code}
													type='button'
													variant='ghost'
													className='h-auto w-full justify-start gap-2 rounded-md px-2 py-1.5 text-left text-xs'
													onClick={() => {
														if (checked) {
															onChange(selectedCodes.filter((code) => code !== item.code));
															return;
														}
														onChange([...selectedCodes, item.code]);
													}}
												>
													<Checkbox checked={checked} />
													<div className='min-w-0'>
														<p className='truncate font-medium'>
															{item.name} ({item.code})
														</p>
														{!item.isActive && (
															<p className='text-[10px] text-amber-700'>Inactive in ATLAS</p>
														)}
													</div>
												</Button>
											);
										})}
									</div>
								</div>
							))}
						</div>
					</ScrollArea>
				</PopoverContent>
			</Popover>

			{selectedCodes.length > 0 ? (
				<div className='flex flex-wrap gap-1'>
					{selectedCodes.map((code, index) => {
						const subject = subjects.find((item) => item.code === code);
						return (
							<Badge key={code} variant='secondary' className='h-6 gap-1 text-[10px]'>
								<span className='max-w-40 truncate'>
									{selectedLabels[index]} ({code})
								</span>
								<Button
									type='button'
									variant='ghost'
									size='icon'
									className='size-4 rounded-full'
									onClick={() => onChange(selectedCodes.filter((itemCode) => itemCode !== code))}
								>
									<X className='size-3' />
								</Button>
								{subject && !subject.isActive && <TriangleAlert className='size-3 text-amber-700' />}
							</Badge>
						);
					})}
				</div>
			) : (
				<p className='text-[11px] text-muted-foreground'>{NONE_LABEL}</p>
			)}

			{selectedInactiveCount > 0 && (
				<div className='flex items-start gap-1.5 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] text-red-700'>
					<TriangleAlert className='mt-0.5 size-3.5' />
					<span>
						One or more mapped learning areas are inactive and will not be used during generation.
					</span>
				</div>
			)}
		</div>
	);
}

export default function SpecializationMapping() {
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [subjects, setSubjects] = useState<Subject[]>([]);
	const [departments, setDepartments] = useState<SpecializationCatalogDepartment[]>([]);
	const [orphans, setOrphans] = useState<string[]>([]);
	const [selectionBySpecialization, setSelectionBySpecialization] = useState<Record<string, string[]>>({});
	const [initialSelectionBySpecialization, setInitialSelectionBySpecialization] = useState<Record<string, string[]>>({});
	const [pendingRouteExit, setPendingRouteExit] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const [showUnmappedOnly, setShowUnmappedOnly] = useState(false);

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
			const [catalogRes, subjectRes] = await Promise.all([
				atlasApi.get<SpecializationCatalogResponse>(`/faculty/specialization-catalog?schoolId=${DEFAULT_SCHOOL_ID}`),
				atlasApi.get<{ subjects: Subject[] }>(`/subjects?schoolId=${DEFAULT_SCHOOL_ID}`),
			]);

			setSubjects(subjectRes.data.subjects);
			setDepartments(catalogRes.data.departments);
			setOrphans(catalogRes.data.orphans);

			const nextSelectionMap: Record<string, string[]> = {};
			for (const department of catalogRes.data.departments) {
				for (const item of department.items) {
					nextSelectionMap[item.specialization] = item.mappedSubjectCodes;
				}
			}
			setSelectionBySpecialization(nextSelectionMap);
			setInitialSelectionBySpecialization(nextSelectionMap);
		} catch {
			toast.error('Unable to load specialization and subject mapping data.');
		} finally {
			setLoading(false);
		}
	};

	const handleSelectionChange = (specialization: string, subjectCodes: string[]) => {
		setSelectionBySpecialization((previous) => ({
			...previous,
			[specialization]: Array.from(new Set(subjectCodes)),
		}));
	};

	const saveAllChanges = async () => {
		if (!isDirty) {
			toast.info('No changes to save.');
			return;
		}

		setSaving(true);
		try {
			const specializationKeys = Array.from(
				new Set([
					...Object.keys(selectionBySpecialization),
					...Object.keys(initialSelectionBySpecialization),
				]),
			);

			const updates: BatchMappingPayload[] = [];

			for (const specialization of specializationKeys) {
				const selectedCodes = selectionBySpecialization[specialization] ?? [];
				const initialCodes = initialSelectionBySpecialization[specialization] ?? [];

				const selectedKey = JSON.stringify([...selectedCodes].sort());
				const initialKey = JSON.stringify([...initialCodes].sort());
				if (selectedKey === initialKey) {
					continue;
				}

				updates.push({
					alias: specialization,
					canonicalCodes: selectedCodes,
				});
			}

			if (updates.length === 0) {
				setInitialSelectionBySpecialization(selectionBySpecialization);
				toast.success('Mappings are already up to date.');
				return;
			}

			await atlasApi.post('/specialization-aliases/batch', {
				schoolId: DEFAULT_SCHOOL_ID,
				mappings: updates,
			});

			setInitialSelectionBySpecialization(selectionBySpecialization);
			void loadData();
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
			if (value.length > 0) {
				count += 1;
			}
		}
		return count;
	}, [selectionBySpecialization]);

	const totalSpecializations = useMemo(
		() => departments.reduce((sum, department) => sum + department.specializationCount, 0),
		[departments],
	);

	const filteredDepartments = useMemo(() => {
		const search = searchQuery.trim().toLowerCase();
		return departments
			.map((department) => {
				const items = department.items.filter((item) => {
					const selected = selectionBySpecialization[item.specialization] ?? [];
					const mapped = selected.length > 0;
					if (showUnmappedOnly && mapped) {
						return false;
					}

					if (!search) {
						return true;
					}

					const selectedCodes = selected.join(' ').toLowerCase();
					const selectedNames = selected
						.map((code) => subjects.find((subject) => subject.code === code)?.name || '')
						.join(' ')
						.toLowerCase();
					const haystack = `${item.specialization} ${department.departmentName} ${selectedCodes} ${selectedNames}`.toLowerCase();
					return haystack.includes(search);
				});

				return {
					...department,
					items,
					specializationCount: items.length,
				};
			})
			.filter((department) => department.items.length > 0);
	}, [departments, searchQuery, selectionBySpecialization, showUnmappedOnly, subjects]);

	const filteredSpecializationCount = useMemo(
		() => filteredDepartments.reduce((sum, department) => sum + department.items.length, 0),
		[filteredDepartments],
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
							Map each EnrollPro term to one or more ATLAS Learning Areas using suggested grouping and searchable selection.
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

			<div className='shrink-0 border-b bg-background px-6 py-2'>
				<div className='flex flex-wrap items-center gap-3'>
					<div className='relative min-w-55 flex-1 max-w-sm'>
						<Search className='absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground' />
						<Input
							value={searchQuery}
							onChange={(event) => setSearchQuery(event.target.value)}
							placeholder='Search EnrollPro terms'
							className='h-8 pl-7 text-xs'
						/>
					</div>
					<div className='flex items-center gap-2'>
						<Switch checked={showUnmappedOnly} onCheckedChange={setShowUnmappedOnly} />
						<Label className='text-xs font-medium'>Show Unmapped Only</Label>
					</div>
					<Badge variant='outline' className='font-semibold'>
						{filteredSpecializationCount} visible
					</Badge>
				</div>
			</div>

			<div className='shrink-0 px-6 py-2 border-b bg-background/70 flex items-center gap-3 text-xs'>
				<Badge variant='outline' className='font-semibold'>
					{filteredDepartments.length}/{departments.length} departments
				</Badge>
				<Badge variant='outline' className='font-semibold'>
					{mappedCount}/{totalSpecializations} terms mapped
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
					{filteredDepartments.map((department) => (
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
										const selected = selectionBySpecialization[item.specialization] ?? [];
										const selectedSubjects = selected
											.map((code) => subjects.find((subject) => subject.code === code))
											.filter((subject): subject is Subject => Boolean(subject));
										const selectedHasInactive = selectedSubjects.some((subject) => !subject.isActive);
										const statusTone = selected.length === 0 ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-emerald-100 text-emerald-800 border-emerald-200';
										return (
											<Card key={item.specialization} className='border-muted/80'>
												<CardContent className='p-4 space-y-3'>
													<div className='space-y-1'>
														<p className='text-sm font-semibold leading-tight'>{item.specialization}</p>
														<Badge className={`h-5 text-[10px] font-semibold border ${statusTone}`}>
															{selected.length === 0 ? 'Needs mapping' : 'Mapped'}
														</Badge>
													</div>
													<div className='space-y-1'>
														<div className='flex items-center gap-1'>
															<Label className='text-[11px] font-semibold'>ATLAS Learning Area</Label>
															<TooltipProvider>
																<Tooltip>
																	<TooltipTrigger asChild>
																		<Button variant='ghost' size='icon' className='size-4'>
																			<TriangleAlert className='size-3 text-muted-foreground' />
																		</Button>
																	</TooltipTrigger>
																	<TooltipContent>
																		Inactive mappings will not be used during generation.
																	</TooltipContent>
																</Tooltip>
															</TooltipProvider>
														</div>
														<MappingMultiSelect
															departmentName={department.departmentName}
															selectedCodes={selected}
															subjects={subjects}
															onChange={(values) => handleSelectionChange(item.specialization, values)}
														/>
													</div>
													{item.mappedSubjects.length > 0 && (
														<div className='text-[11px] text-muted-foreground'>
															Current: {item.mappedSubjects.map((entry) => `${entry.name} (${entry.code})`).join(', ')}
														</div>
													)}
													{selectedHasInactive && (
														<div className='text-[11px] text-red-700 flex items-center gap-1'>
															<TriangleAlert className='size-3.5' />
															Contains inactive learning area
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
					{filteredDepartments.length === 0 && (
						<Card>
							<CardContent className='py-10 text-center text-sm text-muted-foreground'>
								No specialization terms match your current filters.
							</CardContent>
						</Card>
					)}
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
