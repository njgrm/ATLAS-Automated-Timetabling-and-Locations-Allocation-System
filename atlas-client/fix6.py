import re

with open("D:\\ATLAS\\atlas-client\\src\\pages\\FacultyAssignments.tsx", "r", encoding="utf-8") as f:
    text = f.read()

# 1. Fix the double return and const injection
old_return = """return (
\t\t\t\t\t\t\t\t\tconst gradeStyle = getGradeColors(gradeLevel);
\t\t\t\t\t\t\t\t\treturn (
\t\t\t\t\t\t\t\t<div key={gradeLevel} className={`overflow-hidden rounded-md border ${gradeStyle.container}`}>"""
new_return = """const gradeStyle = getGradeColors(gradeLevel);
\t\t\t\t\t\t\t\treturn (
\t\t\t\t\t\t\t\t<div key={gradeLevel} className={`overflow-hidden rounded-md border ${gradeStyle.container}`}>"""
text = text.replace(old_return, new_return)

# 2. Add advisedSectionId to SubjectRowProps
old_props = """        gradeLevelFilter?: string;
};"""
new_props = """        gradeLevelFilter?: string;
        advisedSectionId?: number | null;
};"""
text = text.replace(old_props, new_props)

# 3. Add advisedSectionId as param in SubjectRow
old_func = """        sectionFilter = 'all',
        gradeLevelFilter = 'all',
}: SubjectRowProps) {"""
new_func = """        sectionFilter = 'all',
        gradeLevelFilter = 'all',
        advisedSectionId = null,
}: SubjectRowProps) {"""
text = text.replace(old_func, new_func)

# 4. Pass advisedSectionId to SubjectRow
old_pass = """\t\t\t\t\t\t\t\tsectionFilter={sectionFilter}
/>"""
new_pass = """\t\t\t\t\t\t\t\tsectionFilter={sectionFilter}
\t\t\t\t\t\t\t\tadvisedSectionId={homeroomHint?.advisedSectionId ?? null}
/>"""
text = text.replace(old_pass, new_pass)

with open("D:\\ATLAS\\atlas-client\\src\\pages\\FacultyAssignments.tsx", "w", encoding="utf-8") as f:
    f.write(text)
