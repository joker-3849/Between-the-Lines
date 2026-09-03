/* Настройки, которые выбирает читатель. Живут в localStorage этого браузера
   и ни на что в данных клуба не влияют. */

const KEY = 'btl:settings:v1';

const DEFAULTS = {
  // Какие обложки показывать:
  //   'art'  — нарисованные для клуба (поле art в books.json)
  //   'real' — фотографии настоящих изданий, а нарисованные как запасной вариант
  covers: 'art'
};

const listeners = new Set();

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };   // приватный режим или запрет на хранение
  }
}

let current = read();

export function get(name) {
  return current[name];
}

export function set(name, value) {
  if (current[name] === value) return;
  current = { ...current, [name]: value };
  try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* не страшно */ }
  listeners.forEach(fn => fn(name, value));
}

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
