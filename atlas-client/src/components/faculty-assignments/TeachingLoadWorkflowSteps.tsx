/**
 * A6-TL-DEMAND-SOURCE-C01 correction (bounded, behaviour-identical).
 *
 * The Teaching Load page's `sr-only` workflow steps, extracted verbatim so the
 * page has headroom under the AGENTS.md §8 1000-physical-line cap after a merge
 * with `origin/main`. It is pure presentation: no state, no props, no data. The
 * page renders it in the same position inside the header band, so the rendered
 * DOM and the accessible name are unchanged.
 */
export function TeachingLoadWorkflowSteps() {
	return (
		<p className="sr-only" aria-label="Teaching load workflow">
			<span className="text-foreground">1. Choose a teacher or section</span>
			<span aria-hidden="true" className="mx-2">→</span>
			<span className="text-foreground">2. Review the load and coverage</span>
			<span aria-hidden="true" className="mx-2">→</span>
			<span className="text-foreground">3. Save your changes</span>
		</p>
	);
}
