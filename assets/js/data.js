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
  const [club, books] = await Promise.all([
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

/* ── оценки ───────────────────────────────────────────────────────────── */

/** Все оценки по критерию: [{member, value}] в порядке участников клуба. */
export function scoresFor(book, critId) {
  return state.members
    .map(m => ({ member: m, value: book.reviews?.[m.id]?.scores?.[critId] }))
    .filter(s => typeof s.value === 'number');
}

export function avg(book, critId = 'overall') {
  const s = scoresFor(book, critId);
  if (!s.length) return null;
  return s.reduce((a, x) => a + x.value, 0) / s.length;
}

/** Разброс: максимум минус минимум. Чем больше — тем сильнее спорили. */
export function spread(book, critId = 'overall') {
  const s = scoresFor(book, critId).map(x => x.value);
  if (s.length < 2) return 0;
  return Math.max(...s) - Math.min(...s);
}

export function verdict(book) {
  const sp = spread(book);
  if (sp >= 4) return { kind: 'split', label: 'спорная' };
  if (sp <= 1) return { kind: 'unison', label: 'единогласно' };
  return null;
}

/** Средняя оценка участника по набору книг. */
export function memberMean(memberId, books = state.books) {
  const vals = books
    .map(b => b.reviews?.[memberId]?.scores?.overall)
    .filter(v => typeof v === 'number');
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/** Все выписанные строчки: [{book, member, line}] */
export function allLines(books = state.books) {
  const out = [];
  books.forEach(b => {
    state.members.forEach(m => {
      const line = b.reviews?.[m.id]?.line;
      if (line?.text) out.push({ book: b, member: m, line });
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

/** Число с одним знаком после запятой, без хвостового нуля: 8.0 → «8», 7.75 → «7,8» */
export function num(v, digits = 1) {
  if (v == null) return '—';
  const r = Number(v.toFixed(digits));
  return String(r).replace('.', ',');
}
