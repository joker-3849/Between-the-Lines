/* Три остальных раздела: «Между строк», «Хроника» и «Итоги года». */

import {
  state, avg, spread, allLines, fmtDate, nPlural, plural, numPlural,
  memberMean, memberScore, yearOf, years, num
} from './data.js';
import { coverHTML, mountCovers, avatarHTML, whoHTML, esc } from './ui.js';
import { icon, hydrateIcons } from './icons.js';
import { mountTilt, tiltWrap } from './tilt.js';

let onOpenBook = () => {};
export function initPages(openBook) { onOpenBook = openBook; }

function wireBookLinks(root) {
  root.querySelectorAll('[data-book-link]').forEach(el => {
    el.addEventListener('click', () => onOpenBook(el.dataset.bookLink, el.querySelector('.cover')));
  });
}

/* ══════════════════ Между строк ══════════════════ */

let linesFilter = 'all';

export function renderLines() {
  const view = document.getElementById('view-lines');
  const items = allLines().filter(x => linesFilter === 'all' || x.member.id === linesFilter);

  const chips = [
    `<button class="chip" data-member="all" aria-pressed="${linesFilter === 'all'}">Все</button>`,
    ...state.members.map(m =>
      `<button class="chip" data-member="${esc(m.id)}" aria-pressed="${linesFilter === m.id}">${esc(m.name)}</button>`)
  ].join('');

  const cards = items.map(({ book, member, line, kind }) => `
    <figure class="line-card">
      <blockquote class="line-q">«${esc(line.text)}»</blockquote>
      <figcaption class="line-meta">
        ${avatarHTML(member)}
        <span>${esc(member.name)}</span>
        <span aria-hidden="true">·</span>
        <button class="line-book" data-book-link="${esc(book.id)}">${esc(book.title)}</button>
        ${kind === 'book' ? '<span class="tag-book">из книги</span>' : ''}
      </figcaption>
    </figure>`).join('');

  view.innerHTML = `<div class="page">
    <div class="page-head">
      <h1 class="page-title">Между строк</h1>
      <p class="page-sub">Строчки, которые мы забрали с собой: свои формулировки с обсуждений и несколько фраз прямо из книг.</p>
    </div>
    <div class="lines-filter">${chips}</div>
    ${items.length ? `<div class="lines-grid">${cards}</div>`
      : `<p class="shelf-empty">Здесь пока пусто.</p>`}
  </div>`;

  hydrateIcons(view);
  wireBookLinks(view);

  view.querySelector('.lines-filter').addEventListener('click', e => {
    const chip = e.target.closest('[data-member]');
    if (!chip) return;
    linesFilter = chip.dataset.member;
    renderLines();
  });
}

/* ══════════════════ Хроника ══════════════════ */

export function renderChronicle() {
  const view = document.getElementById('view-chronicle');
  const byYear = new Map();
  [...state.books]
    .sort((a, b) => b.discussed.localeCompare(a.discussed))
    .forEach(b => {
      const y = yearOf(b);
      if (!byYear.has(y)) byYear.set(y, []);
      byYear.get(y).push(b);
    });

  const blocks = [...byYear.entries()].map(([year, books]) => `
    <div class="chron-year">
      <h2>${year}</h2>
      <span>${nPlural(books.length, 'встреча', 'встречи', 'встреч')}</span>
    </div>
    ${books.map(b => `
      <button class="chron-row" data-book-link="${esc(b.id)}">
        <span class="chron-date">${esc(fmtDate(b.discussed, { withYear: false }))}</span>
        ${coverHTML(b, 'chron-cover')}
        <span class="chron-main">
          <span class="chron-title">${esc(b.title)}</span>
          <span class="chron-sub">${esc(b.author)} · ${esc(b.genre)}</span>
        </span>
        <span class="chron-score">${num(avg(b))}<small>/${state.club.scale}</small></span>
      </button>`).join('')}`).join('');

  view.innerHTML = `<div class="page">
    <div class="page-head">
      <h1 class="page-title">Хроника</h1>
      <p class="page-sub">${nPlural(state.books.length, 'встреча', 'встречи', 'встреч')} по датам — от последней к первой.</p>
    </div>
    ${blocks}
  </div>`;

  hydrateIcons(view);
  mountCovers(view);
  wireBookLinks(view);
}

/* ══════════════════ Итоги года ══════════════════ */

let activeYear = null;
let yearObserver = null;

function booksOfYear(year) {
  return state.books.filter(b => yearOf(b) === year)
    .sort((a, b) => a.discussed.localeCompare(b.discussed));
}

function best(list, fn) {
  return list.reduce((a, b) => (fn(b) > fn(a) ? b : a), list[0]);
}
function worst(list, fn) {
  return list.reduce((a, b) => (fn(b) < fn(a) ? b : a), list[0]);
}

function featureHTML({ label, book, text, showScores }) {
  const pills = showScores ? `<div class="yr-scores">${state.members.map(m => {
    const v = memberScore(book, m.id);
    return v == null ? '' : `<span class="yr-score-pill">${avatarHTML(m)}${num(v)}</span>`;
  }).join('')}</div>` : '';

  return `<section class="yr-act">
    <div class="yr-label">${esc(label)}</div>
    <div class="yr-feature">
      <button data-book-link="${esc(book.id)}" style="display:block;text-align:left">
        ${tiltWrap(coverHTML(book), 'tilt-feature')}
      </button>
      <div>
        <h2 class="yr-btitle">${esc(book.title)}</h2>
        <p class="yr-bauthor">${esc(book.author)}</p>
        <p class="yr-text">${esc(text)}</p>
        ${pills}
      </div>
    </div>
  </section>`;
}

/* Объём и год издания в записях встреч есть не у всех книг, поэтому
   соответствующие рекорды показываются, только когда их есть на чём
   посчитать: карточка «Самая толстая» без страниц врала бы. */
function recordsHTML(list) {
  const withPages = list.filter(b => b.pages > 0);
  const withYear = list.filter(b => b.year);
  const unison = worst(list, b => spread(b));

  const cards = [];
  if (withPages.length) {
    const longest = best(withPages, b => b.pages);
    cards.push({ label: 'Самая толстая', book: longest,
      value: nPlural(longest.pages, 'страница', 'страницы', 'страниц') });
  }
  if (withYear.length) {
    const oldest = worst(withYear, b => b.year);
    cards.push({ label: 'Самая старая', book: oldest, value: `${oldest.year} год` });
  }
  cards.push({ label: 'Полное единодушие', book: unison,
    value: `разброс ${numPlural(spread(unison), 'балл', 'балла', 'баллов')}` });

  return `<section class="yr-act">
    <div class="yr-label">Ещё несколько рекордов</div>
    <div class="yr-records">
      ${cards.map(c => `<button class="yr-record" data-book-link="${esc(c.book.id)}">
        ${coverHTML(c.book, 'yr-record-cover')}
        <span class="yr-record-label">${esc(c.label)}</span>
        <span class="yr-record-title">${esc(c.book.title)}</span>
        <span class="yr-record-value">${esc(c.value)}</span>
      </button>`).join('')}
    </div>
  </section>`;
}

function genresHTML(list) {
  const counts = new Map();
  list.forEach(b => counts.set(b.genre, (counts.get(b.genre) || 0) + 1));
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const max = rows[0]?.[1] || 1;

  return `<section class="yr-act">
    <div class="yr-label">Что читали</div>
    <div class="yr-bars">
      ${rows.map(([g, n]) => `<div class="yr-bar">
        <span class="yr-bar-label">${esc(g)}</span>
        <span class="yr-bar-track"><span class="yr-bar-fill" style="width:${(n / max * 100).toFixed(1)}%"></span></span>
        <span class="yr-bar-num">${n}</span>
      </div>`).join('')}
    </div>
  </section>`;
}

function peopleHTML(list) {
  const means = state.members
    .map(m => ({ m, mean: memberMean(m.id, list) }))
    .filter(x => x.mean != null);
  if (!means.length) return '';

  const strict = worst(means, x => x.mean);
  const kind = best(means, x => x.mean);

  const title = (x) => {
    if (x === strict) return x.m.g === 'm' ? 'самый строгий' : 'самая строгая';
    if (x === kind) return x.m.g === 'm' ? 'самый щедрый' : 'самая щедрая';
    return 'средняя оценка';
  };

  return `<section class="yr-act">
    <div class="yr-label">Читатели</div>
    <div class="yr-people">
      ${means.map(x => `<div class="yr-person">
        ${whoHTML(x.m)}
        <b>${num(x.mean)}</b>
        <span>${esc(title(x))}</span>
      </div>`).join('')}
    </div>
  </section>`;
}

function lineOfYearHTML(year, list) {
  const pick = state.club.yearHighlights?.[year]?.lineOfTheYear;
  let book = pick && state.bookById.get(pick.bookId);
  let member = pick && state.memberById.get(pick.memberId);
  // Выбранная строчка года — своя формулировка участницы; если её нет,
  // берём первую попавшуюся из года, включая цитаты из книг.
  let line = book && member ? book.reviews?.[member.id]?.line : null;
  let kind = 'club';

  if (!line?.text) {
    const any = allLines(list)[0];
    if (!any) return '';
    ({ book, member, line, kind } = any);
  }

  return `<section class="yr-act">
    <div class="yr-label">Строчка года</div>
    <blockquote class="yr-quote">«${esc(line.text)}»</blockquote>
    <p class="yr-quote-by">
      ${esc(member.name)} — о книге «${esc(book.title)}»${kind === 'book' ? ', цитата из книги' : ''}
    </p>
  </section>`;
}

export function renderYear() {
  const view = document.getElementById('view-year');
  const all = years();
  if (!all.length) { view.innerHTML = ''; return; }

  // По умолчанию — последний год, в котором прошло не меньше пяти встреч.
  if (activeYear == null || !all.includes(activeYear)) {
    activeYear = all.find(y => booksOfYear(y).length >= 5) ?? all[0];
  }

  const list = booksOfYear(activeYear);
  const pages = list.reduce((a, b) => a + (b.pages || 0), 0);
  const mean = list.reduce((a, b) => a + (avg(b) ?? 0), 0) / list.length;
  const bookOfYear = best(list, b => avg(b) ?? 0);
  const mostSplit = best(list, b => spread(b));
  const running = activeYear === new Date().getFullYear();

  const switcher = all.length > 1
    ? `<div class="yr-switch">${all.map(y =>
        `<button class="chip" data-year="${y}" aria-pressed="${y === activeYear}">${y}</button>`).join('')}</div>`
    : '';

  view.innerHTML = `<div class="yr">
    <header class="yr-hero">
      <div class="yr-kicker">Итоги года</div>
      <div class="yr-number">${activeYear}</div>
      <p>${running
        ? 'Год ещё идёт — итоги промежуточные и будут дополняться после каждой встречи.'
        : `Год закрыт: ${nPlural(list.length, 'встреча', 'встречи', 'встреч')}`
          + `${pages ? ` и ${nPlural(pages, 'страница', 'страницы', 'страниц')}` : ''}.`}</p>
      ${switcher}
      <div class="yr-scrollhint">${icon('chevron-down')}<span>Листайте</span></div>
    </header>

    <section class="yr-act">
      <div class="yr-label">Коротко</div>
      <div class="yr-stats">
        <div class="yr-stat"><b>${list.length}</b><span>${plural(list.length, 'КНИГА', 'КНИГИ', 'КНИГ')}</span></div>
        ${pages ? `<div class="yr-stat"><b>${pages.toLocaleString('ru-RU')}</b><span>СТРАНИЦ</span></div>` : ''}
        <div class="yr-stat"><b>${num(mean)}</b><span>СРЕДНЯЯ ОЦЕНКА</span></div>
        <div class="yr-stat"><b>${num(Math.max(...list.map(b => spread(b))))}</b><span>МАКСИМАЛЬНЫЙ РАЗБРОС</span></div>
      </div>
    </section>

    ${featureHTML({
      label: 'Книга года',
      book: bookOfYear,
      text: `Самая высокая средняя оценка года — ${num(avg(bookOfYear))} из ${state.club.scale}. ` +
            `Обсуждали ${fmtDate(bookOfYear.discussed)}.`,
      showScores: true
    })}

    ${lineOfYearHTML(activeYear, list)}

    ${featureHTML({
      label: 'Самая спорная',
      book: mostSplit,
      text: `Разброс в ${numPlural(spread(mostSplit), 'балл', 'балла', 'баллов')} — рекорд года. ` +
            `Ниже видно, кто где оказался.`,
      showScores: true
    })}

    ${recordsHTML(list)}
    ${genresHTML(list)}
    ${peopleHTML(list)}

    <section class="yr-end">
      <p>Полка растёт. Следующий год начнём с той книги, о которой дольше всего спорили в чате.</p>
    </section>
  </div>`;

  hydrateIcons(view);
  mountCovers(view);
  mountTilt(view);
  wireBookLinks(view);

  const sw = view.querySelector('.yr-switch');
  if (sw) sw.addEventListener('click', e => {
    const b = e.target.closest('[data-year]');
    if (!b) return;
    activeYear = Number(b.dataset.year);
    renderYear();
    window.scrollTo({ top: 0, behavior: 'auto' });
  });

  // Появление секций по мере прокрутки.
  yearObserver?.disconnect();
  yearObserver = new IntersectionObserver(entries => {
    entries.forEach(en => { if (en.isIntersecting) en.target.classList.add('in'); });
  }, { rootMargin: '0px 0px -12% 0px', threshold: .12 });
  view.querySelectorAll('.yr-act').forEach(el => yearObserver.observe(el));
}
