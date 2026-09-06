/* Полка подтягивает чужие правки сама, без перезагрузки.
 *
 * Сайт статический: правка одной участницы становится коммитом, GitHub Pages
 * пересобирает его за минуту-полторы, и до этого момента у остальных в
 * открытых вкладках старая полка. Раньше её приходилось перезагружать, да ещё
 * и со сбросом кеша. Теперь вкладка сама изредка перечитывает
 * data/books.json и, если он изменился, обновляет полку на месте.
 *
 * Три вещи, без которых это ломало бы больше, чем чинит:
 *
 *  • Незакоммиченные правки неприкосновенны: пока в этой вкладке есть
 *    несохранённое или открыт редактор, опрос молчит — иначе чужой файл
 *    затёр бы то, что человек прямо сейчас набирает.
 *
 *  • После своего же коммита Pages ещё минуту отдаёт старый файл. Если
 *    принять его, только что добавленная книга исчезнет с полки. Поэтому
 *    после сохранения ждём ровно тот текст, который сами отправили, и всё
 *    остальное игнорируем.
 *
 *  • В скрытой вкладке опрашивать незачем — ждём возвращения. */

import { state, fetchJSON, replaceBooks, dirtyFiles } from './data.js';
import { isEditing } from './bookedit.js';

const PERIOD = 60000;          // как часто перечитывать, мс
const WAIT_LIMIT = 15 * 60000; // сколько ждать свой коммит, прежде чем сдаться

/* Сравниваем не текст файла, а его содержимое: форматирование у файла в
   репозитории и у нашей сборки может отличаться пробелами, а смысл — нет. */
const norm = books => JSON.stringify(books);

let known = null;      // содержимое, которое мы уже показываем
let awaited = null;    // свой коммит, которого ждём от Pages
let awaitedAt = 0;
let onChange = () => {};

/** Запомнить, что мы только что отправили: до его появления чужое не берём. */
export function expectPublished(books) {
  awaited = norm(books);
  awaitedAt = Date.now();
}

async function tick() {
  if (document.hidden) return;
  if (dirtyFiles().length || isEditing()) return;

  let books;
  try {
    books = await fetchJSON('data/books.json');
  } catch {
    return;                    // сеть моргнула — попробуем в следующий раз
  }
  if (!Array.isArray(books)) return;

  const text = norm(books);

  if (awaited !== null) {
    // Ждём свой коммит. Он либо приходит, либо через четверть часа мы
    // признаём, что он не появится (Pages упал, ветка не та), и живём дальше.
    if (text === awaited) { awaited = null; }
    else if (Date.now() - awaitedAt < WAIT_LIMIT) return;
    else awaited = null;
  }

  if (text === known) return;
  known = text;
  replaceBooks(books);
  onChange();
}

export function initLive(handler) {
  onChange = handler;
  known = norm(state.books);
  setInterval(tick, PERIOD);
  // Возврат к вкладке — самый частый момент, когда данные уже устарели.
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
  window.addEventListener('focus', tick);
}
