// ATLAS UX audit — paste into the browser console (or run via a browser tool's JS evaluate) on any ATLAS page.
// Returns a JSON report of objective UX defects for older, mouse-first schedulers. Read-only: it never clicks or writes.
// Operator rule (2026-09-29): any MAJOR here fails a planner's proof and blocks a release train.
// Run it on each page, and again with each dialog/dropdown open. Viewport must be 1366x768 (reported in the result).
(() => {
	const MIN_TEXT_PX = 14; // smallest readable text anywhere
	const MIN_BODY_PX = 16; // running text / table cells
	const MIN_TARGET_PX = 40; // clickable height
	const MOJIBAKE = /ΓÇ|â€|Ã¢|Ã©|Â·|�/;
	const visible = (el) => {
		const r = el.getBoundingClientRect();
		if (r.width === 0 || r.height === 0) return false;
		const s = getComputedStyle(el);
		return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05;
	};
	const label = (el) => {
		const t = (el.innerText || el.getAttribute('aria-label') || el.value || '').trim().replace(/\s+/g, ' ');
		return `${el.tagName.toLowerCase()}${el.getAttribute('role') ? `[role=${el.getAttribute('role')}]` : ''} "${t.slice(0, 60)}"`;
	};
	const out = {
		url: location.pathname + location.search,
		viewport: `${innerWidth}x${innerHeight}`,
		pageScrollsSideways: document.documentElement.scrollWidth > innerWidth + 1,
		smallText: [], truncated: [], overflowing: [], mojibake: [], smallTargets: [], moreFilters: [], summary: {},
	};
	const seenText = new Set();
	for (const el of document.querySelectorAll('body *')) {
		if (!visible(el)) continue;
		const s = getComputedStyle(el);
		const ownText = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').trim();
		if (ownText) {
			const px = Number.parseFloat(s.fontSize);
			if (px < MIN_TEXT_PX && !el.closest('[aria-hidden="true"]')) {
				const key = `${px}|${ownText.slice(0, 40)}`;
				if (!seenText.has(key)) { seenText.add(key); out.smallText.push({ px, text: ownText.slice(0, 60), el: label(el) }); }
			}
			if (MOJIBAKE.test(ownText)) out.mojibake.push({ text: ownText.slice(0, 80), el: label(el) });
			if (/more filters/i.test(ownText)) out.moreFilters.push(label(el));
		}
		// Truncated: text cut with an ellipsis or clipped inside its own box.
		if ((s.textOverflow === 'ellipsis' || s.overflow === 'hidden' || s.overflowX === 'hidden' || s.webkitLineClamp !== 'none')
			&& (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 2) && (el.innerText || '').trim()) {
			out.truncated.push({ el: label(el), shown: `${el.clientWidth}px`, needs: `${el.scrollWidth}px` });
		}
		// Overflowing: text that spills outside a bordered/filled box (buttons, selects, chips, inputs).
		if (/^(button|a|label|span|div)$/i.test(el.tagName) && (s.borderStyle !== 'none' && Number.parseFloat(s.borderWidth) > 0)
			&& s.overflow === 'visible' && el.scrollWidth > el.clientWidth + 2 && (el.innerText || '').trim()) {
			out.overflowing.push({ el: label(el), box: `${el.clientWidth}px`, content: `${el.scrollWidth}px` });
		}
	}
	for (const el of document.querySelectorAll('button, a[href], [role="button"], [role="combobox"], [role="tab"], select, input:not([type="hidden"])')) {
		if (!visible(el) || el.closest('table')) continue;
		const r = el.getBoundingClientRect();
		if (r.height < MIN_TARGET_PX && (el.innerText || el.getAttribute('aria-label') || '').trim()) out.smallTargets.push({ el: label(el), h: Math.round(r.height) });
	}
	for (const k of ['smallText', 'truncated', 'overflowing', 'mojibake', 'smallTargets', 'moreFilters']) {
		out[k] = out[k].slice(0, 40);
		out.summary[k] = out[k].length;
	}
	out.summary.tableCellsUnder16px = [...document.querySelectorAll('td, th')].filter((c) => visible(c) && Number.parseFloat(getComputedStyle(c).fontSize) < MIN_BODY_PX).length;
	out.major = out.summary.mojibake + out.summary.moreFilters + out.summary.overflowing + (out.pageScrollsSideways ? 1 : 0)
		+ out.smallText.filter((t) => t.px < 12).length;
	return out;
})();
