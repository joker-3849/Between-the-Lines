/* Полка: семь книг лицом, до пяти следующих — стопкой, остальные (если
   вдруг наберётся) не показываем вовсе. Плюс поиск, жанры и сортировка. */

import { state, avg, spread, genres, fmtDate, nPlural, nextMeeting, num } from './data.js';
import { coverHTML, esc } from './ui.js';
import { icon, hydrateIcons } from './icons.js';
import { openAddBookModal } from './addbook.js';
import { editorMode } from './lock.js';
import { bookcaseHTML } from './bookcase.js';

const FACE_OUT = 7;          // сколько книг стоят лицом, прежде чем начнётся стопка
const PILE_MAX = 5;          // сколько книг видно в стопке; остальные просто не показываем

const ui = { genre: 'Всё', sort: 'date-desc', query: '', pileOpen: false };

let onOpen = () => {};

/* Книги без года или объёма (в записях встреч этих полей часто нет) уходят
   в конец списка, а не всплывают наверх как «нулевые». */
const last = (v, cmp) => (a, b) => {
  const x = v(a), y = v(b);
  if (x == null && y == null) return 0;
  if (x == null) return 1;
  if (y == null) return -1;
  return cmp(x, y);
};

const SORTS = {
  'date-desc':   (a, b) => b.discussed.localeCompare(a.discussed),
  'date-asc':    (a, b) => a.discussed.localeCompare(b.discussed),
  'score-desc':  last(avg, (x, y) => y - x),
  'spread-desc': (a, b) => spread(b) - spread(a) || (avg(b) ?? 0) - (avg(a) ?? 0),
  'year-asc':    last(b => b.year, (x, y) => x - y),
  'pages-desc':  last(b => b.pages, (x, y) => y - x),
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

/** Название клуба логотипом: серединное «the» — курсивом, как в шапке. */
function wordmarkHTML(name) {
  const m = /^(.*\S)\s+(the)\s+(\S.*)$/i.exec(name || '');
  return m
    ? `${esc(m[1])}<span class="wm-the"> ${esc(m[2])} </span>${esc(m[3])}`
    : esc(name || '');
}

function renderHead() {
  const { club, books } = state;
  document.getElementById('heroTagline').textContent = club.tagline;
  document.getElementById('heroLedger').textContent =
    `${nPlural(books.length, 'книга', 'книги', 'книг')} · ` +
    `${nPlural(genres().length, 'жанр', 'жанра', 'жанров')} · с ${club.since} года`;
  document.getElementById('footNote').innerHTML = wordmarkHTML(club.name);

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
  requestAnimationFrame(() => syncGenreFade(box));

  // Без режима редактора полка только для чтения — кнопки добавления нет.
  document.getElementById('addBookBtn').hidden = !editorMode();
}

/* Полоса жанров прокручивается вбок, и понять это можно только по
   растушёванному краю — поэтому он появляется ровно с той стороны, где
   ещё остались невидимые чипы, и пропадает, когда прокручивать некуда. */
function syncGenreFade(box = document.getElementById('genres')) {
  if (!box) return;
  const max = box.scrollWidth - box.clientWidth;
  box.classList.toggle('can-left', box.scrollLeft > 2);
  box.classList.toggle('can-right', box.scrollLeft < max - 2);
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
// «Разложить» выкладывает на полку всю библиотеку — там ряд вдвое длиннее,
// и книгам разрешено стоять теснее: смотреть их всё равно приходится
// по одной, наводя курсор.
const OVERLAP_MAX_OPEN = 0.92;

const overlapMax = count => (count > FACE_OUT ? OVERLAP_MAX_OPEN : OVERLAP_MAX);

/** Подгоняет нахлёст между обложками под фактическую ширину ряда. */
function fitFrontRow(front, count) {
  const max = overlapMax(count);
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
    ratio = Math.min(max, Math.max(OVERLAP_MIN, 1 - step / coverW));
  }
  front.style.setProperty('--overlap', `${(ratio * coverW).toFixed(1)}px`);
}

/* Главная страница живёт ровно в один экран, поэтому размер книги считается
   не по формуле в CSS, а по факту: сколько высоты осталось полке после шапки,
   героя, панели и подвала. Значение в CSS (clamp по vw и vh) — только чтобы
   первый кадр не мигал; дальше его заменяет посчитанное. */
const COVER_MIN = 96;
const COVER_MAX = 240;
const COVER_RATIO = 1.5;              // высота обложки к ширине
// Наклонённая книга ближним краем выходит ниже своей коробки, и ровно на
// столько же ниже оказывается подпись, которая всплывает при наведении.
const TILT_OVERHANG = 14;

/** Ширина книги, при которой полка целиком помещается в оставшуюся высоту. */
function coverWidthForHeight() {
  const wrap = document.querySelector('.shelf-wrap');
  const shelf = document.getElementById('shelf');
  const foot = document.querySelector('.site-foot');
  if (!wrap || !shelf) return null;

  const wrapCs = getComputedStyle(wrap);
  const shelfCs = getComputedStyle(shelf);
  // Верх полки в координатах документа: страница должна укладываться в экран
  // целиком, поэтому считаем от начала документа, а не от текущей прокрутки.
  const top = wrap.getBoundingClientRect().top - document.body.getBoundingClientRect().top;

  const avail = window.innerHeight - top
    - parseFloat(wrapCs.paddingBottom || 0)
    - parseFloat(shelfCs.paddingTop || 0)
    - (foot ? foot.offsetHeight : 0)
    - TILT_OVERHANG;

  fitPile(avail);
  return clampCover(avail / COVER_RATIO);
}

const clampCover = w => Math.max(COVER_MIN, Math.min(COVER_MAX, Math.round(w)));

/* Нижняя граница плашки — не «сколько красиво», а «сколько ещё читается»:
   на 1024×768 стопка при 26px упиралась в минимум и всё равно на десяток
   пикселей выталкивала страницу за экран. При 21px и подписи в 14px строчка
   ещё разборчива, а полка наконец помещается. */
const PILE_ROW_MIN = 21, PILE_ROW_MAX = 40, PILE_HEAD = 34, PILE_GAP = 5;

/**
 * Высоту полки задают не только книги: рядом стоит стопка, и на невысоком
 * экране именно она оказывается самой высокой. Поэтому плашки стопки тоже
 * ужимаются под оставшуюся высоту — иначе книги упираются в минимум, а
 * страница всё равно прокручивается.
 */
function fitPile(avail) {
  const row = (avail - PILE_HEAD) / PILE_MAX - PILE_GAP;
  const px = Math.max(PILE_ROW_MIN, Math.min(PILE_ROW_MAX, Math.round(row)));
  document.documentElement.style.setProperty('--pile-row', `${px}px`);
}

const setCoverWidth = w =>
  document.documentElement.style.setProperty('--cover-w', `${w}px`);

/** Ширина книги, при которой ряд из count книг ещё помещается по ширине. */
function coverWidthForRow(front, count) {
  const cs = getComputedStyle(front);
  const inner = front.clientWidth - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0);
  // Ряд из count книг занимает rowFactor ширин обложки.
  const rowFactor = 1 + (count - 1) * (1 - overlapMax(count));
  return clampCover(inner / rowFactor);
}

let lastFrontCount = 0;

/** Пересчитать размер книги и нахлёст под текущее окно. */
export function refitShelf() {
  const front = document.querySelector('.shelf-front');
  // В режиме шкафа высота не подгоняется: полки специально уходят за экран.
  if (!front || !lastFrontCount || ui.pileOpen) return;
  // Полку перерисовывают и когда она скрыта — например, после правки книги,
  // пока открыта карточка. У скрытого блока все размеры нулевые, и подгонка
  // выдавала бы минимальную обложку, с которой полка потом и оставалась.
  if (!front.clientWidth) return;

  const byHeight = coverWidthForHeight();
  if (byHeight != null) {
    setCoverWidth(byHeight);
    // Второй проход: после смены размера ряду могло не хватить ширины —
    // тогда высоту недобираем, зато книги не наезжают на стопку.
    const byRow = coverWidthForRow(front, lastFrontCount);
    if (byRow < byHeight) setCoverWidth(byRow);

    // Третий, поправочный: высоту полки задаёт не только книга — рядом стоит
    // стопка, у страницы свои отступы. Считать это всё формулой хрупко,
    // поэтому просто смотрим, вылезла ли страница за экран, и убираем ровно
    // столько, сколько вылезло. Ниже минимума не опускаемся: если не влезает
    // и так, пусть лучше страница прокрутится, чем книги станут неразличимы.
    for (let pass = 0; pass < 3; pass++) {
      const over = document.body.scrollHeight - document.documentElement.clientHeight;
      if (over <= 1) break;
      const now = parseFloat(getComputedStyle(document.documentElement)
        .getPropertyValue('--cover-w')) || byHeight;
      const next = clampCover(now - Math.ceil(over / COVER_RATIO));
      if (next >= now) break;
      setCoverWidth(next);
    }
  }
  fitFrontRow(front, lastFrontCount);
}

/* Полосу жанров можно листать тремя способами: колесом мыши (её обычная
   вертикальная прокрутка переводится в горизонтальную), перетаскиванием
   курсором и, как и раньше, тачем. Клик по чипу при этом не должен
   срабатывать после протаскивания — отсюда порог в несколько пикселей. */
function wireGenreDrag(box) {
  box.addEventListener('wheel', e => {
    // Тачпады шлют и deltaX — им ничего переводить не нужно.
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    const max = box.scrollWidth - box.clientWidth;
    if (max <= 0) return;
    box.scrollLeft += e.deltaY;
    e.preventDefault();
  }, { passive: false });

  let startX = 0, startScroll = 0, dragging = false, moved = 0;

  box.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch' || e.button !== 0) return;  // тач листает сам
    dragging = true; moved = 0;
    startX = e.clientX;
    startScroll = box.scrollLeft;
    box.setPointerCapture(e.pointerId);
  });

  box.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    if (!box.classList.contains('dragging') && Math.abs(dx) > 4) {
      box.classList.add('dragging');   // с этого момента это уже не клик
    }
    moved = Math.max(moved, Math.abs(dx));
    box.scrollLeft = startScroll - dx;
  });

  const end = e => {
    if (!dragging) return;
    dragging = false;
    box.classList.remove('dragging');
    if (e.pointerId != null && box.hasPointerCapture?.(e.pointerId)) {
      box.releasePointerCapture(e.pointerId);
    }
  };
  box.addEventListener('pointerup', end);
  box.addEventListener('pointercancel', end);

  // Протащили — значит, чип не нажимали.
  box.addEventListener('click', e => { if (moved > 4) { e.stopPropagation(); moved = 0; } }, true);
}

export function renderShelf() {
  const shelf = document.getElementById('shelf');
  const wrap = shelf.closest('.shelf-wrap');
  const empty = document.getElementById('shelfEmpty');
  const list = visibleBooks();

  empty.hidden = list.length > 0;
  wrap.classList.toggle('is-case', ui.pileOpen);
  document.getElementById('view-shelf').classList.toggle('case-open', ui.pileOpen);

  if (ui.pileOpen) {
    renderCase(shelf, list);
    return;
  }

  const front = list.slice(0, Math.min(FACE_OUT, list.length));
  const rest = list.slice(front.length);

  shelf.innerHTML =
    `<div class="shelf-front">${front.map(slotHTML).join('')}</div>` +
    pileHTML(rest);

  hydrateIcons(shelf);

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

  lastFrontCount = front.length;
  requestAnimationFrame(refitShelf);
}

/* ── шкаф: вся библиотека на нескольких полках ────────────────────────── */

/**
 * Раскладку приходится считать в два прохода: сколько книг влезет в ряд,
 * видно только по фактической ширине шкафа, а она известна лишь после того,
 * как он встал в разметку. Первый проход рисует шкаф по ширине контейнера,
 * второй — уточняет по себе же.
 */
function renderCase(shelf, list) {
  const draw = width => {
    shelf.innerHTML =
      `<div class="case-head">
         ${icon('stack')}
         <span>${nPlural(list.length, 'книга', 'книги', 'книг')} на полках</span>
         <button class="pile-toggle" id="pileToggle">собрать</button>
       </div>` +
      bookcaseHTML(list, width);
    hydrateIcons(shelf);
    wireCase(shelf);
  };

  draw(shelf.clientWidth - 2 * padOf(shelf));
  requestAnimationFrame(() => {
    const row = shelf.querySelector('.bc-row');
    if (row && Math.abs(row.clientWidth - lastCaseWidth) > 4) {
      lastCaseWidth = row.clientWidth;
      draw(row.clientWidth);
    }
  });
}

let lastCaseWidth = 0;

const padOf = el => parseFloat(getComputedStyle(el).paddingLeft || 0);

function wireCase(shelf) {
  shelf.querySelectorAll('[data-id]').forEach(el => {
    el.addEventListener('click', () => onOpen(el.dataset.id, el.querySelector('.cover')));
  });
  document.getElementById('pileToggle')?.addEventListener('click', () => {
    ui.pileOpen = false;
    renderShelf();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

/** Перерисовать шапку, панель и полку после добавления или удаления книги. */
export function refreshShelf() {
  renderHead();      // в подзаголовке число книг и жанров — оно тоже меняется
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

  document.getElementById('addBookBtn').addEventListener('click', openAddBookModal);


  const genresBox = document.getElementById('genres');
  genresBox.addEventListener('scroll', () => syncGenreFade(), { passive: true });
  wireGenreDrag(genresBox);

  let resizeT;
  window.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => { refitShelf(); syncGenreFade(); }, 120);
  });
}
