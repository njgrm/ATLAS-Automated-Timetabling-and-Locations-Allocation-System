type ActionableErrorPayload = {
	message?: unknown;
	actionHint?: unknown;
};

export function getActionableApiError(error: unknown, fallback: string): string {
	const payload = (error as { response?: { data?: ActionableErrorPayload } })?.response?.data;
	const message = typeof payload?.message === 'string' ? payload.message.trim() : '';
	const actionHint = typeof payload?.actionHint === 'string' ? payload.actionHint.trim() : '';
	return [message, actionHint].filter(Boolean).join(' ') || fallback;
}
