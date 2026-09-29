/**
 * A5 C4 ITEM 3 (2026-09-29) — the `/subjects` catalog body, and the ONE progress
 * panel that stands in for it while the first catalog response is outstanding.
 *
 * WHY THIS FILE EXISTS, AND WHY IT IS A PURE MOVE FIRST.
 *
 * The finding (Lane C, Codex staging walk, train 6): *"Never show an empty table
 * under 'Checking source'. Show one progress panel until rows are ready."* Codex run
 * 2 called it MAJOR and said why: *"an empty table under 'Checking source' invites
 * guessing"*.
 *
 * The defect is a disagreement between two things on one screen. The source chip is
 * driven by `!actorScopeResolved || loading` and reads **Checking source**; the body
 * underneath it rendered the table shell unconditionally, filling `tbody` with EIGHT
 * SKELETON ROWS while `loading` and an empty-state panel when `paged.length === 0`.
 * So a scheduler could read "Checking source" above a grid of grey bars, or above
 * "No subjects found." — neither of which says which of the two things is
 * happening, and both of which invite the reader to guess.
 *
 * This module was created as a PURE MOVE of that block before any behaviour
 * changed, so the failing-first run for A5 C4-3a/3b/3c below could execute against
 * REAL production code that still carried the defect. A test written first against
 * the page would have needed the whole authenticated page graph mocked; a test
 * written first against a component that did not yet exist would have failed with
 * "module not found", which discriminates nothing (`AGENTS.md` §11). Moving the
 * block first keeps the failure real and the harness small.
 *
 * THE DESIGN GATE, APPLIED (`AGENTS.md` §11).
 *   1 ONE PRIMARY ACTION — nothing to do while loading is the honest state, and
 *     the panel says so in one sentence rather than offering a grid to stare at.
 *   2 NOTHING CRAMPED — one centred panel, no grid of half-drawn rows.
 *   3 NO JARGON — "Loading subjects…" names the page and the wait, nothing else.
 *   4 ONE STATUS PER FACT — the panel and the chip now describe the SAME fact. That
 *     agreement is the whole item, and `A5-C4-3c` is the row that decides it.
 *
 * SUBTRACT FIRST. The eight skeleton rows are GONE, not supplemented. The screen
 * has fewer things in it than it had before, which is the point.
 *
 * UNCHANGED AND NAMED AS UNCHANGED: the resolved-empty state, the footer
 * pagination, the mobile list, and the scope-unavailable panel (which lives in the
 * page, above this component, and is a different fact entirely). A slow load that
 * EVENTUALLY resolves with rows shows the rows: the panel is bounded by the first
 * response, not by a timer, and no timer is introduced here.
 */
import { BookOpen } from 'lucide-react';
import { AdminStatePanel, AdminTableShell } from '@/components/admin-workspace/AdminWorkspace';
import { SubjectRow } from '@/components/subjects/SubjectRow';
import { SubjectMobileList } from '@/components/subjects/SubjectMobileList';
import { SubjectTablePagination } from '@/components/subjects/SubjectTablePagination';
import { SubjectTermContractPopover } from '@/components/subjects/SubjectTermContractPopover';
import { SortableHeader, type SortField, type SortDir } from '@/components/subjects/SortableHeader';
import { SUBJECT_ACTION_COLUMN_WIDTH_CLASS, SUBJECT_ACTION_COLUMN_Z } from '@/components/subjects/subject-action-column';
import type { Subject, TermAuthority, SubjectCoverageRow } from '@/types';

/**
 * THE PROGRESS PANEL. One centred `AdminStatePanel` — the SAME component the page
 * already uses for its empty and unavailable states, so this is a shape the page
 * already knows how to render rather than a new one.
 */
export function SubjectCatalogProgress() {
	return (
		<div className="px-4 py-20" data-testid="subjects-catalog-progress">
			<AdminStatePanel
				icon={<BookOpen className="size-8" />}
				title="Loading subjects…"
				description="ATLAS is reading the subject catalog for this school."
			/>
		</div>
	);
}

type Props = {
	/** True until the FIRST catalog response resolves, or the actor scope is unresolved. */
	loading: boolean;
	paged: Subject[];
	subjects: Subject[];
	coverageBySubjectId?: Map<number, SubjectCoverageRow> | null;	termAuthority: TermAuthority | null;
	sortField: SortField;
	sortDir: SortDir;
	onToggleSort: (field: SortField) => void;
	page: number;
	pageSize: number;
	totalFiltered: number;
	totalPages: number;
	onPageChange: (page: number) => void;
	onPageSizeChange: (size: number) => void;
	onReviewCoverage: (subject: Subject) => void;
	onEdit: (subject: Subject) => void;
	onArchive: (subject: Subject) => void;
	onDelete: (subject: Subject) => void;
	onReactivate: (subject: Subject) => void;
};

export function SubjectCatalogBody({
	loading,
	paged,
	subjects,
	coverageBySubjectId,
	termAuthority,
	sortField,
	sortDir,
	onToggleSort,
	page,
	pageSize,
	totalFiltered,
	totalPages,
	onPageChange,
	onPageSizeChange,
	onReviewCoverage,
	onEdit,
	onArchive,
	onDelete,
	onReactivate,
}: Props) {
	// A5 C4: the panel REPLACES the table shell while the first response is
	// outstanding. It is not drawn alongside it. That is the subtraction, and it is
	// also what makes the chip and the body agree: there is no state in which the
	// chip says "Checking source" and the body shows rows, a grid of skeletons, or
	// "No subjects found.".
	//
	// NOT A TIMER. The panel is bounded by the FIRST RESPONSE, so a slow load that
	// eventually resolves shows the rows. Nothing here converts a hang into an
	// error, retries, or polls — the stall itself is A8's row, and inventing a
	// timeout here would be working around it.
	if (loading) {
		return (
			<AdminTableShell>
				<SubjectCatalogProgress />
			</AdminTableShell>
		);
	}

	return (
		<AdminTableShell
			footer={subjects.length > 0 ? (
				<SubjectTablePagination
					leading={<SubjectTermContractPopover termAuthority={termAuthority} />}
					page={page}
					pageSize={pageSize}
					totalFiltered={totalFiltered}
					totalPages={totalPages}
					onPageChange={onPageChange}
					onPageSizeChange={onPageSizeChange}
				/>
			) : undefined}
		>
			<SubjectMobileList
				loading={false}
				paged={paged}
				subjects={subjects}
				/* `SubjectMobileList` declares this prop as `Map | null`, while the page
				 * holds it as possibly-undefined before the coverage read resolves. The
				 * normalisation is here rather than at the call site so both the page and
				 * any future caller get the same value. */
				coverageBySubjectId={coverageBySubjectId ?? null}
				onReviewCoverage={onReviewCoverage}
				onEdit={onEdit}
				onArchive={onArchive}
				onReactivate={onReactivate}
				onDelete={onDelete}
			/>
			<table className="hidden w-full text-sm md:table">
				{/* A5 C7 ITEM 44 — THE HEADER ROW, RAISED ABOVE THE STICKY BODY CELLS.
				 *
				 * `sticky` + `z-index` creates a STACKING CONTEXT, so this `thead`'s
				 * `z` is what decides the header row against everything OUTSIDE it,
				 * and no `z` on a child `<th>` can change that. It used to be `z-10`
				 * — the SAME value as every row's sticky action `<td>`
				 * (`SubjectRow.tsx`) — and two siblings at the same `z` paint in
				 * document order, so `tbody` won and the header's ACTION column was
				 * covered by row buttons as soon as the list scrolled. The `th`'s own
				 * `z-20` never fixed it: it was resolved inside this context.
				 *
				 * `bg-muted`, NOT `bg-muted/90`. The `/90` alpha plus a
				 * `backdrop-blur` meant a row button underneath was legible THROUGH
				 * the header. That is a read-only column of labels and the only
				 * column with a `sticky` background, so it gets an opaque one; with
				 * an opaque fill the blur has nothing to blur, so it is dropped
				 * rather than left as an inert class. */}
				<thead className={`sticky top-0 ${SUBJECT_ACTION_COLUMN_Z} bg-muted`}>
					<tr className="border-b">
						{/* Phase 2.4: SortableHeader helper mirrors Phase 1.5. aria-sort
							exposes the sort state, the button carries an accessible
							name + visible Tooltip. The helper closes over the
							component's sortField/sortDir/toggleSort. */}
						<SortableHeader field="name" label="Subject" sortField={sortField} sortDir={sortDir} onToggleSort={onToggleSort} align="left" />
						<SortableHeader field="gradeLevels" label="Grade level / program" sortField={sortField} sortDir={sortDir} onToggleSort={onToggleSort} align="left" />
						<SortableHeader field="minMinutesPerWeek" label="Weekly need" sortField={sortField} sortDir={sortDir} onToggleSort={onToggleSort} align="left" />
						<SortableHeader field="preferredRoomType" label="Room need" sortField={sortField} sortDir={sortDir} onToggleSort={onToggleSort} align="left" />
						{/* SCA-01.2: Teacher coverage is a plain column, not a
							sort. Sorting by isSeedable presented bootstrap
							seed state as operator priority. */}
						<th className="px-4 py-3 text-left font-semibold text-muted-foreground uppercase tracking-wider text-xs">Teacher coverage</th>
						{/* A5 C7 ITEM 44 — the `z-20` THAT WAS HERE IS DELIBERATELY GONE.
						 *
						 * It could never have worked: a `z-index` on a child is resolved
						 * within its parent's stacking context, so raising this `th`
						 * above the body cells was impossible while `thead` sat at
						 * `z-10`. Leaving `z-20` in place would have been worse than
						 * useless — it reads as "this cell is protected" and is exactly
						 * the misreading that shipped the defect.
						 *
						 * Nothing is lost by dropping it. Within the `thead` this cell
						 * still needs to beat its SIBLINGS, and a positioned element
						 * paints above non-positioned ones regardless of `z-index`, so
						 * `sticky right-0` alone keeps it above the other five headers.
						 * Against the `tbody` the header row is now decided one level
						 * up, by `SUBJECT_ACTION_COLUMN_Z` on the `thead`.
						 *
						 * The fixed width is shared with each row's `<td>` so the column
						 * edge lines up instead of the header and the cells each
						 * deciding it. */}
						<th className={`sticky right-0 border-l border-border/40 bg-muted py-3 text-right font-semibold text-muted-foreground uppercase tracking-wider text-xs ${SUBJECT_ACTION_COLUMN_WIDTH_CLASS}`}>
							Action
						</th>
					</tr>
				</thead>
				<tbody className="divide-y divide-border/40">
					{paged.length === 0 ? (
						<tr>
							<td colSpan={6} className="px-4 py-20 text-center">
								<AdminStatePanel icon={<BookOpen className="size-8" />} title={subjects.length === 0 ? 'No subjects found.' : 'No matches found.'} description={subjects.length === 0 ? 'The catalog is empty for this school. Add the first subject to start the list.' : 'Clear a filter or search another subject name or code.'} />
							</td>
						</tr>
					) : (
						paged.map((s) => (
							<SubjectRow
								key={s.id}
								subject={s}
								timeMode="hours"
								coverageRow={coverageBySubjectId?.get(s.id) ?? undefined}
								onEdit={onEdit}
								onDelete={onDelete}
								onArchive={onArchive}
								onShowCoverage={onReviewCoverage}
								onReactivate={onReactivate}
							/>
						))
					)}
				</tbody>
			</table>
		</AdminTableShell>
	);
}
