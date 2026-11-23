// Runs inside the ad page. Lists what paints, in paint order, as native units (text, role images) and
// raster units (everything else), and leaves window.__show() so the converter can photograph any group alone.
(async () => {
  await document.fonts.ready; await Promise.allSettled([...document.images].map(i => i.decode()));
  const body = document.body, px = v => parseFloat(v) || 0, notes = [];
  // The page background is drawn by the browser, not by an element, so move it onto an element we can show and hide.
  const pageBg = [document.documentElement, body].map(e => getComputedStyle(e).background).find(b => !/^rgba\(0, 0, 0, 0\) none/.test(b));
  for (const e of [document.documentElement, body]) e.style.setProperty('background', 'transparent', 'important');
  if (pageBg) { const d = document.createElement('div'); d.id = '__pagebg'; d.style.cssText = `position:fixed;inset:0;z-index:-2147483647;background:${pageBg}`; body.prepend(d); }
  const all = [...body.querySelectorAll('*')].filter(e => !['BR', 'SCRIPT', 'STYLE', 'LINK'].includes(e.tagName) && !(e.closest('svg') && e.tagName !== 'svg'));
  const css = new Map(all.map(e => [e, getComputedStyle(e)]));
  const label = e => e.dataset.role || (typeof e.className === 'string' && e.className) || e.id || e.tagName.toLowerCase();

  // Measure with transforms off, then rebuild each element's world matrix (rotation and scale) by hand.
  const tf = new Map();
  for (const e of all) { const s = css.get(e); if (s.transform !== 'none') tf.set(e, { m: new DOMMatrix(s.transform), o: s.transformOrigin.split(' ').map(parseFloat) }); }
  for (const e of tf.keys()) e.style.setProperty('transform', 'none', 'important');
  const box = new Map(all.map(e => [e, e.getBoundingClientRect()]));
  const world = e => { const chain = []; for (let a = e; a && a !== body; a = a.parentElement) chain.unshift(a);
    let M = new DOMMatrix(); for (const a of chain) { const t = tf.get(a); if (!t) continue; const b = box.get(a);
      M = M.translate(b.left + t.o[0], b.top + t.o[1]).multiply(t.m).translate(-b.left - t.o[0], -b.top - t.o[1]); } return M; };
  const place = (e, l, t, w, h) => { const M = world(e), c = M.transformPoint({ x: l + w / 2, y: t + h / 2 }), k = Math.hypot(M.a, M.b);
    return { cx: c.x, cy: c.y, w: w * k, h: h * k, rotation: Math.atan2(M.b, M.a) * 180 / Math.PI, k }; };

  // Paint order, approximated: at each level sort by z-index, then positioned after static, then document order.
  const key = e => { const path = []; for (let a = e; a && a !== body; a = a.parentElement) { const s = css.get(a) || getComputedStyle(a), pos = s.position !== 'static';
    path.unshift([pos && s.zIndex !== 'auto' ? +s.zIndex : 0, pos ? 1 : 0, [...a.parentElement.children].indexOf(a)]); } return path; };
  const cmp = (a, b) => { for (let i = 0; i < Math.max(a.length, b.length); i++) { const x = a[i], y = b[i]; if (!x) return -1; if (!y) return 1;
    for (let j = 0; j < 3; j++) if (x[j] !== y[j]) return x[j] - y[j]; } return 0; };

  const ownText = e => [...e.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim());
  const textRoot = e => { let top = null; for (let a = e; a && a !== body; a = a.parentElement) if (ownText(a).length) top = a; return top; };
  const styleOf = e => { const s = css.get(e) || getComputedStyle(e), fs = px(s.fontSize);
    return { family: s.fontFamily.split(',')[0].replace(/["']/g, '').trim(), weight: +s.fontWeight, italic: s.fontStyle === 'italic', size: fs, color: s.color,
      letterSpacing: s.letterSpacing === 'normal' ? 0 : px(s.letterSpacing) / fs, underline: /underline/.test(s.textDecorationLine), transform: s.textTransform,
      shadow: s.textShadow === 'none' ? null : s.textShadow }; };
  const cased = (t, tr) => tr === 'uppercase' ? t.toUpperCase() : tr === 'lowercase' ? t.toLowerCase() : tr === 'capitalize' ? t.replace(/(^|\s)\S/g, c => c.toUpperCase()) : t;

  // Every word of a block with the line Chrome put it on, so Konva gets Chrome's own line breaks.
  const wordsOf = root => { const out = [], walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), r = document.createRange(); let open = false;
    for (let n; (n = walker.nextNode());) { const st = styleOf(n.parentElement);
      for (const m of n.textContent.matchAll(/\S+/g)) { r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length); const q = r.getClientRects();
        if (!q.length) continue; const a = q[0], z = q[q.length - 1];
        out.push({ text: cased(m[0], st.transform), st, left: a.left, top: a.top, right: z.right, bottom: a.bottom, glued: m.index === 0 && open }); }
      if (n.textContent.length) open = !/\s$/.test(n.textContent); }
    const lines = []; for (const w of out) { const mid = (w.top + w.bottom) / 2, L = lines.find(l => mid > l.top && mid < l.bottom);
      if (L) { L.words.push(w); L.top = Math.min(L.top, w.top); L.bottom = Math.max(L.bottom, w.bottom); } else lines.push({ top: w.top, bottom: w.bottom, words: [w] }); }
    return lines; };
  const same = (a, b) => ['family', 'weight', 'italic', 'size', 'color', 'letterSpacing', 'underline'].every(k => a[k] === b[k]);
  const join = ws => ws.map((w, i) => (i && !w.glued ? ' ' : '') + w.text).join('');

  const units = [], els = [];
  // A photo is often an <img> inside a cropping box that carries the data-role, so a picture takes the role of the box around it.
  const roleOf = e => e.dataset.role || (e.tagName === 'IMG' && e.closest('[data-role]')?.dataset.role) || null;
  const add = (e, u, sub = []) => { els.push(e); units.push({ ...u, el: els.length - 1, name: label(e), role: roleOf(e), _key: [...key(e), ...sub] }); };
  for (const e of all) {
    const s = css.get(e), b = box.get(e); if (s.display === 'none' || s.visibility === 'hidden' || !b.width || !b.height) continue;
    const pseudo = ['::before', '::after'].some(p => { const q = getComputedStyle(e, p); return q.content !== 'none' && q.content !== 'normal'; });
    const paints = e.id === '__pagebg' || !/^rgba\(0, 0, 0, 0\)$/.test(s.backgroundColor) || s.backgroundImage !== 'none' || s.boxShadow !== 'none' || pseudo
      || ['Top', 'Right', 'Bottom', 'Left'].some(d => px(s[`border${d}Width`]) && s[`border${d}Style`] !== 'none') || ['IMG', 'svg', 'CANVAS', 'VIDEO'].includes(e.tagName)
      || (s.display === 'list-item' && s.listStyleType !== 'none');
    if (s.mixBlendMode !== 'normal') notes.push(`${label(e)}: mix-blend-mode ${s.mixBlendMode} cannot cross layers`);
    if (s.backdropFilter && s.backdropFilter !== 'none') notes.push(`${label(e)}: backdrop-filter cannot cross layers`);
    if (s.display === 'list-item' && s.listStyleType !== 'none') notes.push(`${label(e)}: list marker stays in the picture layer`);
    if (paints) add(e, { kind: ['IMG', 'svg'].includes(e.tagName) && roleOf(e) ? 'image' : 'raster', ...place(e, b.left, b.top, b.width, b.height) });
    if (ownText(e).length && textRoot(e) === e) {
      const lines = wordsOf(e), words = lines.flatMap(l => l.words); if (!words.length) continue;
      const uniform = words.every(w => same(w.st, words[0].st)), blocky = !/^inline/.test(s.display);
      const pl = px(s.paddingLeft) + px(s.borderLeftWidth), pt = px(s.paddingTop) + px(s.borderTopWidth), pr = px(s.paddingRight) + px(s.borderRightWidth), pb = px(s.paddingBottom) + px(s.borderBottomWidth);
      const lh = s.lineHeight === 'normal' ? 1.2 : px(s.lineHeight) / px(s.fontSize);
      const align = { start: 'left', end: 'right', justify: 'left' }[s.textAlign] || s.textAlign;
      // The words' own extent, not the element's box: a logo dot or an icon may share the box with the text.
      const x0 = Math.min(...words.map(w => w.left)), x1 = Math.max(...words.map(w => w.right)), yc = (lines[0].top + lines[lines.length - 1].bottom) / 2;
      const th = lines.length * lh * px(s.fontSize);
      if (uniform && blocky) add(e, { kind: 'text', text: lines.map(l => join(l.words)).join('\n'), lines: lines.length, st: words[0].st, lineHeight: lh, align,
        ...place(e, x0, yc - th / 2, x1 - x0, th) }, [[0, 0, -0.5]]);
      else { if (!uniform) notes.push(`${label(e)}: ${lines.length} line(s) with mixed styles become one layer per styled run`);
        lines.forEach((l, li) => { let run = []; const flush = () => { if (!run.length) return; const x0 = Math.min(...run.map(w => w.left)), x1 = Math.max(...run.map(w => w.right));
            add(e, { kind: 'text', text: join(run), lines: 1, st: run[0].st, lineHeight: 1, align: 'left', fragment: true, ...place(e, x0, l.top, x1 - x0, l.bottom - l.top) }, [[0, 0, -0.5 + li / 1000]]); run = []; };
          for (const w of l.words) { if (run.length && !same(run[0].st, w.st)) flush(); run.push(w); } flush(); }); }
    }
  }
  for (const e of tf.keys()) e.style.removeProperty('transform');
  units.sort((a, b) => cmp(a._key, b._key)); units.forEach(u => delete u._key);

  // Font files the ad ships, following @import. A family split into subsets keeps the basic Latin file only.
  const rulesOf = sh => { try { return [...sh.cssRules].flatMap(r => r instanceof CSSImportRule && r.styleSheet ? rulesOf(r.styleSheet) : [r]); } catch { return []; } };
  const faces = [...document.styleSheets].flatMap(rulesOf).filter(r => r instanceof CSSFontFaceRule).map(r => ({
    family: r.style.fontFamily.replace(/["']/g, ''), weight: r.style.fontWeight || '400', style: r.style.fontStyle || 'normal', range: r.style.unicodeRange || '',
    local: (r.style.src.match(/local\(["']?([^"')]+)/) || [])[1] || null,
    url: /url\(/.test(r.style.src) ? new URL(r.style.src.match(/url\(["']?([^"')]+)/)[1], r.parentStyleSheet.href || location.href).href : null }))
    .filter(f => !f.range || /U\+0+-0*FF\b/i.test(f.range));
  if ([...document.styleSheets].flatMap(rulesOf).some(r => r instanceof CSSFontFaceRule && r.style.unicodeRange && !/U\+0+-0*FF\b/i.test(r.style.unicodeRange)))
    notes.push('fonts: only the basic Latin subset of each family is carried over');
  const hide = document.createElement('style'); document.head.append(hide);
  window.__show = (idx, noText) => { for (const e of [body, ...all]) e.style.setProperty('visibility', 'hidden', 'important');
    for (const i of idx) els[i].style.setProperty('visibility', 'visible', 'important');
    hide.textContent = noText ? '*{-webkit-text-fill-color:transparent!important;text-shadow:none!important;text-decoration-color:transparent!important}' : '';
    return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); };
  return { width: innerWidth, height: innerHeight, units, faces, notes: [...new Set(notes)] };
})()
