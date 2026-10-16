/* «Добавить книгу»: заготовка новой книги и переход в редактор.
 *
 * Отдельной формы в модальном окне больше нет. Новая книга открывается той
 * же страницей правки, что и существующая: слева обложка и поля, справа
 * оценки. Окно было лишним шагом и вторым набором тех же полей, который
 * приходилось держать в согласии с редактором; теперь набор один.
 *
 * Здесь же осталась выгрузка книги в JSON — она нужна, пока сохранение с
 * сайта не включено, и к форме отношения не имеет. */

import { genres } from './data.js';
import { esc } from './ui.js';
import { randomArt } from './covers.js';
import { icon, hydrateIcons } from './icons.js';
import { openModal, closeModal, initModal } from './modal.js';
import { requireUnlock } from './lock.js';

let openEditor = () => {};

export function initAddBook(opts = {}) {
  openEditor = opts.openEditor || openEditor;
  initModal();
}

const todayISO = () => new Date().toISOString().slice(0, 10);

/**
 * Заготовка: только то, без чего карточка не нарисуется. Жанр — первый из
 * уже встречавшихся, чтобы список в форме открывался на чём-то разумном,
 * а не на «+ другой жанр…». Id появится при сохранении: он делается из
 * названия, а названия ещё нет.
 */
export function blankBook() {
  return {
    id: '',
    title: '', author: '',
    year: null, pages: null,
    genre: genres()[0] || 'Роман',
    edition: '',
    art: randomArt(),
    discussed: todayISO(),
    proposedBy: null,
    coverQuery: '', cover: null, isbn: null, goodreads: null,
    reviews: {}
  };
}

/** Оценка Goodreads: пятибалльная, с запятой или точкой. Всё, что выходит за
 *  шкалу или не число, — как будто её не вводили: пустое поле честнее вранья. */
export function grVal(raw) {
  const v = Number(String(raw).replace(',', '.'));
  return Number.isFinite(v) && v > 0 && v <= 5 ? Number(v.toFixed(2)) : null;
}

/* ── публичные точки входа ───────────────────────────────────────────── */

export async function openAddBook() {
  if (!await requireUnlock()) return;
  openEditor(blankBook());
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
