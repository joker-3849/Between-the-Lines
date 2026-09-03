#!/usr/bin/env node
/**
 * Скачивает реальные обложки книг в assets/covers/<id>.jpg.
 *
 * Источник — Open Library: ищем по названию и автору (поле coverQuery
 * в data/books.json), берём обложку одного из найденных изданий.
 * Ничего не выдумываем: если подходящей обложки нет, файл просто не создаётся,
 * и на сайте остаётся типографская обложка.
 *
 *   node tools/fetch-covers.mjs                  — скачать всё, чего ещё нет
 *   node tools/fetch-covers.mjs --force          — перекачать заново
 *   node tools/fetch-covers.mjs --codes          — не качать файлы, а вписать
 *                                                  коды обложек в books.json
 *   node tools/fetch-covers.mjs --list shchegol  — показать издания на выбор
 *   node tools/fetch-covers.mjs --pick shchegol=2 — взять третий вариант
 *
 * Требуется Node 18+ (встроенный fetch) и доступ в интернет.
 */

import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const COVERS = join(ROOT, 'assets', 'covers');
const SEARCH = 'https://openlibrary.org/search.json';
const IMAGE = id => `https://covers.openlibrary.org/b/id/${id}-L.jpg?default=false`;

const args = process.argv.slice(2);
const force = args.includes('--force');
const codesOnly = args.includes('--codes');
const listOnly = args.includes('--list') ? args[args.indexOf('--list') + 1] : null;
const picks = new Map();
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  const pair = a === '--pick' ? args[i + 1] : a.startsWith('--pick=') ? a.slice(7) : null;
  if (pair && pair.includes('=')) {
    const [id, n] = pair.split('=');
    picks.set(id, Number(n) || 0);
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function candidates(book) {
  const url = `${SEARCH}?q=${encodeURIComponent(book.coverQuery || `${book.title} ${book.author}`)}`
    + '&fields=title,author_name,cover_i,first_publish_year,publisher&limit=12';
  const res = await fetch(url, { headers: { 'User-Agent': 'between-the-lines/1.0' } });
  if (!res.ok) throw new Error(`поиск вернул ${res.status}`);
  const data = await res.json();
  return (data.docs || []).filter(d => d.cover_i);
}

async function download(coverId, dest) {
  const res = await fetch(IMAGE(coverId));
  if (!res.ok) return false;
  const buf = Buffer.from(await res.arrayBuffer());
  // Open Library отдаёт заглушку в пару сотен байт, если обложки на самом деле нет
  if (buf.length < 3000 || buf[0] !== 0xff || buf[1] !== 0xd8) return false;
  await writeFile(dest, buf);
  return buf.length;
}

/** Есть ли по этому номеру настоящая картинка (а не заглушка). */
async function coverExists(coverId) {
  const res = await fetch(IMAGE(coverId));
  if (!res.ok) return false;
  const len = Number(res.headers.get('content-length') || 0);
  if (len && len < 3000) return false;
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.length >= 3000 && buf[0] === 0xff && buf[1] === 0xd8;
}

async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}

const books = JSON.parse(await readFile(join(ROOT, 'data', 'books.json'), 'utf8'));
await mkdir(COVERS, { recursive: true });

if (listOnly) {
  const book = books.find(b => b.id === listOnly);
  if (!book) { console.error(`Книга «${listOnly}» не найдена в data/books.json`); process.exit(1); }
  const list = await candidates(book);
  console.log(`\nВарианты обложек для «${book.title}»:\n`);
  list.forEach((d, i) => console.log(
    `  ${String(i).padStart(2)}  ${d.title} — ${(d.author_name || []).join(', ')}` +
    `${d.first_publish_year ? ` (${d.first_publish_year})` : ''}` +
    `${d.publisher?.[0] ? `, ${d.publisher[0]}` : ''}`
  ));
  console.log(`\nВзять нужный:  node tools/fetch-covers.mjs --pick ${book.id}=<номер> --force\n`);
  process.exit(0);
}

let saved = 0, skipped = 0, missed = 0;

for (const book of books) {
  const dest = join(COVERS, `${book.id}.jpg`);

  if (codesOnly) {
    if (!force && book.olCover) { skipped++; continue; }
  } else if (!force && await exists(dest)) {
    skipped++; continue;
  }

  process.stdout.write(`· ${book.title} … `);
  try {
    const list = await candidates(book);
    const start = picks.get(book.id) ?? 0;
    let ok = false;

    for (let i = start; i < Math.min(list.length, start + 4); i++) {
      const coverId = list[i].cover_i;

      if (codesOnly) {
        if (await coverExists(coverId)) {
          book.olCover = `id:${coverId}`;
          console.log(`код id:${coverId}`);
          saved++; ok = true; break;
        }
      } else {
        const size = await download(coverId, dest);
        if (size) {
          console.log(`сохранено (${Math.round(size / 1024)} КБ)`);
          saved++; ok = true; break;
        }
      }
    }
    if (!ok) { console.log('обложка не нашлась — останется своя'); missed++; }
  } catch (e) {
    console.log(`ошибка: ${e.message}`);
    missed++;
  }
  await sleep(350);   // не частим с запросами к Open Library
}

if (codesOnly && saved) {
  await writeFile(join(ROOT, 'data', 'books.json'),
    JSON.stringify(books, null, 2) + '\n');
}

console.log(`\nГотово: сохранено ${saved}, пропущено ${skipped}, без обложки ${missed}.`);
if (saved && codesOnly) {
  console.log('Коды вписаны в data/books.json. Переключатель «настоящие» на полке');
  console.log('теперь будет тянуть обложки прямо с Open Library.');
} else if (saved) {
  console.log('Не забудьте закоммитить assets/covers/ — тогда сайт не зависит от чужого CDN.');
}
