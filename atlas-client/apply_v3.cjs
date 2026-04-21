const fs = require('fs');
const path = 'src/pages/FacultyAssignments.tsx';
let code = fs.readFileSync(path, 'utf8');

// ─── 1. Add Star to imports ────────────────────────────────────────────────
const importsOld = `import {
AlertTriangle,
CheckCircle2,
ChevronDown,
ChevronRight,
Info,
RotateCcw,
Save,
Search,
ShieldAlert,
UserCog,
} from 'lucide-react';`;
const importsNew = `import {
AlertTriangle,
CheckCircle2,
ChevronDown,
ChevronRight,
Info,
RotateCcw,
Save,
Star,
Search,
ShieldAlert,
UserCog,
} from 'lucide-react';`;
if (code.includes(importsOld)) {
    code = code.replace(importsOld, importsNew);
    console.log('✓ 1: Added Star import');
} else { console.log('✗ 1: imports not found'); }

// ─── 2. Add gradeLevelFilter state ────────────────────────────────────────
const stateOld = `\tconst [sectionFilter, setSectionFilter] = useState<'all' | 'unassigned' | 'assigned'>('all');`;
const stateNew = `\tconst [sectionFilter, setSectionFilter] = useState<'all' | 'unassigned' | 'assigned'>('all');\n\tconst [gradeLevelFilter, setGradeLevelFilter] = useState<string>('all');`;
if (code.includes(stateOld)) {
    code = code.replace(stateOld, stateNew);
    console.log('✓ 2: Added gradeLevelFilter state');
} else { console.log('✗ 2: state line not found'); }

// ─── 3. Fix filterBySubjectSearch to also match subjects with matching sections ──
// The problem: when searching "archimedes" the subject doesn't match, sections do,
// but filterBySubjectSearch removes the subject before SubjectRow can filter sections.
// Fix: In filterBySubjectSearch, also keep a subject if ANY of its sections match.
// But we need allKnownSections here. Instead, pass sectionMap to the function or
// just make filterBySubjectSearch smarter by checking if search might reference sections.
// Since we can't access sections in filterBySubjectSearch, we need to always show ALL
// subjects when the searchTerm might be a section name, and let SubjectRow filter to empty.
// Best fix: filterBySubjectSearch returns a subject if subject name/code matches OR if the
// search doesn't look like a subject search. Let SubjectRow handle empty state.
// Actually the cleanest fix: if the search doesn't match ANY subject, show ALL subjects
// and let SubjectRow filter sections. If it matches some subjects, filter.

const filterFnOld = `const filterBySubjectSearch = useCallback(
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
);`;
const filterFnNew = `const filterBySubjectSearch = useCallback(
	(subjectList: Subject[]) => {
		if (!subjectSearch.trim()) {
			return subjectList;
		}
		const normalizedQuery = subjectSearch.toLowerCase();
		// Check if any subject directly matches the search term
		const anySubjectMatches = subjectList.some(
			(subject) => subject.name.toLowerCase().includes(normalizedQuery) || subject.code.toLowerCase().includes(normalizedQuery),
		);
		// If no subjects directly match, it might be a section/grade search — show all subjects
		// so SubjectRow can filter down to matching sections
		if (!anySubjectMatches) {
			return subjectList;
		}
		return subjectList.filter(
			(subject) => subject.name.toLowerCase().includes(normalizedQuery) || subject.code.toLowerCase().includes(normalizedQuery),
		);
	},
	[subjectSearch],
);`;
if (code.includes(filterFnOld.replace(/\t/g, '\t'))) {
    code = code.replace(filterFnOld, filterFnNew);
    console.log('✓ 3: Fixed filterBySubjectSearch');
} else {
    // Try finding it by key snippet
    const filterKey = 'const filterBySubjectSearch = useCallback(';
    const filterIdx = code.indexOf(filterKey);
    if (filterIdx !== -1) {
        const filterEnd = code.indexOf('\n);', filterIdx) + 3;
        const oldBlock = code.slice(filterIdx, filterEnd);
        const newBlock = filterFnNew;
        code = code.slice(0, filterIdx) + newBlock + code.slice(filterEnd);
        console.log('✓ 3: Fixed filterBySubjectSearch (index mode)');
    } else {
        console.log('✗ 3: filterBySubjectSearch not found');
    }
}

// ─── 4. Sort primarySubjects to put dept-matching subjects first, homeroom NOT first ──
// The user wants department subjects first (not alphabetical). Currently they're in
// whatever order subjects API returns. Add a sort to primarySubjects.
const sortOld = `	return { primarySubjects: primary, otherSubjects: other };
}, [selected, subjects]);`;
const sortNew = `	// Sort: dept-specific subjects alphabetically, homeroom last within primary group
	primary.sort((a, b) => {
		const aIsHomeroom = a.code.toLowerCase().includes('homeroom') || a.name.toLowerCase().includes('homeroom');
		const bIsHomeroom = b.code.toLowerCase().includes('homeroom') || b.name.toLowerCase().includes('homeroom');
		if (aIsHomeroom && !bIsHomeroom) return 1;
		if (!aIsHomeroom && bIsHomeroom) return -1;
		return a.name.localeCompare(b.name);
	});
	other.sort((a, b) => a.name.localeCompare(b.name));
	return { primarySubjects: primary, otherSubjects: other };
}, [selected, subjects]);`;
if (code.includes(sortOld)) {
    code = code.replace(sortOld, sortNew);
    console.log('✓ 4: Added subject sort');
} else { console.log('✗ 4: subject sort anchor not found'); }

// ─── 5. Add adviser star to faculty list item ──────────────────────────────
// Add the Star icon next to the name in the faculty list when isClassAdviser
const facultyNameOld = `				<p className="truncate text-sm font-medium">
					{member.lastName}, {member.firstName}
				</p>`;
const facultyNameNew = `				<p className="truncate text-sm font-medium flex items-center gap-1">
					{member.isClassAdviser && <Star className="size-3 shrink-0 fill-amber-400 text-amber-400" aria-label="Class Adviser" />}
					{member.lastName}, {member.firstName}
				</p>`;
if (code.includes(facultyNameOld)) {
    code = code.replace(facultyNameOld, facultyNameNew);
    console.log('✓ 5: Added adviser star to list');
} else { console.log('✗ 5: faculty name block not found'); }

// ─── 6. Add adviser badge to selected faculty header ──────────────────────
const selectedHeaderAdviserAnchor = `{!selected.isActiveForScheduling && <Badge variant="secondary">Excluded</Badge>}`;
const selectedHeaderAdviserNew = `{selected.isClassAdviser && (
				<Badge className="border-amber-300 bg-amber-50 text-amber-700 gap-1 flex items-center">
					<Star className="size-3 fill-amber-500 text-amber-500" />
					Adviser
				</Badge>
			)}
			{!selected.isActiveForScheduling && <Badge variant="secondary">Excluded</Badge>}`;
if (code.includes(selectedHeaderAdviserAnchor)) {
    code = code.replace(selectedHeaderAdviserAnchor, selectedHeaderAdviserNew);
    console.log('✓ 6: Added adviser badge to header');
} else { console.log('✗ 6: header anchor not found'); }

// ─── 7. Remove the Ownership Transfers ribbon ─────────────────────────────
const ownershipRibbonOld = `\t\t\t{pendingEntries.length > 0 && (
\t\t\t\t<div className="mt-1.5 flex items-center gap-2 rounded border border-sky-200 bg-sky-50/60 px-3 py-1.5">
\t\t\t\t\t<Badge className="shrink-0 border-sky-300 bg-white text-[0.5625rem] text-sky-700">{pendingEntries.length} pending</Badge>
\t\t\t\t\t<span className="shrink-0 text-xs font-semibold text-sky-800">Ownership transfers:</span>
\t\t\t\t\t<div className="flex flex-1 items-center gap-1 overflow-x-auto">
\t\t\t\t\t\t{pendingEntries.map((e) => (
\t\t\t\t\t\t\t<Badge key={e.key} variant="outline" className="shrink-0 whitespace-nowrap border-sky-200 bg-white px-1.5 py-0 text-[0.5625rem] text-sky-800">
\t\t\t\t\t\t\t\t{e.facultyName} | {e.subjectCode} | G{e.gradeLevel} {e.sectionName}
\t\t\t\t\t\t\t</Badge>
\t\t\t\t\t\t))}
\t\t\t\t\t</div>
\t\t\t\t</div>
\t\t\t)}`;
if (code.includes(ownershipRibbonOld)) {
    code = code.replace(ownershipRibbonOld, '');
    console.log('✓ 7: Removed ownership transfers ribbon');
} else {
    // Try finding by unique snippet
    const ribbonIdx = code.indexOf('Ownership transfers:');
    if (ribbonIdx !== -1) {
        const ribbonStart = code.lastIndexOf('{pendingEntries.length > 0', ribbonIdx);
        const ribbonEnd = code.indexOf(')}', ribbonIdx) + 2; // closing )}
        code = code.slice(0, ribbonStart) + '' + code.slice(ribbonEnd);
        console.log('✓ 7: Removed ownership transfers ribbon (index mode)');
    } else {
        console.log('✗ 7: ownership ribbon not found');
    }
}

// ─── 8. Add grade level filter Select to the toolbar ──────────────────────
const toolbarFilterOld = `<Select value={sectionFilter} onValueChange={(v) => setSectionFilter(v as 'all' | 'unassigned' | 'assigned')}>
				<SelectTrigger className="h-7 w-36 text-xs">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all" className="text-xs">All Sections</SelectItem>
					<SelectItem value="unassigned" className="text-xs">Unassigned Only</SelectItem>
					<SelectItem value="assigned" className="text-xs">Assigned Only</SelectItem>
				</SelectContent>
			</Select>`;
const toolbarFilterNew = `<Select value={sectionFilter} onValueChange={(v) => setSectionFilter(v as 'all' | 'unassigned' | 'assigned')}>
				<SelectTrigger className="h-7 w-36 text-xs">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all" className="text-xs">All Sections</SelectItem>
					<SelectItem value="unassigned" className="text-xs">Unassigned Only</SelectItem>
					<SelectItem value="assigned" className="text-xs">Assigned Only</SelectItem>
				</SelectContent>
			</Select>
			<Select value={gradeLevelFilter} onValueChange={setGradeLevelFilter}>
				<SelectTrigger className="h-7 w-28 text-xs">
					<SelectValue placeholder="All Grades" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all" className="text-xs">All Grades</SelectItem>
					<SelectItem value="7" className="text-xs">G7</SelectItem>
					<SelectItem value="8" className="text-xs">G8</SelectItem>
					<SelectItem value="9" className="text-xs">G9</SelectItem>
					<SelectItem value="10" className="text-xs">G10</SelectItem>
				</SelectContent>
			</Select>`;
if (code.includes(toolbarFilterOld)) {
    code = code.replace(toolbarFilterOld, toolbarFilterNew);
    console.log('✓ 8: Added grade level filter');
} else { console.log('✗ 8: toolbar filter anchor not found'); }

// ─── 9. Pass gradeLevelFilter to SubjectRow props type and component ────────
const subjectRowPropsOld = `\tsearchTerm?: string;\n\tsectionFilter?: 'all' | 'unassigned' | 'assigned';\n};`;
const subjectRowPropsNew = `\tsearchTerm?: string;\n\tsectionFilter?: 'all' | 'unassigned' | 'assigned';\n\tgradeLevelFilter?: string;\n\tadvisedSectionId?: number | null;\n};`;
if (code.includes(subjectRowPropsOld)) {
    code = code.replace(subjectRowPropsOld, subjectRowPropsNew);
    console.log('✓ 9: Added gradeLevelFilter and advisedSectionId to SubjectRowProps');
} else { console.log('✗ 9: SubjectRowProps end not found'); }

// ─── 10. Add gradeLevelFilter + advisedSectionId to SubjectRow destructure ─
const subjectRowParamsOld = `\tsearchTerm = '',\n\tsectionFilter = 'all',\n}: SubjectRowProps) {`;
const subjectRowParamsNew = `\tsearchTerm = '',\n\tsectionFilter = 'all',\n\tgradeLevelFilter = 'all',\n\tadvisedSectionId = null,\n}: SubjectRowProps) {`;
if (code.includes(subjectRowParamsOld)) {
    code = code.replace(subjectRowParamsOld, subjectRowParamsNew);
    console.log('✓ 10: Added gradeLevelFilter to SubjectRow params');
} else { console.log('✗ 10: SubjectRow params end not found'); }

// ─── 11. Wire gradeLevelFilter into displaySections filter ─────────────────
const displaySectionsFilterOld = `\t\tif (searchTerm) {\n\t\t\tconst term = searchTerm.toLowerCase();\n\t\t\tif (subject.name.toLowerCase().includes(term) || subject.code.toLowerCase().includes(term)) {\n\t\t\t\t// subject matches\n\t\t\t} else {\n\t\t\t\t// strict filter sections\n\t\t\t\tresult = result.filter(sec => sec.name.toLowerCase().includes(term) || \`g\${sec.displayOrder}\`.includes(term));\n\t\t\t}\n\t\t}\n\n\t\treturn result;\n\t}, [sections, sectionFilter, searchTerm, subject, savedOwnershipMap, pendingOwnershipMap]);`;
const displaySectionsFilterNew = `\t\t// Grade level filter
\t\tif (gradeLevelFilter !== 'all') {
\t\t\tresult = result.filter(sec => String(sec.displayOrder) === gradeLevelFilter);
\t\t}

\t\tif (searchTerm) {
\t\t\tconst term = searchTerm.toLowerCase();
\t\t\tif (subject.name.toLowerCase().includes(term) || subject.code.toLowerCase().includes(term)) {
\t\t\t\t// subject matches
\t\t\t} else {
\t\t\t\t// strict filter sections by name or grade
\t\t\t\tresult = result.filter(sec => sec.name.toLowerCase().includes(term) || \`g\${sec.displayOrder}\`.includes(term));
\t\t\t}
\t\t}

\t\treturn result;
\t}, [sections, sectionFilter, gradeLevelFilter, searchTerm, subject, savedOwnershipMap, pendingOwnershipMap]);`;
if (code.includes(displaySectionsFilterOld)) {
    code = code.replace(displaySectionsFilterOld, displaySectionsFilterNew);
    console.log('✓ 11: Wired gradeLevelFilter into displaySections');
} else {
    // Try by key
    const keyOld = `\t\treturn result;\n\t}, [sections, sectionFilter, searchTerm, subject, savedOwnershipMap, pendingOwnershipMap]);`;
    if (code.includes(keyOld)) {
        const insertBefore = `\t\tif (searchTerm) {`;
        const gradeInsert = `\t\t// Grade level filter\n\t\tif (gradeLevelFilter !== 'all') {\n\t\t\tresult = result.filter(sec => String(sec.displayOrder) === gradeLevelFilter);\n\t\t}\n\n\t\t`;
        code = code.replace(insertBefore, gradeInsert + insertBefore);
        code = code.replace(keyOld, `\t\treturn result;\n\t}, [sections, sectionFilter, gradeLevelFilter, searchTerm, subject, savedOwnershipMap, pendingOwnershipMap]);`);
        console.log('✓ 11: Wired gradeLevelFilter (fallback)');
    } else { console.log('✗ 11: displaySections filter anchor not found'); }
}

// ─── 12. Remove grade color badge pill from section tile ──────────────────
// Replace the G{section.displayOrder} span badge with nothing (container has color now)
const gradeBadgePillOld = `<span className={\`mb-0.5 inline-block rounded px-1 py-0 text-[0.5rem] font-bold uppercase leading-tight tracking-wider \${GRADE_COLORS[String(section.displayOrder)] ?? 'bg-muted text-muted-foreground'}\`}>
G{section.displayOrder}
</span>
<p className="truncate text-xs font-semibold leading-tight">{section.name}</p>`;
const gradeBadgePillNew = `<p className="truncate text-xs font-semibold leading-tight">{section.name}</p>`;
if (code.includes(gradeBadgePillOld)) {
    code = code.replace(gradeBadgePillOld, gradeBadgePillNew);
    console.log('✓ 12: Removed grade badge pill from tile');
} else { console.log('✗ 12: grade badge pill not found'); }

// ─── 13. Color-code the grade accordion header (container) ─────────────────
// The outer grade accordion div currently: className="overflow-hidden rounded-md border border-border/70 bg-background"
// Replace with grade-colored header background
const gradeAccordionOld = `<div key={gradeLevel} className="overflow-hidden rounded-md border border-border/70 bg-background">
<Button
type="button"
variant="ghost"
onClick={() => setOpenGrades((current) => ({ ...current, [gradeLevel]: !(current[gradeLevel] ?? true) }))}
className="h-auto w-full justify-between rounded-none px-3 py-2"
>
<span className="flex items-center gap-2 text-sm font-medium">
{isOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
{gradeLabel(gradeLevel)}
</span>
<Badge variant="secondary" className="text-[0.5625rem]">{selectedInGrade} / {gradeSections.length}</Badge>
</Button>`;
const gradeAccordionNew = `<div key={gradeLevel} className="overflow-hidden rounded-md border border-border/70">
<Button
type="button"
variant="ghost"
onClick={() => setOpenGrades((current) => ({ ...current, [gradeLevel]: !(current[gradeLevel] ?? true) }))}
className={\`h-auto w-full justify-between rounded-none px-3 py-2 \${GRADE_COLORS[String(gradeLevel)] ?? 'bg-muted/40'}\`}
>
<span className="flex items-center gap-2 text-sm font-medium">
{isOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
{gradeLabel(gradeLevel)}
</span>
<Badge variant="secondary" className={\`text-[0.5625rem] bg-white/60 \${GRADE_COLORS[String(gradeLevel)] ? GRADE_COLORS[String(gradeLevel)].replace('bg-', 'text-').split(' ')[1] : ''}\`}>{selectedInGrade} / {gradeSections.length}</Badge>
</Button>`;
if (code.includes(gradeAccordionOld)) {
    code = code.replace(gradeAccordionOld, gradeAccordionNew);
    console.log('✓ 13: Grade accordion header colored');
} else { console.log('✗ 13: grade accordion header not found'); }

// ─── 14. Color-code the section tile border/bg based on grade ──────────────
// The tile currently: flex flex-col gap-1.5 rounded-md border p-2 transition-colors
// with conditional: blocked ? ... : isSelected ? ... : 'border-border/60 hover:bg-muted/30'
// We want to add grade color tint to the unselected/selected states
const tileBorderOld = `className={\`flex flex-col gap-1.5 rounded-md border p-2 transition-colors \${
blocked ? 'cursor-not-allowed border-red-200 bg-red-50/50 opacity-70' : isSelected ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/20' : 'border-border/60 hover:bg-muted/30'
}\`}`;
const tileBorderNew = `className={\`flex flex-col gap-1.5 rounded-md border p-2 transition-colors \${
blocked
? 'cursor-not-allowed border-red-200 bg-red-50/50 opacity-70'
: isSelected
? \`border-primary/40 bg-primary/5 ring-1 ring-primary/20\`
: \`border-border/60 hover:bg-muted/20 \${
section.displayOrder === 7 ? 'hover:bg-green-50/40'
: section.displayOrder === 8 ? 'hover:bg-yellow-50/40'
: section.displayOrder === 9 ? 'hover:bg-red-50/40'
: section.displayOrder === 10 ? 'hover:bg-blue-50/40'
: ''
}\`
}\`}`;
if (code.includes(tileBorderOld)) {
    code = code.replace(tileBorderOld, tileBorderNew);
    console.log('✓ 14: Section tile grade tint applied');
} else { console.log('✗ 14: tile border not found'); }

// ─── 15. Pass gradeLevelFilter and advisedSectionId to SubjectRow calls ────
// Find where SubjectRow is called with searchTerm and sectionFilter and add the new props
const subjectRowCallOld1 = `sections={allKnownSections.filter((section) => subject.gradeLevels.includes(section.displayOrder))}
disabled={!selected.isActiveForScheduling || !sectionsAvailable}
selectedFacultyId={selected.id}
savedOwnershipMap={savedOwnershipMap}
pendingOwnershipMap={pendingOwnershipMap}
onSetSections={setSubjectSections}
\t\t\t\t\t\t\t\t\t\t\tsearchTerm={subjectSearch}
\t\t\t\t\t\t\t\t\t\t\tsectionFilter={sectionFilter}
/>
))}`;
const subjectRowCallNew1 = `sections={allKnownSections.filter((section) => subject.gradeLevels.includes(section.displayOrder))}
disabled={!selected.isActiveForScheduling || !sectionsAvailable}
selectedFacultyId={selected.id}
savedOwnershipMap={savedOwnershipMap}
pendingOwnershipMap={pendingOwnershipMap}
onSetSections={setSubjectSections}
\t\t\t\t\t\t\t\t\t\t\tsearchTerm={subjectSearch}
\t\t\t\t\t\t\t\t\t\t\tsectionFilter={sectionFilter}
gradeLevelFilter={gradeLevelFilter}
advisedSectionId={homeroomHint?.advisedSectionId ?? null}
/>
))}`;
if (code.includes(subjectRowCallOld1)) {
    code = code.replace(subjectRowCallOld1, subjectRowCallNew1);
    console.log('✓ 15: Added gradeLevelFilter to SubjectRow call 1 (primary)');
} else { console.log('✗ 15: primary SubjectRow call not found'); }

const subjectRowCallOld2 = `sections={allKnownSections.filter((section) => subject.gradeLevels.includes(section.displayOrder))}
disabled={!selected.isActiveForScheduling || !sectionsAvailable || !allowOutsideDepartment}
selectedFacultyId={selected.id}
savedOwnershipMap={savedOwnershipMap}
pendingOwnershipMap={pendingOwnershipMap}
onSetSections={setSubjectSections}
\t\t\t\t\t\t\t\t\t\t\tsearchTerm={subjectSearch}
\t\t\t\t\t\t\t\t\t\t\tsectionFilter={sectionFilter}
isOutsideDepartment`;
const subjectRowCallNew2 = `sections={allKnownSections.filter((section) => subject.gradeLevels.includes(section.displayOrder))}
disabled={!selected.isActiveForScheduling || !sectionsAvailable || !allowOutsideDepartment}
selectedFacultyId={selected.id}
savedOwnershipMap={savedOwnershipMap}
pendingOwnershipMap={pendingOwnershipMap}
onSetSections={setSubjectSections}
\t\t\t\t\t\t\t\t\t\t\tsearchTerm={subjectSearch}
\t\t\t\t\t\t\t\t\t\t\tsectionFilter={sectionFilter}
gradeLevelFilter={gradeLevelFilter}
advisedSectionId={homeroomHint?.advisedSectionId ?? null}
isOutsideDepartment`;
if (code.includes(subjectRowCallOld2)) {
    code = code.replace(subjectRowCallOld2, subjectRowCallNew2);
    console.log('✓ 15b: Added gradeLevelFilter to SubjectRow call 2 (outside dept)');
} else { console.log('✗ 15b: outside dept SubjectRow call not found'); }

// ─── 16. Add Advisory badge to section tile ──────────────────────────────
// In the section tile, after the section name, add an advisory badge if this section
// is the adviser's advisory section
const sectionNameOld = `<p className="truncate text-xs font-semibold leading-tight">{section.name}</p>
{section.programCode && section.programCode !== 'REGULAR' && (
<p className="truncate text-[0.6rem] text-muted-foreground">{section.programCode}</p>
)}`;
const sectionNameNew = `<div className="flex items-center gap-1">
<p className="truncate text-xs font-semibold leading-tight">{section.name}</p>
{advisedSectionId && section.id === advisedSectionId && (
<Badge className="shrink-0 gap-0.5 border-amber-300 bg-amber-50 px-1 py-0 text-[0.5rem] text-amber-700 flex items-center">
<Star className="size-2.5 fill-amber-500 text-amber-500" />Advisory
</Badge>
)}
</div>
{section.programCode && section.programCode !== 'REGULAR' && (
<p className="truncate text-[0.6rem] text-muted-foreground">{section.programCode}</p>
)}`;
if (code.includes(sectionNameOld)) {
    code = code.replace(sectionNameOld, sectionNameNew);
    console.log('✓ 16: Added Advisory badge on tile');
} else { console.log('✗ 16: section name block not found'); }

fs.writeFileSync(path, code, 'utf8');
console.log('\nAll patches done. Run npm run build to verify.');
