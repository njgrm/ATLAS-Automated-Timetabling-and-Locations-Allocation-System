import sys
from pathlib import Path

path = Path('src/pages/FacultyAssignments.tsx')
code = path.read_text(encoding='utf-8')

def replace(old_sub, new_sub, label):
    global code
    if old_sub in code:
        code = code.replace(old_sub, new_sub)
        print(f"OK {label}")
    else:
        print(f"FAILED {label}")
        sys.exit(1)

# 1. Imports
replace(
    "\tStar,\n} from 'lucide-react';",
    "\tStar,\n\tPencil,\n} from 'lucide-react';",
    "Imports"
)

# 2. Accordion Headers
replace(
    '{GRADE_COLORS[String(gradeLevel)] ? GRADE_COLORS[String(gradeLevel)].replace(\'bg-\', \'border-\').replace(\'/80\', \'/30\').replace(\' text-\', \' \') : \'border-border/70\'}',
    '{GRADE_COLORS[String(gradeLevel)] ? GRADE_COLORS[String(gradeLevel)].replace(\'/80\', \'/20\').replace(\' text-\', \' \') : \'border-border/70 bg-background\'}',
    "Header border"
)

replace(
    'className={`h-auto w-full justify-between rounded-none px-3 py-2 ${GRADE_COLORS[String(gradeLevel)] ? GRADE_COLORS[String(gradeLevel)].replace(\'/80\', \'/20\') : \'bg-background\'}`}',
    'className={`h-auto w-full justify-between rounded-none px-3 py-2 ${GRADE_COLORS[String(gradeLevel)] ? GRADE_COLORS[String(gradeLevel)].replace(\'/80\', \'/10\') : \'bg-transparent\'}`}',
    "Header button"
)

# 3. Badgelabels
badgelabel_old = """\t\t\t\t\t\t\t\t\t\tconst badgeLabel = isPendingOther
\t\t\t\t\t\t\t\t\t\t\t? `Pending: ${formatOwnerName(pendingOwner?.facultyName)}`
\t\t\t\t\t\t\t\t\t\t\t: isSavedOther
\t\t\t\t\t\t\t\t\t\t\t? `Saved: ${formatOwnerName(savedOwner?.facultyName)}`
\t\t\t\t\t\t\t\t\t\t\t: isPendingCurrent
\t\t\t\t\t\t\t\t\t\t\t? 'Pending'
\t\t\t\t\t\t\t\t\t\t\t: isSavedCurrent
\t\t\t\t\t\t\t\t\t\t\t? 'Saved'
\t\t\t\t\t\t\t\t\t\t\t: null;
\t\t\t\t\t\t\t\t\t\treturn ("""
badgelabel_new = """\t\t\t\t\t\t\t\t\t\tconst badgeProps = isPendingOther
\t\t\t\t\t\t\t\t\t\t\t? { text: pendingOwner?.facultyName, mode: 'pending' }
\t\t\t\t\t\t\t\t\t\t\t: isSavedOther
\t\t\t\t\t\t\t\t\t\t\t? { text: savedOwner?.facultyName, mode: 'saved' }
\t\t\t\t\t\t\t\t\t\t\t: isPendingCurrent
\t\t\t\t\t\t\t\t\t\t\t? { text: 'Pending', mode: 'pending' }
\t\t\t\t\t\t\t\t\t\t\t: isSavedCurrent
\t\t\t\t\t\t\t\t\t\t\t? { text: 'Saved', mode: 'saved' }
\t\t\t\t\t\t\t\t\t\t\t: null;
\t\t\t\t\t\t\t\t\t\t
\t\t\t\t\t\t\t\t\t\tconst gradeTint = section.displayOrder === 7 ? 'bg-green-50/70 hover:bg-green-100/50' : section.displayOrder === 8 ? 'bg-yellow-50/70 hover:bg-yellow-100/50' : section.displayOrder === 9 ? 'bg-red-50/70 hover:bg-red-100/50' : section.displayOrder === 10 ? 'bg-blue-50/70 hover:bg-blue-100/50' : 'bg-muted/30 hover:bg-muted/50';
\t\t\t\t\t\t\t\t\t\tconst borderState = blocked ? 'cursor-not-allowed border-red-300 opacity-70' : isSelected ? 'border-primary ring-1 ring-primary/40' : 'border-border/60';

\t\t\t\t\t\t\t\t\t\treturn ("""
replace(badgelabel_old, badgelabel_new, "Badge props")

# 4. Tile Outer class
old_tile_class = """\t\t\t\t\t\t\t\t\t\t\t\t\tclassName={`flex flex-col gap-1.5 rounded-md border p-2 transition-colors ${
\t\t\t\t\t\t\t\t\t\t\t\t\t\tblocked ? 'cursor-not-allowed border-red-300 bg-red-50/50 opacity-70' : isSelected ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/20' : `border-border/60 ${section.displayOrder === 7 ? 'hover:bg-green-50/40 bg-green-50/10' : section.displayOrder === 8 ? 'hover:bg-yellow-50/40 bg-yellow-50/10' : section.displayOrder === 9 ? 'hover:bg-red-50/40 bg-red-50/10' : section.displayOrder === 10 ? 'hover:bg-blue-50/40 bg-blue-50/10' : 'hover:bg-muted/30'}`
\t\t\t\t\t\t\t\t\t\t\t\t\t}`}"""
new_tile_class = "\t\t\t\t\t\t\t\t\t\t\t\t\tclassName={`flex flex-col gap-1.5 rounded-md border p-2 transition-colors ${gradeTint} ${borderState}`}"
replace(old_tile_class, new_tile_class, "Tile outer wrapper")

# 5. Checkbox line
old_cb = '<Checkbox checked={isSelected} onCheckedChange={() => toggleSection(section.id)} disabled={disabled || blocked} className="mt-0.5 shrink-0" />'
new_cb = '<Checkbox checked={isSelected} onCheckedChange={() => toggleSection(section.id)} disabled={disabled || blocked} className="mt-0.5 shrink-0 bg-white" />'
replace(old_cb, new_cb, "Checkbox bg white")

# 6. Star logic + removing badgeLabel old
old_interior = """\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<p className="text-[0.6875rem] font-semibold leading-tight break-words">{section.name}</p>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t{section.programCode && section.programCode !== 'REGULAR' && (
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<p className="text-[0.5625rem] text-muted-foreground break-words mt-[2px]">{section.programCode}</p>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t)}
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t{(advisedSectionId === section.id || badgeLabel) && (
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<div className="flex flex-wrap items-center gap-1 mt-0.5">
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t{advisedSectionId === section.id && (
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<Badge className="shrink-0 gap-0.5 border-amber-300 bg-amber-50 px-1 py-0 text-[0.5rem] tracking-tight text-amber-700 flex items-center shadow-none">
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<Star className="size-2.5 fill-amber-500 text-amber-500" />Advisory
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t</Badge>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t)}
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t{badgeLabel && (
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<Tooltip>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<TooltipTrigger asChild>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<Badge
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tvariant="outline"
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tclassName={`px-1 py-0 text-[0.5rem] tracking-tight leading-tight block w-fit max-w-full truncate shadow-none ${
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tisPendingOther
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t? 'border-red-200 bg-white/60 text-red-700'
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t: isSavedOther
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t? 'border-amber-200 bg-white/60 text-amber-700'
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t: isPendingCurrent
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t? 'border-sky-200 bg-white/60 text-sky-700'
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t: 'border-emerald-200 bg-white/60 text-emerald-700'
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t}`}
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t{badgeLabel}
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t</Badge>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t</TooltipTrigger>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<TooltipContent side="top" className="max-w-xs text-xs">
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t{isPendingOther && <p>{pendingOwner?.facultyName} has this subject-section pair in an unsaved session draft.</p>}
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t{isSavedOther && <p>{savedOwner?.facultyName} already owns this subject-section pair in saved data.</p>}
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t{isPendingCurrent && <p>This selection is pending in the current session and has not been saved yet.</p>}
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t{isSavedCurrent && !isPendingCurrent && <p>This subject-section pair is already saved for the selected teacher.</p>}
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t</TooltipContent>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t</Tooltip>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t)}
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t)}"""
new_interior = """\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<p className="text-[0.6875rem] font-semibold leading-tight break-words flex items-center gap-1.5">
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t{advisedSectionId === section.id && (
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<Star className="size-3.5 fill-amber-500 text-amber-500 shrink-0" aria-label="Adviser" />
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t)}
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t{section.name}
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t</p>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t{section.programCode && section.programCode !== 'REGULAR' && (
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<p className="text-[0.5625rem] text-muted-foreground break-words mt-[2px]">{section.programCode}</p>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t)}
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t{badgeProps && (
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<div className="flex flex-wrap items-center gap-1 mt-0.5">
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<Tooltip>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<TooltipTrigger asChild>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<Badge
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tvariant="outline"
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tclassName={`px-1.5 py-0.5 text-xs font-medium tracking-tight leading-tight flex items-center gap-1.5 max-w-full truncate shadow-sm ${
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tbadgeProps.mode === 'pending'
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t? 'border-amber-300 bg-amber-50/80 text-amber-800'
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t: 'border-emerald-300 bg-emerald-50/80 text-emerald-800'
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t}`}
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t{badgeProps.mode === 'pending' ? <Pencil className="size-3 shrink-0" /> : <CheckCircle2 className="size-3 shrink-0" />}
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<span className="truncate">{badgeProps.text}</span>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t</Badge>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t</TooltipTrigger>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<TooltipContent side="top" className="max-w-xs text-xs">
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t{isPendingOther && <p>{pendingOwner?.facultyName} has this subject-section pair in an unsaved session draft.</p>}
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t{isSavedOther && <p>{savedOwner?.facultyName} already owns this subject-section pair in saved data.</p>}
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t{isPendingCurrent && <p>This selection is pending in the current session and has not been saved yet.</p>}
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t{isSavedCurrent && !isPendingCurrent && <p>This subject-section pair is already saved for the selected teacher.</p>}
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t</TooltipContent>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t</Tooltip>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t)}"""

replace(old_interior, new_interior, "Tile interior update")

path.write_text(code, encoding='utf-8')
