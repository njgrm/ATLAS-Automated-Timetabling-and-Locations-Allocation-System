import { MUST_FIX_LABEL } from '@/lib/timetable-plain-language';

export function filteredEmptyExplanation(input: { severityFilter: string; hiddenCount: number; hasSearch: boolean }): { sentence: string; action: string } {
	const n = input.hiddenCount;
	const isAre = n === 1 ? 'is' : 'are';
	const warnings = `${n} warning${n === 1 ? '' : 's'}`;
	const mustFix = `${n} ${MUST_FIX_LABEL} problem${n === 1 ? '' : 's'}`;
	if (input.severityFilter === 'hard') return { sentence: `No ${MUST_FIX_LABEL} problems. ${warnings} ${isAre} hidden by this filter.`, action: `Show ${warnings}` };
	if (input.severityFilter === 'soft') return { sentence: `No warnings. ${mustFix} ${isAre} hidden by this filter.`, action: `Show ${mustFix}` };
	const entries = `${n} entr${n === 1 ? 'y' : 'ies'}`;
	return { sentence: input.hasSearch ? `No violations match your search. ${entries} ${isAre} hidden.` : `No violations shown by this filter. ${entries} ${isAre} hidden.`, action: 'Show all violations' };
}
