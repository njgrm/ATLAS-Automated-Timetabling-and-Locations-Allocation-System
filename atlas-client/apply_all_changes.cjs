const fs = require('fs');
const path = 'src/pages/FacultyAssignments.tsx';
let code = fs.readFileSync(path, 'utf8');

// ─── Change 1: Compact alert ribbons ────────────────────────────────────────
const alertsOld = `\t\t\t\t\t{subjectsLackingFaculty.length > 0 && (
\t\t\t\t\t\t<div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 shadow-sm">
\t\t\t\t\t\t\t<div className="flex items-center gap-2 text-red-700">
\t\t\t\t\t\t\t\t<AlertTriangle className="size-4" />
\t\t\t\t\t\t\t\t<h4 className="text-xs font-semibold">Subjects Lacking Faculty</h4>
\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t<p className="mt-1 text-[0.6875rem] text-red-700/80">
\t\t\t\t\t\t\t\t{subjectsLackingFaculty.length} active subject(s) currently have no faculty assigned.
\t\t\t\t\t\t\t</p>
\t\t\t\t\t\t\t<div className="mt-2 flex flex-wrap gap-1">
\t\t\t\t\t\t\t\t{subjectsLackingFaculty.map((subject) => (
\t\t\t\t\t\t\t\t\t<Badge key={subject.id} variant="outline" className="border-red-300 bg-white text-[0.625rem] text-red-700">
\t\t\t\t\t\t\t\t\t\t{subject.code}
\t\t\t\t\t\t\t\t\t</Badge>
\t\t\t\t\t\t\t\t))}
\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t</div>
\t\t\t\t\t)}

\t\t\t\t\t{pendingEntries.length > 0 && (
\t\t\t\t\t\t<div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 p-3 shadow-sm">
\t\t\t\t\t\t\t<div className="flex items-center justify-between gap-3">
\t\t\t\t\t\t\t\t<div>
\t\t\t\t\t\t\t\t\t<p className="text-xs font-semibold text-sky-800">Session Pending Ownership</p>
\t\t\t\t\t\t\t\t\t<p className="text-[0.6875rem] text-sky-700">
\t\t\t\t\t\t\t\t\t\tUnsaved subject-section changes remain visible while you switch teachers.
\t\t\t\t\t\t\t\t\t</p>
\t\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t\t<Badge className="border-sky-200 bg-white text-sky-700">{pendingEntries.length} pending</Badge>
\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t<div className="mt-2 flex max-h-28 flex-wrap gap-1 overflow-auto">
\t\t\t\t\t\t\t\t{pendingEntries.map((entry) => (
\t\t\t\t\t\t\t\t\t<Badge key={entry.key} variant="outline" className="border-sky-200 bg-white text-[0.625rem] text-sky-800">
\t\t\t\t\t\t\t\t\t\t{entry.facultyName} | {entry.subjectCode} | G{entry.gradeLevel} {entry.sectionName}
\t\t\t\t\t\t\t\t\t</Badge>
\t\t\t\t\t\t\t\t))}
\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t</div>
\t\t\t\t\t)}`;

const alertsNew = `\t\t\t\t\t{subjectsLackingFaculty.length > 0 && (
\t\t\t\t\t\t<div className="mt-2 flex items-center gap-2 rounded border border-red-200 bg-red-50/60 px-3 py-1.5">
\t\t\t\t\t\t\t<AlertTriangle className="size-3.5 shrink-0 text-red-600" />
\t\t\t\t\t\t\t<span className="shrink-0 text-xs font-semibold text-red-700">{subjectsLackingFaculty.length} lacking faculty:</span>
\t\t\t\t\t\t\t<div className="flex flex-1 items-center gap-1 overflow-x-auto">
\t\t\t\t\t\t\t\t{subjectsLackingFaculty.map((s) => (
\t\t\t\t\t\t\t\t\t<Badge key={s.id} variant="outline" className="shrink-0 border-red-300 bg-white px-1.5 py-0 text-[0.5625rem] text-red-700">{s.code}</Badge>
\t\t\t\t\t\t\t\t))}
\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t</div>
\t\t\t\t\t)}

\t\t\t\t\t{pendingEntries.length > 0 && (
\t\t\t\t\t\t<div className="mt-1.5 flex items-center gap-2 rounded border border-sky-200 bg-sky-50/60 px-3 py-1.5">
\t\t\t\t\t\t\t<Badge className="shrink-0 border-sky-300 bg-white text-[0.5625rem] text-sky-700">{pendingEntries.length} pending</Badge>
\t\t\t\t\t\t\t<span className="shrink-0 text-xs font-semibold text-sky-800">Ownership transfers:</span>
\t\t\t\t\t\t\t<div className="flex flex-1 items-center gap-1 overflow-x-auto">
\t\t\t\t\t\t\t\t{pendingEntries.map((e) => (
\t\t\t\t\t\t\t\t\t<Badge key={e.key} variant="outline" className="shrink-0 whitespace-nowrap border-sky-200 bg-white px-1.5 py-0 text-[0.5625rem] text-sky-800">
\t\t\t\t\t\t\t\t\t\t{e.facultyName} | {e.subjectCode} | G{e.gradeLevel} {e.sectionName}
\t\t\t\t\t\t\t\t\t</Badge>
\t\t\t\t\t\t\t\t))}
\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t</div>
\t\t\t\t\t)}`;

if (code.includes(alertsOld)) {
    code = code.replace(alertsOld, alertsNew);
    console.log('✓ Change 1: Alert ribbons applied');
} else {
    console.log('✗ Change 1: Could not find alert block');
}

// ─── Change 2: Omnisearch + section filter dropdown ─────────────────────────
const searchOld = `\t\t\t\t\t\t<div className="flex items-center gap-2 border-b border-border bg-muted/30 px-5 py-2">
\t\t\t\t\t\t\t<div className="relative flex-1 max-w-xs">
\t\t\t\t\t\t\t\t<Search className="absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
\t\t\t\t\t\t\t\t<Input
\t\t\t\t\t\t\t\t\tplaceholder="Search subjects..."
\t\t\t\t\t\t\t\t\tvalue={subjectSearch}
\t\t\t\t\t\t\t\t\tonChange={(event) => setSubjectSearch(event.target.value)}
\t\t\t\t\t\t\t\t\tclassName="h-7 pl-8 text-xs"
\t\t\t\t\t\t\t\t/>
\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t<div className="ml-auto flex items-center gap-2">
\t\t\t\t\t\t\t\t<ShieldAlert className={\`size-3.5 \${allowOutsideDepartment ? 'text-amber-600' : 'text-muted-foreground'}\`} />
\t\t\t\t\t\t\t\t<span className="text-[0.625rem] text-muted-foreground">Outside dept.</span>
\t\t\t\t\t\t\t\t<Switch
\t\t\t\t\t\t\t\t\tchecked={allowOutsideDepartment}
\t\t\t\t\t\t\t\t\tonCheckedChange={setAllowOutsideDepartment}
\t\t\t\t\t\t\t\t\taria-label="Allow outside department assignments"
\t\t\t\t\t\t\t\t/>
\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t</div>`;

const searchNew = `\t\t\t\t\t\t<div className="flex items-center gap-2 border-b border-border bg-muted/30 px-5 py-2">
\t\t\t\t\t\t\t<div className="relative w-52 shrink-0">
\t\t\t\t\t\t\t\t<Search className="absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
\t\t\t\t\t\t\t\t<Input
\t\t\t\t\t\t\t\t\tplaceholder="Search subjects or sections..."
\t\t\t\t\t\t\t\t\tvalue={subjectSearch}
\t\t\t\t\t\t\t\t\tonChange={(event) => setSubjectSearch(event.target.value)}
\t\t\t\t\t\t\t\t\tclassName="h-7 pl-8 text-xs"
\t\t\t\t\t\t\t\t/>
\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t<Select value={sectionFilter} onValueChange={(v) => setSectionFilter(v as 'all' | 'unassigned' | 'assigned')}>
\t\t\t\t\t\t\t\t<SelectTrigger className="h-7 w-36 text-xs">
\t\t\t\t\t\t\t\t\t<SelectValue />
\t\t\t\t\t\t\t\t</SelectTrigger>
\t\t\t\t\t\t\t\t<SelectContent>
\t\t\t\t\t\t\t\t\t<SelectItem value="all" className="text-xs">All Sections</SelectItem>
\t\t\t\t\t\t\t\t\t<SelectItem value="unassigned" className="text-xs">Unassigned Only</SelectItem>
\t\t\t\t\t\t\t\t\t<SelectItem value="assigned" className="text-xs">Assigned Only</SelectItem>
\t\t\t\t\t\t\t\t</SelectContent>
\t\t\t\t\t\t\t</Select>
\t\t\t\t\t\t\t<div className="ml-auto flex items-center gap-2">
\t\t\t\t\t\t\t\t<ShieldAlert className={\`size-3.5 \${allowOutsideDepartment ? 'text-amber-600' : 'text-muted-foreground'}\`} />
\t\t\t\t\t\t\t\t<span className="text-[0.625rem] text-muted-foreground">Outside dept.</span>
\t\t\t\t\t\t\t\t<Switch
\t\t\t\t\t\t\t\t\tchecked={allowOutsideDepartment}
\t\t\t\t\t\t\t\t\tonCheckedChange={setAllowOutsideDepartment}
\t\t\t\t\t\t\t\t\taria-label="Allow outside department assignments"
\t\t\t\t\t\t\t\t/>
\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t</div>`;

if (code.includes(searchOld)) {
    code = code.replace(searchOld, searchNew);
    console.log('✓ Change 2: Omnisearch + filter applied');
} else {
    console.log('✗ Change 2: Could not find search block');
}

// ─── Change 3: Default-closed accordion (open only when searching) ───────────
const accordionToggleOld = `onClick={() => setOpenGrades((current) => ({ ...current, [gradeLevel]: !(current[gradeLevel] ?? true) }))}`;
const accordionToggleNew = `onClick={() => setOpenGrades((current) => ({ ...current, [gradeLevel]: !(current[gradeLevel] ?? (searchTerm ? true : false)) }))}`;
if (code.includes(accordionToggleOld)) {
    code = code.replace(accordionToggleOld, accordionToggleNew);
    console.log('✓ Change 3: Accordion default-closed applied');
} else {
    console.log('✗ Change 3: Could not find accordion toggle');
}

// The isOpen check also needs to default to false
const isOpenOld = `const isOpen = openGrades[gradeLevel] ?? true;`;
const isOpenNew = `const isOpen = openGrades[gradeLevel] ?? (searchTerm ? true : false);`;
if (code.includes(isOpenOld)) {
    code = code.replace(isOpenOld, isOpenNew);
    console.log('✓ Change 3b: isOpen default false applied');
} else {
    console.log('✗ Change 3b: Could not find isOpen expression');
}

// ─── Change 4: Grid layout for sections ─────────────────────────────────────
const gridOld = `\t\t\t{isOpen && (
\t\t\t\t<div className="space-y-1 border-t border-border/70 px-3 py-2">`;
const gridNew = `\t\t\t{isOpen && (
\t\t\t\t<div className="grid grid-cols-2 gap-1.5 border-t border-border/70 p-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">`;
if (code.includes(gridOld)) {
    code = code.replace(gridOld, gridNew);
    console.log('✓ Change 4: Grid layout applied');
} else {
    console.log('✗ Change 4: Could not find grid section container');
}

// ─── Change 5: Grade color badge on section tiles ────────────────────────────
const tileOld = `\t\t\t\t\treturn (
\t\t\t\t\t\t<div
\t\t\t\t\t\t\tkey={section.id}
\t\t\t\t\t\t\tclassName={\`flex items-center justify-between gap-3 rounded-md border px-2.5 py-2 \${
\t\t\t\t\t\t\t\tblocked ? 'border-red-200 bg-red-50/60' : isSelected ? 'border-primary/30 bg-primary/5' : 'border-border/70'
\t\t\t\t\t\t\t}\`}
\t\t\t\t\t\t>
\t\t\t\t\t\t\t<div className="flex min-w-0 items-center gap-2">
\t\t\t\t\t\t\t\t<Checkbox checked={isSelected} onCheckedChange={() => toggleSection(section.id)} disabled={disabled || blocked} />
\t\t\t\t\t\t\t\t<div className="min-w-0">
\t\t\t\t\t\t\t\t\t<p className="truncate text-sm font-medium">{section.name}</p>
\t\t\t\t\t\t\t\t\t<p className="truncate text-[0.6875rem] text-muted-foreground">
\t\t\t\t\t\t\t\t\t\tG{section.displayOrder}{section.programCode && section.programCode !== 'REGULAR' ? \` | \${section.programCode}\` : ''}
\t\t\t\t\t\t\t\t\t</p>
\t\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t<div className="flex items-center gap-1.5">`;

const tileNew = `\t\t\t\t\treturn (
\t\t\t\t\t\t<div
\t\t\t\t\t\t\tkey={section.id}
\t\t\t\t\t\t\tclassName={\`flex flex-col gap-1.5 rounded-md border p-2 transition-colors \${
\t\t\t\t\t\t\t\tblocked ? 'cursor-not-allowed border-red-200 bg-red-50/50 opacity-70' : isSelected ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/20' : 'border-border/60 hover:bg-muted/30'
\t\t\t\t\t\t\t}\`}
\t\t\t\t\t\t>
\t\t\t\t\t\t\t<div className="flex items-start gap-1.5">
\t\t\t\t\t\t\t\t<Checkbox checked={isSelected} onCheckedChange={() => toggleSection(section.id)} disabled={disabled || blocked} className="mt-0.5 shrink-0" />
\t\t\t\t\t\t\t\t<div className="min-w-0 flex-1">
\t\t\t\t\t\t\t\t\t<span className={\`mb-0.5 inline-block rounded px-1 py-0 text-[0.5rem] font-bold uppercase leading-tight tracking-wider \${GRADE_COLORS[String(section.displayOrder)] ?? 'bg-muted text-muted-foreground'}\`}>
\t\t\t\t\t\t\t\t\t\tG{section.displayOrder}
\t\t\t\t\t\t\t\t\t</span>
\t\t\t\t\t\t\t\t\t<p className="truncate text-xs font-semibold leading-tight">{section.name}</p>
\t\t\t\t\t\t\t\t\t{section.programCode && section.programCode !== 'REGULAR' && (
\t\t\t\t\t\t\t\t\t\t<p className="truncate text-[0.6rem] text-muted-foreground">{section.programCode}</p>
\t\t\t\t\t\t\t\t\t)}
\t\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t<div className="flex items-center gap-1.5 pl-5">`;

if (code.includes(tileOld)) {
    code = code.replace(tileOld, tileNew);
    console.log('✓ Change 5: Grade color tile applied');
} else {
    console.log('✗ Change 5: Could not find section tile block');
}

fs.writeFileSync(path, code, 'utf8');
console.log('\nDone. Run npm run build to verify.');
