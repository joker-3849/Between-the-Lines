/* Сохранение правок в репозиторий и полоса, которая показывает, как оно идёт.
 *
 * Когда сохранение настроено (в club.json есть publish), никакой отдельной
 * кнопки «сохранить ещё раз» нет: правка, добавление или удаление книги сами
 * уходят коммитом. Полоса внизу — это отчёт о происходящем, а кнопка на ней
 * появляется только чтобы повторить после неудачи.
 *
 * Полоса плавающая, а не встроена в панель полки: сохранять приходится и со
 * страницы книги сразу после правки, где панели с фильтрами нет. */

import { dirtyFiles, clearDirty } from './data.js';
import { canPublish, publishFiles, booksJSON, clubJSON } from './publish.js';
import { requireUnlock, currentPhrase, forgetPhrase } from './lock.js';
import { icon, hydrateIcons } from './icons.js';

const FILES = {
  books: { path: 'data/books.json', text: booksJSON },
  club: { path: 'data/club.json', text: clubJSON }
};

/* Коммит начинается не мгновенно: одно действие пользователя иногда метит
   изменённым и books, и club, и ждать четверть секунды дешевле, чем слать
   два коммита подряд. */
const DEBOUNCE = 350;

let bar, note, btn;
let saving = false;
let startTimer, hideTimer;

function message(files) {
  const what = files.includes('books') ? 'Правки' : 'Новая фраза клуба';
  return `${what} уходят в репозиторий…`;
}

function show(text, kind = '') {
  clearTimeout(hideTimer);
  bar.hidden = false;
  bar.className = `save-bar ${kind}`.trim();
  note.textContent = text;
}

function hideSoon() {
  hideTimer = setTimeout(() => {
    bar.hidden = true;
    bar.className = 'save-bar';
    btn.hidden = true;
  }, 5000);
}

function retryButton() {
  btn.hidden = false;
  btn.disabled = false;
  btn.innerHTML = `${icon('refresh')} Повторить`;
  hydrateIcons(btn);
}

/** Отправить всё, что разошлось с репозиторием. */
async function save() {
  if (saving) return;
  const files = dirtyFiles();
  if (!files.length || !canPublish()) return;

  saving = true;
  btn.hidden = true;
  show(message(files));

  try {
    // Фразы может не быть — например, вкладку открыли заново, а щеколда
    // осталась открытой с прошлого раза. Тогда спросим её один раз.
    if (!await requireUnlock({ needPhrase: true })) {
      show('Без фразы сохранить нельзя.', 'err');
      retryButton();
      return;
    }

    await publishFiles(
      currentPhrase(),
      files.map(f => ({ path: FILES[f].path, text: FILES[f].text() })),
      files.includes('books') ? 'Полка с сайта' : 'Фраза клуба с сайта'
    );

    clearDirty();
    show('Сохранено. Сайт пересоберётся за минуту-полторы.', 'ok');
    btn.hidden = true;
    hideSoon();
  } catch (e) {
    // Фраза разошлась с токеном (её сменили в другой вкладке) — спросим заново.
    if (e.kind === 'phrase') forgetPhrase();
    show(e.message || 'Не вышло сохранить.', 'err');
    retryButton();
  } finally {
    saving = false;
  }
}

/* Каждое изменение состояния запускает отсчёт до коммита. Пока сохранение не
   настроено, полосы нет вовсе: правки переносят вручную через «Показать JSON». */
function sync() {
  const files = dirtyFiles();
  if (!files.length || !canPublish()) return;
  if (saving) return;

  show(message(files));
  btn.hidden = true;
  clearTimeout(startTimer);
  startTimer = setTimeout(save, DEBOUNCE);
}

export function initSaveBar() {
  bar = document.getElementById('saveBar');
  note = document.getElementById('saveBarNote');
  btn = document.getElementById('saveBarBtn');
  if (!bar) return;
  btn.addEventListener('click', save);
}

export function syncSaveBar() { if (bar) sync(); }
