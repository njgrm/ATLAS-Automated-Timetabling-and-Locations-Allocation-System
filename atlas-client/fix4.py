import re

with open("D:\\ATLAS\\atlas-client\\src\\pages\\FacultyAssignments.tsx", "r", encoding="utf-8") as f:
    text = f.read()

# Fix SubjectRowProps
text = re.sub(
    r"(searchTerm\?: string;\s+sectionFilter\?: 'all' \| 'unassigned' \| 'assigned';\s+)(};)",
    r"\1\tgradeLevelFilter?: string;\n\2",
    text
)

# Fix SubjectRow args
text = re.sub(
    r"(searchTerm = '',\s+sectionFilter = 'all',\s+)(}: SubjectRowProps) \{",
    r"\1\tgradeLevelFilter = 'all',\n\2 {",
    text
)

# Fix displaySections
text = re.sub(
    r"(let result = sections;\s+)(if \(sectionFilter !== 'all'\) \{)",
    r"\1if (gradeLevelFilter !== 'all') {\n\t\t\t\t\tresult = result.filter(sec => sec.displayOrder === Number(gradeLevelFilter));\n\t\t\t\t}\n\n\t\t\t\t\2",
    text
)

text = re.sub(
    r"(\[sections, sectionFilter, searchTerm, subject, savedOwnershipMap, pendingOwnershipMap\])",
    r"[sections, sectionFilter, gradeLevelFilter, searchTerm, subject, savedOwnershipMap, pendingOwnershipMap]",
    text
)

# Add gradeLevelFilter to SubjectRow usages
text = re.sub(
    r"(onSetSections=\{setSubjectSections\}\s+searchTerm=\{subjectSearch\}\s+)(/>)",
    r"\1sectionFilter={sectionFilter}\n\t\t\t\t\t\t\t\t\t\t\t\tgradeLevelFilter={gradeLevelFilter}\n\t\t\t\t\t\t\t\t\t\t\t\t\2",
    text
)

# Hide SubjectRow if empty
hide = """
\tconst blockedCount = sections.length - selectableSectionIds.length;

\tif (groupedSections.length === 0 && (searchTerm || sectionFilter !== 'all' || gradeLevelFilter !== 'all')) {
\t\treturn null;
\t}

\tconst getGradeColors = (grade: number) => {
\t\tswitch (grade) {
\t\t\tcase 7: return { container: 'border-green-200 bg-green-50/30', card: 'border-green-200 bg-green-50 hover:bg-green-100/50', text: 'text-green-700' };
\t\t\tcase 8: return { container: 'border-yellow-200 bg-yellow-50/30', card: 'border-yellow-200 bg-yellow-50 hover:bg-yellow-100/50', text: 'text-yellow-700' };
\t\t\tcase 9: return { container: 'border-red-200 bg-red-50/30', card: 'border-red-200 bg-red-50 hover:bg-red-100/50', text: 'text-red-700' };
\t\t\tcase 10: return { container: 'border-blue-200 bg-blue-50/30', card: 'border-blue-200 bg-blue-50 hover:bg-blue-100/50', text: 'text-blue-700' };
\t\t\tdefault: return { container: 'border-border/70 bg-background', card: 'border-border/60 hover:bg-muted/30', text: 'text-muted-foreground' };
\t\t}
\t};
"""
text = re.sub(
    r"\s+const blockedCount = sections\.length - selectableSectionIds\.length;\s+",
    hide,
    text
)

# Wrap GradeLevel Containers
text = re.sub(
    r"(<div key=\{gradeLevel\} className=\")overflow-hidden rounded-md border border-border/70 bg-background(\">)",
    r"\t\t\t\t\t\t\t\t\tconst gradeStyle = getGradeColors(gradeLevel);\n\t\t\t\t\t\t\t\t\treturn (\n\t\t\t\t\t\t\t\t<div key={gradeLevel} className={`overflow-hidden rounded-md border ${gradeStyle.container}`}>\n",
    text
)

# Wrap individual boxes
text = re.sub(
    r"(blocked \? 'cursor-not-allowed border-red-200 bg-red-50/50 opacity-70' : isSelected \? 'border-primary/40 bg-primary/5 ring-1 ring-primary/20' : )'border-border/60 hover:bg-muted/30'",
    r"\1 gradeStyle.card",
    text
)

# Render Select for Grade Level Filter
toolbar_select = """</Select>
\t\t\t\t\t\t\t\t<Select value={gradeLevelFilter} onValueChange={setGradeLevelFilter}>
\t\t\t\t\t\t\t\t\t<SelectTrigger className="h-7 w-32 text-xs">
\t\t\t\t\t\t\t\t\t\t<SelectValue placeholder="Grade Level" />
\t\t\t\t\t\t\t\t\t</SelectTrigger>
\t\t\t\t\t\t\t\t\t<SelectContent>
\t\t\t\t\t\t\t\t\t\t<SelectItem value="all" className="text-xs">All Grades</SelectItem>
\t\t\t\t\t\t\t\t\t\t<SelectItem value="7" className="text-xs">Grade 7</SelectItem>
\t\t\t\t\t\t\t\t\t\t<SelectItem value="8" className="text-xs">Grade 8</SelectItem>
\t\t\t\t\t\t\t\t\t\t<SelectItem value="9" className="text-xs">Grade 9</SelectItem>
\t\t\t\t\t\t\t\t\t\t<SelectItem value="10" className="text-xs">Grade 10</SelectItem>
\t\t\t\t\t\t\t\t\t</SelectContent>
\t\t\t\t\t\t\t\t</Select>
\t\t\t\t\t\t\t\t<div className="ml-auto flex items-center gap-2">"""
text = re.sub(
    r"</Select>\s*<div className=\"ml-auto flex items-center gap-2\">",
    toolbar_select,
    text
)

# search section by grade Level in searchTerm
text = re.sub(
    r"result = result\.filter\(sec => sec\.name\.toLowerCase\(\)\.includes\(term\) \|\| `g\$\{sec\.displayOrder\}`\.includes\(term\)\);",
    r"result = result.filter(sec => sec.name.toLowerCase().includes(term) || `g${sec.displayOrder}`.toLowerCase().includes(term) || sec.displayOrder.toString().includes(term));",
    text
)

with open("D:\\ATLAS\\atlas-client\\src\\pages\\FacultyAssignments.tsx", "w", encoding="utf-8") as f:
    f.write(text)
