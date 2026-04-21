import re

with open('src/pages/FacultyAssignments.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Imports
code = code.replace(
    "import { gradeLabel, matchesFacultyDepartment } from '@/lib/grade-labels';",
    "import { gradeLabel, matchesFacultyDepartment, GRADE_COLORS } from '@/lib/grade-labels';"
)

# 2. Add Section Filter State
code = code.replace(
    "const [subjectSearch, setSubjectSearch] = useState('');",
    "const [subjectSearch, setSubjectSearch] = useState('');\n\tconst [sectionFilter, setSectionFilter] = useState<'all' | 'unassigned' | 'assigned'>('all');"
)

# 3. Modify filter logic to also let sections drive the subject visibility
code = code.replace(
    "const matchesSubject = subject.name.toLowerCase().includes(normalized) || subject.code.toLowerCase().includes(normalized);",
    "const matchesSubject = subject.name.toLowerCase().includes(normalized) || subject.code.toLowerCase().includes(normalized);\n\t\t\tconst matchingSections = allKnownSections.some((section) => subject.gradeLevels.includes(section.displayOrder) && section.name.toLowerCase().includes(normalized));"
)
code = code.replace(
    "return matchesSubject;",
    "return matchesSubject || matchingSections;"
)

# 4. Collapse pending Entries & Lacking Faculty
lacking_faculty_old = '''{subjectsLackingFaculty.length > 0 && (
								<div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 shadow-sm">
									<div className="flex items-center gap-2 text-red-700">
										<AlertTriangle className="size-4" />
										<h4 className="text-xs font-semibold">Subjects Lacking Faculty</h4>
									</div>
									<p className="mt-1 text-[0.6875rem] text-red-700/80">
										{subjectsLackingFaculty.length} active subject(s) currently have no faculty assigned.
									</p>
									<div className="mt-2 flex flex-wrap gap-1">
										{subjectsLackingFaculty.map((subject) => (
											<Badge key={subject.id} variant="outline" className="border-red-300 bg-white text-[0.625rem] text-red-700">
												{subject.code}
											</Badge>
										))}
									</div>
								</div>
							)}'''
code = code.replace(lacking_faculty_old, '')

pending_old = '''{pendingEntries.length > 0 && (
								<div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 p-3 shadow-sm">
									<div className="flex items-center justify-between gap-3">
										<div>
											<p className="text-xs font-semibold text-sky-800">Session Pending Ownership</p>
											<p className="text-[0.6875rem] text-sky-700">
												Unsaved subject-section changes remain visible while you switch teachers.
											</p>
										</div>
										<Badge className="border-sky-200 bg-white text-sky-700">{pendingEntries.length} pending</Badge>
									</div>
									<div className="mt-2 flex max-h-28 flex-wrap gap-1 overflow-auto">
										{pendingEntries.map((entry) => (
											<Badge key={entry.key} variant="outline" className="border-sky-200 bg-white text-[0.625rem] text-sky-800">
												{entry.facultyName} | {entry.subjectCode} | G{entry.gradeLevel} {entry.sectionName}
											</Badge>
										))}
									</div>
								</div>
							)}'''
code = code.replace(pending_old, '')

# Combine them into the header area
header_end = '''											</TooltipContent>
										</Tooltip>
									</div>
								</div>'''
new_banners = '''											</TooltipContent>
										</Tooltip>
									</div>
								</div>

								{subjectsLackingFaculty.length > 0 && (
									<div className="mt-2 flex items-center gap-2 rounded border border-red-200 bg-red-50/50 px-3 py-1.5 shadow-sm text-xs">
										<AlertTriangle className="size-3.5 text-red-700 shrink-0" />
										<p className="text-red-700 font-semibold shrink-0">{subjectsLackingFaculty.length} lack faculty:</p>
										<div className="flex flex-wrap gap-1 items-center">
											{subjectsLackingFaculty.map((s) => (
												<Badge key={s.id} variant="outline" className="border-red-300 bg-white text-red-700 text-[0.5625rem] px-1 py-0 h-4 leading-none">{s.code}</Badge>
											))}
										</div>
									</div>
								)}

								{pendingEntries.length > 0 && (
									<div className="mt-2 flex items-center gap-2 rounded border border-sky-200 bg-sky-50/50 px-3 py-1.5 shadow-sm text-xs">
										<Badge className="border-sky-200 bg-white text-[0.5625rem] text-sky-700">{pendingEntries.length} pending</Badge>
										<span className="text-sky-800 font-semibold shrink-0">Ownership Transfers</span>
										<div className="flex flex-1 items-center gap-1 overflow-x-auto whitespace-nowrap scrollbar-hide py-0.5">
											{pendingEntries.map((e) => (
												<Badge key={e.key} variant="outline" className="shrink-0 border-sky-200 bg-white text-sky-800 text-[0.5625rem] px-1.5 py-0 h-4 leading-none">
													{e.facultyName} | {e.subjectCode} | G{e.gradeLevel} {e.sectionName}
												</Badge>
											))}
										</div>
									</div>
								)}'''
code = code.replace(header_end, new_banners)

# 5. Search Bar and Filter
search_old = '''									<div className="relative flex-1 max-w-xs">
										<Search className="absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
										<Input
											placeholder="Search subjects..."
											value={subjectSearch}
											onChange={(event) => setSubjectSearch(event.target.value)}
											className="h-7 pl-8 text-xs"
										/>
									</div>'''
search_new = '''									<div className="relative flex-1 max-w-[14rem]">
										<Search className="absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
										<Input
											placeholder="Search subjects or sections..."
											value={subjectSearch}
											onChange={(event) => setSubjectSearch(event.target.value)}
											className="h-7 pl-8 text-xs bg-card"
										/>
									</div>
									<Select value={sectionFilter} onValueChange={(x: any) => setSectionFilter(x)}>
										<SelectTrigger className="w-36 h-7 text-xs bg-card">
											<SelectValue placeholder="All Sections" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="all" className="text-xs">All Sections</SelectItem>
											<SelectItem value="unassigned" className="text-xs">Unassigned Only</SelectItem>
											<SelectItem value="assigned" className="text-xs">Assigned Only</SelectItem>
										</SelectContent>
									</Select>'''
code = code.replace(search_old, search_new)

# 6. Pass filters to SubjectRow
code = code.replace(
    "onSetSections={setSubjectSections}",
    "onSetSections={setSubjectSections}\n\t\t\t\t\t\t\t\t\t\t\tsearchTerm={subjectSearch}\n\t\t\t\t\t\t\t\t\t\t\tsectionFilter={sectionFilter}"
)

with open('src/pages/FacultyAssignments.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print('FacultyAssignments.tsx updated 1.')
