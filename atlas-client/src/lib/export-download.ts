/**
 * EXPORT-FILENAME-FIX — one download identity for every server-generated ATLAS
 * export.
 *
 * The server already emits a correct, school-year-bearing
 * `Content-Disposition` (`<type>[-<entity>]-SY<year>-term<N>.<ext>`) plus the
 * matching OOXML MIME type. Before this module the client built its own name
 * from possibly-stale context and discarded the header, so a download could
 * land with a divergent or extension-less name that the OS could not associate
 * with Excel/Word ("it downloaded but I can't open it"). The helpers here parse
 * the authoritative server header, derive a MIME type from the resolved
 * extension, and trigger the download with the resulting filename.
 */

const EXPORT_MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
	xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	csv: 'text/csv;charset=utf-8',
	pdf: 'application/pdf',
};

/** Lowercased extension of a filename or URL path, or `null` when it has none. */
export function extensionOf(value: string): string | null {
	const withoutQuery = value.split('?')[0]?.split('#')[0] ?? value;
	const match = /\.([A-Za-z0-9]+)$/.exec(withoutQuery.trim());
	return match ? match[1].toLowerCase() : null;
}

/** Browser/OS MIME type for a resolved export filename. */
export function mimeTypeForFilename(filename: string): string {
	const extension = extensionOf(filename);
	return (extension && EXPORT_MIME_BY_EXTENSION[extension]) || 'application/octet-stream';
}

/**
 * Reduce a server-provided name to a safe single path segment. Rejects empty,
 * `.`, `..`, and any name that tried to smuggle a directory component.
 */
function sanitizeFilename(value: string): string | null {
	const basename = value.split(/[\\/]/).pop() ?? '';
	// Strip control characters and the quote wrapper so the name cannot escape
	// the download attribute or the Content-Disposition grammar.
	const cleaned = basename.replace(/[\u0000-\u001f\u007f"]/g, '').trim();
	if (cleaned.length === 0 || cleaned === '.' || cleaned === '..') return null;
	return cleaned;
}

function decodeRfc5987(value: string): string | null {
	try {
		return decodeURIComponent(value);
	} catch {
		return null;
	}
}

/**
 * Parse the exact filename the server attached to an export. The RFC 5987
 * `filename*=UTF-8''…` form wins over the legacy `filename=` parameter, per
 * RFC 6266. Returns `null` when the header carries no usable name.
 */
export function parseContentDispositionFilename(header: string | null | undefined): string | null {
	if (!header || header.trim().length === 0) return null;

	const starMatch = /filename\*\s*=\s*([^;]+)/i.exec(header);
	if (starMatch) {
		const raw = starMatch[1].trim();
		// Drop the `UTF-8''` (or any charset/language) prefix before decoding.
		const payload = raw.replace(/^[^']*'[^']*'/, '');
		const decoded = decodeRfc5987(payload);
		const sanitized = decoded ? sanitizeFilename(decoded) : null;
		if (sanitized) return sanitized;
	}

	const plainMatch = /filename\s*=\s*(?:"([^"]*)"|'([^']*)'|([^;]+))/i.exec(header);
	if (plainMatch) {
		const value = (plainMatch[1] ?? plainMatch[2] ?? plainMatch[3] ?? '').trim();
		const sanitized = sanitizeFilename(value);
		if (sanitized) return sanitized;
	}

	return null;
}

/** Minimal shape of the fetch `Response` we depend on (keeps fakes testable). */
type HeaderBearer = { headers?: { get?: (name: string) => string | null } | null } | null | undefined;

/**
 * Resolve the download name for a fetched export response: the server
 * `Content-Disposition` filename when present and usable, otherwise the
 * caller's constructed fallback.
 */
export function resolveDownloadFilename(response: HeaderBearer, fallback: string): string {
	const header = response?.headers?.get?.('Content-Disposition') ?? null;
	return parseContentDispositionFilename(header) ?? fallback;
}

/**
 * Guarantee the resolved name carries the export's authoritative extension.
 * The extension is taken from the request URL path (e.g.
 * `.../class-program.xlsx?termIndex=2`), so a header-less fallback or a
 * truncated name can never produce an extension-less download. A wrong trailing
 * extension is replaced with the authoritative one.
 */
export function ensureFilenameExtension(filename: string, sourceUrl: string): string {
	const expected = extensionOf(sourceUrl);
	if (!expected) return filename;
	const current = extensionOf(filename);
	if (current === expected) return filename;
	if (current) return `${filename.slice(0, -(current.length + 1))}.${expected}`;
	return `${filename}.${expected}`;
}

/**
 * Re-type a downloaded blob so the OS resolves the correct Excel/Word handler.
 * A correct server MIME type is preserved untouched; an empty or generic
 * `application/octet-stream` type is replaced with the extension-derived one.
 */
export function withExportMimeType(blob: Blob, filename: string): Blob {
	if (blob.type && blob.type !== 'application/octet-stream') return blob;
	return new Blob([blob], { type: mimeTypeForFilename(filename) });
}

export type BlobDownloadDeps = {
	createObjectUrl?: (blob: Blob) => string;
	revokeObjectUrl?: (url: string) => void;
	triggerDownload?: (objectUrl: string, filename: string) => void;
	/** Defer the object-URL revoke so the browser can finish the download. */
	scheduleRevoke?: (revoke: () => void) => void;
	documentRef?: Document;
};

/**
 * Trigger one download for an already-fetched blob under the exact filename.
 * The object URL is revoked only after the click has been dispatched (next
 * task), so a slow browser cannot have the source yanked out from under it.
 */
export function triggerBlobDownload(blob: Blob, filename: string, deps: BlobDownloadDeps = {}): void {
	const typed = withExportMimeType(blob, filename);
	const objectUrl = (deps.createObjectUrl ?? URL.createObjectURL)(typed);
	if (deps.triggerDownload) {
		deps.triggerDownload(objectUrl, filename);
	} else {
		const doc = deps.documentRef ?? document;
		const anchor = doc.createElement('a');
		anchor.href = objectUrl;
		anchor.download = filename;
		anchor.rel = 'noopener';
		doc.body?.appendChild(anchor);
		anchor.click();
		anchor.remove();
	}
	const revoke = () => (deps.revokeObjectUrl ?? URL.revokeObjectURL)(objectUrl);
	if (deps.scheduleRevoke) deps.scheduleRevoke(revoke);
	else setTimeout(revoke, 0);
}
