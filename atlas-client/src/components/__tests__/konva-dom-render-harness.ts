/**
 * A3 c11 — a DOM-render harness for the two KONVA surfaces this cycle changes.
 *
 * WHY THIS EXISTS. `react-konva` draws into a `<canvas>`, and jsdom ships no
 * 2D context (`HTMLCanvasElement.getContext()` returns `null` and logs
 * "Not implemented"), so a react-konva render throws
 * `TypeError: Cannot read properties of null (reading 'scale')`. That is why
 * every pre-existing control for `BuildingView` and `CampusMapEditor` is a
 * source-text or box-model assertion. Fix 7.1 is a *text-measurement* defect
 * (a name Konva ellipsises) and fix 36 is a *containment* defect (a rect drawn
 * outside its ground); neither is decidable by reading source. BOTH are
 * decidable from a real render, because Konva's own text-layout and scene code
 * decides both questions — it only needs a `measureText` and a 2D sink.
 *
 * WHAT IS REAL HERE, PRECISELY, because that is what decides whether this file
 * is evidence or theatre:
 *
 *  - REAL: `react-konva`, `konva@10.2.3`, React 19, and the production
 *    components under test, mounted through `react-dom/client` into jsdom.
 *  - REAL: Konva's own ellipsis decision (`Text.js:312-419`) and its own
 *    `Rect`/`Shape` scene functions. Konva decides whether a name is
 *    ellipsised and where each rect lands; this harness supplies only the two
 *    things a browser supplies: font metrics and a drawing surface.
 *  - REAL: `measureText`, computed from the published **Arial** advance widths
 *    — the metrics Konva's default `fontFamily: 'Arial'` (`Text.js:448`)
 *    resolves to on the ATLAS host, and which Arial shares with Helvetica. The
 *    font is read back out of `ctx.font` per call, so size and weight are
 *    honoured exactly as they are in a browser.
 *  - REAL: the drawn output. `fillText` and `fillRect` are recorded, and each
 *    recorded rect is composed with the transform Konva set immediately before
 *    it, so "the ground contains every building" is a claim about the
 *    coordinates Konva actually painted.
 *  - NOT REAL: rasterisation, colour, hit-testing, pointer events. No assertion
 *    below may claim a pixel, a scrollbar or a click. A browser row stays owed
 *    to a browser holder (Lane C / A4) for both items.
 *
 * A control that cannot fail is not evidence, so the two numbers the whole of
 * fix 7.1 turns on are derived from the tables at the foot of this file, and
 * every new control states the base-revision value it must differ from.
 */
import { JSDOM } from 'jsdom';

/* ── Arial advance widths, units per 1000 em, ASCII 32..126 ──────────────────
 * Standard Adobe Core 14 / Monotype Arial AFM. The two entries fix 7.1 turns on:
 *
 *   "Sampaguita" at Arial Bold 11px
 *     S 667 + a 556 + m 889 + p 611 + a 556 + g 611 + u 611 + i 278 + t 333 + a 556
 *     = 5668/1000 em = 62.35px
 *   "Sampaguita." = (5668 + 278)/1000 x 11 = 65.40px
 *
 * Konva keeps the whole last line only when `measureText(line + '.') < maxWidth`
 * (`Text.js:411-413`). At the base `maxWidth` of 62 BOTH fail, so Konva slices
 * three characters off and paints `Sampag.` — the exact string the live audit
 * recorded on `G9 Room 401`. The name is 62.35px, i.e. the base pill was 0.35px
 * short, which is why the number is stated to two decimals and not rounded into
 * a "close enough" either way. */
const AFM_REGULAR = [
	278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
	556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
	1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
	667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
	333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
	556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];
const AFM_BOLD = [
	278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
	556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
	975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
	667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
	333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
	611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];
/** A code point outside the table is measured at 1 em, so an unexpected glyph
 *  can only make a name WIDER (never narrower) and fail a fit control that
 *  should pass — the pessimistic direction. */
const FALLBACK_EM = 1000;

/** Advance width of `text` in px, for the CSS `font` shorthand Konva wrote. */
export function measureArialText(text: string, font: string): number {
	const size = /(\d+(?:\.\d+)?)px/.exec(font)?.[1];
	if (size === undefined) throw new Error(`unparseable ctx.font: ${font}`);
	const bold = /(^|\s)(bold|[6-9]00)(\s|$)/.test(font);
	const table = bold ? AFM_BOLD : AFM_REGULAR;
	let total = 0;
	for (const ch of text) {
		const code = ch.codePointAt(0) ?? 0;
		const advance = code >= 32 && code <= 126 ? table[code - 32] : undefined;
		total += advance === undefined ? FALLBACK_EM : advance;
	}
	return (total / 1000) * Number(size);
}

export type DrawnBox = { x: number; y: number; width: number; height: number };
export type DrawnFill = DrawnBox & { fill: string };
export type DrawnStroke = DrawnBox & { stroke: string; lineWidth: number };
export type DrawnText = { text: string; x: number; y: number; font: string };
export type KonvaRender = {
	host: HTMLElement;
	/** The distinct SHAPES Konva filled, first occurrence kept, in paint order.
	 *  A "shape" is one `fill()` call with the bounding box of the path that
	 *  preceded it, so a rounded `Rect` (which Konva draws with
	 *  `moveTo`/`lineTo`/`arcTo`, never `fillRect`) is captured whole. */
	fills: DrawnFill[];
	/** The same, for `stroke()` calls. A shape Konva only FILLS never appears
	 *  here, which is how a control proves a "no border" claim. */
	strokes: DrawnStroke[];
	/**
	 * The distinct strings Konva painted, over EVERY recorded pass, in order.
	 *
	 * The union is deliberate and is the right lens for a TEXT question. A
	 * component repaints in several steps (BuildingView paints on mount, then
	 * again when its auto-fit effect lands), and Konva's wrap/ellipsis decision
	 * is taken in STAGE UNITS (`Text.js:312-419` measures with `measureText`,
	 * which knows nothing of the stage scale), so a name is either paintable in
	 * full in every pass or in none. Reading one pass would therefore only
	 * measure which repaint happened to be last. `fills`/`strokes` come from the
	 * LAST pass, because geometry DOES change between passes and a control about
	 * layout needs one consistent state.
	 */
	paintedText: string[];
	/** How many drawing operations Konva issued. Asserted > 0 so a control can
	 *  never pass on an empty sink. */
	drawCount: number;
	/** How many complete scene passes were recorded; the LAST one is what the
	 *  assertions read. Asserted > 0 for the same reason. */
	frameCount: number;
	/** The Stage's own size, read off the rendered layer canvas. */
	stageWidth: number;
	stageHeight: number;
	unmount: () => void;
};

let installed = false;
let hostBox = { width: 0, height: 0 };
type Sink = {
	fills: DrawnFill[];
	strokes: DrawnStroke[];
	texts: DrawnText[];
	/** Completed scene passes. A pass ends at the next `clearRect`, which is
	 *  what Konva's SceneCanvas does at the top of every `drawScene`. */
	frames: Array<{ fills: DrawnFill[]; strokes: DrawnStroke[]; texts: DrawnText[] }>;
	frameCount: number;
	draws: number;
	path: { minX: number; minY: number; maxX: number; maxY: number } | null;
	/** A path point that is a *control* point, e.g. an `arcTo` corner. */
	control: Array<[number, number]>;
};
let sink: Sink | null = null;

/** Fix the box `getBoundingClientRect` and the ResizeObserver report, so a
 *  component that measures its host (BuildingView, and the new campus editor
 *  canvas) is deterministic in a DOM with no layout engine. Call BEFORE mount. */
export function setHostBox(size: { width: number; height: number }): void {
	hostBox = { ...size };
}

function newSink(): Sink {
	return { fills: [], strokes: [], texts: [], frames: [], frameCount: 0, draws: 0, path: null, control: [] };
}

/**
 * ONE path point, and the transform Konva had set. `record` is called for every
 * geometry call so the shape's box is known when `fill()` arrives.
 *
 * `arcTo(x1,y1,x2,y2,r)` contributes BOTH of its points. Konva uses it only to
 * turn a 90-degree corner of a rounded rectangle, and such an arc is inscribed
 * in the box spanned by the two points, so the recorded box is exact for the
 * shapes this project draws. `arc()` contributes the whole circle box, which is
 * pessimistic and can only widen a box, never narrow it.
 */
/** A 2x3 affine matrix, in the same order the 2D context takes it. */
type Mat = { a: number; b: number; c: number; d: number; e: number; f: number };
const IDENTITY: Mat = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
/** `m2` applied after `m1` — the order `CanvasRenderingContext2D.transform` uses. */
function mul(m1: Mat, m2: Mat): Mat {
	return {
		a: m1.a * m2.a + m1.c * m2.b,
		b: m1.b * m2.a + m1.d * m2.b,
		c: m1.a * m2.c + m1.c * m2.d,
		d: m1.b * m2.c + m1.d * m2.d,
		e: m1.a * m2.e + m1.c * m2.f + m1.e,
		f: m1.b * m2.e + m1.d * m2.f + m1.f,
	};
}
const applyMat = (m: Mat, x: number, y: number) => ({ x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f });

/**
 * The 2D sink. Konva 10 drives it with the real 2D API — `Context.js:335/361/379`
 * multiply the node matrix in through `transform()`, `:171/:488` reset with
 * `setTransform()`, and `Context.setAttr` (`:209-211`, `:418`, `:495`) assigns
 * `fillStyle`/`strokeStyle`/`lineWidth` straight onto the context — so all of
 * those are implemented rather than approximated.
 *
 * Hit-canvas passes are EXCLUDED. Konva fills the hit canvas with
 * `shape.colorKey` (`Context.js:533`), an opaque per-shape id colour, and draws
 * every shape there again; recording those would mix id colours into the scene
 * list. Hit canvases are the ones Konva marks `konvajs-hit`, so the exclusion is
 * by the canvas Konva itself labels, not by guessing from a colour.
 */
function makeContext(canvas: HTMLCanvasElement): unknown {
	let font = '11px Arial';
	let fillStyle = '#000000';
	let strokeStyle = '#000000';
	let lineWidth = 1;
	let m: Mat = IDENTITY;
	const stack: Mat[] = [];
	/**
	 * Only the SCENE canvas is recorded, and the two exclusions are decided by
	 * the canvas Konva itself owns rather than by a colour:
	 *   - the hit canvas, which Konva labels `konvajs-hit` and fills with
	 *     `shape.colorKey` (Context.js:533), an id-derived colour;
	 *   - the per-shape SHADOW BUFFER, which Konva creates with
	 *     `document.createElement('canvas')` and never attaches, so
	 *     `isConnected` is false. It redraws the same shape with its real fill
	 *     but under a shadow-offset transform, so recording it would add
	 *     duplicates sitting at the origin.
	 * Both checks are read LAZILY, at record time: Konva labels the hit canvas
	 * after `getContext()` has already been called on it.
	 */
	const isScene = (): boolean => canvas.isConnected === true && !/konvajs-hit/.test(canvas.className || '');

	const abs = (x: number, y: number) => applyMat(m, x, y);
	const reset = (): void => { if (sink) { sink.path = null; sink.control = []; } };
	/** ONE path point, through the current matrix. */
	const point = (x: number, y: number): void => {
		if (!sink) return;
		const p = abs(x, y);
		sink.path = sink.path
			? { minX: Math.min(sink.path.minX, p.x), minY: Math.min(sink.path.minY, p.y), maxX: Math.max(sink.path.maxX, p.x), maxY: Math.max(sink.path.maxY, p.y) }
			: { minX: p.x, minY: p.y, maxX: p.x, maxY: p.y };
	};
	const box = (): DrawnBox | null => {
		const path = sink?.path;
		return path ? { x: path.minX, y: path.minY, width: path.maxX - path.minX, height: path.maxY - path.minY } : null;
	};

	const state: Record<string | symbol, unknown> = {
		measureText: (text: string) => ({
			width: measureArialText(text, font),
			actualBoundingBoxAscent: 8,
			actualBoundingBoxDescent: 2,
			fontBoundingBoxAscent: 9,
			fontBoundingBoxDescent: 3,
		}),
		fillText: (text: string, x: number, y: number) => {
			if (!sink || !isScene()) return;
			sink.draws += 1;
			const p = abs(x, y);
			sink.texts.push({ text, x: p.x, y: p.y, font });
		},
		beginPath: reset,
		closePath: () => {},
		moveTo: (x: number, y: number) => { reset(); point(x, y); },
		lineTo: (x: number, y: number) => point(x, y),
		// Control points are inside the curve's hull, so recording them can only
		// widen the box — the pessimistic direction.
		quadraticCurveTo: (cx: number, cy: number, x: number, y: number) => { point(cx, cy); point(x, y); },
		bezierCurveTo: (c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number) => { point(c1x, c1y); point(c2x, c2y); point(x, y); },
		// Konva uses `arcTo` only to turn a 90-degree rounded-rect corner, and
		// such an arc is inscribed in the box its two points span, so recording
		// both points is exact for every shape this project draws.
		arcTo: (x1: number, y1: number, x2: number, y2: number) => { point(x1, y1); point(x2, y2); },
		arc: (cx: number, cy: number, r: number) => { point(cx - r, cy - r); point(cx + r, cy + r); },
		rect: (x: number, y: number, w: number, h: number) => { point(x, y); point(x + w, y + h); },
		roundRect: (x: number, y: number, w: number, h: number) => { point(x, y); point(x + w, y + h); },
		fill: () => {
			const b = box();
			if (sink && b && isScene()) { sink.draws += 1; sink.fills.push({ ...b, fill: fillStyle }); }
			reset();
		},
		stroke: () => {
			const b = box();
			if (sink && b && isScene()) { sink.draws += 1; sink.strokes.push({ ...b, stroke: strokeStyle, lineWidth }); }
			reset();
		},
		clip: reset,
		// A scene pass boundary: bank what has been drawn and start a new pass.
		clearRect: () => {
			reset();
			if (!sink || !isScene()) return;
			if (sink.fills.length + sink.texts.length > 0) {
				sink.frames.push({ fills: sink.fills, strokes: sink.strokes, texts: sink.texts });
				sink.fills = [];
				sink.strokes = [];
				sink.texts = [];
			}
		},
		fillRect: (x: number, y: number, w: number, h: number) => { point(x, y); point(x + w, y + h); (state.fill as () => void)(); },
		strokeRect: () => (state.stroke as () => void)(),
		save: () => stack.push({ ...m }),
		restore: () => { m = stack.pop() ?? IDENTITY; },
		setTransform: (a: number, b: number, c: number, d: number, e: number, f: number) => { m = { a, b, c, d, e, f }; },
		transform: (a: number, b: number, c: number, d: number, e: number, f: number) => { m = mul(m, { a, b, c, d, e, f }); },
		translate: (x: number, y: number) => { m = mul(m, { ...IDENTITY, e: x, f: y }); },
		scale: (x: number, y: number) => { m = mul(m, { a: x, b: 0, c: 0, d: y, e: 0, f: 0 }); },
		rotate: (rad: number) => { m = mul(m, { a: Math.cos(rad), b: Math.sin(rad), c: -Math.sin(rad), d: Math.cos(rad), e: 0, f: 0 }); },
		// Konva's hit canvas reads one pixel (`Util.isCanvasFarblingActive` ->
		// `getHitColor`), which is why the sink has to answer `getImageData`.
		getImageData: (_x: number, _y: number, w: number, h: number) => ({
			data: new Uint8ClampedArray(Math.max(4, w * h * 4)), width: w, height: h,
		}),
		createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(Math.max(4, w * h * 4)), width: w, height: h }),
		putImageData: () => {},
		drawImage: () => { if (sink && isScene()) sink.draws += 1; },
		createLinearGradient: () => ({ addColorStop: () => {} }),
		createRadialGradient: () => ({ addColorStop: () => {} }),
		createPattern: () => null,
		setLineDash: () => {},
		ellipse: (x: number, y: number, rx: number, ry: number) => { point(x - rx, y - ry); point(x + rx, y + ry); },
	};
	return new Proxy(state, {
		get: (target, key) => (key in target ? target[key] : () => {}),
		set: (target, key, value) => {
			if (key === 'font' && typeof value === 'string') font = value;
			if (key === 'fillStyle') fillStyle = String(value);
			if (key === 'strokeStyle') strokeStyle = String(value);
			if (key === 'lineWidth' && typeof value === 'number') lineWidth = value;
			// Konva 10 also accepts a `transform` DOMMatrix-ish object on some
			// paths; `m` is the array form.
			if (key === 'transform' && value && typeof value === 'object') {
				const arr = (value as { m?: number[] }).m;
				if (Array.isArray(arr) && arr.length >= 6) m = { a: arr[0], b: arr[1], c: arr[2], d: arr[3], e: arr[4], f: arr[5] };
			}
			target[key] = value;
			return true;
		},
	});
}

/**
 * Attach the 2D sink to a jsdom window that somebody ELSE created, so a test
 * whose surface is DOM can still mount a component that happens to contain a
 * react-konva stage. Without it the stage throws
 * `Cannot read properties of null (reading 'scale')` and the whole tree fails
 * to mount, taking the DOM assertions with it.
 */
export function installCanvasShim(domWindow: { HTMLCanvasElement: { prototype: Record<string, unknown> } }): void {
	const canvasProto = domWindow.HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
	canvasProto.getContext = function getContext(this: HTMLCanvasElement) { return makeContext(this); };
	canvasProto.toDataURL = () => 'data:,';
}

/** Install jsdom + the 2D sink. Idempotent; call before importing react-dom. */
export function installKonvaDomEnv(url = 'https://njgrm.buru-degree.ts.net/map'): void {
	if (installed) return;
	const dom = new JSDOM('<!doctype html><html><body></body></html>', { url, pretendToBeVisual: true });
	sink = newSink();
	const g = globalThis as unknown as Record<string, unknown>;
	Object.assign(g, {
		window: dom.window,
		document: dom.window.document,
		HTMLElement: dom.window.HTMLElement,
		HTMLCanvasElement: dom.window.HTMLCanvasElement,
		HTMLInputElement: dom.window.HTMLInputElement,
		HTMLImageElement: dom.window.HTMLImageElement,
		Element: dom.window.Element,
		Node: dom.window.Node,
		Event: dom.window.Event,
		CustomEvent: dom.window.CustomEvent,
		MouseEvent: dom.window.MouseEvent,
		KeyboardEvent: dom.window.KeyboardEvent,
		FocusEvent: dom.window.FocusEvent,
		NodeFilter: dom.window.NodeFilter,
		MutationObserver: dom.window.MutationObserver,
		Image: dom.window.Image,
		getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
		requestAnimationFrame: (cb: (t: number) => void) => setTimeout(() => cb(Date.now()), 0),
		cancelAnimationFrame: (id: number) => clearTimeout(id),
		DOMRect: dom.window.DOMRect,
		IS_REACT_ACT_ENVIRONMENT: true,
	});
	Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
	dom.window.HTMLElement.prototype.scrollIntoView = () => {};
	dom.window.HTMLElement.prototype.hasPointerCapture = () => false;
	dom.window.HTMLElement.prototype.getBoundingClientRect = function rect(this: Element) {
		return new dom.window.DOMRect(0, 0, hostBox.width, hostBox.height);
	};
	class FixedResizeObserver {
		constructor(private readonly callback: ResizeObserverCallback) {}
		observe(target: Element): void {
			const entry = {
				target,
				contentRect: { x: 0, y: 0, width: hostBox.width, height: hostBox.height, top: 0, left: 0, right: hostBox.width, bottom: hostBox.height, toJSON: () => ({}) },
			} as unknown as ResizeObserverEntry;
			this.callback([entry], this as unknown as ResizeObserver);
		}
		unobserve(): void {}
		disconnect(): void {}
	}
	Object.assign(g, { ResizeObserver: FixedResizeObserver });
	(dom.window as unknown as { matchMedia: (q: string) => unknown }).matchMedia = (q: string) => ({
		matches: false, media: q, onchange: null,
		addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
		dispatchEvent() { return false; },
	});
	installCanvasShim(dom.window as unknown as { HTMLCanvasElement: { prototype: Record<string, unknown> } });
	installed = true;
}

export type ReactBits = {
	createElement: typeof import('react').createElement;
	act: (fn: () => void | Promise<void>) => void | Promise<void>;
	createRoot: typeof import('react-dom/client').createRoot;
};

/** Install the environment and hand back React, imported AFTER the globals. */
export async function setupKonvaDom(url?: string): Promise<ReactBits> {
	installKonvaDomEnv(url);
	const React = await import('react');
	const client = await import('react-dom/client');
	return {
		createElement: React.createElement,
		act: React.act as unknown as ReactBits['act'],
		createRoot: client.createRoot,
	};
}

/** Mount a react-konva tree and return exactly what Konva painted. */
export async function renderKonva(createElement: ReactBits['createElement'], act: ReactBits['act'], element: unknown): Promise<KonvaRender> {
	const { createRoot } = await import('react-dom/client');
	const doc = document;
	const host = doc.createElement('div');
	doc.body.appendChild(host);
	sink = newSink();
	const root = createRoot(host);
	act(() => { root.render(element as never); });
	// Konva paints on the next animation frame; the harness rAF is a macrotask,
	// so flush one before reading the sink or the list is short by a frame.
	await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

	const first = host.querySelector('canvas') as HTMLCanvasElement | null;
	const stageWidth = Number((first?.style.width ?? '0').replace('px', '')) || 0;
	const stageHeight = Number((first?.style.height ?? '0').replace('px', '')) || 0;
	// Bank the tail pass, then read the LAST pass: the scene is painted once on
	// mount (before BuildingView's auto-fit effect sets the fit scale) and again
	// once the fit lands, and only the last pass is the state on screen.
	if (sink.fills.length + sink.texts.length > 0) {
		sink.frames.push({ fills: sink.fills, strokes: sink.strokes, texts: sink.texts });
		sink.fills = [];
		sink.strokes = [];
		sink.texts = [];
	}
	const frame = sink.frames.length > 0 ? sink.frames[sink.frames.length - 1] : { fills: [], strokes: [], texts: [] };
	sink.frameCount = sink.frames.length;

	// De-duplicate by first occurrence, so one scene is one list.
	const dedupe = <T>(items: T[], key: (item: T) => string): T[] => {
		const seen = new Set<string>();
		const out: T[] = [];
		for (const item of items) {
			const k = key(item);
			if (seen.has(k)) continue;
			seen.add(k);
			out.push(item);
		}
		return out;
	};
	const fills = dedupe(frame.fills, (f) => `${f.x}|${f.y}|${f.width}|${f.height}|${f.fill}`);
	const strokes = dedupe(frame.strokes, (s2) => `${s2.x}|${s2.y}|${s2.width}|${s2.height}|${s2.stroke}|${s2.lineWidth}`);
	const texts = dedupe(sink.frames.flatMap((f) => f.texts), (t) => t.text);

	return {
		host,
		fills,
		strokes,
		paintedText: texts.map((t) => t.text),
		drawCount: sink.draws,
		frameCount: sink.frameCount,
		stageWidth,
		stageHeight,
		unmount: () => { act(() => root.unmount()); host.remove(); },
	};
}
