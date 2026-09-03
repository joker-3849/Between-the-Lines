#!/usr/bin/env node
/**
 * Работает с обложками книг на Open Library — по ISBN из data/books.json.
 *
 * Три режима:
 *
 *   node tools/fetch-covers.mjs --verify         — проверить ISBN, которые уже
 *                                                   вписаны в books.json, и сказать,
 *                                                   у каких из них реально есть обложка
 *   node tools/fetch-covers.mjs --isbns          — найти ISBN по названию и автору
 *                                                   (полю coverQuery) и вписать в books.json
 *   node tools/fetch-covers.mjs                  — скачать файлы обложек в assets/covers/
 *                                                   по уже проставленным ISBN
 *
 * Ничего не выдумываем: если по ISBN обложки нет, поле не трогаем и файл не создаём —
 * на сайте остаётся типографская обложка.
 *
 *   node tools/fetch-covers.mjs --force              — перекачать/переписать заново
 *   node tools/fetch-covers.mjs --list shchegol       — показать издания на выбор
 *   node tools/fetch-covers.mjs --isbns --pick shchegol=2 --force   — взять другое издание
 *
 * Требуется Node 18+ (встроенный fetch) и доступ в интернет — то есть обычный
 * компьютер, не эта песочница: covers.openlibrary.org отсюда недоступен.
 */

import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const COVERS = join(ROOT, 'assets', 'covers');
const BOOKS_PATH = join(ROOT, 'data', 'books.json');
const SEARCH = 'https://openlibrary.org/search.json';
const byISBN = isbn => `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`;
const byCoverId = id => `https://covers.openlibrary.org/b/id/${id}-L.jpg?default=false`;

const args = process.argv.slice(2);
const force = args.includes('--force');
const findIsbns = args.includes('--isbns');
const verify = args.includes('--verify');
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
    + '&fields=title,author_name,cover_i,isbn,first_publish_year,publisher&limit=12';
  const res = await fetch(url, { headers: { 'User-Agent': 'between-the-lines/1.0' } });
  if (!res.ok) throw new Error(`поиск вернул ${res.status}`);
  const data = await res.json();
  return (data.docs || []).filter(d => d.cover_i);
}

/** Настоящая ли это картинка, а не заглушка на пару сотен байт. */
function looksLikeImage(buf) {
  return buf.length >= 3000 && buf[0] === 0xff && buf[1] === 0xd8;
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) return false;
  const buf = Buffer.from(await res.arrayBuffer());
  if (!looksLikeImage(buf)) return false;
  await writeFile(dest, buf);
  return buf.length;
}

async function coverExistsAt(url) {
  const res = await fetch(url);
  if (!res.ok) return false;
  const buf = Buffer.from(await res.arrayBuffer());
  return looksLikeImage(buf);
}

async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}

const books = JSON.parse(await readFile(BOOKS_PATH, 'utf8'));
await mkdir(COVERS, { recursive: true });

if (listOnly) {
  const book = books.find(b => b.id === listOnly);
  if (!book) { console.error(`Книга «${listOnly}» не найдена в data/books.json`); process.exit(1); }
  const list = await candidates(book);
  console.log(`\nВарианты обложек для «${book.title}»:\n`);
  list.forEach((d, i) => console.log(
    `  ${String(i).padStart(2)}  ${d.title} — ${(d.author_name || []).join(', ')}` +
    `${d.first_publish_year ? ` (${d.first_publish_year})` : ''}` +
    `${d.publisher?.[0] ? `, ${d.publisher[0]}` : ''}` +
    `${d.isbn?.[0] ? `, ISBN ${d.isbn[0]}` : ''}`
  ));
  console.log(`\nВзять нужный:  node tools/fetch-covers.mjs --isbns --pick ${book.id}=<номер> --force\n`);
  process.exit(0);
}

/* ── проверка уже вписанных ISBN ─────────────────────────────────────── */

if (verify) {
  console.log('Проверяю ISBN, вписанные в data/books.json…\n');
  let ok = 0, bad = 0, empty = 0;
  for (const book of books) {
    if (!book.isbn) { console.log(`○ ${book.title} — ISBN не указан`); empty++; continue; }
    const good = await coverExistsAt(byISBN(book.isbn));
    console.log(`${good ? '✓' : '✗'} ${book.title} — ISBN ${book.isbn}${good ? '' : ' — обложки нет или ISBN неверный'}`);
    good ? ok++ : bad++;
    await sleep(300);
  }
  console.log(`\nГотово: верно ${ok}, не нашлось ${bad}, без ISBN ${empty}.`);
  if (bad) console.log('Для неверных запустите: node tools/fetch-covers.mjs --list <id>, выберите издание и впишите его ISBN.');
  process.exit(0);
}

/* ── поиск ISBN по названию и автору ─────────────────────────────────── */

if (findIsbns) {
  let saved = 0, skipped = 0, missed = 0;
  for (const book of books) {
    if (!force && book.isbn) { skipped++; continue; }
    process.stdout.write(`· ${book.title} … `);
    try {
      const list = await candidates(book);
      const start = picks.get(book.id) ?? 0;
      let ok = false;
      for (let i = start; i < Math.min(list.length, start + 6); i++) {
        const isbn = list[i].isbn?.find(x => /^\d{10}(\d{3})?$/.test(x));
        if (!isbn) continue;
        if (await coverExistsAt(byISBN(isbn))) {
          book.isbn = isbn;
          console.log(`ISBN ${isbn}`);
          saved++; ok = true; break;
        }
      }
      if (!ok) { console.log('подходящего ISBN с обложкой не нашлось — оставляю как есть'); missed++; }
    } catch (e) {
      console.log(`ошибка: ${e.message}`);
      missed++;
    }
    await sleep(350);
  }
  if (saved) await writeFile(BOOKS_PATH, JSON.stringify(books, null, 2) + '\n');
  console.log(`\nГотово: найдено ${saved}, пропущено ${skipped}, не нашлось ${missed}.`);
  if (saved) console.log('ISBN вписаны в data/books.json — переключатель «настоящие» подтянет обложки прямо с Open Library.');
  process.exit(0);
}

/* ── скачивание файлов по уже известным ISBN ─────────────────────────── */

let saved = 0, skipped = 0, missed = 0;

for (const book of books) {
  const dest = join(COVERS, `${book.id}.jpg`);
  if (!force && await exists(dest)) { skipped++; continue; }

  process.stdout.write(`· ${book.title} … `);
  try {
    let size = book.isbn && await download(byISBN(book.isbn), dest);

    if (!size) {
      // ISBN не дал результата — поищем среди изданий той же книги.
      const list = await candidates(book);
      const start = picks.get(book.id) ?? 0;
      for (let i = start; i < Math.min(list.length, start + 4) && !size; i++) {
        size = await download(byCoverId(list[i].cover_i), dest);
      }
    }

    if (size) { console.log(`сохранено (${Math.round(size / 1024)} КБ)`); saved++; }
    else { console.log('обложка не нашлась — останется своя'); missed++; }
  } catch (e) {
    console.log(`ошибка: ${e.message}`);
    missed++;
  }
  await sleep(350);   // не частим с запросами к Open Library
}

console.log(`\nГотово: сохранено ${saved}, пропущено ${skipped}, без обложки ${missed}.`);
if (saved) console.log('Не забудьте закоммитить assets/covers/ — тогда сайт не зависит от чужого CDN.');
