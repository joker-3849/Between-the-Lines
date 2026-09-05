/* «Разложить» — вся библиотека на нескольких полках, как в настоящем шкафу.
 *
 * Книги стоят по-разному: большинство корешками вверх, кто-то привалился к
 * соседу, кто-то лежит стопкой плашмя, кто-то развёрнут лицом. Поза и размер
 * выводятся из id книги, а не из случайного числа: при перерисовке и после
 * фильтра расстановка остаётся той же самой, иначе полка «прыгала» бы от
 * каждого нажатия.
 *
 * Ширина корешка берётся из объёма книги, когда он известен, — так полка
 * читается как настоящая: тонкие книжки рядом с томами. */

import { num, avg } from './data.js';
import { artOf, esc } from './ui.js';

/* Простой детерминированный хеш строки — источник всех «случайностей». */
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Псевдослучайное число 0…1 из id книги и номера параметра. */
const rnd = (id, salt) => (hash(`${id}#${salt}`) % 1000) / 1000;

const SPINE_MIN = 34, SPINE_MAX = 74;   // ширина корешка, px
const SHELF_H = 244;                    // рабочая высота одной полки, px

/** Ширина корешка: по объёму, если он есть, иначе по хешу. */
function spineWidth(book) {
  if (book.pages > 0) {
    const t = Math.max(0, Math.min(1, (book.pages - 120) / 700));
    return Math.round(SPINE_MIN + t * (SPINE_MAX - SPINE_MIN));
  }
  return Math.round(SPINE_MIN + rnd(book.id, 'w') * (SPINE_MAX - SPINE_MIN));
}

/** Высота книги — от неё зависит, насколько ровно стоит ряд. */
function bookHeight(book) {
  return Math.round(SHELF_H * (0.82 + rnd(book.id, 'h') * 0.18));
}

/**
 * Поза книги. Лежащие идут подряд, чтобы собираться в стопку, а не
 * рассыпаться поодиночке между стоящими.
 */
function pose(book, i) {
  // Лежащих мало нарочно: стопка занимает место как несколько книг, а
  // высоты почти не даёт — если их много, полка выглядит полупустой.
  const r = rnd(book.id, 'p');
  if (r < 0.10) return 'flat';     // лежит
  if (r < 0.26) return 'face';     // развёрнута лицом
  if (r < 0.40) return 'lean';     // привалилась
  return 'up';                     // стоит
}

/* ── разметка ─────────────────────────────────────────────────────────── */

function spineHTML(book, poseName) {
  const art = artOf(book);
  const w = spineWidth(book);
  const h = bookHeight(book);
  const lean = poseName === 'lean' ? (6 + Math.round(rnd(book.id, 'l') * 5)) : 0;

  return `<button class="bc-book bc-${poseName}" data-id="${esc(book.id)}"
      style="--w:${w}px;--h:${h}px;--bg:${esc(art.bg)};--fg:${esc(art.fg)};
             --acc:${esc(art.acc)};--lean:${lean}deg"
      aria-label="Открыть карточку: ${esc(book.title)}, ${esc(book.author)}">
    <span class="bc-band" aria-hidden="true"></span>
    <span class="bc-spine-text">${esc(book.title)}</span>
    <span class="bc-band bc-band-low" aria-hidden="true"></span>
  </button>`;
}

function faceHTML(book) {
  const art = artOf(book);
  const h = Math.round(SHELF_H * 0.9);
  return `<button class="bc-book bc-face" data-id="${esc(book.id)}"
      style="--h:${h}px;--w:${Math.round(h / 1.5)}px;--bg:${esc(art.bg)};
             --fg:${esc(art.fg)};--acc:${esc(art.acc)}"
      aria-label="Открыть карточку: ${esc(book.title)}, ${esc(book.author)}">
    <span class="bc-face-genre">${esc(book.genre || '')}</span>
    <span class="bc-face-title">${esc(book.title)}</span>
    <span class="bc-face-author">${esc(book.author)}</span>
    <span class="bc-face-score">${num(avg(book))}</span>
  </button>`;
}

function stackHTML(books) {
  const inner = books.map(b => {
    const art = artOf(b);
    // Толщина лежащей книги: стопка из тонких плашек выглядела стопкой
    // визиток, а не книг, — поэтому нижняя граница заметно выше.
    const th = 24 + Math.round(rnd(b.id, 't') * 16);
    const w = Math.round(SHELF_H * (0.56 + rnd(b.id, 's') * 0.12));
    const shift = Math.round((rnd(b.id, 'x') - .5) * 14);
    return `<button class="bc-flat" data-id="${esc(b.id)}"
        style="--th:${th}px;--w:${w}px;--shift:${shift}px;--bg:${esc(art.bg)};
               --fg:${esc(art.fg)};--acc:${esc(art.acc)}"
        aria-label="Открыть карточку: ${esc(b.title)}, ${esc(b.author)}">
      <span class="bc-flat-title">${esc(b.title)}</span>
    </button>`;
  }).join('');
  return `<div class="bc-stack">${inner}</div>`;
}

/**
 * Раскладывает книги по полкам: набирает ряд, пока он помещается в ширину,
 * потом начинает следующий. Ширину контейнера передаёт вызывающий код —
 * измерить её можно только после того, как шкаф встал в разметку.
 */
function layout(books, available) {
  const shelves = [];
  let row = [], used = 0;

  const flatWidth = b => Math.round(SHELF_H * (0.56 + rnd(b.id, 's') * 0.12));
  const widthOf = item => item.kind === 'stack'
    ? Math.max(...item.books.map(flatWidth)) + 22
    : (item.pose === 'face' ? Math.round(SHELF_H * 0.9 / 1.5) : spineWidth(item.book))
      + (item.pose === 'lean' ? 18 : 3);

  // Одинокая лежащая книга оставляет над собой дыру в человеческий рост,
  // поэтому «лечь» — решение не одной книги, а группы: выпала поза «flat» —
  // с ней ложатся и следующие одна-две, получается настоящая стопка.
  const items = [];
  for (let i = 0; i < books.length;) {
    const book = books[i];
    const p = pose(book, i);
    const room = books.length - i;

    if (p === 'flat' && room >= 2) {
      const n = Math.min(room, 2 + Math.round(rnd(book.id, 'n')));
      items.push({ kind: 'stack', books: books.slice(i, i + n) });
      i += n;
    } else {
      items.push({ kind: 'book', book, pose: p === 'flat' ? 'up' : p });
      i++;
    }
  }

  // Полка не набивается под завязку: настоящая заполнена неровно, где-то
  // до края, где-то до половины. Доля берётся из номера полки, поэтому
  // рисунок стабилен между перерисовками.
  const MAX_PER_SHELF = 7;
  let limit = available * (0.74 + rnd('shelf', 0) * 0.22);

  items.forEach(item => {
    const w = widthOf(item);
    if (row.length && (used + w > limit || row.length >= MAX_PER_SHELF)) {
      shelves.push(row);
      row = []; used = 0;
      limit = available * (0.74 + rnd('shelf', shelves.length) * 0.22);
    }
    row.push(item);
    used += w;
  });
  if (row.length) shelves.push(row);
  return shelves;
}

/** Собирает разметку шкафа под доступную ширину. */
export function bookcaseHTML(books, available) {
  if (!books.length) return '';
  const shelves = layout(books, Math.max(240, available));

  return `<div class="bookcase" style="--shelf-h:${SHELF_H}px">
    ${shelves.map(row => `<div class="bc-shelf">
      <div class="bc-row">${row.map(item =>
        item.kind === 'stack' ? stackHTML(item.books)
        : item.pose === 'face' ? faceHTML(item.book)
        : spineHTML(item.book, item.pose)).join('')}</div>
      <div class="bc-plank" aria-hidden="true"></div>
    </div>`).join('')}
  </div>`;
}
