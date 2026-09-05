/* Редактор карточки книги: та же страница, только поля вместо текста.
 *
 * Сайт статический и читает полку из JSON в репозитории, поэтому «Сохранить»
 * правит книгу в памяти страницы и помечает её как изменённую — готовый JSON
 * для data/books.json отдаётся отдельной кнопкой, как и у новой книги.
 *
 * Баллы ставятся кликом по цифре 1…10, а не вводом с клавиатуры: критерий,
 * под ним ряд кружков. Средний балл нигде не вводится — он пересчитывается
 * на лету из выставленных критериев. */

import { state, memberScore, num, dropBook } from './data.js';
import { coverHTML, mountCovers, avatarHTML, esc,
         scorePickerHTML, rereadPickerHTML, wirePickers, readPicked, pickedMean } from './ui.js';
import { icon, hydrateIcons } from './icons.js';
import { showBookJSON } from './addbook.js';

let onDone = () => {};
let book = null;

const scale = () => state.club.scale || 10;

/* ── поля книги ───────────────────────────────────────────────────────── */

function field(id, label, value, attrs = '') {
  return `<div class="field">
    <label for="be-${id}">${esc(label)}</label>
    <input id="be-${id}" value="${esc(value ?? '')}" autocomplete="off" ${attrs}>
  </div>`;
}

function factsFormHTML() {
  const genreList = [...new Set(state.books.map(b => b.genre).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'ru'));
  const known = genreList.includes(book.genre);

  return `<div class="be-facts">
    ${field('title', 'Название', book.title, 'required')}
    ${field('author', 'Автор', book.author, 'required')}
    <div class="field-row">
      ${field('year', 'Год', book.year, 'type="number" inputmode="numeric"')}
      ${field('pages', 'Страниц', book.pages, 'type="number" inputmode="numeric"')}
    </div>
    <div class="field">
      <label for="be-genre">Жанр</label>
      <select id="be-genre">
        ${genreList.map(g => `<option value="${esc(g)}"${g === book.genre ? ' selected' : ''}>${esc(g)}</option>`).join('')}
        <option value="__custom__"${known ? '' : ' selected'}>+ другой жанр…</option>
      </select>
      <input id="be-genre-custom" placeholder="Свой жанр" autocomplete="off"
        value="${known ? '' : esc(book.genre ?? '')}" ${known ? 'hidden' : ''}>
    </div>
    ${field('edition', 'Издание', book.edition)}
    ${field('isbn', 'ISBN издания', book.isbn, 'inputmode="numeric"')}
    <div class="field">
      <label for="be-discussed">Дата обсуждения</label>
      <input id="be-discussed" type="date" value="${esc(book.discussed ?? '')}">
    </div>
    <div class="field">
      <label for="be-by">Кто предложил</label>
      <select id="be-by">
        <option value="">— не указано —</option>
        ${state.members.map(m => `<option value="${esc(m.id)}"${m.id === book.proposedBy ? ' selected' : ''}>${esc(m.name)}</option>`).join('')}
      </select>
    </div>
  </div>`;
}

/* ── оценки участника ─────────────────────────────────────────────────── */

function memberHTML(m) {
  const rev = book.reviews?.[m.id] || {};
  const mean = memberScore(book, m.id);

  return `<section class="be-member" data-member="${esc(m.id)}">
    <header class="be-member-head">
      ${avatarHTML(m)}
      <span class="be-member-name">${esc(m.name)}</span>
      <span class="be-mean" data-member="${esc(m.id)}">
        <b>${mean == null ? '—' : num(mean)}</b>
        <span>средний балл</span>
      </span>
    </header>

    ${state.criteria.map(c => scorePickerHTML(m, c, rev.scores?.[c.id])).join('')}
    ${rereadPickerHTML(m, rev.reread)}

    <div class="field">
      <label for="be-text-${esc(m.id)}">Впечатление</label>
      <textarea id="be-text-${esc(m.id)}" class="be-text" data-member="${esc(m.id)}">${esc(rev.text ?? '')}</textarea>
    </div>
    <div class="field">
      <label for="be-quote-${esc(m.id)}">Цитата из книги</label>
      <textarea id="be-quote-${esc(m.id)}" class="be-quote" data-member="${esc(m.id)}"
        style="min-height:52px">${esc(rev.quote?.text ?? '')}</textarea>
    </div>
    <div class="field">
      <label for="be-line-${esc(m.id)}">Между строк</label>
      <textarea id="be-line-${esc(m.id)}" class="be-line" data-member="${esc(m.id)}"
        style="min-height:52px">${esc(rev.line?.text ?? '')}</textarea>
      <p class="field-hint">Опишите ваше впечатление одной фразой.</p>
    </div>
  </section>`;
}

/* ── сборка страницы ──────────────────────────────────────────────────── */

function render() {
  const view = document.getElementById('view-book');
  view.innerHTML = `<form class="book-page book-edit" id="bookEditForm" novalidate>
    <div class="be-bar">
      <span class="badge draft">правка</span>
      <span class="be-bar-note">Меняйте что угодно и нажмите «Сохранить».
        Средний балл считается сам.</span>
      <div class="be-bar-actions">
        <button type="button" class="btn btn-danger" id="beDelete">
          ${icon('trash')} Удалить книгу
        </button>
        <button type="button" class="btn btn-ghost" id="beCancel">Отменить</button>
        <button type="submit" class="btn btn-primary">${icon('device-floppy')} Сохранить</button>
      </div>
    </div>

    <div class="bp-left">
      ${coverHTML(book, 'bp-cover')}
      ${factsFormHTML()}
    </div>

    <div class="bp-right">
      <h2 class="section-h" style="margin-top:0">Оценки участников</h2>
      <p class="field-hint" style="margin:-10px 0 18px">Балл ставится кликом по цифре.
        Повторный клик по той же цифре снимает оценку.</p>
      <div class="be-members">${state.members.map(memberHTML).join('')}</div>
    </div>
  </form>`;

  hydrateIcons(view);
  mountCovers(view);
  wire(view);
  window.scrollTo({ top: 0, behavior: 'auto' });
  return view;
}

function wire(view) {
  const form = view.querySelector('#bookEditForm');

  const genreSel = view.querySelector('#be-genre');
  const genreCustom = view.querySelector('#be-genre-custom');
  genreSel.addEventListener('change', () => {
    genreCustom.hidden = genreSel.value !== '__custom__';
    if (!genreCustom.hidden) genreCustom.focus();
  });

  // Кружков полсотни — один делегированный обработчик на всю колонку.
  wirePickers(view.querySelector('.be-members'), refreshMean);

  view.querySelector('#beCancel').addEventListener('click', () => finish(false));
  view.querySelector('#beDelete').addEventListener('click', removeBook);
  form.addEventListener('submit', e => { e.preventDefault(); save(form); });
}

/** Средний балл участника прямо в форме — из того, что уже накликано. */
function refreshMean(memberId) {
  const form = document.getElementById('bookEditForm');
  const box = form?.querySelector(`.be-mean[data-member="${CSS.escape(memberId)}"] b`);
  if (!box) return;
  const mean = pickedMean(form, memberId);
  box.textContent = mean == null ? '—' : num(mean);
}

/* ── удаление ─────────────────────────────────────────────────────────── */

/** Убирает книгу с полки. Как и правки, только в памяти вкладки. */
function removeBook() {
  const target = book;
  if (!target) return;
  const ok = window.confirm(
    `Удалить «${target.title}» с полки?\n\n` +
    'Книга исчезнет из этой вкладки сразу. Чтобы она не вернулась после '
    + `перезагрузки, удалите элемент с id "${target.id}" из data/books.json.`);
  if (!ok) return;

  dropBook(target.id);
  book = null;
  const done = onDone;
  onDone = () => {};
  done(false, target, { deleted: true });
}

/* ── сохранение ───────────────────────────────────────────────────────── */

function collectReviews(form) {
  const reviews = {};
  state.members.forEach(m => {
    const sel = `[data-member="${CSS.escape(m.id)}"]`;
    const { scores, reread } = readPicked(form, m.id);
    const text = form.querySelector(`.be-text${sel}`)?.value.trim() || '';
    const lineText = form.querySelector(`.be-line${sel}`)?.value.trim() || '';
    const quoteText = form.querySelector(`.be-quote${sel}`)?.value.trim() || '';

    // Совсем пустого участника в данные не пишем — иначе полка обрастает
    // отзывами-призраками, которые нигде не показываются.
    if (!Object.keys(scores).length && !text && !lineText && !quoteText && reread == null) return;

    reviews[m.id] = {
      scores, reread, text,
      line: lineText ? { text: lineText } : null,
      quote: quoteText ? { text: quoteText } : null
    };
  });
  return reviews;
}

function save(form) {
  const v = id => form.querySelector(`#be-${id}`)?.value.trim() ?? '';
  const title = v('title'), author = v('author');
  if (!title || !author) {
    ['title', 'author'].forEach(id =>
      form.querySelector(`#be-${id}`).classList.toggle('invalid', !v(id)));
    form.querySelector(`#be-${title ? 'author' : 'title'}`).focus();
    return;
  }

  const genreSel = form.querySelector('#be-genre');
  const genre = genreSel.value === '__custom__' ? v('genre-custom') : genreSel.value;

  Object.assign(book, {
    title, author,
    year: v('year') ? Number(v('year')) : null,
    pages: v('pages') ? Number(v('pages')) : null,
    genre: genre || 'Без жанра',
    edition: v('edition'),
    isbn: v('isbn').replace(/[^0-9Xx]/g, '') || null,
    discussed: v('discussed') || book.discussed,
    proposedBy: form.querySelector('#be-by').value || null,
    reviews: collectReviews(form)
  });
  if (!book._draft) book._edited = true;

  finish(true);
}

function finish(saved) {
  const edited = book;
  const done = onDone;
  book = null;
  onDone = () => {};
  done(saved, edited);
}

/* ── точка входа ──────────────────────────────────────────────────────── */

export function openBookEditor(target, opts = {}) {
  book = target;
  onDone = opts.onDone || (() => {});
  render();
}

/** Открыт ли сейчас редактор — нужно, чтобы Esc не закрывал карточку под ним. */
export function isEditing() { return book != null; }

/** Можно ли уйти со страницы. Незаписанные правки просят подтверждения —
 *  иначе «На полку» или пункт меню молча стирает всё набранное. */
export function confirmLeaveEditor() {
  if (!book) return true;
  if (!window.confirm('Правки не сохранены. Уйти со страницы и потерять их?')) return false;
  finish(false);
  return true;
}

export { showBookJSON };
