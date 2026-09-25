export type TimetableLayoutMode = 'simple' | 'advanced';

export type TimetableSimpleTask =
	| 'place-unresolved'
	| 'swap-sessions'
	| 'review-issues'
	| 'plan-draft'
	| 'publish'
	/** DRAFT-UX-C01 (S5) — the unassigned sessions list in the Simple layout. */
	| 'unassigned-sessions';

