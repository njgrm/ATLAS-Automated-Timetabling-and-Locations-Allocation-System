import re

with open("D:\\ATLAS\\atlas-client\\src\\pages\\FacultyAssignments.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Pass gradeLevelFilter to SubjectRows
old_subject_row_map_1 = """onSetSections={setSubjectSections}
                                                                               searchTerm={subjectSearch}
/>"""
new_subject_row_map_1 = """onSetSections={setSubjectSections}
searchTerm={subjectSearch}
sectionFilter={sectionFilter}
gradeLevelFilter={gradeLevelFilter}
/>"""
content = content.replace(old_subject_row_map_1, new_subject_row_map_1)

# 2. Add gradeLevelFilter to SubjectRowProps
old_props = """        searchTerm?: string;
        sectionFilter?: 'all' | 'unassigned' | 'assigned';
};"""
new_props = """        searchTerm?: string;
        sectionFilter?: 'all' | 'unassigned' | 'assigned';
        gradeLevelFilter?: string;
};"""
content = content.replace(old_props, new_props)

# 3. Add gradeLevelFilter param to SubjectRow
old_func_def = """        searchTerm = '',
        sectionFilter = 'all',
}: SubjectRowProps) {"""
new_func_def = """        searchTerm = '',
        sectionFilter = 'all',
        gradeLevelFilter = 'all',
}: SubjectRowProps) {"""
content = content.replace(old_func_def, new_func_def)

# 4. Modify displaySections filtering logic to use gradeLevelFilter and hide when empty
old_display = """                if (searchTerm) {
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

new_display = """                if (gradeLevelFilter !== 'all') {
                        result = result.filter(sec => sec.displayOrder === Number(gradeLevelFilter));
                }

                if (searchTerm) {
                        const term = searchTerm.toLowerCase();
                        if (subject.name.toLowerCase().includes(term) || subject.code.toLowerCase().includes(term)) {
                                // subject matches
                        } else {
                                // strict filter sections
                                result = result.filter(sec => sec.name.toLowerCase().includes(term) || `g${sec.displayOrder}`.toLowerCase().includes(term));
                        }
                }

                return result;
        }, [sections, sectionFilter, gradeLevelFilter, searchTerm, subject, savedOwnershipMap, pendingOwnershipMap]);"""

content = content.replace(old_display, new_display)

# 5. hide SubjectRow if it has no sections and filters are active
old_hide = """const blockedCount = sections.length - selectableSectionIds.length;"""
new_hide = """const blockedCount = sections.length - selectableSectionIds.length;

if (groupedSections.length === 0 && (searchTerm || sectionFilter !== 'all' || gradeLevelFilter !== 'all')) {
    return null;
}

const getGradeColors = (grade: number) => {
        switch (grade) {
                case 7: return { container: 'border-green-200 bg-green-50/30', card: 'border-green-200 bg-green-50', text: 'text-green-700' };
                case 8: return { container: 'border-yellow-200 bg-yellow-50/30', card: 'border-yellow-200 bg-yellow-50', text: 'text-yellow-700' };
                case 9: return { container: 'border-red-200 bg-red-50/30', card: 'border-red-200 bg-red-50', text: 'text-red-700' };
                case 10: return { container: 'border-blue-200 bg-blue-50/30', card: 'border-blue-200 bg-blue-50', text: 'text-blue-700' };
                default: return { container: 'border-border/70 bg-background', card: 'border-border/60 hover:bg-muted/30', text: 'text-muted-foreground' };
        }
};
"""
content = content.replace(old_hide, new_hide)

# 6. Apply colors to grade wrapper
old_wrapper = """<div key={gradeLevel} className="overflow-hidden rounded-md border border-border/70 bg-background">"""
new_wrapper = """const gradeStyle = getGradeColors(gradeLevel);
return (
<div key={gradeLevel} className={`overflow-hidden rounded-md border ${gradeStyle.container}`}>"""
content = content.replace(old_wrapper, new_wrapper)

# 7. Apply colors to section cards
old_card = """className={`flex flex-col gap-1.5 rounded-md border p-2 transition-colors ${
blocked ? 'cursor-not-allowed border-red-200 bg-red-50/50 opacity-70' : isSelected ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/20' : 'border-border/60 hover:bg-muted/30'
}`}"""
new_card = """className={`flex flex-col gap-1.5 rounded-md border p-2 transition-colors ${
blocked ? 'cursor-not-allowed border-red-300 bg-red-50/50 opacity-70' : isSelected ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/20' : gradeStyle.card
}`}"""
content = content.replace(old_card, new_card)

# 8. Render toolbar Grade Level select
old_toolbar = """                                        <SelectContent>
                                                <SelectItem value="all" className="text-xs">All Sections</SelectItem>
                                                <SelectItem value="unassigned" className="text-xs">Unassigned Only</SelectItem>
                                                <SelectItem value="assigned" className="text-xs">Assigned Only</SelectItem>
                                        </SelectContent>
                                </Select>
                                <div className="ml-auto flex items-center gap-2">"""
new_toolbar = """                                        <SelectContent>
                                                <SelectItem value="all" className="text-xs">All Sections</SelectItem>
                                                <SelectItem value="unassigned" className="text-xs">Unassigned Only</SelectItem>
                                                <SelectItem value="assigned" className="text-xs">Assigned Only</SelectItem>
                                        </SelectContent>
                                </Select>
                                <Select value={gradeLevelFilter} onValueChange={setGradeLevelFilter}>
                                        <SelectTrigger className="h-7 w-32 text-xs">
                                                <SelectValue placeholder="Grade Level" />
                                        </SelectTrigger>
                                        <SelectContent>
                                                <SelectItem value="all" className="text-xs">All Grades</SelectItem>
                                                <SelectItem value="7" className="text-xs">Grade 7</SelectItem>
                                                <SelectItem value="8" className="text-xs">Grade 8</SelectItem>
                                                <SelectItem value="9" className="text-xs">Grade 9</SelectItem>
                                                <SelectItem value="10" className="text-xs">Grade 10</SelectItem>
                                        </SelectContent>
                                </Select>
                                <div className="ml-auto flex items-center gap-2">"""
content = content.replace(old_toolbar, new_toolbar)

with open("D:\\ATLAS\\atlas-client\\src\\pages\\FacultyAssignments.tsx", "w", encoding="utf-8") as f:
    f.write(content)
