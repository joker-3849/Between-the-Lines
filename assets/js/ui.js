/* Общие UI-кирпичики: обложка, аватар участника, шкала оценок. */

import { state, num } from './data.js';
import { icon } from './icons.js';
import { motifSVG, DEFAULT_ART } from './covers.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ── обложка ──────────────────────────────────────────────────────────── */

/**
 * Разметка обложки. Обложки у клуба свои, типографские: единственным
 * источником фотографий был Open Library, а он по нашим книгам ничего не
 * отдаёт — переключатель «свои / настоящие» вместе с ним и убран.
 */
export function coverHTML(book, cls = '') {
  const art = { ...DEFAULT_ART, ...(book.art || {}) };
  const vars = `--bg:${esc(art.bg)};--fg:${esc(art.fg)};--acc:${esc(art.acc)}`;

  return `<div class="cover ${cls}" style="${vars}">
    <div class="cover-fallback">
      ${motifSVG(art.motif)}
      <div class="cf-top">
        <span class="cf-genre">${esc(book.genre || '')}</span>
        <span class="cf-year">${esc(book.year ?? '')}</span>
      </div>
      <div class="cf-text">
        <div class="cf-title">${esc(book.title)}</div>
        <div class="cf-rule"></div>
        <div class="cf-author">${esc(book.author)}</div>
      </div>
    </div>
    <div class="cover-gloss"></div>
  </div>`;
}

/** Цвета обложки — нужны стопке, где книга видна только корешком. */
export function artOf(book) {
  return { ...DEFAULT_ART, ...(book.art || {}) };
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

/* ── прочее ───────────────────────────────────────────────────────────── */

/** Плавное появление элементов по очереди. */
export function stagger(nodes, step = 55, base = 90) {
  [...nodes].forEach((el, i) => {
    el.style.setProperty('--delay', `${base + i * step}ms`);
    el.classList.add('rise');
  });
}

/* ── ввод оценки: кружки 1…N ───────────────────────────────────────────
   Балл ставится кликом по цифре, а не набором с клавиатуры: критерий и под
   ним ряд кружков. Повторный клик по выбранной цифре снимает оценку.
   Один и тот же элемент используют и редактор карточки, и форма добавления,
   поэтому текущее значение живёт в data-value самого блока — читать форму
   можно, ничего про неё не зная. */

export function scorePickerHTML(member, crit, value) {
  const n = state.club.scale || 10;
  const v = typeof value === 'number' ? value : null;
  const pips = Array.from({ length: n }, (_, i) => i + 1).map(x =>
    `<button type="button" class="pip${x === v ? ' on' : ''}" data-v="${x}"
       role="radio" aria-checked="${x === v}"
       aria-label="${esc(crit.label)}, ${esc(member.name)}: ${x} из ${n}">${x}</button>`).join('');

  return `<div class="pick" data-member="${esc(member.id)}" data-crit="${esc(crit.id)}"
       data-value="${v ?? ''}">
    <div class="pick-head">
      <span class="pick-label">${esc(crit.label)}</span>
      <span class="pick-val">${v ?? '—'}</span>
    </div>
    <div class="pick-row" role="radiogroup"
      aria-label="${esc(crit.label)} — ${esc(member.name)}">${pips}</div>
  </div>`;
}

export function rereadPickerHTML(member, value) {
  const cur = value === true ? 'yes' : value === false ? 'no' : '';
  const opt = (v, label, ic) => `<button type="button" class="rr-btn${cur === v ? ' on' : ''}"
      data-reread="${v}" aria-pressed="${cur === v}">${icon(ic)}<span>${label}</span></button>`;
  return `<div class="reread-pick" data-member="${esc(member.id)}" data-value="${cur}">
    <span class="pick-label">Перечитаешь?</span>
    <div class="rr-choice">${opt('yes', 'да', 'thumb-up')}${opt('no', 'нет', 'thumb-down')}</div>
  </div>`;
}

/** Один делегированный обработчик на все кружки внутри root. */
export function wirePickers(root, onChange = () => {}) {
  root.addEventListener('click', e => {
    const pip = e.target.closest('.pip');
    if (pip) {
      const pick = pip.closest('.pick');
      const next = pick.dataset.value === pip.dataset.v ? '' : pip.dataset.v;
      pick.dataset.value = next;
      pick.querySelector('.pick-val').textContent = next || '—';
      pick.querySelectorAll('.pip').forEach(p => {
        const on = p.dataset.v === next;
        p.classList.toggle('on', on);
        p.setAttribute('aria-checked', String(on));
      });
      onChange(pick.dataset.member);
      return;
    }
    const rr = e.target.closest('.rr-btn');
    if (!rr) return;
    const box = rr.closest('.reread-pick');
    const next = box.dataset.value === rr.dataset.reread ? '' : rr.dataset.reread;
    box.dataset.value = next;
    box.querySelectorAll('.rr-btn').forEach(b => {
      const on = b.dataset.reread === next;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    onChange(box.dataset.member);
  });
}

/** Всё, что накликал участник, — из любого куска разметки с .pick. */
export function readPicked(root, memberId) {
  const sel = `[data-member="${CSS.escape(memberId)}"]`;
  const scores = {};
  root.querySelectorAll(`.pick${sel}`).forEach(p => {
    const v = Number(p.dataset.value);
    if (v > 0) scores[p.dataset.crit] = v;
  });
  const rr = root.querySelector(`.reread-pick${sel}`)?.dataset.value;
  return { scores, reread: rr === 'yes' ? true : rr === 'no' ? false : null };
}

/** Средний балл по уже накликанным кружкам — для живого пересчёта в форме. */
export function pickedMean(root, memberId) {
  const vals = [...root.querySelectorAll(`.pick[data-member="${CSS.escape(memberId)}"]`)]
    .map(p => Number(p.dataset.value)).filter(v => v > 0);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}
