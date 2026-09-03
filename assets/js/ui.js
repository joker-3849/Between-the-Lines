/* Общие UI-кирпичики: обложка, аватар участника, шкала оценок. */

import { state, scoresFor, avg, num } from './data.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ── обложка ──────────────────────────────────────────────────────────── */

function coverSources(book) {
  const list = [];
  if (book.cover) list.push(book.cover);
  if (Array.isArray(book.coverRemote)) list.push(...book.coverRemote);
  return list;
}

/**
 * Разметка обложки. Пока картинка не загрузилась (или её нет вовсе),
 * видна типографская обложка — она же остаётся постоянным запасным вариантом.
 */
export function coverHTML(book, cls = '') {
  const sources = coverSources(book);
  return `<div class="cover t${book.tone ?? 0} ${cls}"
       data-sources="${esc(JSON.stringify(sources))}">
    <img class="cover-img" alt="Обложка: ${esc(book.title)}" loading="lazy">
    <div class="cover-fallback">
      <div class="cf-top">
        <span class="cf-genre">${esc(book.genre || '')}</span>
      </div>
      <div>
        <div class="cf-title">${esc(book.title)}</div>
        <div class="cf-rule"></div>
        <div class="cf-author">${esc(book.author)}</div>
      </div>
    </div>
    <div class="cover-gloss"></div>
  </div>`;
}

/** Подключает загрузку картинок с перебором источников по очереди. */
export function mountCovers(root = document) {
  root.querySelectorAll('.cover[data-sources]').forEach(cover => {
    const img = cover.querySelector('.cover-img');
    if (!img || img.dataset.mounted) return;
    img.dataset.mounted = '1';

    let sources = [];
    try { sources = JSON.parse(cover.dataset.sources); } catch { /* оставим пустым */ }
    if (!sources.length) return;

    let i = 0;
    const tryNext = () => {
      if (i >= sources.length) return;     // остаёмся на типографской обложке
      img.src = sources[i++];
    };
    img.addEventListener('load', () => cover.classList.add('has-img'), { once: true });
    img.addEventListener('error', tryNext);
    tryNext();
  });
}

/* ── участники ────────────────────────────────────────────────────────── */

export function whoHTML(member, extra = '') {
  return `<span class="who">
    <span class="who-dot" style="--c:${esc(member.color)}">${esc(member.initial)}</span>
    <span class="who-name">${esc(member.name)}</span>${extra}
  </span>`;
}

export function avatarHTML(member, cls = '') {
  return `<span class="who-dot ${cls}" style="--c:${esc(member.color)}"
    title="${esc(member.name)}">${esc(member.initial)}</span>`;
}

/* ── шкала одного критерия ────────────────────────────────────────────── */

const PAD = 4;        // отступ шкалы от краёв, %
const SPAN = 100 - PAD * 2;

function pos(value, scale) {
  return PAD + ((value - 1) / (scale - 1)) * SPAN;
}

/**
 * Одна строка: название критерия, среднее и точки участников на оси 1…N.
 * Совпадающие оценки поднимаются друг над другом, чтобы не слипались.
 */
export function critHTML(book, crit) {
  const scale = state.club.scale || 10;
  const scores = scoresFor(book, crit.id);
  if (!scores.length) return '';

  const mean = avg(book, crit.id);
  const byValue = new Map();

  const dots = scores.map(({ member, value }) => {
    const n = byValue.get(value) || 0;
    byValue.set(value, n + 1);
    return `<span class="dot" style="--c:${esc(member.color)};left:${pos(value, scale).toFixed(2)}%;--lift:${-n * 22}px"
      data-v="${value}" title="${esc(member.name)}: ${value} из ${scale}">${esc(member.initial)}</span>`;
  }).join('');

  // Насколько высоко пришлось складывать совпавшие оценки.
  const stack = Math.max(...byValue.values());

  return `<div class="crit">
    <div class="crit-head">
      <span class="crit-label">${esc(crit.label)}</span>
      <span class="crit-avg">${num(mean)}<small> / ${scale}</small></span>
    </div>
    <div class="crit-scale" style="--stack:${stack}">
      <div class="crit-track"></div>
      <div class="crit-avgline" style="left:${pos(mean, scale).toFixed(2)}%"></div>
      ${dots}
      <div class="crit-ends"><span>1</span><span>${scale}</span></div>
    </div>
  </div>`;
}

/* ── прочее ───────────────────────────────────────────────────────────── */

/** Плавное появление элементов по очереди. */
export function stagger(nodes, step = 55, base = 90) {
  [...nodes].forEach((el, i) => {
    el.style.setProperty('--delay', `${base + i * step}ms`);
    el.classList.add('rise');
  });
}
