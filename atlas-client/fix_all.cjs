const fs = require('fs');
const path = 'src/pages/FacultyAssignments.tsx';
let code = fs.readFileSync(path, 'utf8');

function replaceRegex(regex, replacement, name) {
    if (regex.test(code)) {
        code = code.replace(regex, replacement);
        console.log('✓ ' + name);
    } else {
        console.log('✗ ' + name + ' NOT FOUND');
    }
}

// 1. imports
replaceRegex(
    /from 'lucide-react';/,
    `Star,
} from 'lucide-react';`,
    'Imports'
);

// 2. formatOwnerName definition
const newHelper = `
const formatOwnerName = (name?: string) => {
	if (!name) return '';
	const lastName = name.split(',')[0].trim();
	return lastName.charAt(0).toUpperCase() + lastName.slice(1).toLowerCase();
};

type SubjectRowProps = {`;
replaceRegex(/type SubjectRowProps = \{/, newHelper, 'formatOwnerName');

// 3. state
replaceRegex(
    /const \[sectionFilter, setSectionFilter\] = useState<'all' \| 'unassigned' \| 'assigned'>\('all'\);/,
    `const [sectionFilter, setSectionFilter] = useState<'all' | 'unassigned' | 'assigned'>('all');
\tconst [gradeLevelFilter, setGradeLevelFilter] = useState<string>('all');`,
    'State'
);

// 4. filterBySubjectSearch
replaceRegex(
    /const filterBySubjectSearch = useCallback\([\s\S]*?\n\s+\[subjectSearch\],\n\);/,
    `const filterBySubjectSearch = useCallback(
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
	);`,
    'filterBySubjectSearch'
);

// 5. subject sorting
replaceRegex(
    /return \{ primarySubjects: primary, otherSubjects: other \};\n\s*\}, \[selected, subjects\]\);/,
    `// Sort: dept-specific subjects alphabetically, homeroom last within primary group
\t\tprimary.sort((a, b) => {
\t\t\tconst aIsHomeroom = a.code.toLowerCase().includes('homeroom') || a.name.toLowerCase().includes('homeroom');
\t\t\tconst bIsHomeroom = b.code.toLowerCase().includes('homeroom') || b.name.toLowerCase().includes('homeroom');
\t\t\tif (aIsHomeroom && !bIsHomeroom) return 1;
\t\t\tif (!aIsHomeroom && bIsHomeroom) return -1;
\t\t\treturn a.name.localeCompare(b.name);
\t\t});
\t\tother.sort((a, b) => a.name.localeCompare(b.name));
\t\treturn { primarySubjects: primary, otherSubjects: other };
\t}, [selected, subjects]);`,
    'Subject sorting'
);

// 6. faculty list item adviser star
replaceRegex(
    /\{member\.lastName\}, \{member\.firstName\}\n\s*<\/p>/,
    `{member.isClassAdviser && <Star className="size-3 shrink-0 flex-none fill-amber-400 text-amber-400" aria-label="Class Adviser" />}
\t\t\t\t\t\t\t\t\t\t{member.lastName}, {member.firstName}
\t\t\t\t\t\t\t\t\t</p>`,
    'Faculty list star'
);

// modify the <p> containing the member.lastName to have flex utilities
replaceRegex(
    /<p className="truncate text-sm font-medium">\n\s*\{member\.isClassAdviser/,
    `<p className="truncate text-sm font-medium flex items-center gap-1.5">\n\t\t\t\t\t\t\t\t\t\t{member.isClassAdviser`,
    'Faculty list flex'
);

// 7. advisory badge on selected header
replaceRegex(
    /\{!selected\.isActiveForScheduling && <Badge variant="secondary">Excluded<\/Badge>\}/,
    `{selected.isClassAdviser && (
\t\t\t\t\t\t\t\t<Badge className="border-amber-300 bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700 flex items-center gap-1">
\t\t\t\t\t\t\t\t\t<Star className="size-3 fill-amber-500 text-amber-500" />
\t\t\t\t\t\t\t\t\tAdviser
\t\t\t\t\t\t\t\t</Badge>
\t\t\t\t\t\t\t)}
\t\t\t\t\t\t\t{!selected.isActiveForScheduling && <Badge variant="secondary">Excluded</Badge>}`,
    'Header adviser badge'
);

// 8. remove ownership transfers ribbon
replaceRegex(
    /\{pendingEntries\.length > 0 && \([\s\S]*?\n\t\t\t\t<\/div>\n\t\t\t\)}\n{1,3}\n/,
    '',
    'Remove transfers ribbon'
);

// 9. add grade level filter to toolbar
replaceRegex(
    /<\/SelectContent>\n\s*<\/Select>\n\s*<div className="ml-auto flex items-center gap-2">/,
    `</SelectContent>
					</Select>
					<Select value={gradeLevelFilter} onValueChange={setGradeLevelFilter}>
						<SelectTrigger className="h-7 w-28 text-xs">
							<SelectValue placeholder="All Grades" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all" className="text-xs">All Grades</SelectItem>
							<SelectItem value="7" className="text-xs">Grade 7</SelectItem>
							<SelectItem value="8" className="text-xs">Grade 8</SelectItem>
							<SelectItem value="9" className="text-xs">Grade 9</SelectItem>
							<SelectItem value="10" className="text-xs">Grade 10</SelectItem>
						</SelectContent>
					</Select>
					<div className="ml-auto flex items-center gap-2">`,
    'Grade filter select'
);

// 10. SubjectRowProps
replaceRegex(
    /sectionFilter\?: 'all' \| 'unassigned' \| 'assigned';\n\}/,
    `sectionFilter?: 'all' | 'unassigned' | 'assigned';
\tgradeLevelFilter?: string;
\tadvisedSectionId?: number | null;
}`,
    'SubjectRow props update'
);

// 11. SubjectRow destructure
replaceRegex(
    /sectionFilter = 'all',\n\}: SubjectRowProps\)/,
    `sectionFilter = 'all',
\tgradeLevelFilter = 'all',
\tadvisedSectionId = null,
}: SubjectRowProps)`,
    'SubjectRow params update'
);

// 12. displaySections logic update
replaceRegex(
    /if \(searchTerm\) \{[\s\S]*?\}\n\s*return result;\n\s*\}, \[sections, sectionFilter, searchTerm, subject, savedOwnershipMap, pendingOwnershipMap\]\);/,
    `if (gradeLevelFilter !== 'all') {
\t\t\t\tresult = result.filter(sec => String(sec.displayOrder) === gradeLevelFilter);
\t\t\t}
\t\t\tif (searchTerm) {
\t\t\t\tconst term = searchTerm.toLowerCase();
\t\t\t\tif (subject.name.toLowerCase().includes(term) || subject.code.toLowerCase().includes(term)) {
\t\t\t\t\t// subject matches
\t\t\t\t} else {
\t\t\t\t\tresult = result.filter(sec => sec.name.toLowerCase().includes(term) || \`g\${sec.displayOrder}\`.includes(term));
\t\t\t\t}
\t\t\t}
\t\t\treturn result;
\t\t}, [sections, sectionFilter, gradeLevelFilter, searchTerm, subject, savedOwnershipMap, pendingOwnershipMap]);`,
    'displaySections update'
);

// 13. SubjectRow prop passes
replaceRegex(
    /searchTerm=\{subjectSearch\}\n\s*sectionFilter=\{sectionFilter\}\n\s*\/>/g,
    `searchTerm={subjectSearch}
\t\t\t\t\t\t\t\t\t\t\tsectionFilter={sectionFilter}
\t\t\t\t\t\t\t\t\t\t\tgradeLevelFilter={gradeLevelFilter}
\t\t\t\t\t\t\t\t\t\t\tadvisedSectionId={homeroomHint?.advisedSectionId ?? null}
\t\t\t\t\t\t\t\t\t\t/>`,
    'SubjectRow props pass #1'
);

replaceRegex(
    /searchTerm=\{subjectSearch\}\n\s*sectionFilter=\{sectionFilter\}\n\s*isOutsideDepartment\n\s*\/>/g,
    `searchTerm={subjectSearch}
\t\t\t\t\t\t\t\t\t\t\tsectionFilter={sectionFilter}
\t\t\t\t\t\t\t\t\t\t\tgradeLevelFilter={gradeLevelFilter}
\t\t\t\t\t\t\t\t\t\t\tadvisedSectionId={homeroomHint?.advisedSectionId ?? null}
\t\t\t\t\t\t\t\t\t\t\tisOutsideDepartment
\t\t\t\t\t\t\t\t\t\t/>`,
    'SubjectRow props pass #2'
);

// 14. grade container style coloring
replaceRegex(
    /className="overflow-hidden rounded-md border border-border\/70 bg-background"/g,
    'className={`overflow-hidden rounded-md border ${GRADE_COLORS[String(gradeLevel)] ? GRADE_COLORS[String(gradeLevel)].replace("bg-", "border-").replace("/80", "/40").replace(" text-", " ") : "border-border/70"}`}',
    'Accordion container coloring'
);

replaceRegex(
    /className="h-auto w-full justify-between rounded-none px-3 py-2"/g,
    'className={`h-auto w-full justify-between rounded-none px-3 py-2 ${GRADE_COLORS[String(gradeLevel)] ?? "bg-background"}`}',
    'Accordion button Header coloring'
);

replaceRegex(
    /className="text-\[0\.5625rem\]">\{selectedInGrade\} \/ \{gradeSections\.length\}<\/Badge>/g,
    'className={`text-[0.5625rem] bg-white/70 ${GRADE_COLORS[String(gradeLevel)] ? GRADE_COLORS[String(gradeLevel)].replace("bg-", "text-").split(" ")[1] : ""}`}>{selectedInGrade} / {gradeSections.length}</Badge>',
    'Accordion button badge coloring'
);


// 15. The exact Section Tile replace. Uses multiline match for precision!
replaceRegex(
    /const badgeLabel = isPendingOther[\s\S]*?<\/div>(\s*)<\/div>(\s*)<\/div>(\s*)\);/g,
    `const badgeLabel = isPendingOther
\t\t\t\t\t\t\t\t\t\t? \`Pending: \${formatOwnerName(pendingOwner?.facultyName)}\`
\t\t\t\t\t\t\t\t\t\t: isSavedOther
\t\t\t\t\t\t\t\t\t\t? \`Saved: \${formatOwnerName(savedOwner?.facultyName)}\`
\t\t\t\t\t\t\t\t\t\t: isPendingCurrent
\t\t\t\t\t\t\t\t\t\t? 'Pending'
\t\t\t\t\t\t\t\t\t\t: isSavedCurrent
\t\t\t\t\t\t\t\t\t\t? 'Saved'
\t\t\t\t\t\t\t\t\t\t: null;

\t\t\t\t\t\t\t\t\tconst tint = section.displayOrder === 7 ? 'hover:bg-green-50/40' : section.displayOrder === 8 ? 'hover:bg-yellow-50/40' : section.displayOrder === 9 ? 'hover:bg-red-50/40' : section.displayOrder === 10 ? 'hover:bg-blue-50/40' : 'hover:bg-muted/20';

\t\t\t\t\t\t\t\t\treturn (
\t\t\t\t\t\t\t\t\t\t<div
\t\t\t\t\t\t\t\t\t\t\tkey={section.id}
\t\t\t\t\t\t\t\t\t\t\tclassName={\`flex flex-col gap-1.5 rounded-md border p-2 transition-colors \${
\t\t\t\t\t\t\t\t\t\t\t\tblocked ? 'cursor-not-allowed border-red-300 bg-red-50/50 opacity-70' : isSelected ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/20' : \`border-border/60 \${tint}\`
\t\t\t\t\t\t\t\t\t\t\t}\`}
\t\t\t\t\t\t\t\t\t\t>
\t\t\t\t\t\t\t\t\t\t\t<div className="flex items-start gap-1.5">
\t\t\t\t\t\t\t\t\t\t\t\t<Checkbox checked={isSelected} onCheckedChange={() => toggleSection(section.id)} disabled={disabled || blocked} className="mt-0.5 shrink-0" />
\t\t\t\t\t\t\t\t\t\t\t\t<div className="min-w-0 flex-1 flex flex-col gap-1">
\t\t\t\t\t\t\t\t\t\t\t\t\t<div className="min-w-0">
\t\t\t\t\t\t\t\t\t\t\t\t\t\t<p className="text-[0.6875rem] font-semibold leading-tight break-words">{section.name}</p>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t{section.programCode && section.programCode !== 'REGULAR' && (
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<p className="text-[0.5625rem] text-muted-foreground break-words mt-[2px]">{section.programCode}</p>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t)}
\t\t\t\t\t\t\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t\t\t\t\t\t\t
\t\t\t\t\t\t\t\t\t\t\t\t\t{(advisedSectionId === section.id || badgeLabel) && (
\t\t\t\t\t\t\t\t\t\t\t\t\t\t<div className="flex flex-wrap items-center gap-1 mt-0.5">
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t{advisedSectionId === section.id && (
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<Badge className="shrink-0 gap-0.5 border-amber-300 bg-amber-50 px-1 py-0 text-[0.5rem] tracking-tight text-amber-700 flex items-center">
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<Star className="size-2 fill-amber-500 text-amber-500" />Advisory
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t</Badge>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t)}
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t{badgeLabel && (
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<Tooltip>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<TooltipTrigger asChild>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<Badge
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tvariant="outline"
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tclassName={\`px-1 py-0 text-[0.5rem] tracking-tight leading-tight block w-fit max-w-full lg:truncate whitespace-normal \${
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tisPendingOther
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t? 'border-red-200 bg-white/50 text-red-700'
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t: isSavedOther
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t? 'border-amber-200 bg-white/50 text-amber-700'
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t: isPendingCurrent
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t? 'border-sky-200 bg-white/50 text-sky-700'
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t: 'border-emerald-200 bg-white/50 text-emerald-700'
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t}\`}
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t{badgeLabel}
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t</Badge>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t</TooltipTrigger>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<TooltipContent side="top" className="max-w-xs text-xs">
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t{isPendingOther && <p>{pendingOwner?.facultyName} has this subject-section pair in an unsaved session draft.</p>}
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t{isSavedOther && <p>{savedOwner?.facultyName} already owns this subject-section pair in saved data.</p>}
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t{isPendingCurrent && <p>This selection is pending in the current session and has not been saved yet.</p>}
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t{isSavedCurrent && !isPendingCurrent && <p>This subject-section pair is already saved for the selected teacher.</p>}
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t</TooltipContent>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t</Tooltip>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t)}
\t\t\t\t\t\t\t\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t\t\t\t\t\t\t)}
\t\t\t\t\t\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t\t\t);`,
    'Tile markup implementation'
);

fs.writeFileSync(path, code, 'utf8');
console.log('Script completed.');
