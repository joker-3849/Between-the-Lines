/* Форма «Добавить книгу». Сайт читает полку из JSON в репозитории, поэтому
 * форма не сохраняет ничего сама: она собирает книгу в памяти страницы —
 * её сразу видно на полке — и отдаёт готовый JSON для вставки в
 * data/books.json. Черновик живёт до перезагрузки страницы. */

import { state, addDraftBook, freeBookId, num } from './data.js';
import { avatarHTML, esc,
         scorePickerHTML, rereadPickerHTML, wirePickers, readPicked, pickedMean } from './ui.js';
import { randomArt, motifSVG } from './covers.js';
import { icon, hydrateIcons } from './icons.js';
import { openModal, closeModal, initModal } from './modal.js';
import { requireUnlock } from './lock.js';

let onAdded = () => {};
let art = null;

export function initAddBook(opts) {
  onAdded = opts.onAdded || onAdded;
  initModal();
}

/* ── форма ────────────────────────────────────────────────────────────── */

const todayISO = () => new Date().toISOString().slice(0, 10);

function artPreviewHTML() {
  const vars = `--bg:${esc(art.bg)};--fg:${esc(art.fg)};--acc:${esc(art.acc)}`;
  return `<div class="cover art-preview" style="${vars}">
    <div class="cover-fallback">
      ${motifSVG(art.motif)}
      <div class="cf-top"><span class="cf-genre" id="artGenrePreview"></span></div>
      <div class="cf-text">
        <div class="cf-title" id="artTitlePreview">Название книги</div>
        <div class="cf-rule"></div>
        <div class="cf-author" id="artAuthorPreview">Автор</div>
      </div>
    </div>
    <div class="cover-gloss"></div>
  </div>`;
}

function memberFieldsetHTML(m) {
  return `<details class="review-member">
    <summary>${avatarHTML(m)}<span>${esc(m.name)}</span>
      <span class="review-member-hint">развернуть, если мнение уже есть</span></summary>
    <div class="review-body">
      <div class="be-mean" data-member="${esc(m.id)}"><b>—</b><span>средний балл</span></div>
      ${state.criteria.map(c => scorePickerHTML(m, c, undefined)).join('')}
      ${rereadPickerHTML(m, null)}
      <div class="field">
        <label>Впечатление</label>
        <textarea class="nb-text" data-member="${m.id}"></textarea>
      </div>
      <div class="field">
        <label>Цитата из книги (необязательно)</label>
        <textarea class="nb-quote" data-member="${m.id}" style="min-height:52px"></textarea>
      </div>
      <div class="field">
        <label>Между строк (необязательно)</label>
        <textarea class="nb-line" data-member="${m.id}" style="min-height:52px"></textarea>
        <p class="field-hint">Опишите ваше впечатление одной фразой.</p>
      </div>
    </div>
  </details>`;
}

function formHTML() {
  const genreList = [...new Set(state.books.map(b => b.genre).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));
  return `<form id="addBookForm" novalidate>
    <div class="field-row">
      <div class="field"><label for="nb-title">Название *</label>
        <input id="nb-title" required autocomplete="off"></div>
      <div class="field"><label for="nb-author">Автор *</label>
        <input id="nb-author" required autocomplete="off"></div>
    </div>

    <div class="field-row">
      <div class="field"><label for="nb-year">Год издания</label>
        <input id="nb-year" type="number" inputmode="numeric"></div>
      <div class="field"><label for="nb-pages">Страниц</label>
        <input id="nb-pages" type="number" inputmode="numeric"></div>
    </div>

    <div class="field-row">
      <div class="field">
        <label for="nb-genre">Жанр</label>
        <select id="nb-genre">
          ${genreList.map(g => `<option value="${esc(g)}">${esc(g)}</option>`).join('')}
          <option value="__custom__">+ другой жанр…</option>
        </select>
        <input id="nb-genre-custom" placeholder="Свой жанр" hidden autocomplete="off">
      </div>
      <div class="field"><label for="nb-edition">Издание</label>
        <input id="nb-edition" placeholder="Например: АСТ, 2020" autocomplete="off"></div>
    </div>

    <div class="field-row">
      <div class="field"><label for="nb-discussed">Дата обсуждения</label>
        <input id="nb-discussed" type="date" value="${todayISO()}"></div>
      <div class="field"><label for="nb-by">Кто предложил</label>
        <select id="nb-by">
          <option value="">— не указано —</option>
          ${state.members.map(m => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="field">
      <label for="nb-isbn">ISBN издания</label>
      <input id="nb-isbn" placeholder="9780000000000" inputmode="numeric" autocomplete="off">
      <p class="field-hint">Не обязателен: обложки у клуба свои, ISBN нужен только как
        выходные данные конкретного издания.</p>
    </div>

    <div class="art-row">
      <div id="artPreviewBox">${artPreviewHTML()}</div>
      <div class="art-side">
        <p class="field-hint">Рисунок обложки — на случай, если фотографии не найдётся
          или переключатель стоит на «свои».</p>
        <button type="button" class="btn btn-ghost" id="artReroll">${icon('refresh')} Другой вариант</button>
      </div>
    </div>

    <h3 class="section-h" style="margin-top:8px">Мнения участников</h3>
    <p class="field-hint" style="margin:-10px 0 14px">Разверните карточку каждого, у кого мнение
      уже есть — балл ставится кликом по цифре. Остальных можно оставить свёрнутыми
      и дозаполнить позже через «Внести изменения» на странице книги.</p>
    <div class="review-members">
      ${state.members.map(memberFieldsetHTML).join('')}
    </div>

    <div class="modal-actions">
      <button type="submit" class="btn btn-primary">${icon('plus')} Добавить на полку</button>
      <button type="button" class="btn btn-ghost" id="addBookCancel">Отмена</button>
    </div>
  </form>`;
}

function wireForm() {
  const form = document.getElementById('addBookForm');

  const genreSel = document.getElementById('nb-genre');
  const genreCustom = document.getElementById('nb-genre-custom');
  genreSel.addEventListener('change', () => {
    genreCustom.hidden = genreSel.value !== '__custom__';
    if (!genreCustom.hidden) genreCustom.focus();
    syncPreview();
  });

  const syncPreview = () => {
    document.getElementById('artTitlePreview').textContent = titleVal() || 'Название книги';
    document.getElementById('artAuthorPreview').textContent = authorVal() || 'Автор';
    document.getElementById('artGenrePreview').textContent = genreVal() || '';
  };
  document.getElementById('nb-title').addEventListener('input', syncPreview);
  document.getElementById('nb-author').addEventListener('input', syncPreview);
  genreCustom.addEventListener('input', syncPreview);

  document.getElementById('artReroll').addEventListener('click', () => {
    art = randomArt();
    document.getElementById('artPreviewBox').innerHTML = artPreviewHTML();
    hydrateIcons(document.getElementById('artPreviewBox'));
    syncPreview();
  });

  wirePickers(document.querySelector('.review-members'), memberId => {
    const box = form.querySelector(`.be-mean[data-member="${CSS.escape(memberId)}"] b`);
    if (!box) return;
    const mean = pickedMean(form, memberId);
    box.textContent = mean == null ? '—' : num(mean);
  });

  document.getElementById('addBookCancel').addEventListener('click', closeModal);

  form.addEventListener('submit', e => {
    e.preventDefault();
    submitForm(form);
  });

  function titleVal() { return document.getElementById('nb-title').value.trim(); }
  function authorVal() { return document.getElementById('nb-author').value.trim(); }
  function genreVal() {
    return genreSel.value === '__custom__' ? genreCustom.value.trim() : genreSel.value;
  }
}

function buildReviews(form) {
  const reviews = {};
  state.members.forEach(m => {
    const { scores, reread } = readPicked(form, m.id);
    const text = form.querySelector(`.nb-text[data-member="${m.id}"]`)?.value.trim() || '';
    const lineText = form.querySelector(`.nb-line[data-member="${m.id}"]`)?.value.trim() || '';
    const quoteText = form.querySelector(`.nb-quote[data-member="${m.id}"]`)?.value.trim() || '';
    // участник пока не заполнял — пропускаем
    if (!Object.keys(scores).length && !text && !lineText && !quoteText && reread == null) return;
    reviews[m.id] = {
      scores, reread, text,
      line: lineText ? { text: lineText } : null,
      quote: quoteText ? { text: quoteText } : null
    };
  });
  return reviews;
}

function submitForm(form) {
  const val = id => document.getElementById(id).value.trim();
  const title = val('nb-title');
  const author = val('nb-author');
  if (!title || !author) {
    [['nb-title', title], ['nb-author', author]].forEach(([id, v]) => {
      document.getElementById(id).classList.toggle('invalid', !v);
    });
    return;
  }

  const genreSel = document.getElementById('nb-genre');
  const genre = (genreSel.value === '__custom__' ? val('nb-genre-custom') : genreSel.value) || 'Без жанра';
  const isbnRaw = val('nb-isbn').replace(/[^0-9Xx]/g, '');

  const book = {
    id: freeBookId(title),
    title, author,
    year: val('nb-year') ? Number(val('nb-year')) : null,
    pages: val('nb-pages') ? Number(val('nb-pages')) : null,
    genre,
    edition: val('nb-edition'),
    art,
    discussed: val('nb-discussed') || todayISO(),
    proposedBy: document.getElementById('nb-by').value || null,
    coverQuery: `${title} ${author}`,
    cover: null,
    isbn: isbnRaw || null,
    reviews: buildReviews(form)
  };

  const draft = addDraftBook(book);
  closeModal();
  onAdded(draft);
}

/* ── публичные точки входа ───────────────────────────────────────────── */

export async function openAddBookModal() {
  if (!await requireUnlock()) return;
  art = randomArt();
  openModal('Добавить книгу', formHTML());
  wireForm();
  document.getElementById('nb-title').focus();
}

function stripDraft(book) {
  const { _draft, ...rest } = book;
  return rest;
}

function exportPanelHTML(book) {
  const json = JSON.stringify(stripDraft(book), null, 2);
  return `<p class="field-hint">Книга появилась на полке, но только на этой странице — сайт
    не пишет в файлы сам. Чтобы она осталась насовсем: скопируйте JSON ниже, вставьте
    отдельным элементом массива в <code>data/books.json</code> и закоммитьте.</p>
  <textarea class="export-json" id="exportJson" readonly spellcheck="false">${esc(json)}</textarea>
  <div class="modal-actions">
    <button type="button" class="btn btn-primary" id="exportCopy">${icon('copy')} Скопировать JSON</button>
    <button type="button" class="btn btn-ghost" id="exportClose">Готово</button>
  </div>`;
}

export function showBookJSON(book) {
  openModal(`«${book.title}» — JSON для books.json`, exportPanelHTML(book));
  const ta = document.getElementById('exportJson');
  const copyBtn = document.getElementById('exportCopy');
  document.getElementById('exportClose').addEventListener('click', closeModal);
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(ta.value);
      copyBtn.innerHTML = `${icon('check')} Скопировано`;
    } catch {
      ta.focus();
      ta.select();
      copyBtn.innerHTML = 'Не вышло — выделено, скопируйте вручную (Ctrl/Cmd+C)';
    }
    hydrateIcons(copyBtn);
    setTimeout(() => { copyBtn.innerHTML = `${icon('copy')} Скопировать JSON`; hydrateIcons(copyBtn); }, 2400);
  });
}
