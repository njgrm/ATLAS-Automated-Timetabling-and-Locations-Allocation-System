import sys
from pathlib import Path

path = Path('src/pages/FacultyAssignments.tsx')
code = path.read_text(encoding='utf-8')

def rep(old, new, label):
    global code
    if old in code:
        code = code.replace(old, new)
        print(f"OK {label}")
    else:
        print(f"FAIL {label}")
        sys.exit(1)

# 1. Imports
rep(
    "ShieldAlert,\n\tUserCog,\n} from 'lucide-react';",
    "ShieldAlert,\n\tUserCog,\n\tStar,\n\tPencil,\n} from 'lucide-react';",
    "Imports"
)

# 2. Main Page State
rep(
    "\tconst [sectionFilter, setSectionFilter] = useState<'all' | 'unassigned' | 'assigned'>('all');\n\tconst [selectedFacultyId, setSelectedFacultyId] = useState<number | null>(null);",
    "\tconst [sectionFilter, setSectionFilter] = useState<'all' | 'unassigned' | 'assigned'>('all');\n\tconst [gradeLevelFilter, setGradeLevelFilter] = useState<string>('all');\n\tconst [selectedFacultyId, setSelectedFacultyId] = useState<number | null>(null);",
    "State"
)

# 3. Removes active ownership transfer banner ribbon logic - actually just delete the ribbon
old_ribbon = """							{Object.keys(pendingOwnershipMap).length > 0 && selectedFacultyId !== null && (
								<div className="flex shrink-0 items-center gap-2 overflow-x-auto whitespace-nowrap rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
									<RotateCcw className="size-3.5 shrink-0" />
									<span>Session Pending Ownership:</span>
									<div className="flex items-center gap-1.5">
										{Object.entries(pendingOwnershipMap)
											.slice(0, 15)
											.map(([key, info]) => {
												const [subjectId, sectionId] = key.split(':');
												const subject = subjects.find((s) => s.id === Number(subjectId));
												const section = sectionMap[Number(sectionId)];
												if (!subject || !section) return null;
												return (
													<Badge key={key} variant="secondary" className="border-amber-200 bg-amber-100/50 px-1 py-0 text-[0.6rem] text-amber-800">
														{info.facultyId === selectedFacultyId ? 'Saving: ' : 'From '}
														{info.facultyName} - {subject.code} G{section.displayOrder}
													</Badge>
												);
											})}
										{Object.keys(pendingOwnershipMap).length > 15 && <span className="text-[0.6rem] text-muted-foreground">+{Object.keys(pendingOwnershipMap).length - 15} more</span>}
									</div>
								</div>
							)}"""
rep(old_ribbon, "", "Pending Ribbon")

# 4. Toolbar Selects
old_toolbar = """								<div className="flex w-[180px] shrink-0 items-center justify-between rounded-md border border-border bg-background px-3 py-2">
									<select
										title="Filter Sections"
										value={sectionFilter}
										onChange={(e) => setSectionFilter(e.target.value as 'all' | 'unassigned' | 'assigned')}
										className="w-full bg-transparent text-[0.6875rem] font-medium outline-none"
									>
										<option value="all">All Sections</option>
										<option value="unassigned">Hide Assigned</option>
										<option value="assigned">Assigned Only</option>
									</select>
									<ChevronDown className="size-3.5 text-muted-foreground" />
								</div>
							</div>"""
new_toolbar = """								<div className="flex w-[120px] shrink-0 items-center justify-between rounded-md border border-border bg-background px-3 py-2">
									<select
										title="Filter Grade Level"
										value={gradeLevelFilter}
										onChange={(e) => setGradeLevelFilter(e.target.value)}
										className="w-full bg-transparent text-[0.6875rem] font-medium outline-none"
									>
										<option value="all">All Grades</option>
										<option value="7">Grade 7</option>
										<option value="8">Grade 8</option>
										<option value="9">Grade 9</option>
										<option value="10">Grade 10</option>
									</select>
									<ChevronDown className="size-3.5 text-muted-foreground" />
								</div>
								<div className="flex w-[150px] shrink-0 items-center justify-between rounded-md border border-border bg-background px-3 py-2">
									<select
										title="Filter Sections"
										value={sectionFilter}
										onChange={(e) => setSectionFilter(e.target.value as 'all' | 'unassigned' | 'assigned')}
										className="w-full bg-transparent text-[0.6875rem] font-medium outline-none"
									>
										<option value="all">All Sections</option>
										<option value="unassigned">Hide Assigned</option>
										<option value="assigned">Assigned Only</option>
									</select>
									<ChevronDown className="size-3.5 text-muted-foreground" />
								</div>
							</div>"""
rep(old_toolbar, new_toolbar, "Toolbar Selects")

# 5. formatOwnerName
old_subrowprops = "	sectionFilter?: 'all' | 'unassigned' | 'assigned';\n};"
new_subrowprops = "	sectionFilter?: 'all' | 'unassigned' | 'assigned';\n\tgradeLevelFilter?: string;\n\tadvisedSectionId?: number | null;\n};"
rep(old_subrowprops, new_subrowprops, "SubjectRowProps")

# SubjectRow signature
rep(
    "\tsearchTerm = '',\n\tsectionFilter = 'all',\n}: SubjectRowProps) {",
    "\tsearchTerm = '',\n\tsectionFilter = 'all',\n\tgradeLevelFilter = 'all',\n\tadvisedSectionId = null,\n}: SubjectRowProps) {",
    "SubjectRow signature"
)

# displaySections Logic
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
			result = result.filter(sec => String(sec.displayOrder) === gradeLevelFilter);
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
rep(old_displaySections, new_displaySections, "displaySections Logic")

# SubjectRow injections
old_sub_map1 = """											searchTerm={subjectSearch}
											sectionFilter={sectionFilter}
										/>"""
new_sub_map1 = """											searchTerm={subjectSearch}
											sectionFilter={sectionFilter}
											gradeLevelFilter={gradeLevelFilter}
											advisedSectionId={homeroomHint?.advisedSectionId ?? null}
										/>"""
rep(old_sub_map1, new_sub_map1, "SubjectRow injections 1")

old_sub_map2 = """											sectionFilter={sectionFilter}
											isOutsideDepartment
										/>"""
new_sub_map2 = """											sectionFilter={sectionFilter}
											isOutsideDepartment
											gradeLevelFilter={gradeLevelFilter}
											advisedSectionId={homeroomHint?.advisedSectionId ?? null}
										/>"""
rep(old_sub_map2, new_sub_map2, "SubjectRow injections 2")


# Faculty list star
rep(
    """								<p className="truncate text-sm font-medium">
									{member.lastName}, {member.firstName}
								</p>""",
    """								<p className="truncate flex items-center gap-1.5 text-sm font-medium">
									{member.isClassAdviser && <Star className="size-3 shrink-0 flex-none fill-amber-400 text-amber-400" aria-label="Class Adviser" />}
									{member.lastName}, {member.firstName}
								</p>""",
    "Faculty list star"
)

# Header star
rep(
    """										{selected.department ?? 'No department assigned'}
									</div>
								</div>
							</div>""",
    """										{selected.department ?? 'No department assigned'}
									</div>
									{selected.isClassAdviser && (
										<Badge variant="outline" className="border-amber-200 bg-amber-50 text-[0.5625rem] text-amber-700">
											<Star className="mr-1 size-2.5 fill-amber-500 text-amber-500" /> Class Adviser
										</Badge>
									)}
								</div>
							</div>""",
    "Header star"
)

# Accordion Header Bg
rep(
    """<div key={gradeLevel} className={`overflow-hidden rounded-md border ${GRADE_COLORS[String(gradeLevel)] ? GRADE_COLORS[String(gradeLevel)].replace("bg-", "border-").replace("/80", "/30").replace(" text-", " ") : "border-border/70"}`}>""",
    """<div key={gradeLevel} className={`overflow-hidden rounded-md border ${GRADE_COLORS[String(gradeLevel)] ? GRADE_COLORS[String(gradeLevel)].replace("/80", "/20").replace(" text-", " ") : "border-border/70 bg-background"}`}>""",
    "Accordion header 1"
)
rep(
    """className={`h-auto w-full justify-between rounded-none px-3 py-2 ${GRADE_COLORS[String(gradeLevel)] ? GRADE_COLORS[String(gradeLevel)].replace("/80", "/20") : "bg-background"}`}>""",
    """className={`h-auto w-full justify-between rounded-none px-3 py-2 ${GRADE_COLORS[String(gradeLevel)] ? GRADE_COLORS[String(gradeLevel)].replace("/80", "/10") : "bg-transparent"}`}>""",
    "Accordion header 2"
)

# Subject sort logic
rep(
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

# Omnisearch subject filter anySubjectMatches logic
rep(
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

# And finally the TILE INTERNALS from the `badgeLabel` all the way to the closing div of the map
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
											const borderState = blocked ? 'cursor-not-allowed border-red-300 opacity-70' : isSelected ? 'border-primary ring-1 ring-primary/40 text-primary-foreground' : 'border-border/60';

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
rep(old_tile_internals, new_tile_internals, "Tile Internals")

path.write_text(code, encoding='utf-8')
