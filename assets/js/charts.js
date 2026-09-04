/* Виджеты для карточки книги: полукруглая шкала среднего балла, радар по
 * критериям и кольцо «Перечитаешь?».
 *
 * Всё рисуется руками в inline-SVG: данных на книгу немного (пять критериев
 * и три-четыре человека), а тащить ради этого библиотеку в сайт без сборки
 * незачем. Цвета берутся из тех же переменных, что и остальной интерфейс,
 * поэтому смена палитры не требует правок здесь. */

import { state, avg, spread, verdict, scoresFor, memberScore, rereadTally, num, numPlural } from './data.js';
import { esc } from './ui.js';

const scale = () => state.club.scale || 10;

/* ── средний балл: полукруглая шкала ──────────────────────────────────── */

export function gaugeHTML(book) {
  const mean = avg(book);
  const max = scale();
  const v = verdict(book);
  const scores = scoresFor(book);
  const sp = spread(book);

  // Подпись под шкалой объясняет, чем именно клуб сошёлся или разошёлся —
  // раньше эта фраза висела отдельной строкой под автором.
  const gap = numPlural(sp, 'балл', 'балла', 'баллов');
  const note = !scores.length ? ''
    : scores.length === 1
      ? `Оценил${scores[0].member.g === 'm' ? '' : 'а'} пока только ${scores[0].member.name}.`
      : sp < 0.05 ? 'Все сошлись на одной оценке.'
      : v?.kind === 'unison' ? `Оценки почти совпали: разброс ${gap}.`
      : v?.kind === 'split' ? `Мнения разошлись на ${gap} из ${max}.`
      : `Средние баллы разошлись на ${gap}.`;
  const R = 76, CX = 100, CY = 96, SW = 13;
  const len = Math.PI * R;
  const frac = mean == null ? 0 : Math.max(0, Math.min(1, mean / max));

  // Засечки по дуге — как на приборной шкале: сразу видно, где ты на ней.
  const ticks = Array.from({ length: 41 }, (_, i) => {
    const a = Math.PI - (i / 40) * Math.PI;
    const outer = R - SW / 2 - 4;
    const inner = outer - (i % 5 === 0 ? 8 : 4.5);
    return `<line x1="${(CX + outer * Math.cos(a)).toFixed(1)}" y1="${(CY - outer * Math.sin(a)).toFixed(1)}"
      x2="${(CX + inner * Math.cos(a)).toFixed(1)}" y2="${(CY - inner * Math.sin(a)).toFixed(1)}"
      stroke="currentColor" stroke-width="1" opacity="${i % 5 === 0 ? .5 : .26}"/>`;
  }).join('');

  const arc = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`;

  return `<div class="wg wg-gauge">
    <div class="wg-label">Средний балл</div>
    <div class="wg-body">
    <svg viewBox="0 0 200 118" class="gauge" aria-hidden="true">
      <defs>
        <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="var(--peach)"/>
          <stop offset="1" stop-color="var(--gold)"/>
        </linearGradient>
      </defs>
      <path d="${arc}" fill="none" stroke="var(--rule)" stroke-width="${SW}" stroke-linecap="round"/>
      <path d="${arc}" fill="none" stroke="url(#gaugeGrad)" stroke-width="${SW}" stroke-linecap="round"
        stroke-dasharray="${(frac * len).toFixed(1)} ${len.toFixed(1)}"/>
      <g color="var(--faint)">${ticks}</g>
    </svg>
    <div class="gauge-value">
      <b>${mean == null ? '—' : num(mean)}</b><span>из ${max}</span>
    </div>
    ${v ? `<span class="badge ${v.kind} gauge-badge">${esc(v.label)}</span>` : ''}
    ${note ? `<p class="gauge-note">${esc(note)}</p>` : ''}
    </div>
  </div>`;
}

/* ── радар по критериям ───────────────────────────────────────────────── */

const R = 66, CX = 108, CY = 100;

function axisAngle(i, n) { return -Math.PI / 2 + (i * 2 * Math.PI) / n; }

function point(i, n, value) {
  const r = R * (value / scale());
  const a = axisAngle(i, n);
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}

function polygon(values, n) {
  return values.map((v, i) => point(i, n, v).map(x => x.toFixed(1)).join(',')).join(' ');
}

/**
 * Пятиугольник со шкалой 0…10 по каждому критерию: залитая фигура — средние
 * оценки клуба, тонкие контуры — каждый участник отдельно. Форма фигуры
 * читается быстрее, чем пять отдельных чисел: сразу видно перекос.
 */
export function radarHTML(book) {
  const crits = state.criteria;
  const n = crits.length;
  if (n < 3) return '';

  const means = crits.map(c => avg(book, c.id));
  if (means.every(v => v == null)) return '';

  const rings = [2, 4, 6, 8, 10].map(v =>
    `<polygon points="${polygon(crits.map(() => v), n)}" fill="none"
       stroke="var(--rule)" stroke-width="1"/>`).join('');

  const spokes = crits.map((_, i) => {
    const [x, y] = point(i, n, scale());
    return `<line x1="${CX}" y1="${CY}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"
      stroke="var(--rule)" stroke-width="1"/>`;
  }).join('');

  const labels = crits.map((c, i) => {
    const a = axisAngle(i, n);
    const x = CX + (R + 15) * Math.cos(a);
    const y = CY + (R + 15) * Math.sin(a);
    const anchor = Math.abs(Math.cos(a)) < .3 ? 'middle' : (Math.cos(a) > 0 ? 'start' : 'end');
    return `<text x="${x.toFixed(1)}" y="${(y + 3.5).toFixed(1)}" text-anchor="${anchor}"
      font-size="10" fill="var(--faint)">${esc(c.short || c.label)}</text>`;
  }).join('');

  const people = state.members.map(m => {
    const vals = crits.map(c => memberScore(book, m.id, c.id));
    if (vals.some(v => typeof v !== 'number')) return '';
    return `<polygon points="${polygon(vals, n)}" fill="none"
      stroke="${esc(m.color)}" stroke-width="1.6" stroke-linejoin="round" opacity=".85"/>`;
  }).join('');

  const clubVals = means.map(v => v ?? 0);

  return `<div class="wg wg-radar">
    <div class="wg-label">Профиль книги</div>
    <div class="wg-body">
    <svg viewBox="-20 0 256 200" class="radar" aria-hidden="true">
      ${rings}${spokes}
      <polygon points="${polygon(clubVals, n)}" fill="var(--gold)" opacity=".13"/>
      <polygon points="${polygon(clubVals, n)}" fill="none" stroke="var(--gold)" stroke-width="2"
        stroke-linejoin="round"/>
      ${people}
      ${labels}
    </svg>
    <div class="wg-legend">
      <span class="lg lg-club">клуб</span>
      ${state.members.map(m =>
        `<span class="lg" style="--c:${esc(m.color)}">${esc(m.name)}</span>`).join('')}
    </div>
    </div>
  </div>`;
}

/* ── «Перечитаешь?»: кольцо ───────────────────────────────────────────── */

export function rereadRingHTML(book) {
  const { yes, no } = rereadTally(book);
  const total = yes.length + no.length;
  if (!total) return '';

  const r = 42, c = 2 * Math.PI * r;
  const yesLen = (yes.length / total) * c;

  return `<div class="wg wg-reread">
    <div class="wg-label">Перечитаешь?</div>
    <div class="wg-body">
    <div class="ring-wrap">
      <svg viewBox="0 0 112 112" class="ring" aria-hidden="true">
        <circle cx="56" cy="56" r="${r}" fill="none" stroke="var(--rr-no)" stroke-width="12"/>
        <circle cx="56" cy="56" r="${r}" fill="none" stroke="var(--rr-yes)" stroke-width="12"
          stroke-dasharray="${yesLen.toFixed(1)} ${(c - yesLen).toFixed(1)}"
          transform="rotate(-90 56 56)" stroke-linecap="butt"/>
      </svg>
      <div class="ring-value"><b>${yes.length}</b><span>из ${total}</span></div>
    </div>
    <div class="rr-rows">
      ${yes.length ? `<div class="rr-row rr-yes"><span class="rr-key">да</span>
        <span>${yes.map(m => esc(m.name)).join(', ')}</span></div>` : ''}
      ${no.length ? `<div class="rr-row rr-no"><span class="rr-key">нет</span>
        <span>${no.map(m => esc(m.name)).join(', ')}</span></div>` : ''}
    </div>
    </div>
  </div>`;
}

/* ── место на полке ───────────────────────────────────────────────────── */

/**
 * Где эта книга среди всех прочитанных: полоска из засечек, по одной на
 * книгу, отсортированных по средней оценке, — своя выделена. Само число
 * «седьмая из двенадцати» мало что говорит, а вот насколько она оторвалась
 * от соседей по списку, видно сразу.
 */
export function rankHTML(book) {
  const rated = state.books
    .map(b => ({ b, mean: avg(b) }))
    .filter(x => x.mean != null)
    .sort((a, b) => b.mean - a.mean);

  const i = rated.findIndex(x => x.b.id === book.id);
  if (i < 0 || rated.length < 2) return '';

  const top = rated[0].mean, bottom = rated[rated.length - 1].mean;
  const span = top - bottom || 1;
  const pos = m => (1 - (m - bottom) / span) * 100;   // сверху вниз: лучшие слева

  const ticks = rated.map((x, k) =>
    `<span class="rk-tick${k === i ? ' on' : ''}" style="left:${pos(x.mean).toFixed(2)}%"
       title="${esc(x.b.title)}: ${num(x.mean)}"></span>`).join('');

  const ordinal = ['первая', 'вторая', 'третья', 'четвёртая', 'пятая', 'шестая',
                   'седьмая', 'восьмая', 'девятая', 'десятая'][i] || `${i + 1}-я`;

  return `<div class="wg wg-rank">
    <div class="wg-label">Место на полке</div>
    <div class="wg-body">
      <div class="rk-number"><b>${i + 1}</b><span>из ${rated.length}</span></div>
      <div class="rk-strip">
        <span class="rk-line"></span>
        ${ticks}
      </div>
      <div class="rk-ends"><span>лучшая</span><span>худшая</span></div>
      <p class="rk-note">${esc(ordinal)} по средней оценке клуба</p>
    </div>
  </div>`;
}

/* ── карточка участника: средний балл и пять мини-шкал ────────────────── */

export function memberCardsHTML(book) {
  const cards = state.members.map(m => {
    const mean = memberScore(book, m.id);
    if (mean == null) return '';
    const rr = book.reviews?.[m.id]?.reread;

    const bars = state.criteria.map(c => {
      const v = memberScore(book, m.id, c.id);
      const pct = v == null ? 0 : (v / scale()) * 100;
      return `<div class="mb-row" title="${esc(c.label)}: ${v ?? '—'} из ${scale()}">
        <span class="mb-name">${esc(c.short || c.label)}</span>
        <span class="mb-track"><span class="mb-fill" style="width:${pct.toFixed(0)}%"></span></span>
        <span class="mb-val">${v ?? '—'}</span>
      </div>`;
    }).join('');

    return `<article class="mcard" style="--c:${esc(m.color)}">
      <header class="mcard-head">
        <span class="who-dot" style="--c:${esc(m.color)}">${esc(m.initial)}</span>
        <span class="mcard-name">${esc(m.name)}</span>
        <span class="mcard-mean">${num(mean)}</span>
      </header>
      ${rr == null ? '' : `<span class="mcard-rr ${rr ? 'yes' : 'no'}">${rr ? 'перечитает' : 'не перечитает'}</span>`}
      <div class="mcard-bars">${bars}</div>
    </article>`;
  }).join('');

  return cards ? `<div class="mcards">${cards}</div>` : '';
}
