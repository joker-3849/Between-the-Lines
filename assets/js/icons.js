/* Иконки в стиле Tabler Icons: сетка 24×24, обводка 1.5, скруглённые концы.
   Полный набор — tabler.io/icons; здесь только используемые. */

const PATHS = {
  'arrow-left':  '<path d="M5 12h14"/><path d="M5 12l6 6"/><path d="M5 12l6-6"/>',
  'arrow-right': '<path d="M5 12h14"/><path d="M13 18l6-6"/><path d="M13 6l6 6"/>',
  'search':      '<circle cx="10" cy="10" r="7"/><path d="M21 21l-6-6"/>',
  'sort':        '<path d="M3 9l4-4 4 4"/><path d="M7 5v14"/><path d="M13 15l4 4 4-4"/><path d="M17 5v14"/>',
  'bookmark':    '<path d="M18 7v14l-6-4-6 4V7a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4z"/>',
  'chevron-down':'<path d="M6 9l6 6 6-6"/>',
  'quote':       '<path d="M10 11h-4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v6c0 2.667-1.333 4.333-4 5"/><path d="M19 11h-4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v6c0 2.667-1.333 4.333-4 5"/>',
  'calendar':    '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M16 3v4"/><path d="M8 3v4"/><path d="M4 11h16"/>',
  'book':        '<path d="M3 19a9 9 0 0 1 9 0 9 9 0 0 1 9 0"/><path d="M3 6a9 9 0 0 1 9 0 9 9 0 0 1 9 0"/><path d="M3 6v13"/><path d="M12 6v13"/><path d="M21 6v13"/>',
  'trophy':      '<path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3"/><path d="M7 5H4v2a3 3 0 0 0 3 3"/>',
  'flame':       '<path d="M12 12c2-2.96 0-7-1-8 0 3.038-1.773 4.741-3 6-1.226 1.26-2 3.24-2 5a6 6 0 1 0 12 0c0-1.532-1.056-3.94-2-5-1.786 3-2.791 3-4 2z"/>',
  'stack':       '<path d="M12 4l-8 4 8 4 8-4z"/><path d="M4 12l8 4 8-4"/><path d="M4 16l8 4 8-4"/>',
  'users':       '<circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.85"/>',
  'scale':       '<path d="M7 20h10"/><path d="M12 4v16"/><path d="M4 9l4-5 4 5a4 4 0 0 1-8 0z"/><path d="M12 9l4-5 4 5a4 4 0 0 1-8 0z"/>',
  'x':           '<path d="M18 6L6 18"/><path d="M6 6l12 12"/>',
  'photo':       '<path d="M15 8h.01"/><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 16l5-5c.928-.893 2.072-.893 3 0l5 5"/><path d="M14 15l1-1c.928-.893 2.072-.893 3 0l3 3"/>',
  'plus':        '<path d="M12 5v14"/><path d="M5 12h14"/>',
  'copy':        '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  'refresh':     '<path d="M19.933 13a8 8 0 1 1 -.933 -6.5"/><path d="M20 4v5h-5"/>',
  'check':       '<path d="M5 12l5 5l10 -10"/>'
};

export function icon(name, cls = '') {
  const body = PATHS[name];
  if (!body) return '';
  return `<span class="ic ${cls}"><svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg></span>`;
}

/** Заполняет все <span class="ic" data-icon="..."> внутри root. */
export function hydrateIcons(root = document) {
  root.querySelectorAll('.ic[data-icon]').forEach(el => {
    if (el.firstElementChild) return;
    const body = PATHS[el.dataset.icon];
    if (body) el.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
  });
}
