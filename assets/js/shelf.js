/* Полка: шесть книг лицом, остальные — стопкой. Плюс поиск, жанры и сортировка. */

import { state, avg, spread, genres, fmtDate, nPlural, nextMeeting, num } from './data.js';
import { coverHTML, mountCovers, esc } from './ui.js';
import { icon, hydrateIcons } from './icons.js';

const FACE_OUT = 6;          // сколько книг стоят лицом, прежде чем начнётся стопка

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

function pileHTML(rest) {
  if (!rest.length) return '';
  const books = rest.map((b, i) => {
    const jog = (i % 3 - 1) * 6;
    return `<button class="pile-book t${b.tone ?? 0}" data-id="${esc(b.id)}"
        style="--jog:${jog}px"
        aria-label="Открыть карточку: ${esc(b.title)}, ${esc(b.author)}">
      <span class="pb-title">${esc(b.title)}</span>
      <span class="pb-score">${num(avg(b))}</span>
    </button>`;
  }).join('');

  return `<div class="pile">
    <div class="pile-head">
      ${icon('stack')}
      <span>${nPlural(rest.length, 'книга', 'книги', 'книг')} в стопке</span>
      <button class="pile-toggle" id="pileToggle">разложить</button>
    </div>
    ${books}
  </div>`;
}

export function renderShelf() {
  const shelf = document.getElementById('shelf');
  const empty = document.getElementById('shelfEmpty');
  const list = visibleBooks();

  empty.hidden = list.length > 0;

  const faceCount = ui.pileOpen ? list.length : FACE_OUT;
  const front = list.slice(0, faceCount);
  const rest = list.slice(faceCount);

  shelf.innerHTML =
    `<div class="shelf-front">${front.map(slotHTML).join('')}</div>` +
    (ui.pileOpen && list.length > FACE_OUT
      ? `<div class="pile"><div class="pile-head">
           ${icon('stack')}<span>стопка разложена</span>
           <button class="pile-toggle" id="pileToggle">собрать</button>
         </div></div>`
      : pileHTML(rest));

  hydrateIcons(shelf);
  mountCovers(shelf);

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
}
