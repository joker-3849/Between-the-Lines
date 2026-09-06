/* Сохранение прямо с сайта: коммит в data/*.json через GitHub API.
 *
 * Сайт статический, поэтому «сохранить» здесь — это коммит в репозиторий, а
 * для коммита нужен токен с правом записи. Токен лежит в data/club.json
 * зашифрованным: ключ выводится из фразы клуба (PBKDF2-SHA-256 → AES-GCM),
 * так что расшифровать его может только тот, кто фразу знает. Ни фраза, ни
 * токен никуда не отправляются — вся криптография в браузере, наружу уходит
 * только запрос к api.github.com.
 *
 * Важно понимать границу: зашифрованный токен лежит в открытом репозитории,
 * значит фраза становится настоящим паролем, и подбирать её будут не у нас
 * на глазах, а офлайн. Поэтому фраза для включённого сохранения должна быть
 * длинной и случайной, а сам токен — узким: доступ только к этому
 * репозиторию и только на содержимое. Худшее, что даёт его утечка, —
 * испорченный репозиторий, и это откатывается из истории.
 *
 * Нет поля publish в club.json — сохранения нет, работает прежний путь:
 * скопировать JSON и закоммитить вручную. */

import { state } from './data.js';

const API = 'https://api.github.com';
const ITER = 600000;          // итераций PBKDF2 на вывод ключа из фразы

const cfg = () => state.club?.publish || null;

/** Настроено ли сохранение на сайт. */
export function canPublish() {
  return Boolean(globalThis.crypto?.subtle && cfg()?.repo && cfg()?.token);
}

/* ── что именно сохраняем ─────────────────────────────────────────────── */

/* Служебные пометки живут только в памяти вкладки: _draft — книга ещё не
   в файле, _edited — правки ещё не закоммичены. В файл они не попадают. */
const clean = ({ _draft, _edited, ...book }) => book;

export const booksJSON = () => JSON.stringify(state.books.map(clean), null, 2) + '\n';
export const clubJSON = () => JSON.stringify(state.club, null, 2) + '\n';

/* ── шифрование токена ────────────────────────────────────────────────── */

/* Фраза приводится к тому же виду, что и при проверке замка, иначе набранная
   с большой буквы фраза открывала бы замок, но не расшифровывала токен. */
const norm = phrase => String(phrase).trim().toLowerCase();

const toB64 = bytes => btoa(String.fromCharCode(...bytes));
const fromB64 = text => Uint8Array.from(atob(text), c => c.charCodeAt(0));

async function keyFrom(phrase, salt, iterations) {
  const base = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(norm(phrase)), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/** Зашифровать токен фразой. Возвращает готовый объект publish. */
export async function encryptToken(phrase, token, repo, branch) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFrom(phrase, salt, ITER);
  const box = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, key, new TextEncoder().encode(token.trim())));

  const out = { repo: repo.trim(), salt: toB64(salt), iter: ITER,
                token: toB64(new Uint8Array([...iv, ...box])) };
  if (branch?.trim()) out.branch = branch.trim();
  return out;
}

/** Расшифровать токен фразой. Неверная фраза — AES-GCM не сойдётся. */
export async function decryptToken(phrase, conf = cfg()) {
  const key = await keyFrom(phrase, fromB64(conf.salt), conf.iter || ITER);
  const raw = fromB64(conf.token);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: raw.slice(0, 12) }, key, raw.slice(12));
  return new TextDecoder().decode(plain);
}

/* ── коммит ───────────────────────────────────────────────────────────── */

class PublishError extends Error {
  constructor(kind, message) { super(message); this.kind = kind; }
}

/* GitHub объясняет отказ лучше, чем можно угадать по коду ответа, — его
   формулировку показываем рядом со своей. */
async function reason(res) {
  try {
    const { message } = await res.json();
    return message ? ` GitHub: «${message}».` : '';
  } catch { return ''; }
}

/* Репозиторий у клуба публичный, поэтому читать его может любой токен, даже
   вовсе без прав на запись, — 403 приходит только на попытке записи. Самая
   частая причина: при создании fine-grained токена осталось значение по
   умолчанию «Public Repositories (read-only)» либо Contents выставлен в
   Read-only. У классического токена та же беда без галочки repo. */
const NO_WRITE = repo =>
  `Токен читает ${repo}, но писать в него не может. Проверьте у токена: `
  + `Repository access — Only select repositories и в списке ${repo}; `
  + `Permissions → Repository permissions → Contents: Read and write.`;

const headers = token => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28'
});

/** Текущий sha файла — GitHub требует его, чтобы не затереть чужую правку. */
async function shaOf(token, path) {
  const { repo, branch } = cfg();
  const q = branch ? `?ref=${encodeURIComponent(branch)}` : '';
  const res = await fetch(`${API}/repos/${repo}/contents/${path}${q}`, { headers: headers(token) });

  if (res.status === 404) return undefined;          // файла ещё нет — создадим
  if (res.status === 401) {
    throw new PublishError('auth', 'GitHub не принял токен: он неверный или отозван.' + await reason(res));
  }
  if (res.status === 403) throw new PublishError('auth', NO_WRITE(repo) + await reason(res));
  if (!res.ok) throw new PublishError('net', `GitHub ответил ${res.status}.` + await reason(res));
  return (await res.json()).sha;
}

async function putFile(token, path, text, message, sha) {
  const { repo, branch } = cfg();
  const body = {
    message,
    content: toB64(new TextEncoder().encode(text)),
    ...(sha ? { sha } : {}),
    ...(branch ? { branch } : {})
  };
  return fetch(`${API}/repos/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: { ...headers(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

/**
 * Коммитит файлы по одному. Каждый — отдельный коммит: Contents API иначе
 * не умеет, а собирать дерево вручную ради двух файлов не стоит.
 *
 * files: [{ path, text }]. Бросает PublishError с kind: auth | conflict | net.
 */
export async function publishFiles(phrase, files, message) {
  let token;
  try {
    token = await decryptToken(phrase);
  } catch {
    throw new PublishError('phrase', 'Фраза не подошла — токен не расшифровался.');
  }

  for (const { path, text } of files) {
    let sha = await shaOf(token, path);
    let res = await putFile(token, path, text, message, sha);

    // 409 — файл успели поменять между чтением sha и записью. Перечитываем
    // и пробуем один раз; если и тогда конфликт, разбираться должен человек.
    if (res.status === 409 || res.status === 422) {
      sha = await shaOf(token, path);
      res = await putFile(token, path, text, message, sha);
    }

    if (res.status === 401) {
      throw new PublishError('auth',
        'GitHub не принял токен: он неверный, отозван или истёк.' + await reason(res));
    }
    if (res.status === 403) {
      throw new PublishError('auth', NO_WRITE(cfg().repo) + await reason(res));
    }
    if (res.status === 409 || res.status === 422) {
      throw new PublishError('conflict', `Файл ${path} кто-то поменял только что. Обновите страницу и повторите.`);
    }
    if (!res.ok) {
      throw new PublishError('net',
        `GitHub ответил ${res.status} на запись ${path}.` + await reason(res));
    }
  }
}

/**
 * Проверяет токен до того, как его зашифруют и положат в репозиторий:
 * иначе о нехватке прав узнаёшь только при первой правке, а выглядит это
 * как поломка сайта. Ничего не пишет — только читает описание репозитория.
 */
export async function checkToken(token, repo) {
  let res;
  try {
    res = await fetch(`${API}/repos/${repo}`, { headers: headers(token) });
  } catch {
    throw new PublishError('net', 'Не вышло достучаться до api.github.com.');
  }
  if (res.status === 401) {
    throw new PublishError('auth', 'GitHub не принял токен: он неверный или отозван.' + await reason(res));
  }
  if (res.status === 404) {
    throw new PublishError('auth',
      `Репозиторий ${repo} токену не виден. Проверьте написание и то, что он выбран `
      + 'в Repository access у токена.');
  }
  if (!res.ok) throw new PublishError('net', `GitHub ответил ${res.status}.` + await reason(res));

  const info = await res.json();
  if (info.permissions && !info.permissions.push) throw new PublishError('auth', NO_WRITE(repo));
}
