/* Полоса «Сохранить на сайт»: появляется, когда в памяти вкладки есть
 * правки, которых нет в репозитории, и исчезает после коммита.
 *
 * Полоса нужна именно плавающая: сохранять хочется и с полки, и со страницы
 * книги сразу после правки, а панель с фильтрами живёт только на полке. */

import { dirtyFiles, clearDirty } from './data.js';
import { canPublish, publishFiles, booksJSON, clubJSON } from './publish.js';
import { requireUnlock, currentPhrase } from './lock.js';
import { icon, hydrateIcons } from './icons.js';

const FILES = {
  books: { path: 'data/books.json', text: booksJSON },
  club: { path: 'data/club.json', text: clubJSON }
};

let bar, note, btn;
/* Сообщение «Сохранено» держится несколько секунд и гасит полосу. Если за
   это время что-то поменяли снова, таймер надо снять — иначе он спрячет
   кнопку уже под новыми правками. */
let hideTimer;

function label(files) {
  if (files.includes('books')) return 'Правки пока видны только в этой вкладке.';
  return 'Новая фраза клуба пока действует только в этой вкладке.';
}

function sync() {
  const files = dirtyFiles();
  const show = files.length > 0 && canPublish();
  if (show) clearTimeout(hideTimer);
  bar.hidden = !show;
  if (!show) return;

  bar.className = 'save-bar';
  note.textContent = label(files);
  btn.hidden = false;
  btn.disabled = false;
  btn.innerHTML = `${icon('device-floppy')} Сохранить на сайт`;
  hydrateIcons(btn);
}

function state(text, kind = '') {
  note.textContent = text;
  bar.className = `save-bar ${kind}`.trim();
}

async function save() {
  const files = dirtyFiles();
  if (!files.length) return;

  if (!await requireUnlock({ needPhrase: true })) return;

  btn.disabled = true;
  btn.innerHTML = `${icon('refresh')} Сохраняю…`;
  hydrateIcons(btn);
  state('Коммит в репозиторий…');

  const message = files.includes('books') && files.includes('club')
    ? 'Полка и настройки клуба с сайта'
    : files.includes('club') ? 'Фраза клуба с сайта' : 'Полка с сайта';

  try {
    await publishFiles(
      currentPhrase(),
      files.map(f => ({ path: FILES[f].path, text: FILES[f].text() })),
      message
    );
    clearDirty();                 // sync() спрячет полосу, но сообщение важнее
    bar.hidden = false;
    state('Сохранено. Сайт пересоберётся за минуту-полторы.', 'ok');
    btn.hidden = true;
    hideTimer = setTimeout(() => {
      bar.hidden = true;
      btn.hidden = false;
      bar.className = 'save-bar';
    }, 6000);
  } catch (e) {
    state(e.message || 'Не вышло сохранить.', 'err');
    btn.disabled = false;
    btn.innerHTML = `${icon('refresh')} Повторить`;
    hydrateIcons(btn);
  }
}

export function initSaveBar() {
  bar = document.getElementById('saveBar');
  note = document.getElementById('saveBarNote');
  btn = document.getElementById('saveBarBtn');
  if (!bar) return;
  btn.addEventListener('click', save);
  sync();
}

export function syncSaveBar() { if (bar) sync(); }
