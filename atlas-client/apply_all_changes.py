import sys
from pathlib import Path

path = Path("src/pages/FacultyAssignments.tsx")
code = path.read_text("utf-8")

def replace_strict(old_str, new_str, label):
    global code
    if old_str not in code:
        print(f"FAILED to find {label}")
        print("Expected:\n", old_str)
        sys.exit(1)
    code = code.replace(old_str, new_str)
    print(f"SUCCESS {label}")

replace_strict(
"""	RotateCcw,
	Save,
	Search,
	ShieldAlert,
	UserCog,
} from 'lucide-react';""",
"""	RotateCcw,
	Save,
	Search,
	ShieldAlert,
	Star,
	Pencil,
	UserCog,
} from 'lucide-react';""",
"Imports"
)

replace_strict(
"""	const [sectionFilter, setSectionFilter] = useState<'all' | 'unassigned' | 'assigned'>('all');
	const [allowOutsideDepartment, setAllowOutsideDepartment] = useState(false);""",
"""	const [sectionFilter, setSectionFilter] = useState<'all' | 'unassigned' | 'assigned'>('all');
	const [gradeLevelFilter, setGradeLevelFilter] = useState<string>('all');
	const [allowOutsideDepartment, setAllowOutsideDepartment] = useState(false);""",
"State declaration"
)

old_ribbon = """			{pendingEntries.length > 0 && (
				<div className="mt-1.5 flex items-center gap-2 rounded border border-sky-200 bg-sky-50/60 px-3 py-1.5">
					<Badge className="shrink-0 border-sky-300 bg-white text-[0.5625rem] text-sky-700">{pendingEntries.length} pending</Badge>
					<span className="shrink-0 text-xs font-semibold text-sky-800">Ownership transfers:</span>
					<div className="flex flex-1 items-center gap-1 overflow-x-auto">
						{pendingEntries.map((e) => (
							<Badge key={e.key} variant="outline" className="shrink-0 whitespace-nowrap border-sky-200 bg-white px-1.5 py-0 text-[0.5625rem] text-sky-800">
								{e.facultyName} | {e.subjectCode} | G{e.gradeLevel} {e.sectionName}
							</Badge>
						))}
					</div>
				</div>
			)}"""
replace_strict(old_ribbon, "", "Pending Ribbon")

old_toolbar = """					<Input
						placeholder="Search subjects or sections..."
						value={subjectSearch}
						onChange={(event) => setSubjectSearch(event.target.value)}
						className="h-7 pl-8 text-xs"
					/>
				</div>
				<Select value={sectionFilter} onValueChange={(v) => setSectionFilter(v as 'all' | 'unassigned' | 'assigned')}>"""
new_toolbar = """					<Input
						placeholder="Search subjects or sections..."
						value={subjectSearch}
						onChange={(event) => setSubjectSearch(event.target.value)}
						className="h-7 pl-8 text-xs"
					/>
				</div>
				<Select value={gradeLevelFilter} onValueChange={setGradeLevelFilter}>
					<SelectTrigger className="h-7 w-28 text-xs">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all" className="text-xs">All Grades</SelectItem>
						<SelectItem value="7" className="text-xs">Grade 7</SelectItem>
						<SelectItem value="8" className="text-xs">Grade 8</SelectItem>
						<SelectItem value="9" className="text-xs">Grade 9</SelectItem>
						<SelectItem value="10" className="text-xs">Grade 10</SelectItem>
					</SelectContent>
				</Select>
				<Select value={sectionFilter} onValueChange={(v) => setSectionFilter(v as 'all' | 'unassigned' | 'assigned')}>"""
replace_strict(old_toolbar, new_toolbar, "Toolbar Selects")

replace_strict(
"""	sectionFilter?: 'all' | 'unassigned' | 'assigned';
};""",
"""	sectionFilter?: 'all' | 'unassigned' | 'assigned';
	gradeLevelFilter?: string;
	advisedSectionId?: number | null;
};""",
"SubjectRowProps"
)

replace_strict(
"""	searchTerm = '',
	sectionFilter = 'all',
}: SubjectRowProps) {""",
"""	searchTerm = '',
	sectionFilter = 'all',
	gradeLevelFilter = 'all',
	advisedSectionId = null,
}: SubjectRowProps) {""",
"SubjectRow signature"
)

old_displaySections = """		if (searchTerm) {
			const term = searchTerm.toLowerCase();
			if (subject.name.toLowerCase().includes(term) || subject.code.toLowerCase().includes(term)) {
				// subject matches
			} else {
				// strict filter sections
				result = result.filter(sec => sec.name.toLowerCase().includes(term) || `g${sec.displayOrder}`.includes(term));
			}
		}

		return result;
	}, [sections, sectionFilter, searchTerm, subject, savedOwnershipMap, pendingOwnershipMap]);"""
new_displaySections = """		if (gradeLevelFilter !== 'all') {
			result = result.filter((sec) => String(sec.displayOrder) === gradeLevelFilter);
		}

		if (searchTerm) {
			const term = searchTerm.toLowerCase();
			if (subject.name.toLowerCase().includes(term) || subject.code.toLowerCase().includes(term)) {
				// subject matches
			} else {
				// strict filter sections
				result = result.filter(sec => sec.name.toLowerCase().includes(term) || `g${sec.displayOrder}`.includes(term));
			}
		}

		return result;
	}, [sections, sectionFilter, gradeLevelFilter, searchTerm, subject, savedOwnershipMap, pendingOwnershipMap]);"""
replace_strict(old_displaySections, new_displaySections, "displaySections Logic")

replace_strict(
"""											searchTerm={subjectSearch}
											sectionFilter={sectionFilter}
										/>""",
"""											searchTerm={subjectSearch}
											sectionFilter={sectionFilter}
											gradeLevelFilter={gradeLevelFilter}
											advisedSectionId={homeroomHint?.advisedSectionId ?? null}
										/>""",
"SubjectRow injections 1"
)

replace_strict(
"""											sectionFilter={sectionFilter}
											isOutsideDepartment
										/>""",
"""											sectionFilter={sectionFilter}
											isOutsideDepartment
											gradeLevelFilter={gradeLevelFilter}
											advisedSectionId={homeroomHint?.advisedSectionId ?? null}
										/>""",
"SubjectRow injections 2"
)

replace_strict(
"""								<p className="truncate text-sm font-medium">
									{member.lastName}, {member.firstName}
								</p>""",
"""								<p className="truncate flex items-center gap-1.5 text-sm font-medium">
									{member.isClassAdviser && <Star className="size-3 shrink-0 flex-none fill-amber-400 text-amber-400" aria-label="Class Adviser" />}
									{member.lastName}, {member.firstName}
								</p>""",
"Faculty list star"
)

replace_strict(
"""										{selected.department ?? 'No department'} | ID: {selected.externalId}
									</p>
								</div>
								{!selected.isActiveForScheduling && <Badge variant="secondary">Excluded</Badge>}""",
"""										{selected.department ?? 'No department'} | ID: {selected.externalId}
									</p>
								</div>
								{selected.isClassAdviser && (
									<Badge variant="outline" className="border-amber-200 bg-amber-50 text-[0.5625rem] text-amber-700">
										<Star className="mr-1 size-2.5 fill-amber-500 text-amber-500" /> Class Adviser
									</Badge>
								)}
								{!selected.isActiveForScheduling && <Badge variant="secondary">Excluded</Badge>}""",
"Header star"
)

replace_strict(
"""<div key={gradeLevel} className={`overflow-hidden rounded-md border ${GRADE_COLORS[String(gradeLevel)] ? GRADE_COLORS[String(gradeLevel)].replace("bg-", "border-").replace("/80", "/30").replace(" text-", " ") : "border-border/70"}`}>""",
"""<div key={gradeLevel} className={`overflow-hidden rounded-md border ${GRADE_COLORS[String(gradeLevel)] ? GRADE_COLORS[String(gradeLevel)].replace("/80", "/20").replace(" text-", " ") : "border-border/70 bg-background"}`}>""",
"Accordion Header Border"
)

replace_strict(
"""className={`h-auto w-full justify-between rounded-none px-3 py-2 ${GRADE_COLORS[String(gradeLevel)] ? GRADE_COLORS[String(gradeLevel)].replace("/80", "/20") : "bg-background"}`}>""",
"""className={`h-auto w-full justify-between rounded-none px-3 py-2 ${GRADE_COLORS[String(gradeLevel)] ? GRADE_COLORS[String(gradeLevel)].replace("/80", "/10") : "bg-transparent"}`}>""",
"Accordion Header Button"
)

replace_strict(
"""		const other: Subject[] = [];
		for (const subject of subjects) {
			if (matchesFacultyDepartment(department, subject.code, subject.name)) {
				primary.push(subject);
			} else {
				other.push(subject);
			}
		}
		return { primarySubjects: primary, otherSubjects: other };""",
"""		const other: Subject[] = [];
		for (const subject of subjects) {
			if (matchesFacultyDepartment(department, subject.code, subject.name)) {
				primary.push(subject);
			} else {
				other.push(subject);
			}
		}
		primary.sort((a, b) => {
			const aIsHomeroom = a.code.toLowerCase().includes('homeroom') || a.name.toLowerCase().includes('homeroom');
			const bIsHomeroom = b.code.toLowerCase().includes('homeroom') || b.name.toLowerCase().includes('homeroom');
			if (aIsHomeroom && !bIsHomeroom) return 1;
			if (!aIsHomeroom && bIsHomeroom) return -1;
			return a.name.localeCompare(b.name);
		});
		other.sort((a, b) => a.name.localeCompare(b.name));
		return { primarySubjects: primary, otherSubjects: other };""",
"Subject sort logic"
)

replace_strict(
"""	const filterBySubjectSearch = useCallback(
		(subjectList: Subject[]) => {
			if (!subjectSearch.trim()) {
				return subjectList;
			}
			const normalizedQuery = subjectSearch.toLowerCase();
			return subjectList.filter(
				(subject) => subject.name.toLowerCase().includes(normalizedQuery) || subject.code.toLowerCase().includes(normalizedQuery),
			);
		},
		[subjectSearch],
	);""",
"""	const filterBySubjectSearch = useCallback(
		(subjectList: Subject[]) => {
			if (!subjectSearch.trim()) {
				return subjectList;
			}
			const normalizedQuery = subjectSearch.toLowerCase();
			const anySubjectMatches = subjectList.some(
				(subject) => subject.name.toLowerCase().includes(normalizedQuery) || subject.code.toLowerCase().includes(normalizedQuery),
			);
			if (!anySubjectMatches) {
				return subjectList;
			}
			return subjectList.filter(
				(subject) => subject.name.toLowerCase().includes(normalizedQuery) || subject.code.toLowerCase().includes(normalizedQuery),
			);
		},
		[subjectSearch],
	);""",
"Omnisearch subject filter anySubjectMatches logic"
)

old_tile_internals = """											const badgeLabel = isPendingOther
												? `Pending: ${pendingOwner?.facultyName}`
												: isSavedOther
												? `Saved: ${savedOwner?.facultyName}`
												: isPendingCurrent
												? 'Pending'
												: isSavedCurrent
												? 'Saved'
												: null;
											return (
												<div
													key={section.id}
													className={`flex flex-col gap-1.5 rounded-md border p-2 transition-colors ${
														blocked ? 'cursor-not-allowed border-red-200 bg-red-50/50 opacity-70' : isSelected ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/20' : 'border-border/60 hover:bg-muted/30'
													}`}
												>
													<div className="flex items-start gap-1.5">
														<Checkbox checked={isSelected} onCheckedChange={() => toggleSection(section.id)} disabled={disabled || blocked} className="mt-0.5 shrink-0" />
														<div className="min-w-0 flex-1">
															<span className={`mb-0.5 inline-block rounded px-1 py-0 text-[0.5rem] font-bold uppercase leading-tight tracking-wider ${GRADE_COLORS[String(section.displayOrder)] ?? 'bg-muted text-muted-foreground'}`}>
																G{section.displayOrder}
															</span>
															<p className="truncate text-xs font-semibold leading-tight">{section.name}</p>
															{section.programCode && section.programCode !== 'REGULAR' && (
																<p className="truncate text-[0.6rem] text-muted-foreground">{section.programCode}</p>
															)}
														</div>
													</div>
													<div className="flex items-center gap-1.5 pl-5">
														{badgeLabel && (
															<Tooltip>
																<TooltipTrigger asChild>
																	<Badge
																		variant="outline"
																		className={`text-[0.5625rem] ${
																			isPendingOther
																				? 'border-red-200 text-red-700'
																				: isSavedOther
																				? 'border-amber-200 text-amber-700'
																				: isPendingCurrent
																				? 'border-sky-200 text-sky-700'
																				: 'border-emerald-200 text-emerald-700'
																		}`}
																	>
																		{badgeLabel}
																	</Badge>
																</TooltipTrigger>
																<TooltipContent side="top" className="max-w-xs text-xs">
																	{isPendingOther && <p>{pendingOwner?.facultyName} has this subject-section pair in an unsaved session draft.</p>}
																	{isSavedOther && <p>{savedOwner?.facultyName} already owns this subject-section pair in saved data.</p>}
																	{isPendingCurrent && <p>This selection is pending in the current session and has not been saved yet.</p>}
																	{isSavedCurrent && !isPendingCurrent && <p>This subject-section pair is already saved for the selected teacher.</p>}
																</TooltipContent>
															</Tooltip>
														)}
													</div>
												</div>
											);"""
new_tile_internals = """											const badgeProps = isPendingOther
												? { text: pendingOwner?.facultyName, mode: 'pending' }
												: isSavedOther
												? { text: savedOwner?.facultyName, mode: 'saved' }
												: isPendingCurrent
												? { text: 'Pending Request', mode: 'pending' }
												: isSavedCurrent
												? { text: 'Saved', mode: 'saved' }
												: null;
											
											const gradeTint = section.displayOrder === 7 ? 'bg-green-50/70 hover:bg-green-100/50' : section.displayOrder === 8 ? 'bg-yellow-50/70 hover:bg-yellow-100/50' : section.displayOrder === 9 ? 'bg-red-50/70 hover:bg-red-100/50' : section.displayOrder === 10 ? 'bg-blue-50/70 hover:bg-blue-100/50' : 'bg-muted/30 hover:bg-muted/50';
											const borderState = blocked ? 'cursor-not-allowed border-red-300 opacity-70' : isSelected ? 'border-primary ring-1 ring-primary/40 text-primary-foreground' : 'border-border/60 hover:border-foreground/20';

											return (
												<div
													key={section.id}
													className={`flex flex-col gap-1.5 rounded-md border p-2 transition-colors ${gradeTint} ${borderState}`}
												>
													<div className="flex items-start gap-1.5">
														<Checkbox checked={isSelected} onCheckedChange={() => toggleSection(section.id)} disabled={disabled || blocked} className={`mt-0.5 shrink-0 ${isSelected ? '' : 'bg-white'}`} />
														<div className="min-w-0 flex-1 flex flex-col gap-0.5">
															<div className="min-w-0">
																<p className="text-[0.6875rem] font-semibold leading-tight break-words flex items-center gap-1.5">
																	{advisedSectionId === section.id && (
																		<Star className="size-3.5 fill-amber-500 text-amber-500 shrink-0" aria-label="Adviser" />
																	)}
																	{section.name}
																</p>
																{section.programCode && section.programCode !== 'REGULAR' && (
																	<p className="text-[0.5625rem] text-muted-foreground break-words mt-[2px]">{section.programCode}</p>
																)}
															</div>
															
															{badgeProps && (
																<div className="flex flex-wrap items-center gap-1 mt-0.5">
																	<Tooltip>
																		<TooltipTrigger asChild>
																			<Badge
																				variant="outline"
																				className={`px-1.5 py-0.5 text-[0.6875rem] font-medium tracking-tight leading-tight flex items-center gap-1.5 max-w-full truncate shadow-sm ${
																					badgeProps.mode === 'pending'
																						? 'border-amber-300 bg-amber-50 text-amber-800 ring-1 ring-amber-400/20'
																						: 'border-emerald-300 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-400/20'
																				}`}
																			>
																				{badgeProps.mode === 'pending' ? <Pencil className="size-3 shrink-0" /> : <CheckCircle2 className="size-3 shrink-0" />}
																				<span className="truncate">{badgeProps.text}</span>
																			</Badge>
																		</TooltipTrigger>
																		<TooltipContent side="top" className="max-w-xs text-xs">
																			{isPendingOther && <p>{pendingOwner?.facultyName} has this subject-section pair in an unsaved session draft.</p>}
																			{isSavedOther && <p>{savedOwner?.facultyName} already owns this subject-section pair in saved data.</p>}
																			{isPendingCurrent && <p>This selection is pending in the current session and has not been saved yet.</p>}
																			{isSavedCurrent && !isPendingCurrent && <p>This subject-section pair is already saved for the selected teacher.</p>}
																		</TooltipContent>
																	</Tooltip>
																</div>
															)}
														</div>
													</div>
												</div>
											);"""
replace_strict(old_tile_internals, new_tile_internals, "Tile internals")

path.write_text(code, encoding='utf-8')
print("✅ Fully applied all code replacements safely!")
