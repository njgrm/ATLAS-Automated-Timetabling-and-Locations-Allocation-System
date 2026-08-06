export function SandboxEntryBadge() {
	return (
		<span className="rounded bg-emerald-100 px-1 py-0.5 text-xs font-bold uppercase tracking-wide text-emerald-700 shrink-0">
			Sandbox
		</span>
	);
}

export function TeacherDepartureEntryBadge() {
	return (
		<span
			className="rounded bg-violet-100 px-1 py-0.5 text-xs font-bold uppercase tracking-wide text-violet-700 shrink-0"
			data-testid="teacher-departure-grid-badge"
		>
			Needs new teacher
		</span>
	);
}
