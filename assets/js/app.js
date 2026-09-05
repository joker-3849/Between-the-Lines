/* Точка входа: загрузка данных, переключение разделов, состояние шапки. */

import { loadData, onDirtyChange } from './data.js';
import { hydrateIcons } from './icons.js';
import { initShelf, refreshShelf } from './shelf.js';
import { initBook, showBook, closeBook, currentBookId } from './book.js';
import { initPages, renderLines, renderChronicle, renderYear } from './pages.js';
import { initAddBook } from './addbook.js';
import { isEditing, confirmLeaveEditor } from './bookedit.js';
import { initSaveBar, syncSaveBar } from './savebar.js';

const RENDERERS = {
  lines: renderLines,
  chronicle: renderChronicle,
  year: renderYear
};

let currentView = 'shelf';
let shelfScroll = 0;

function setView(name) {
  if (currentView === 'shelf' && name !== 'shelf') shelfScroll = window.scrollY;

  document.querySelectorAll('.view').forEach(v => {
    v.hidden = v.dataset.view !== name;
  });
  document.querySelectorAll('.navlink').forEach(b => {
    b.classList.toggle('is-active', b.dataset.view === name);
  });

  document.getElementById('backBtn').hidden = name !== 'book';
  currentView = name;

  RENDERERS[name]?.();

  if (name === 'shelf') window.scrollTo({ top: shelfScroll, behavior: 'auto' });
  else if (name !== 'book') window.scrollTo({ top: 0, behavior: 'auto' });

  updateTopbar();
}

function updateTopbar() {
  const compact = currentView !== 'shelf' || window.scrollY > 90;
  document.getElementById('topbar').classList.toggle('compact', compact);
}

function openBook(id, coverEl) {
  showBook(id, coverEl);
}

function goto(name) {
  if (currentView === 'book') {
    if (!confirmLeaveEditor()) return;
    closeBook(name === 'book' ? 'shelf' : name);
  } else {
    setView(name);
  }
}

function fail(message) {
  document.getElementById('app').innerHTML =
    `<p class="shelf-empty" style="max-width:56ch;margin:14vh auto">${message}</p>`;
}

(async function init() {
  hydrateIcons();

  try {
    await loadData();
  } catch (e) {
    console.error(e);
    fail('Не удалось загрузить данные клуба. Если вы открыли файл напрямую (file://), ' +
         'запустите локальный сервер: <code>python3 -m http.server</code> — браузер не отдаёт JSON без него.');
    return;
  }

  initBook({
    setView,
    // Название, оценка или жанр могли поменяться — полка и разделы должны
    // это увидеть, не дожидаясь перезагрузки.
    onBookChanged: () => refreshShelf()
  });
  initPages(openBook);
  initShelf(openBook);
  initAddBook({
    onAdded: book => {
      refreshShelf();
      openBook(book.id);
    }
  });

  initSaveBar();
  onDirtyChange(syncSaveBar);

  document.getElementById('mainnav').addEventListener('click', e => {
    const b = e.target.closest('[data-view]');
    if (b) goto(b.dataset.view);
  });

  document.querySelector('.wordmark').addEventListener('click', e => {
    e.preventDefault();
    goto('shelf');
  });

  document.getElementById('backBtn').addEventListener('click', () => {
    if (confirmLeaveEditor()) closeBook('shelf');
  });

  document.addEventListener('keydown', e => {
    // Пока карточка в режиме правки, Esc принадлежит форме, а не навигации:
    // случайно закрыть страницу и потерять незаписанное не должно быть можно.
    if (e.key === 'Escape' && currentView === 'book' && currentBookId() && !isEditing()) {
      closeBook('shelf');
    }
  });

  window.addEventListener('scroll', updateTopbar, { passive: true });
  updateTopbar();
})();
