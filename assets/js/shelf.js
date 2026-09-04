/* Полка: семь книг лицом, до пяти следующих — стопкой, остальные (если
   вдруг наберётся) не показываем вовсе. Плюс поиск, жанры и сортировка. */

import { state, avg, spread, genres, fmtDate, nPlural, nextMeeting, num } from './data.js';
import { coverHTML, mountCovers, loadedCovers, resetLoadedCovers, esc } from './ui.js';
import * as settings from './settings.js';
import { icon, hydrateIcons } from './icons.js';
import { openAddBookModal } from './addbook.js';

const FACE_OUT = 7;          // сколько книг стоят лицом, прежде чем начнётся стопка
const PILE_MAX = 5;          // сколько книг видно в стопке; остальные просто не показываем

const ui = { genre: 'Всё', sort: 'date-desc', query: '', pileOpen: false };

let onOpen = () => {};

const SORTS = {
  'date-desc':   (a, b) => b.discussed.localeCompare(a.discussed),
  'date-asc':    (a, b) => a.discussed.localeCompare(b.discussed),
  'score-desc':  (a, b) => (avg(b) ?? 0) - (avg(a) ?? 0),
  'spread-desc': (a, b) => spread(b) - spread(a) || (avg(b) ?? 0) - (avg(a) ?? 0),
  'year-asc':    (a, b) => (a.year ?? 0) - (b.year ?? 0),
  'pages-desc':  (a, b) => (b.pages ?? 0) - (a.pages ?? 0),
  'title-asc':   (a, b) => a.title.localeCompare(b.title, 'ru')
};

function visibleBooks() {
  const q = ui.query.trim().toLowerCase();
  return state.books
    .filter(b => ui.genre === 'Всё' || b.genre === ui.genre)
    .filter(b => !q || `${b.title} ${b.author}`.toLowerCase().includes(q))
    .sort(SORTS[ui.sort] || SORTS['date-desc']);
}

/* ── шапка ────────────────────────────────────────────────────────────── */

function renderHead() {
  const { club, books } = state;
  document.getElementById('heroTagline').textContent = club.tagline;
  document.getElementById('heroLedger').textContent =
    `${nPlural(books.length, 'книга', 'книги', 'книг')} · ` +
    `${nPlural(genres().length, 'жанр', 'жанра', 'жанров')} · с ${club.since} года`;
  document.getElementById('footNote').textContent =
    `${club.name} · ${club.cadenceLabel}`;

  const now = club.currentlyReading;
  const box = document.getElementById('now');
  if (!now?.title) { box.hidden = true; return; }
  box.hidden = false;
  document.getElementById('nowTitle').textContent = now.title;
  document.getElementById('nowAuthor').textContent = now.author || '';

  const meet = nextMeeting(club);
  if (meet) {
    document.getElementById('nowDate').textContent = fmtDate(meet.iso, { withYear: false });
    document.getElementById('nowCountdown').textContent =
      meet.days === 0 ? 'сегодня'
      : meet.days === 1 ? 'завтра'
      : `через ${nPlural(meet.days, 'день', 'дня', 'дней')}`;
  }
}

/* ── панель ───────────────────────────────────────────────────────────── */

function renderToolbar() {
  const box = document.getElementById('genres');
  const list = ['Всё', ...genres()];
  box.innerHTML = list.map(g =>
    `<button class="chip" data-genre="${esc(g)}" aria-pressed="${g === ui.genre}">${esc(g)}</button>`
  ).join('');

  const mode = settings.get('covers');
  document.querySelectorAll('#coversToggle .seg').forEach(b =>
    b.setAttribute('aria-pressed', String(b.dataset.covers === mode)));
}

/* Подсказка появляется только если настоящих обложек действительно не видно:
   считаем те, что успели загрузиться, а не те, что прописаны в данных. */
let hintToken = 0;

function checkCoversHint() {
  const hint = document.getElementById('coversHint');
  const token = ++hintToken;

  if (settings.get('covers') !== 'real') { hint.hidden = true; return; }

  setTimeout(() => {
    if (token !== hintToken) return;
    const none = loadedCovers() === 0;
    hint.hidden = !none;
    if (none) {
      hint.textContent = 'Фотографий настоящих обложек пока нет. Проверьте ISBN в поле '
        + 'isbn в data/books.json или запустите tools/fetch-covers.mjs — '
        + 'до тех пор показываем свои.';
    }
  }, 1600);
}

/* ── полка ────────────────────────────────────────────────────────────── */

function slotHTML(book) {
  const mean = avg(book);
  return `<div class="slot">
    <button class="book3d" data-id="${esc(book.id)}"
      aria-label="Открыть карточку: ${esc(book.title)}, ${esc(book.author)}">
      <span class="book-edge" aria-hidden="true"></span>
      ${coverHTML(book)}
    </button>
    <div class="slot-caption" aria-hidden="true">
      <div class="sc-title">${esc(book.title)}</div>
      <div class="sc-meta">
        <span class="sc-score">${num(mean)}</span>
        <span>·</span>
        <span>${esc(book.genre)}</span>
      </div>
    </div>
  </div>`;
}

function addSlotHTML() {
  return `<div class="slot add-slot">
    <button type="button" class="book3d add-book-btn" id="addBookTile"
      aria-haspopup="dialog" aria-label="Добавить новую книгу на полку">
      <span class="add-plus">${icon('plus')}</span>
      <span class="add-label">Добавить<br>книгу</span>
    </button>
  </div>`;
}

function pileHTML(rest) {
  if (!rest.length) return '';
  const shown = rest.slice(0, PILE_MAX);
  const books = shown.map((b, i) => {
    const jog = (i % 3 - 1) * 6;
    return `<button class="pile-book" data-id="${esc(b.id)}"
        style="--jog:${jog}px"
        aria-label="Открыть карточку: ${esc(b.title)}, ${esc(b.author)}">
      ${coverHTML(b, 'pile-cover')}
      <span class="pile-scrim" aria-hidden="true"></span>
      <span class="pb-title">${esc(b.title)}</span>
      <span class="pb-score">${num(avg(b))}</span>
    </button>`;
  }).join('');

  return `<div class="pile">
    <div class="pile-head">
      ${icon('stack')}
      <span>${nPlural(shown.length, 'книга', 'книги', 'книг')} в стопке</span>
      <button class="pile-toggle" id="pileToggle">разложить</button>
    </div>
    ${books}
  </div>`;
}

/* Ряд обложек всегда показывает ровно FACE_OUT книг (пока их хватает) и
   никогда не скроллится по горизонтали: вместо этого книги подгоняются под
   доступную ширину нахлёстом — небольшим, если места хватает, и заметно
   плотнее, если нет. Считается ровно один раз на кадр после отрисовки,
   когда браузер уже знает реальную ширину .shelf-front. */
const OVERLAP_MIN = 0.18;
// Плотнее этого книги не жмутся: при 0.8 от обложки наружу остаётся полоска
// в пятую часть ширины — по ней ещё можно попасть пальцем. Всё, что тесноты
// требует сверх этого, решается тем, что стопка уходит на свою строку.
const OVERLAP_MAX = 0.80;

/** Подгоняет нахлёст между обложками под фактическую ширину ряда. */
function fitFrontRow(front, count) {
  if (!count) return;
  // Ширину берём с самой книги, а не из --cover-w: значение переменной
  // приходит из getComputedStyle нерассчитанным (clamp(96px,13.6vw,196px)
  // так и останется строкой), а offsetWidth уже знает реальный размер.
  const coverW = front.querySelector('.book3d')?.offsetWidth || 196;
  const cs = getComputedStyle(front);
  const available = front.clientWidth - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0);

  let ratio = OVERLAP_MIN;
  if (count > 1 && available > 0) {
    const step = (available - coverW) / (count - 1);
    ratio = Math.min(OVERLAP_MAX, Math.max(OVERLAP_MIN, 1 - step / coverW));
  }
  front.style.setProperty('--overlap', `${(ratio * coverW).toFixed(1)}px`);
}

let lastFrontCount = 0;

/** Пересчитать нахлёст под текущую ширину окна — например, после ресайза. */
export function refitShelf() {
  const front = document.querySelector('.shelf-front');
  if (front && lastFrontCount) fitFrontRow(front, lastFrontCount);
}

export function renderShelf() {
  const shelf = document.getElementById('shelf');
  const empty = document.getElementById('shelfEmpty');
  const list = visibleBooks();

  empty.hidden = list.length > 0;

  const faceCount = ui.pileOpen ? list.length : Math.min(FACE_OUT, list.length);
  const front = list.slice(0, faceCount);
  const rest = list.slice(faceCount);

  shelf.innerHTML =
    `<div class="shelf-front${ui.pileOpen ? ' expanded' : ''}">${front.map(slotHTML).join('')}</div>` +
    addSlotHTML() +
    (ui.pileOpen && list.length > FACE_OUT
      ? `<div class="pile"><div class="pile-head">
           ${icon('stack')}<span>стопка разложена</span>
           <button class="pile-toggle" id="pileToggle">собрать</button>
         </div></div>`
      : pileHTML(rest));

  hydrateIcons(shelf);
  resetLoadedCovers();
  mountCovers(shelf);
  checkCoversHint();

  shelf.querySelectorAll('[data-id]').forEach(el => {
    el.addEventListener('click', () => {
      onOpen(el.dataset.id, el.querySelector('.cover'));
    });
  });

  const toggle = document.getElementById('pileToggle');
  if (toggle) toggle.addEventListener('click', () => {
    ui.pileOpen = !ui.pileOpen;
    renderShelf();
  });

  document.getElementById('addBookTile')?.addEventListener('click', openAddBookModal);

  lastFrontCount = front.length;
  requestAnimationFrame(() => {
    const frontEl = shelf.querySelector('.shelf-front');
    if (frontEl) fitFrontRow(frontEl, lastFrontCount);
  });
}

/** Перерисовать панель и полку после добавления книги — вызывается извне. */
export function refreshShelf() {
  renderToolbar();
  renderShelf();
}

/** Найти обложку книги на полке — нужно для обратного перелёта при закрытии. */
export function coverOnShelf(bookId) {
  return document.querySelector(`#shelf [data-id="${CSS.escape(bookId)}"] .cover`);
}

/* ── инициализация ────────────────────────────────────────────────────── */

export function initShelf(openBook) {
  onOpen = openBook;
  renderHead();
  renderToolbar();
  renderShelf();

  document.getElementById('genres').addEventListener('click', e => {
    const chip = e.target.closest('[data-genre]');
    if (!chip) return;
    ui.genre = chip.dataset.genre;
    ui.pileOpen = false;
    renderToolbar();
    renderShelf();
  });

  const search = document.getElementById('search');
  let t;
  search.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => { ui.query = search.value; ui.pileOpen = false; renderShelf(); }, 120);
  });

  document.getElementById('sort').addEventListener('change', e => {
    ui.sort = e.target.value;
    ui.pileOpen = false;
    renderShelf();
  });

  document.getElementById('coversToggle').addEventListener('click', e => {
    const b = e.target.closest('[data-covers]');
    if (!b) return;
    settings.set('covers', b.dataset.covers);
    renderToolbar();
    renderShelf();
  });

  let resizeT;
  window.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(refitShelf, 120);
  });
}
