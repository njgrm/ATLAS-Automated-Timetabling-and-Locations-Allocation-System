import { useEffect, useMemo, useRef, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { CheckCircle2, ChevronDown, LayoutGrid, LayoutList, Loader2, RefreshCw, Save, Search, Sparkles, Wand2, X } from 'lucide-react';
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

const DEFAULT_SCHOOL_ID = 1;
const NONE_LABEL = 'No Subject selected';

type MappingOption = {
	code: string;
	name: string;
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
	specializationName: string,
	query: string,
): MappingGroup[] {
	const normalizedSpec = normalizeTerm(specializationName);
	const queryValue = normalizeTerm(query);

	const visibleSubjects = subjectList
		.filter((subject) => subject.isActive)
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
				groupLabel: firstScope,
			};
		});

	const specTokens = new Set(termTokens(normalizedSpec));
	const isSuggested = (option: MappingOption) => {
		const optionName = normalizeTerm(`${option.name} ${option.code}`);
		const optionTokens = new Set(termTokens(optionName));
		// Token exact match
		for (const token of specTokens) {
			if (optionTokens.has(token)) return true;
		}
		// Substring: spec token appears inside option name/code
		for (const token of specTokens) {
			if (token.length >= 3 && optionName.includes(token)) return true;
		}
		// Substring: option token appears inside spec
		for (const token of optionTokens) {
			if (token.length >= 3 && normalizedSpec.includes(token)) return true;
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
	specializationName: string;
	selectedCodes: string[];
	subjects: Subject[];
	onChange: (nextCodes: string[]) => void;
};

function MappingMultiSelect({
	specializationName,
	selectedCodes,
	subjects,
	onChange,
}: MappingMultiSelectProps) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState('');
	const inputRef = useRef<HTMLInputElement>(null);

	const groups = useMemo(
		() => buildGroupedOptions(subjects, specializationName, query),
		[subjects, specializationName, query],
	);

	const selectedLabels = useMemo(() => {
		const lookup = new Map(subjects.map((subject) => [subject.code, subject.name]));
		return selectedCodes.map((code) => lookup.get(code) || code);
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
														const next = checked
															? selectedCodes.filter((code) => code !== item.code)
															: [...selectedCodes, item.code];
														onChange(next);
													}}
												>
													<Checkbox checked={checked} />
													<p className='truncate font-medium'>
														{item.name} ({item.code})
													</p>
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
				{selectedCodes.map((code, index) => (
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
					</Badge>
				))}
			</div>
		) : (
			<p className='text-[11px] text-muted-foreground'>{NONE_LABEL}</p>
		)}
	</div>
	);
}

function findAutoMapMatch(specialization: string, subjects: Subject[]): Subject | null {
	const normalizedSpec = normalizeTerm(specialization);
	const activeSubjects = subjects.filter((s) => s.isActive);
	const exact = activeSubjects.find((s) => normalizeTerm(s.code) === normalizedSpec);
	if (exact) return exact;
	const exactName = activeSubjects.find((s) => normalizeTerm(s.name) === normalizedSpec);
	if (exactName) return exactName;
	const loose = activeSubjects.find((s) => {
		const nc = normalizeTerm(`${s.name} ${s.code}`);
		return nc.includes(normalizedSpec) || normalizedSpec.includes(normalizeTerm(s.code));
	});
	return loose ?? null;
}

export default function SpecializationMapping() {
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [subjects, setSubjects] = useState<Subject[]>([]);
	const [departments, setDepartments] = useState<SpecializationCatalogDepartment[]>([]);
	const [selectionBySpecialization, setSelectionBySpecialization] = useState<Record<string, string[]>>({});
	const [initialSelectionBySpecialization, setInitialSelectionBySpecialization] = useState<Record<string, string[]>>({});
	const [pendingRouteExit, setPendingRouteExit] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const [showUnmappedOnly, setShowUnmappedOnly] = useState(false);
	const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
	const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
	const [bulkMapOpen, setBulkMapOpen] = useState(false);
	const [bulkMapCodes, setBulkMapCodes] = useState<string[]>([]);
	const [bulkMapQuery, setBulkMapQuery] = useState('');
	const bulkMapInputRef = useRef<HTMLInputElement>(null);

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

	const enrichWithModularSiblings = (codes: string[]): string[] => {
		const result = new Set(codes);
		const activeSubjects = subjects.filter((s) => s.isActive);
		for (const code of codes) {
			const subject = activeSubjects.find((s) => s.code === code);
			if (subject?.modularGroupId) {
				for (const sibling of activeSubjects) {
					if (sibling.modularGroupId === subject.modularGroupId) {
						result.add(sibling.code);
					}
				}
			}
		}
		return Array.from(result);
	};

	const handleSelectionChange = (specialization: string, subjectCodes: string[]) => {
		const enriched = enrichWithModularSiblings(subjectCodes);
		setSelectionBySpecialization((previous) => ({
			...previous,
			[specialization]: Array.from(new Set(enriched)),
		}));
	};

	const applyAutoMap = (specialization: string) => {
		const match = findAutoMapMatch(specialization, subjects);
		if (!match) return;
		handleSelectionChange(specialization, [match.code]);
		toast.success(`Auto-mapped "${specialization}" → ${match.name}`);
	};

	const applyBulkMap = () => {
		if (selectedRows.size === 0 || bulkMapCodes.length === 0) return;
		for (const spec of selectedRows) {
			handleSelectionChange(spec, bulkMapCodes);
		}
		toast.success(`Mapped ${selectedRows.size} specialization(s) to ${bulkMapCodes.length} subject(s).`);
		setSelectedRows(new Set());
		setBulkMapOpen(false);
		setBulkMapCodes([]);
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

	const mappedPercent = totalSpecializations > 0 ? Math.round((mappedCount / totalSpecializations) * 100) : 0;

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

	const flatItems = useMemo(
		() =>
			filteredDepartments.flatMap((d) =>
				d.items.map((item) => ({ ...item, departmentName: d.departmentName })),
			),
		[filteredDepartments],
	);

	const bulkSubjectOptions = useMemo(() => {
		const q = normalizeTerm(bulkMapQuery);
		return subjects
			.filter((s) => s.isActive)
			.filter((s) => {
				if (!q) return true;
				return normalizeTerm(`${s.name} ${s.code}`).includes(q);
			});
	}, [subjects, bulkMapQuery]);

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
					<div className='space-y-1 flex-1 min-w-0'>
						<div className='flex items-center gap-2'>
							<Sparkles className='size-4 text-primary' />
							<h1 className='text-lg font-bold tracking-tight'>Specialization to Subject Mapping</h1>
						</div>
						<p className='text-xs text-muted-foreground'>
							Map each teacher specialization to one or more subjects for use in schedule generation.
						</p>
						<div className='flex items-center gap-2 pt-1'>
							<div className='flex-1 max-w-xs h-1.5 rounded-full bg-muted overflow-hidden'>
								<div
									className='h-full rounded-full bg-primary transition-all'
									style={{ width: `${mappedPercent}%` }}
								/>
							</div>
							<span className='text-[11px] text-muted-foreground'>
								{mappedCount}/{totalSpecializations} mapped ({mappedPercent}%)
							</span>
						</div>
					</div>
					<div className='flex items-center gap-2'>
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
				placeholder='Search specializations...'
							className='h-8 pl-7 text-xs'
						/>
					</div>
					<div className='flex items-center gap-2'>
						<Switch checked={showUnmappedOnly} onCheckedChange={setShowUnmappedOnly} />
						<Label className='text-xs font-medium'>Show Unmapped Only</Label>
					</div>
					<Badge variant='outline' className='font-semibold'>
						{filteredSpecializationCount} visible
					</Badge>				<div className='flex items-center gap-0.5 rounded-md border p-0.5'>
					<Button
						variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
						size='icon'
						className='size-6'
						onClick={() => setViewMode('grid')}
						title='Grid view'
					>
						<LayoutGrid className='size-3.5' />
					</Button>
					<Button
						variant={viewMode === 'list' ? 'secondary' : 'ghost'}
						size='icon'
						className='size-6'
						onClick={() => {
							setViewMode('list');
							setSelectedRows(new Set());
						}}
						title='List view'
					>
						<LayoutList className='size-3.5' />
					</Button>
				</div>
				{viewMode === 'list' && selectedRows.size > 0 && (
					<Button
						size='sm'
						variant='secondary'
						className='h-7 gap-1.5 text-xs'
						onClick={() => {
							setBulkMapOpen(true);
							setBulkMapCodes([]);
							setBulkMapQuery('');
						}}
					>
						<CheckCircle2 className='size-3.5' />
						Map {selectedRows.size} Selected
					</Button>
				)}				</div>
			</div>

			<div className='shrink-0 px-6 py-2 border-b bg-background/70 flex items-center gap-3 text-xs'>
				<Badge variant='outline' className='font-semibold'>
					{filteredDepartments.length}/{departments.length} departments
				</Badge>
				<Badge variant='outline' className='font-semibold'>
				{mappedCount}/{totalSpecializations} mapped
			</Badge>
			</div>

			<ScrollArea className='flex-1 min-h-0'>
			{viewMode === 'grid' ? (
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
										const statusTone = selected.length === 0 ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-emerald-100 text-emerald-800 border-emerald-200';
										const autoMatch = selected.length === 0 ? findAutoMapMatch(item.specialization, subjects) : null;
										return (
											<Card key={item.specialization} className='border-muted/80'>
												<CardContent className='p-4 space-y-3'>
													<div className='flex items-start justify-between gap-2'>
														<div className='space-y-1 min-w-0'>
															<p className='text-sm font-semibold leading-tight truncate'>{item.specialization}</p>
															<Badge className={`h-5 text-[10px] font-semibold border ${statusTone}`}>
																{selected.length === 0 ? 'Needs mapping' : 'Mapped'}
															</Badge>
														</div>
														{autoMatch && (
															<Button
																type='button'
																variant='ghost'
																size='icon'
																className='size-7 shrink-0'
																title={`Auto-map → ${autoMatch.name}`}
																onClick={() => applyAutoMap(item.specialization)}
															>
																<Wand2 className='size-3.5 text-primary' />
															</Button>
														)}
													</div>
													<div className='space-y-1'>
													<Label className='text-[11px] font-semibold'>Subject</Label>
														<MappingMultiSelect
															specializationName={item.specialization}
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
		) : (
			/* ── LIST VIEW ── */
			<div className='p-4'>
				<table className='w-full text-xs border-collapse'>
					<thead>
						<tr className='border-b bg-muted/40'>
							<th className='w-8 px-2 py-2 text-left'>
								<Checkbox
									checked={selectedRows.size > 0 && selectedRows.size === flatItems.length}
									onCheckedChange={(checked) => {
										if (checked) {
											setSelectedRows(new Set(flatItems.map((i) => i.specialization)));
										} else {
											setSelectedRows(new Set());
										}
									}}
								/>
							</th>
							<th className='px-3 py-2 text-left font-semibold text-muted-foreground'>Specialization</th>
							<th className='px-3 py-2 text-left font-semibold text-muted-foreground'>Department</th>
							<th className='px-3 py-2 text-left font-semibold text-muted-foreground'>Mapped Subjects</th>
							<th className='w-24 px-3 py-2 text-left font-semibold text-muted-foreground'>Status</th>
							<th className='w-10 px-2 py-2' />
						</tr>
					</thead>
					<tbody>
						{flatItems.map((item) => {
							const selected = selectionBySpecialization[item.specialization] ?? [];
							const isChecked = selectedRows.has(item.specialization);
							const statusTone =
								selected.length === 0
									? 'bg-amber-100 text-amber-800 border-amber-200'
									: 'bg-emerald-100 text-emerald-800 border-emerald-200';
							const autoMatch = selected.length === 0 ? findAutoMapMatch(item.specialization, subjects) : null;
							return (
								<tr
									key={item.specialization}
									className={`border-b transition-colors hover:bg-muted/30 ${isChecked ? 'bg-primary/5' : ''}`}
								>
									<td className='px-2 py-2'>
										<Checkbox
											checked={isChecked}
											onCheckedChange={(checked) => {
												const next = new Set(selectedRows);
												if (checked) next.add(item.specialization);
												else next.delete(item.specialization);
												setSelectedRows(next);
											}}
										/>
									</td>
									<td className='px-3 py-2 font-medium'>{item.specialization}</td>
									<td className='px-3 py-2 text-muted-foreground'>{item.departmentName}</td>
									<td className='px-3 py-2'>
										{selected.length === 0 ? (
											<span className='text-muted-foreground italic'>—</span>
										) : (
											<div className='flex flex-wrap gap-1'>
												{selected.map((code) => {
													const subj = subjects.find((s) => s.code === code);
													return (
														<Badge key={code} variant='secondary' className='h-5 gap-1 text-[10px]'>
															{subj?.name ?? code}
															<Button
																type='button'
																variant='ghost'
																size='icon'
																className='size-3.5 rounded-full'
																onClick={() =>
																	handleSelectionChange(
																		item.specialization,
																		selected.filter((c) => c !== code),
																	)
																}
															>
																<X className='size-2.5' />
															</Button>
														</Badge>
													);
												})}
											</div>
										)}
									</td>
									<td className='px-3 py-2'>
										<Badge className={`h-5 text-[10px] font-semibold border ${statusTone}`}>
											{selected.length === 0 ? 'Unmapped' : 'Mapped'}
										</Badge>
									</td>
									<td className='px-2 py-2 text-right'>
										{autoMatch && (
											<Button
												type='button'
												variant='ghost'
												size='icon'
												className='size-6'
												title={`Auto-map → ${autoMatch.name}`}
												onClick={() => applyAutoMap(item.specialization)}
											>
												<Wand2 className='size-3 text-primary' />
											</Button>
										)}
									</td>
								</tr>
							);
						})}
						{flatItems.length === 0 && (
							<tr>
								<td colSpan={6} className='py-10 text-center text-muted-foreground'>
									No specialization terms match your current filters.
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
		)}
		</ScrollArea>

		{/* Bulk Map Dialog */}
		<Dialog open={bulkMapOpen} onOpenChange={setBulkMapOpen}>
			<DialogContent className='max-w-md'>
				<DialogHeader>
					<DialogTitle>Map {selectedRows.size} Specialization(s)</DialogTitle>
					<DialogDescription>
						Select subjects to assign to all {selectedRows.size} selected specialization(s). This replaces their current mappings.
					</DialogDescription>
				</DialogHeader>
					<div className='space-y-3'>
						<div className='flex items-center gap-2 rounded-md border px-2'>
							<Search className='size-3.5 text-muted-foreground' />
							<Input
								ref={bulkMapInputRef}
								value={bulkMapQuery}
								onChange={(e) => setBulkMapQuery(e.target.value)}
								placeholder='Search subjects...'
								className='h-7 border-0 px-0 text-xs shadow-none focus-visible:ring-0'
							/>
						</div>
						<ScrollArea className='max-h-64 rounded-md border'>
							<div className='p-2 space-y-1'>
								{bulkSubjectOptions.map((subj) => {
									const checked = bulkMapCodes.includes(subj.code);
									return (
										<Button
											key={subj.code}
											type='button'
											variant='ghost'
											className='h-auto w-full justify-start gap-2 rounded-md px-2 py-1.5 text-left text-xs'
											onClick={() => {
												setBulkMapCodes(
													checked
														? bulkMapCodes.filter((c) => c !== subj.code)
														: [...bulkMapCodes, subj.code],
												);
											}}
										>
											<Checkbox checked={checked} />
											<span className='truncate'>{subj.name} ({subj.code})</span>
										</Button>
									);
								})}
							</div>
						</ScrollArea>
						{bulkMapCodes.length > 0 && (
							<div className='flex flex-wrap gap-1'>
								{bulkMapCodes.map((code) => {
									const subj = subjects.find((s) => s.code === code);
									return (
										<Badge key={code} variant='secondary' className='h-5 text-[10px] gap-1'>
											{subj?.name ?? code}
											<Button
												type='button'
												variant='ghost'
												size='icon'
												className='size-3.5 rounded-full'
												onClick={() => setBulkMapCodes(bulkMapCodes.filter((c) => c !== code))}
											>
												<X className='size-2.5' />
											</Button>
										</Badge>
									);
								})}
							</div>
						)}
					</div>
					<DialogFooter>
						<Button variant='outline' onClick={() => setBulkMapOpen(false)}>Cancel</Button>
						<Button disabled={bulkMapCodes.length === 0} onClick={applyBulkMap}>
							Apply to {selectedRows.size} Specialization(s)
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

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
