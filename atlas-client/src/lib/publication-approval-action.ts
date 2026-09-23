export type PublicationActionIntent = 'request-approval' | 'direct-publish';

export function resolvePublicationActionIntent(role: string | null | undefined): PublicationActionIntent {
	return role === 'scheduler' ? 'request-approval' : 'direct-publish';
}
