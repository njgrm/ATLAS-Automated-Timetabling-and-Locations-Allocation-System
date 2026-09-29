import { Link } from 'react-router-dom';

/**
 * A7 c12b (decision 8 / CORRECTION item 5) — the year-change banner is ONE
 * `role="status"` sentence with exactly ONE interactive element: the `Year Setup`
 * link.
 *
 * ── WHAT IT REPLACES, AND WHY ────────────────────────────────────────────────
 * The band used to carry two buttons (`View past years`, `Year Setup`) and a
 * dismiss `×`: three controls for one fact, in the header region the operator
 * called "crowded and dense". §8's header budget counts everything above the
 * grid. The proposal moved `View past years` into the More menu and the banner
 * collapses to a single sentence whose one link is `Year Setup`.
 *
 * ── THE DISMISSAL TRADE-OFF, RECORDED RATHER THAN LEFT SILENT ────────────────
 * The `×` is gone. Activating the `Year Setup` link ALSO clears the persisted
 * notice, so dismissal is preserved in effect (the operator leaves the banner by
 * acting on it). The 14-day `ROLLOVER_NOTICE_TTL_MS` remains the backstop for a
 * notice nobody acts on. This is a deliberate subtraction: a dismiss-only control
 * is one more thing on a line that must read as a single sentence, and the fact
 * it carries is transient by construction.
 *
 * ── ONE SENTENCE ─────────────────────────────────────────────────────────────
 * The trailing `This page refreshed with the new active year.` is dropped: with
 * the band reduced to one line, that clause made it two sentences where the
 * operator asked for one. The two facts that matter — the new active year and
 * that the previous year is archived and read-only — stay truthful and unchanged.
 */
export type RolloverAwarenessNoticeProps = {
	notice: {
		activeSchoolYearLabel: string;
		previousSchoolYearLabel: string;
		previousSchoolYearId: number;
	};
	/** Activating `Year Setup` clears the notice (dismissal preserved in effect). */
	onActivate?: () => void;
};

export function RolloverAwarenessNotice({ notice, onActivate }: RolloverAwarenessNoticeProps) {
	return (
		<section
			role="status"
			aria-live="polite"
			data-testid="rollover-awareness-notice"
			className="flex min-w-0 items-center gap-2 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-950"
		>
			<p className="min-w-0 leading-relaxed">
				School year changed to <strong>{notice.activeSchoolYearLabel}</strong>.{' '}
				{notice.previousSchoolYearLabel} is archived and read-only.{' '}
				<Link
					to="/admin/year-setup"
					onClick={onActivate}
					className="font-semibold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
				>
					Year Setup
				</Link>
			</p>
		</section>
	);
}
