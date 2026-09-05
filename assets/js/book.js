/* Страница книги: мнения сгруппированы по критериям, а не по участникам.
   Открывается плавным перелётом обложки с полки (FLIP). */

import { state, scoresFor, fmtDate, nPlural } from './data.js';
import { coverHTML, whoHTML, esc, stagger } from './ui.js';
import { gaugeHTML, radarHTML, rereadRingHTML, rankHTML, memberCardsHTML } from './charts.js';
import { hydrateIcons } from './icons.js';
import { mountTilt, tiltWrap } from './tilt.js';
import { coverOnShelf } from './shelf.js';
import { showBookJSON } from './addbook.js';
import { openBookEditor } from './bookedit.js';
import { openShareModal } from './share.js';
import { requireUnlock, editorMode } from './lock.js';
import { canPublish } from './publish.js';

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

/* Сайт читает полку из JSON в репозитории и сам в файлы не пишет, поэтому
   и новая книга, и правки существующей живут только в памяти страницы —
   баннер честно об этом говорит и отдаёт готовый JSON. */
/* Пока правки не закоммичены, книга помечена — но следующий шаг разный:
   с включённым сохранением это кнопка внизу, без него — копирование JSON. */
function draftBannerHTML(book) {
  if (!book._draft && !book._edited) return '';
  const what = book._draft
    ? 'Книга есть только в этой вкладке'
    : 'Правки есть только в этой вкладке';
  return `<div class="draft-banner">
    <span class="badge draft">${book._draft ? 'черновик' : 'изменено'}</span>
    <span>${what}${canPublish()
      ? ' — нажмите «Сохранить на сайт» внизу страницы.'
      : '. Сохранение с сайта не включено: перенести их в data/books.json можно вручную либо включить сохранение в «Редактор» → «Фраза клуба».'}</span>
    <button type="button" class="link" id="showDraftJson">Показать JSON для вставки</button>
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

/** Цитаты из книги и свои формулировки — два отдельных раздела. */
function takenHTML(book, field, title) {
  const items = state.members
    .map(m => ({ m, line: book.reviews?.[m.id]?.[field] }))
    .filter(x => x.line?.text);
  if (!items.length) return '';
  return `<h2 class="section-h">${esc(title)}</h2>
    <div class="taken">${items.map(({ m, line }) => `<div class="taken-item">
      <p class="taken-text">${esc(line.text)}</p>
      <div class="taken-from"><span>${esc(m.name)}</span></div>
    </div>`).join('')}</div>`;
}

function render(book) {
  const view = document.getElementById('view-book');
  view.innerHTML = `<article class="book-page">
    ${draftBannerHTML(book)}
    <div class="bp-left">
      ${tiltWrap(coverHTML(book, 'bp-cover'), 'tilt-bp')}
      ${factsHTML(book)}
      <div class="bp-actions">
        <button type="button" class="btn btn-ghost" id="shareBook">
          <span class="ic" data-icon="share"></span> Поделиться
        </button>
        ${editorMode() ? `<button type="button" class="btn btn-ghost" id="editBook">
          <span class="ic" data-icon="pencil"></span> Внести изменения
        </button>` : ''}
      </div>
    </div>
    <div class="bp-right">
      <h1 class="bp-title">${esc(book.title)}</h1>
      <p class="bp-author">${esc(book.author)}</p>

      <h2 class="section-h">Оценки клуба</h2>
      ${scoresFor(book).length ? `
        <div class="bp-widgets">
          ${gaugeHTML(book)}
          ${radarHTML(book)}
          ${rereadRingHTML(book)}
          ${rankHTML(book)}
        </div>
        ${memberCardsHTML(book)}
      ` : '<p class="bp-verdict-note">Оценок пока нет — нажмите «Внести изменения» и заполните.</p>'}
      ${impressionsHTML(book)}
      ${takenHTML(book, 'quote', 'Цитаты из книги')}
      ${takenHTML(book, 'line', 'Между строк')}
    </div>
  </article>`;

  hydrateIcons(view);
  mountTilt(view);
  view.querySelector('#showDraftJson')?.addEventListener('click', () => showBookJSON(book));
  view.querySelector('#shareBook')?.addEventListener('click', () => openShareModal(book));
  view.querySelector('#editBook')?.addEventListener('click', async () => {
    if (!await requireUnlock()) return;
    openBookEditor(book, {
      onDone: (saved, edited, opts) => {
        if (opts?.deleted) { current = null; deps.onBookChanged?.(); deps.setView('shelf'); return; }
        rerender(book);
      }
    });
  });
  return view;
}

/** Перерисовать открытую карточку на месте: без перелёта и без прокрутки. */
export function refreshBook() {
  const book = current && state.bookById.get(current);
  if (book) rerender(book);
}

/** Перерисовать карточку после правок — без перелёта обложки. */
function rerender(book) {
  const view = render(book);
  deps.onBookChanged?.(book);
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
