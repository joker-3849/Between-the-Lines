/* Страница книги: мнения сгруппированы по критериям, а не по участникам.
   Открывается плавным перелётом обложки с полки (FLIP). */

import { state, avg, spread, verdict, fmtDate, nPlural, num } from './data.js';
import { coverHTML, mountCovers, critHTML, whoHTML, esc, stagger } from './ui.js';
import { hydrateIcons } from './icons.js';
import { coverOnShelf } from './shelf.js';

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let deps = { setView: () => {} };
let current = null;

export function initBook(d) { deps = { ...deps, ...d }; }
export function currentBookId() { return current; }

/* ── разметка ─────────────────────────────────────────────────────────── */

function factsHTML(book) {
  const by = state.memberById.get(book.proposedBy);
  const rows = [
    ['Жанр', book.genre],
    ['Написана', book.year],
    ['Объём', book.pages ? nPlural(book.pages, 'страница', 'страницы', 'страниц') : null],
    ['Издание', book.edition],
    [by ? (by.g === 'm' ? 'Предложил' : 'Предложила') : 'Предложил(а)', by?.name],
    ['Обсуждали', book.discussed ? fmtDate(book.discussed) : null]
  ];
  return `<dl class="bp-facts">${rows
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `<div class="bp-fact"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`)
    .join('')}</dl>`;
}

function verdictHTML(book) {
  const mean = avg(book);
  const sp = spread(book);
  const v = verdict(book);
  const note = sp === 0
    ? 'Все сошлись на одной оценке — такое случается редко.'
    : `Оценки разошлись на ${nPlural(sp, 'балл', 'балла', 'баллов')} из ${state.club.scale}.`;

  return `<div class="bp-verdict">
    <span class="bp-avg">${num(mean)}<small>/${state.club.scale}</small></span>
    ${v ? `<span class="badge ${v.kind}">${esc(v.label)}</span>` : ''}
    <span class="bp-verdict-note">${esc(note)}</span>
  </div>`;
}

function impressionsHTML(book) {
  const items = state.members
    .map(m => ({ m, text: book.reviews?.[m.id]?.text }))
    .filter(x => x.text);
  if (!items.length) return '';
  return `<h2 class="section-h">Впечатления</h2>
    ${items.map(({ m, text }) => `<div class="imp">
      ${whoHTML(m)}
      <p class="imp-text">${esc(text)}</p>
    </div>`).join('')}`;
}

function takenHTML(book) {
  const items = state.members
    .map(m => ({ m, line: book.reviews?.[m.id]?.line }))
    .filter(x => x.line?.text);
  if (!items.length) return '';
  return `<h2 class="section-h">Забрали с собой</h2>
    <div class="taken">${items.map(({ m, line }) => `<div class="taken-item">
      <p class="taken-text">${esc(line.text)}</p>
      <div class="taken-from">
        ${line.kind === 'book' ? '<span class="tag-book">из книги</span>' : ''}
        <span>${esc(m.name)}</span>
      </div>
    </div>`).join('')}</div>`;
}

function render(book) {
  const view = document.getElementById('view-book');
  view.innerHTML = `<article class="book-page">
    <div class="bp-left">
      ${coverHTML(book, 'bp-cover')}
      ${factsHTML(book)}
    </div>
    <div class="bp-right">
      <h1 class="bp-title">${esc(book.title)}</h1>
      <p class="bp-author">${esc(book.author)}</p>
      ${verdictHTML(book)}
      <h2 class="section-h">Оценки клуба</h2>
      ${state.criteria.map(c => critHTML(book, c)).join('')}
      ${impressionsHTML(book)}
      ${takenHTML(book)}
    </div>
  </article>`;

  hydrateIcons(view);
  mountCovers(view);
  return view;
}

/* ── перелёт обложки ──────────────────────────────────────────────────── */

function flyCover(fromRect, toEl, sourceEl) {
  if (!fromRect || !toEl || reduced()) return Promise.resolve();

  const to = toEl.getBoundingClientRect();
  if (!to.width || !to.height) return Promise.resolve();

  const layer = document.getElementById('flipLayer');
  const ghost = document.createElement('div');
  ghost.className = 'flip-ghost';
  ghost.style.cssText =
    `left:${to.left}px;top:${to.top}px;width:${to.width}px;height:${to.height}px`;
  ghost.appendChild(sourceEl.cloneNode(true));
  layer.appendChild(ghost);

  toEl.style.opacity = '0';

  const dx = fromRect.left - to.left;
  const dy = fromRect.top - to.top;
  const sx = fromRect.width / to.width;
  const sy = fromRect.height / to.height;

  const anim = ghost.animate(
    [
      { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: 1 },
      { transform: 'none', opacity: 1 }
    ],
    { duration: 620, easing: 'cubic-bezier(.22,.68,.32,1)' }
  );

  return anim.finished.catch(() => {}).then(() => {
    toEl.style.opacity = '';
    ghost.remove();
  });
}

/* ── открытие и закрытие ──────────────────────────────────────────────── */

export function showBook(id, sourceCover) {
  const book = state.bookById.get(id);
  if (!book) return;
  current = id;

  const fromRect = sourceCover && !reduced() ? sourceCover.getBoundingClientRect() : null;

  deps.setView('book');
  const view = render(book);
  window.scrollTo({ top: 0, behavior: 'auto' });

  const hero = view.querySelector('.bp-cover');
  const right = view.querySelector('.bp-right');

  if (fromRect && sourceCover) {
    flyCover(fromRect, hero, sourceCover);
    stagger(right.children, 45, 180);
  } else {
    stagger(right.children, 40, 60);
  }
}

/** Обратный перелёт: обложка возвращается на своё место на полке. */
export function closeBook(afterView = 'shelf') {
  const view = document.getElementById('view-book');
  const hero = view.querySelector('.bp-cover');
  const target = current ? coverOnShelf(current) : null;

  if (!hero || !target || reduced() || afterView !== 'shelf') {
    current = null;
    deps.setView(afterView);
    return;
  }

  const fromRect = hero.getBoundingClientRect();
  const bookId = current;
  current = null;
  deps.setView(afterView);

  // Полка уже на экране — доводим обложку до её слота.
  requestAnimationFrame(() => {
    const slotCover = coverOnShelf(bookId);
    if (slotCover) flyCover(fromRect, slotCover, hero);
  });
}
