/* Три остальных раздела: «Между строк», «Хроника» и «Итоги года». */

import {
  state, avg, spread, allLines, fmtDate, nPlural, plural, numPlural,
  memberMean, memberScore, yearOf, years, num,
  pagesRead, clubMean, genreStats, favouriteGenre, goodreadsPairs, yearStats
} from './data.js';
import { coverHTML, avatarHTML, whoHTML, esc } from './ui.js';
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

/* «Хроника» — это не только список встреч, но и всё, что из него следует:
   какие жанры клуб любит, кто из участниц строже, где мы расходимся с
   Goodreads. Каждая сводка считается из тех же оценок, что и страница книги,
   и пропадает целиком, если считать не из чего: пустая карточка с прочерками
   выглядит как поломка, а не как «данных пока нет». */

let ratingWho = null;      // чей личный рейтинг открыт

const scale = () => state.club.scale || 10;

/* ── свод ─────────────────────────────────────────────────────────────── */

function statHTML(value, label) {
  return `<div class="cs-stat"><b>${value}</b><span>${esc(label)}</span></div>`;
}

function summaryHTML() {
  const books = state.books;
  const pages = pagesRead(books);
  const mean = clubMean(books);
  const fav = favouriteGenre(books);

  return `<div class="cs-stats">
    ${statHTML(books.length, plural(books.length, 'книга', 'книги', 'книг'))}
    ${pages ? statHTML(pages.toLocaleString('ru-RU'), 'страниц прочитано') : ''}
    ${mean != null ? statHTML(num(mean), `средняя оценка из ${scale()}`) : ''}
    ${fav ? statHTML(`<span class="cs-stat-word">${esc(fav.genre)}</span>`, 'любимый жанр') : ''}
  </div>`;
}

/* ── жанры ────────────────────────────────────────────────────────────── */

/* Полоса — это оценка, а не количество: жанр, который читали дважды и оба
   раза с восторгом, любимее того, который читали пять раз вполсилы. Число
   рядом — сколько книг жанра оценили: непрочитанные в среднее не входят и
   в счёт при нём стоять не должны. */
function genreBarsHTML(rows, favGenre) {
  return `<div class="cs-bars">${rows.map(r => `
    <div class="cs-bar${r.genre === favGenre ? ' is-fav' : ''}">
      <span class="cs-bar-label">${esc(r.genre)}</span>
      <span class="cs-bar-track">
        <span class="cs-bar-fill" style="width:${(r.mean / scale() * 100).toFixed(1)}%"></span>
      </span>
      <span class="cs-bar-num">${num(r.mean)}</span>
      <span class="cs-bar-count">${r.rated}&nbsp;кн.</span>
    </div>`).join('')}</div>`;
}

function clubGenresHTML() {
  const rows = genreStats().filter(r => r.mean != null)
    .sort((a, b) => b.mean - a.mean || b.count - a.count);
  if (!rows.length) return '';
  const fav = favouriteGenre();

  return `<section class="cs-card">
    <h3>Любимый жанр клуба</h3>
    ${fav ? `<p class="cs-lead">${esc(fav.genre)} <b>${num(fav.mean)}</b>
      <span>из ${scale()} · ${nPlural(fav.rated, 'книга', 'книги', 'книг')}</span></p>` : ''}
    ${genreBarsHTML(rows, fav?.genre)}
    <p class="cs-note">Полоса — средняя оценка жанра, а не то, как часто его берут.
      Жанр с единственной книгой в любимые не выбирается: одна десятка — это ещё
      про книгу, а не про жанр.</p>
  </section>`;
}

function memberGenresHTML() {
  const rows = state.members
    .map(m => ({ m, fav: favouriteGenre(state.books, b => memberScore(b, m.id)) }))
    .filter(x => x.fav);
  if (!rows.length) return '';

  return `<section class="cs-card">
    <h3>Любимые жанры участниц</h3>
    <div class="cs-people">
      ${rows.map(({ m, fav }) => `<div class="cs-person">
        ${whoHTML(m)}
        <span class="cs-person-genre">${esc(fav.genre)}</span>
        <b>${num(fav.mean)}</b>
      </div>`).join('')}
    </div>
    <p class="cs-note">Жанр, который каждая оценивает выше остальных. Жанры,
      прочитанные всего раз, в счёт не идут, пока есть прочитанные дважды.</p>
  </section>`;
}

/* ── личный рейтинг ───────────────────────────────────────────────────── */

/* Свой список у каждой получается заметно не таким, как общий: рядом с
   личным баллом стоит расхождение с клубом — по нему сразу видно, где
   человек оказался один против всех. */
function ratingBodyHTML() {
  const m = state.memberById.get(ratingWho);
  if (!m) return '';

  const rows = state.books
    .map(b => ({ book: b, mine: memberScore(b, m.id), club: avg(b) }))
    .filter(r => typeof r.mine === 'number')
    .sort((a, b) => b.mine - a.mine);

  if (!rows.length) {
    return `<p class="cs-empty">${esc(m.name)} пока не оценила ни одной книги.</p>`;
  }

  const mine = memberMean(m.id);
  const club = clubMean(state.books.filter(b => typeof memberScore(b, m.id) === 'number'));
  const off = mine - club;
  const verdict = Math.abs(off) < 0.15
    ? 'ровно как клуб в среднем'
    : `${off > 0 ? 'щедрее' : 'строже'} клуба на ${numPlural(Math.abs(off), 'балл', 'балла', 'баллов')}`;

  return `<ol class="cs-rank">
    ${rows.map((r, i) => {
      const d = r.mine - r.club;
      const sign = Math.abs(d) < 0.05 ? '' : d > 0 ? 'up' : 'down';
      return `<li>
        <span class="cs-rank-n">${i + 1}</span>
        <button class="cs-rank-title" data-book-link="${esc(r.book.id)}">${esc(r.book.title)}</button>
        <span class="cs-rank-score">${num(r.mine)}</span>
        <span class="cs-rank-diff ${sign}">${sign ? (d > 0 ? '+' : '−') + num(Math.abs(d)) : '='}</span>
      </li>`;
    }).join('')}
  </ol>
  <p class="cs-note">Средняя оценка: <b>${num(mine)}</b> — ${verdict}.
    Справа — расхождение с оценкой клуба по той же книге.</p>`;
}

function ratingHTML() {
  const rated = state.members.filter(m =>
    state.books.some(b => typeof memberScore(b, m.id) === 'number'));
  if (!rated.length) return '';
  if (!rated.some(m => m.id === ratingWho)) ratingWho = rated[0].id;

  return `<section class="cs-card cs-card-wide">
    <h3>Ваш рейтинг</h3>
    <div class="cs-who">${rated.map(m =>
      `<button class="chip" data-rating="${esc(m.id)}" aria-pressed="${m.id === ratingWho}">${esc(m.name)}</button>`
    ).join('')}</div>
    <div id="csRatingBody">${ratingBodyHTML()}</div>
  </section>`;
}

/* ── клуб и Goodreads ─────────────────────────────────────────────────── */

/* Оценку Goodreads приходится вписывать руками: открытого API у них нет, а
   страницу оттуда браузер читать не даст. Пока её нет ни у одной книги,
   карточка не считает ничего — она объясняет, где это поле взять. */
function goodreadsHTML() {
  const pairs = goodreadsPairs().sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  if (!pairs.length) {
    return `<section class="cs-card">
      <h3>Клуб и Goodreads</h3>
      <p class="cs-empty">Ни у одной книги не проставлена оценка Goodreads.
        Она вписывается руками — в режиме редактора, на странице книги,
        «Внести изменения» → «Оценка Goodreads». Автоматически её не достать:
        Goodreads не отдаёт оценки наружу.</p>
    </section>`;
  }

  const off = pairs.reduce((a, x) => a + x.diff, 0) / pairs.length;
  const lead = Math.abs(off) < 0.15
    ? 'Клуб и Goodreads сходятся почти в ноль.'
    : `Клуб ${off > 0 ? 'добрее' : 'строже'} Goodreads в среднем на `
      + `${numPlural(Math.abs(off), 'балл', 'балла', 'баллов')}.`;

  return `<section class="cs-card cs-card-wide">
    <h3>Клуб и Goodreads</h3>
    <p class="cs-lead-plain">${lead} Оценки Goodreads приведены к нашей
      ${scale()}-балльной шкале, сравниваются ${nPlural(pairs.length, 'книга', 'книги', 'книг')}.</p>
    <div class="cs-gr">
      ${pairs.map(({ book, ours, theirs, diff }) => `<div class="cs-gr-row">
        <button class="cs-gr-title" data-book-link="${esc(book.id)}">${esc(book.title)}</button>
        <span class="cs-gr-pair">
          <span class="cs-gr-vs">мы</span><b>${num(ours)}</b>
          <span class="cs-gr-vs">goodreads</span><b class="cs-gr-them">${num(theirs)}</b>
        </span>
        <span class="cs-rank-diff ${Math.abs(diff) < 0.05 ? '' : diff > 0 ? 'up' : 'down'}">
          ${Math.abs(diff) < 0.05 ? '=' : (diff > 0 ? '+' : '−') + num(Math.abs(diff))}
        </span>
      </div>`).join('')}
    </div>
  </section>`;
}

/* ── наблюдения ───────────────────────────────────────────────────────── */

/** Пара участниц, чьи оценки расходятся меньше всего. */
function closestPair() {
  const out = [];
  const ms = state.members;
  for (let i = 0; i < ms.length; i++) {
    for (let j = i + 1; j < ms.length; j++) {
      const diffs = state.books.map(b => {
        const x = memberScore(b, ms[i].id), y = memberScore(b, ms[j].id);
        return typeof x === 'number' && typeof y === 'number' ? Math.abs(x - y) : null;
      }).filter(v => v != null);
      if (diffs.length >= 3) {
        out.push({ a: ms[i], b: ms[j], n: diffs.length,
                   d: diffs.reduce((s, v) => s + v, 0) / diffs.length });
      }
    }
  }
  if (!out.length) return null;
  return out.reduce((p, q) => (q.d < p.d ? q : p));
}

/* Средний промежуток между встречами. Считается по датам, а не по книгам:
   за один вечер клуб успевает разобрать и три, и это одна встреча, а не три
   с нулевыми промежутками. */
function cadence() {
  const days = [...new Set(state.books.map(b => b.discussed))]
    .map(d => Date.parse(d + 'T00:00:00'))
    .filter(t => !Number.isNaN(t))
    .sort((a, b) => a - b);
  if (days.length < 4) return null;
  return (days.at(-1) - days[0]) / 86400000 / (days.length - 1);
}

/**
 * Наблюдения — то, что видно только на всей полке сразу. Каждое проверяет
 * себя само и не появляется, пока считать не из чего: три книги ещё ничего
 * не говорят о вкусах клуба.
 */
function observations() {
  const out = [];
  const books = state.books;
  const rated = books.filter(b => avg(b) != null);

  const byCount = genreStats().sort((a, b) => b.count - a.count);
  if (byCount[0] && byCount[0].count >= 2 && byCount.length > 1) {
    out.push(`Чаще всего клуб берёт ${byCount[0].genre.toLowerCase()} — `
      + `${byCount[0].count} ${plural(byCount[0].count, 'книга', 'книги', 'книг')} из ${books.length}.`);
  }

  const fav = favouriteGenre();
  if (fav && byCount.length > 1 && fav.genre !== byCount[0]?.genre) {
    out.push(`Читают чаще одно, а любят другое: выше всего оценивают `
      + `${fav.genre.toLowerCase()} — в среднем ${num(fav.mean)} из ${scale()}.`);
  }

  const yrs = years().filter(y => yearStats(y).count >= 3);
  if (yrs.length >= 2) {
    const [now, prev] = yrs.map(y => yearStats(y));
    const d = now.mean - prev.mean;
    out.push(Math.abs(d) < 0.15
      ? `Планка держится: средняя оценка ${now.year} года — ${num(now.mean)}, ровно как в ${prev.year}-м.`
      : `Средняя оценка ${now.year} года — ${num(now.mean)}, это на `
        + `${numPlural(Math.abs(d), 'балл', 'балла', 'баллов')} ${d > 0 ? 'выше' : 'ниже'}, чем в ${prev.year}-м.`);
  }

  const means = state.members.map(m => ({ m, mean: memberMean(m.id) })).filter(x => x.mean != null);
  if (means.length >= 2) {
    const high = means.reduce((a, b) => (b.mean > a.mean ? b : a));
    const low = means.reduce((a, b) => (b.mean < a.mean ? b : a));
    // Разницу считаем от округлённых значений: иначе в одной фразе стоят
    // «8» и «7,6», а между ними внезапно «0,5».
    const gap = Math.round(high.mean * 10) / 10 - Math.round(low.mean * 10) / 10;
    if (high.m !== low.m && gap > 0) {
      out.push(`${high.m.name} ставит выше всех (${num(high.mean)}), ${low.m.name} — строже всех `
        + `(${num(low.mean)}); между ними ${numPlural(gap, 'балл', 'балла', 'баллов')}.`);
    }
  }

  const pair = closestPair();
  if (pair) {
    out.push(`Ближе всего сходятся ${pair.a.name} и ${pair.b.name}: по `
      + `${nPlural(pair.n, 'книге', 'книгам', 'книгам')} их оценки расходятся в среднем на `
      + `${numPlural(pair.d, 'балл', 'балла', 'баллов')}.`);
  }

  if (rated.length >= 3) {
    const loud = rated.reduce((a, b) => (spread(b) > spread(a) ? b : a));
    if (spread(loud) >= 2) {
      out.push(`Больше всего спорили о книге «${loud.title}» — разброс `
        + `${numPlural(spread(loud), 'балл', 'балла', 'баллов')}.`);
    }
  }

  const rhythm = cadence();
  if (rhythm) {
    out.push(`Встречаются в среднем раз в ${nPlural(Math.round(rhythm), 'день', 'дня', 'дней')}.`);
  }

  const pages = pagesRead();
  if (pages) {
    out.push(`Всего прочитано ${pages.toLocaleString('ru-RU')} `
      + `${plural(pages, 'страница', 'страницы', 'страниц')}.`);
  }

  return out;
}

function observationsHTML() {
  const list = observations();
  if (!list.length) return '';
  return `<section class="cs-card cs-card-wide cs-notes">
    <h3>Наблюдения сайта</h3>
    <ul>${list.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
    <p class="cs-note">Считается заново при каждом открытии страницы — из тех же
      оценок, что и всё остальное.</p>
  </section>`;
}

/* ── сам список встреч ────────────────────────────────────────────────── */

function yearHeadHTML(year, list) {
  const st = yearStats(year, list);
  const bits = [nPlural(st.count, 'встреча', 'встречи', 'встреч')];
  if (st.mean != null) bits.push(`средняя ${num(st.mean)}`);
  if (st.pages) bits.push(`${st.pages.toLocaleString('ru-RU')} с.`);
  return `<div class="chron-year">
    <h2>${year}</h2>
    <span>${esc(bits.join(' · '))}</span>
  </div>`;
}

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
    ${yearHeadHTML(year, books)}
    ${books.map(b => `
      <button class="chron-row" data-book-link="${esc(b.id)}">
        <span class="chron-date">${esc(fmtDate(b.discussed, { withYear: false }))}</span>
        ${coverHTML(b, 'chron-cover')}
        <span class="chron-main">
          <span class="chron-title">${esc(b.title)}</span>
          <span class="chron-sub">${esc(b.author)} · ${esc(b.genre)}</span>
        </span>
        <span class="chron-score">${num(avg(b))}<small>/${scale()}</small></span>
      </button>`).join('')}`).join('');

  view.innerHTML = `<div class="page">
    <div class="page-head">
      <h1 class="page-title">Хроника</h1>
      <p class="page-sub">${nPlural(state.books.length, 'встреча', 'встречи', 'встреч')} по датам —
        и всё, что из них следует.</p>
    </div>

    ${summaryHTML()}
    <div class="cs-grid">
      ${clubGenresHTML()}
      ${memberGenresHTML()}
      ${goodreadsHTML()}
      ${ratingHTML()}
      ${observationsHTML()}
    </div>

    <h2 class="cs-h">Все встречи</h2>
    ${blocks}
  </div>`;

  hydrateIcons(view);
  wireBookLinks(view);

  // Переключатель личного рейтинга перерисовывает только свою карточку:
  // страница длинная, и полная перерисовка сбрасывала бы прокрутку.
  const who = view.querySelector('.cs-who');
  if (who) who.addEventListener('click', e => {
    const b = e.target.closest('[data-rating]');
    if (!b || b.dataset.rating === ratingWho) return;
    ratingWho = b.dataset.rating;
    who.querySelectorAll('[data-rating]').forEach(x =>
      x.setAttribute('aria-pressed', String(x.dataset.rating === ratingWho)));
    const body = view.querySelector('#csRatingBody');
    body.innerHTML = ratingBodyHTML();
    wireBookLinks(body);
  });
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
