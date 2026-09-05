/* Загрузка данных клуба и производные величины.
   Единственный источник правды — data/club.json и data/books.json. */

export const state = {
  club: null,
  books: [],
  members: [],
  criteria: [],
  memberById: new Map(),
  bookById: new Map()
};

export async function loadData() {
  // Одностраничная сборка кладёт данные прямо в страницу, обычная — читает файлы.
  const inline = globalThis.__BTL_DATA__;
  const [club, books] = inline
    ? [inline.club, inline.books]
    : await Promise.all([
        fetch('data/club.json').then(r => r.json()),
        fetch('data/books.json').then(r => r.json())
      ]);
  state.club = club;
  state.books = books;
  state.members = club.members;
  state.criteria = club.criteria;
  club.members.forEach(m => state.memberById.set(m.id, m));
  books.forEach(b => state.bookById.set(b.id, b));
  return state;
}

/* ── добавление новой книги ──────────────────────────────────────────────
   Сайт читает данные из JSON в репозитории, поэтому «Добавить книгу» не
   пишет ни в какой файл сама — она собирает книгу в оперативной памяти,
   чтобы её сразу можно было посмотреть на полке, и отдаёт готовый JSON
   для вставки в data/books.json. Черновик живёт до перезагрузки страницы. */

const RU_TO_LAT = {
  а:'a', б:'b', в:'v', г:'g', д:'d', е:'e', ё:'e', ж:'zh', з:'z', и:'i', й:'y',
  к:'k', л:'l', м:'m', н:'n', о:'o', п:'p', р:'r', с:'s', т:'t', у:'u', ф:'f',
  х:'h', ц:'c', ч:'ch', ш:'sh', щ:'sch', ъ:'', ы:'y', ь:'', э:'e', ю:'yu', я:'ya'
};

export function slugify(title) {
  const translit = String(title).toLowerCase()
    .split('').map(ch => RU_TO_LAT[ch] ?? ch).join('');
  const slug = translit.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || 'kniga';
}

/** Свободный id: «щегол» → shchegol, а при совпадении — shchegol-2, shchegol-3… */
export function freeBookId(title) {
  const base = slugify(title);
  if (!state.bookById.has(base)) return base;
  let n = 2;
  while (state.bookById.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/** Убирает книгу из состояния страницы (не из файла). */
export function dropBook(id) {
  const i = state.books.findIndex(b => b.id === id);
  if (i >= 0) state.books.splice(i, 1);
  state.bookById.delete(id);
}

/** Добавляет книгу в текущее состояние страницы (не в файл) и возвращает её. */
export function addDraftBook(book) {
  const draft = { ...book, _draft: true };
  state.books.push(draft);
  state.bookById.set(draft.id, draft);
  return draft;
}

/* ── оценки ───────────────────────────────────────────────────────────
   Участник выставляет баллы только по критериям из club.json. Средний
   балл нигде не хранится — он всегда считается из них, поэтому не может
   разойтись с ними после правки. */

export const OVERALL = 'overall';

/** Балл участника: по конкретному критерию или средний по всем. */
export function memberScore(book, memberId, critId = OVERALL) {
  const scores = book.reviews?.[memberId]?.scores;
  if (!scores) return undefined;
  if (critId !== OVERALL) {
    return typeof scores[critId] === 'number' ? scores[critId] : undefined;
  }
  const vals = state.criteria
    .map(c => scores[c.id])
    .filter(v => typeof v === 'number');
  if (!vals.length) return undefined;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/** Все оценки по критерию: [{member, value}] в порядке участников клуба. */
export function scoresFor(book, critId = OVERALL) {
  return state.members
    .map(m => ({ member: m, value: memberScore(book, m.id, critId) }))
    .filter(s => typeof s.value === 'number');
}

export function avg(book, critId = OVERALL) {
  const s = scoresFor(book, critId);
  if (!s.length) return null;
  return s.reduce((a, x) => a + x.value, 0) / s.length;
}

/** Разброс: максимум минус минимум. Чем больше — тем сильнее спорили. */
export function spread(book, critId = OVERALL) {
  const s = scoresFor(book, critId).map(x => x.value);
  if (s.length < 2) return 0;
  return Math.max(...s) - Math.min(...s);
}

export function verdict(book) {
  // «Единогласно» имеет смысл только когда есть кого сравнивать между собой.
  if (scoresFor(book).length < 2) return null;
  const sp = spread(book);
  if (sp >= 3) return { kind: 'split', label: 'спорная' };
  if (sp <= 1) return { kind: 'unison', label: 'единогласно' };
  return null;
}

/** Кто перечитает книгу, а кто нет. Участники без ответа не попадают никуда. */
export function rereadTally(book) {
  const yes = [], no = [];
  state.members.forEach(m => {
    const r = book.reviews?.[m.id]?.reread;
    if (r === true) yes.push(m);
    else if (r === false) no.push(m);
  });
  return { yes, no };
}

/** Средняя оценка участника по набору книг. */
export function memberMean(memberId, books = state.books) {
  const vals = books
    .map(b => memberScore(b, memberId))
    .filter(v => typeof v === 'number');
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/**
 * Все выписанные строчки: и цитаты из книг, и свои формулировки.
 * В данных это два разных поля (quote и line) — здесь они сводятся в один
 * список с признаком kind, чтобы страницы не разбирались в этом сами.
 */
export function allLines(books = state.books) {
  const out = [];
  books.forEach(b => {
    state.members.forEach(m => {
      const rev = b.reviews?.[m.id];
      if (rev?.quote?.text) out.push({ book: b, member: m, kind: 'book', line: rev.quote });
      if (rev?.line?.text) out.push({ book: b, member: m, kind: 'club', line: rev.line });
    });
  });
  return out;
}

export function genres(books = state.books) {
  const seen = [];
  books.forEach(b => { if (b.genre && !seen.includes(b.genre)) seen.push(b.genre); });
  return seen.sort((a, b) => a.localeCompare(b, 'ru'));
}

export function yearOf(book) {
  return Number(String(book.discussed).slice(0, 4));
}

export function years(books = state.books) {
  return [...new Set(books.map(yearOf))].sort((a, b) => b - a);
}

/* ── даты и числительные ──────────────────────────────────────────────── */

const MONTHS = ['января','февраля','марта','апреля','мая','июня',
                'июля','августа','сентября','октября','ноября','декабря'];

export function fmtDate(iso, { withYear = true } = {}) {
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${withYear ? ' ' + d.getFullYear() : ''}`;
}

export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

export function nPlural(n, one, few, many) {
  return `${n} ${plural(n, one, few, many)}`;
}

/** Ближайшая встреча: катим дату вперёд с шагом cadenceDays, пока она в прошлом. */
export function nextMeeting(club = state.club) {
  const step = Number(club.cadenceDays) || 14;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(club.nextMeeting + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return null;
  let guard = 0;
  while (d < today && guard++ < 500) d.setDate(d.getDate() + step);
  const days = Math.round((d - today) / 86400000);
  return { date: d, iso: d.toISOString().slice(0, 10), days };
}

/** Числительное при дробном значении: «0,4 балла», «5 баллов», «1 балл».
 *  У дробей в русском всегда родительный единственного — «балла», а не «баллов». */
export function numPlural(v, one, few, many) {
  const shown = Number(v.toFixed(1));
  return `${num(v)} ${Number.isInteger(shown) ? plural(shown, one, few, many) : few}`;
}

/** Число с одним знаком после запятой, без хвостового нуля: 8.0 → «8», 7.75 → «7,8» */
export function num(v, digits = 1) {
  if (v == null) return '—';
  const r = Number(v.toFixed(digits));
  return String(r).replace('.', ',');
}
