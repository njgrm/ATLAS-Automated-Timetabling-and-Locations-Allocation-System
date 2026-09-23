# Scheduler role upstream prerequisite

ATLAS grants the `scheduler` role only when the verified EnrollPro role claim
contains `GRADE_LEVEL_COORDINATOR`. A combined `TEACHER` plus
`GRADE_LEVEL_COORDINATOR` claim also receives `faculty:self-service`; a
coordinator-only claim does not.

ATLAS must not infer this authority from employee IDs, names, account names,
designation text, or local seed membership. EnrollPro's current seed flow reports
`TEACHER` for the four intended accounts and does not currently provide the
coordinator claim. Those accounts therefore remain faculty-only until EnrollPro
issues the authoritative role claim. The EnrollPro source repository remains
read-only for this ATLAS change.
