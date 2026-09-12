import { appendFileSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Durable, timestamped, size-bounded log writer with deterministic rotation.
 *
 * Bounds are enforced by the contract (`logs.maxBytes`, `logs.maxFiles`). When
 * the active file would exceed `maxBytes`, files rotate `.log -> .1.log ->
 * .2.log ...` and the oldest beyond `maxFiles` total files is removed. Logging
 * never grows without limit and never silently drops the active transcript.
 */
export function formatLogLine(options) {
	const timestamp = (options.now ?? new Date()).toISOString();
	const level = String(options.level ?? 'info').toLowerCase();
	const component = options.component ? ` [${options.component}]` : '';
	return `${timestamp} [${level}]${component} ${options.message}\n`;
}

/**
 * Replace every known secret value with a fixed marker. Defense-in-depth: the
 * supervisor never intentionally logs secret values, and this scrub runs on
 * every emitted line so an accidental interpolation cannot leak one.
 */
export function redactSecretValues(text, secretValues = []) {
	let output = String(text);
	for (const value of secretValues) {
		if (typeof value !== 'string' || value.length < 4) continue;
		output = output.split(value).join('***REDACTED***');
	}
	return output;
}

export function logFileNames(base) {
	return { active: `${base}.log`, rotated: (index) => `${base}.${index}.log` };
}

export class BoundedLogger {
	constructor(options) {
		this.directory = options.directory;
		this.base = options.fileBaseName;
		this.maxBytes = options.maxBytes;
		this.maxFiles = options.maxFiles;
		this.component = options.component ?? 'supervisor';
		this.now = options.now ?? (() => new Date());
		this.secretValues = options.secretValues ?? [];
		this.fs = {
			appendFileSync: options.appendFileSync ?? appendFileSync,
			existsSync: options.existsSync ?? existsSync,
			mkdirSync: options.mkdirSync ?? mkdirSync,
			renameSync: options.renameSync ?? renameSync,
			rmSync: options.rmSync ?? rmSync,
			statSync: options.statSync ?? statSync,
			writeFileSync: options.writeFileSync ?? writeFileSync,
			readdirSync: options.readdirSync ?? readdirSync,
		};
		this.ensureDirectory();
	}

	ensureDirectory() {
		if (!this.fs.existsSync(this.directory)) {
			this.fs.mkdirSync(this.directory, { recursive: true });
		}
	}

	get activePath() {
		return join(this.directory, `${this.base}.log`);
	}

	activeSize() {
		try {
			return this.fs.statSync(this.activePath).size;
		} catch {
			return 0;
		}
	}

	/** Enforce the file-count bound even if older runs left extra files. */
	enforceFileBound() {
		const rotated = [];
		for (let i = 1; i < 1000; i += 1) {
			const path = join(this.directory, `${this.base}.${i}.log`);
			if (!this.fs.existsSync(path)) break;
			rotated.push(path);
		}
		const excess = rotated.length - (this.maxFiles - 1);
		for (let i = 0; i < excess; i += 1) {
			try {
				this.fs.rmSync(rotated[i], { force: true });
			} catch {
				/* best-effort bound enforcement; the active transcript is intact */
			}
		}
	}

	rotate() {
		const oldest = join(this.directory, `${this.base}.${this.maxFiles - 1}.log`);
		if (this.fs.existsSync(oldest)) this.fs.rmSync(oldest, { force: true });
		for (let i = this.maxFiles - 2; i >= 1; i -= 1) {
			const from = join(this.directory, `${this.base}.${i}.log`);
			if (this.fs.existsSync(from)) this.fs.renameSync(from, join(this.directory, `${this.base}.${i + 1}.log`));
		}
		if (this.fs.existsSync(this.activePath)) {
			this.fs.renameSync(this.activePath, join(this.directory, `${this.base}.1.log`));
		}
		this.fs.writeFileSync(this.activePath, '');
	}

	write(level, message) {
		const line = redactSecretValues(formatLogLine({ level, message, component: this.component, now: this.now() }), this.secretValues);
		const bytes = Buffer.byteLength(line, 'utf8');
		if (this.activeSize() + bytes > this.maxBytes) {
			this.rotate();
			this.enforceFileBound();
		}
		this.fs.appendFileSync(this.activePath, line);
		return line.length;
	}

	info(message) {
		return this.write('info', message);
	}

	warn(message) {
		return this.write('warn', message);
	}

	error(message) {
		return this.write('error', message);
	}
}

/** Total bytes and file count actually present for a base name. */
export function measureLogFootprint(directory, base, fsImpl = {}) {
	const exists = fsImpl.existsSync ?? existsSync;
	const stat = fsImpl.statSync ?? statSync;
	const listing = fsImpl.readdirSync ?? readdirSync;
	const names = exists(directory) ? listing(directory) : [];
	const files = names.filter((name) => name === `${base}.log` || new RegExp(`^${base}\\.\\d+\\.log$`).test(name));
	let bytes = 0;
	for (const name of files) {
		bytes += stat(join(directory, name)).size;
	}
	return { fileCount: files.length, bytes };
}
