/* Форма «Добавить книгу». Сайт читает полку из JSON в репозитории, поэтому
 * форма не сохраняет ничего сама: она собирает книгу в памяти страницы —
 * её сразу видно на полке — и отдаёт готовый JSON для вставки в
 * data/books.json. Черновик живёт до перезагрузки страницы. */

import { state, addDraftBook, freeBookId } from './data.js';
import { avatarHTML, isbnCoverURL, esc } from './ui.js';
import { randomArt, motifSVG } from './covers.js';
import { icon, hydrateIcons } from './icons.js';

let onAdded = () => {};
let art = null;

export function initAddBook(opts) {
  onAdded = opts.onAdded || onAdded;
  ensureModal();
}

/* ── модальное окно: общий каркас ────────────────────────────────────── */

function ensureModal() {
  if (document.getElementById('addBookModal')) return;
  const div = document.createElement('div');
  div.innerHTML = `<div class="modal-overlay" id="addBookModal" hidden>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
      <div class="modal-head">
        <h2 id="modalTitle">Добавить книгу</h2>
        <button type="button" class="modal-close" id="modalClose" aria-label="Закрыть">${icon('x')}</button>
      </div>
      <div class="modal-body" id="modalBody"></div>
    </div>
  </div>`;
  document.body.appendChild(div.firstElementChild);

  const overlay = document.getElementById('addBookModal');
  document.getElementById('modalClose').addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !overlay.hidden) {
      closeModal();
      // Пока открыт диалог, Esc принадлежит только ему — иначе тот же
      // нажатие следом закрыло бы ещё и страницу книги под ним.
      e.stopImmediatePropagation();
    }
  });
}

function openModal(title, bodyHTML) {
  ensureModal();
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHTML;
  document.getElementById('addBookModal').hidden = false;
  document.body.style.overflow = 'hidden';
  hydrateIcons(document.getElementById('modalBody'));
}

function closeModal() {
  const overlay = document.getElementById('addBookModal');
  if (!overlay) return;
  overlay.hidden = true;
  document.body.style.overflow = '';
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
  const scale = state.club.scale || 10;
  return `<details class="review-member">
    <summary>${avatarHTML(m)}<span>${esc(m.name)}</span>
      <span class="review-member-hint">развернуть, если мнение уже есть</span></summary>
    <div class="review-body">
      <div class="score-grid">
        ${state.criteria.map(c => `<label class="score-field">
          <span>${esc(c.label)}</span>
          <input type="number" min="1" max="${scale}" step="1"
            class="nb-score" data-member="${m.id}" data-crit="${c.id}"
            placeholder="1–${scale}">
        </label>`).join('')}
      </div>
      <div class="field">
        <label>Впечатление</label>
        <textarea class="nb-text" data-member="${m.id}"></textarea>
      </div>
      <div class="field">
        <label>Строчка, которую забрали с собой (необязательно)</label>
        <textarea class="nb-line" data-member="${m.id}" style="min-height:52px"></textarea>
        <label class="check-inline">
          <input type="checkbox" class="nb-line-book" data-member="${m.id}">
          <span>это цитата из книги, а не своя формулировка</span>
        </label>
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
      <div class="isbn-row">
        <input id="nb-isbn" placeholder="9780000000000" inputmode="numeric" autocomplete="off">
        <div class="isbn-preview" id="isbnPreview"><span class="ic" data-icon="photo"></span></div>
      </div>
      <p class="field-hint">По ISBN сайт попробует показать фотографию настоящего издания
        с Open Library — но только в режиме «настоящие» на полке, и только когда сайт
        открыт в обычном браузере: предпросмотр в артефакте Claude такие картинки не грузит.</p>
    </div>

    <div class="art-row">
      <div id="artPreviewBox">${artPreviewHTML()}</div>
      <div class="art-side">
        <p class="field-hint">Рисунок обложки — на случай, если фотографии не найдётся
          или переключатель стоит на «свои».</p>
        <button type="button" class="btn btn-ghost" id="artReroll">${icon('refresh')} Другой вариант</button>
      </div>
    </div>

    <h3 class="section-h" style="margin-top:8px">Мнения участниц</h3>
    <p class="field-hint" style="margin:-10px 0 14px">Разверните карточку каждой, у кого мнение
      уже есть. Остальных можно оставить свёрнутыми и дозаполнить позже.</p>
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

  const isbnInput = document.getElementById('nb-isbn');
  const isbnPreview = document.getElementById('isbnPreview');
  const showIsbnPlaceholder = () => {
    isbnPreview.innerHTML = `<span class="ic" data-icon="photo"></span>`;
    hydrateIcons(isbnPreview);
  };
  let isbnTimer;
  isbnInput.addEventListener('input', () => {
    clearTimeout(isbnTimer);
    isbnTimer = setTimeout(() => {
      const url = isbnCoverURL(isbnInput.value.trim());
      if (!url) { showIsbnPlaceholder(); return; }
      const img = document.createElement('img');
      img.alt = '';
      img.addEventListener('error', showIsbnPlaceholder, { once: true });
      img.src = url;
      isbnPreview.replaceChildren(img);
    }, 400);
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
    const scores = {};
    let any = false;
    state.criteria.forEach(c => {
      const el = form.querySelector(`.nb-score[data-member="${m.id}"][data-crit="${c.id}"]`);
      const v = el?.value !== '' ? Number(el.value) : null;
      if (v != null && !Number.isNaN(v)) { scores[c.id] = v; any = true; }
    });
    const text = form.querySelector(`.nb-text[data-member="${m.id}"]`)?.value.trim() || '';
    const lineText = form.querySelector(`.nb-line[data-member="${m.id}"]`)?.value.trim() || '';
    const lineIsBook = form.querySelector(`.nb-line-book[data-member="${m.id}"]`)?.checked || false;
    if (!any && !text && !lineText) return;   // участница пока не заполняла — пропускаем
    reviews[m.id] = { scores, text, line: lineText ? { kind: lineIsBook ? 'book' : 'club', text: lineText } : null };
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

export function openAddBookModal() {
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
    отдельным элементом массива в <code>data/books.json</code> и закоммитьте. Если вписан
    ISBN, стоит один раз проверить обложку — <code>node tools/fetch-covers.mjs --verify</code>.</p>
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
