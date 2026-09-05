/* Карточки «Поделиться»: картинки 9:16 для сторис.
 *
 * Рисуются на canvas, а не вёрсткой: только так получается настоящий PNG,
 * который можно скачать и выложить. Все размеры в координатах 1080×1920 —
 * контекст масштабируется под нужный размер перед отрисовкой, поэтому один
 * и тот же код даёт и превью в окне, и полноразмерный файл.
 *
 * Цвета берутся из тех же переменных, что и сайт, так что смена палитры
 * подхватывается сама. Шрифты — те же Instrument Serif и Inter; перед
 * отрисовкой их загрузку нужно дождаться (ensureFonts). */

import { state, avg, memberScore, num, fmtDate } from './data.js';
import { artOf } from './ui.js';

export const W = 1080;
export const H = 1920;

const scale = () => state.club.scale || 10;

/* ── общее ────────────────────────────────────────────────────────────── */

function palette() {
  const cs = getComputedStyle(document.documentElement);
  const v = n => cs.getPropertyValue(n).trim();
  return {
    paper: v('--void') || '#fcf3e9',
    paper2: v('--void-2') || '#fffbf6',
    ink: v('--ink') || '#2b1c14',
    dim: v('--dim') || 'rgba(43,28,20,.64)',
    faint: v('--faint') || 'rgba(43,28,20,.42)',
    rule: v('--rule') || 'rgba(43,28,20,.13)',
    gold: v('--gold') || '#650e14',
    peach: v('--peach') || '#f9d1ad'
  };
}

const SERIF = '"Instrument Serif", Georgia, serif';
const SANS = '"Inter", system-ui, sans-serif';

let fontsReady = null;

/** Canvas берёт шрифты из документа, но только уже загруженные. */
export function ensureFonts() {
  if (fontsReady) return fontsReady;
  const need = [
    `400 120px ${SERIF}`, `400 50px ${SERIF}`, `italic 400 50px ${SERIF}`,
    `400 40px ${SANS}`, `500 40px ${SANS}`, `600 40px ${SANS}`
  ];
  fontsReady = Promise.all(need.map(f => document.fonts.load(f).catch(() => {})))
    .then(() => document.fonts.ready)
    .catch(() => {});
  return fontsReady;
}

function wrap(ctx, text, maxW) {
  const lines = [];
  let line = '';
  for (const word of String(text).split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxW) { lines.push(line); line = word; }
    else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** Рисует абзац и возвращает Y под ним. */
function para(ctx, text, { x, y, maxW, font, color, lh, align = 'center', maxLines = 99 }) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  let lines = wrap(ctx, text, maxW);
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    lines[maxLines - 1] = lines[maxLines - 1].replace(/[.,;:!?]?$/, '…');
  }
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lh));
  return y + (lines.length - 1) * lh;
}

/** Высота абзаца без отрисовки — нужна, чтобы блок встал по центру. */
function paraHeight(ctx, text, { maxW, font, lh, maxLines = 99 }) {
  ctx.font = font;
  return (Math.min(wrap(ctx, text, maxW).length, maxLines) - 1) * lh;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Логотип клуба — тот же, что в шапке сайта: антиква, «the» курсивом и
 * приглушённым цветом. Три куска приходится мерить и складывать вручную,
 * потому что canvas рисует одним шрифтом за раз.
 */
function wordmark(ctx, x, y, size, color) {
  const regular = `400 ${size}px ${SERIF}`;
  const italic = `italic 400 ${size}px ${SERIF}`;

  ctx.textAlign = 'left';
  ctx.font = regular; const w1 = ctx.measureText('Between').width;
  ctx.font = italic;  const w2 = ctx.measureText(' the ').width;
  ctx.font = regular; const w3 = ctx.measureText('Lines').width;

  let cx = x - (w1 + w2 + w3) / 2;
  ctx.fillStyle = color;

  ctx.font = regular;
  ctx.fillText('Between', cx, y);
  cx += w1;

  ctx.font = italic;
  ctx.globalAlpha = .55;
  ctx.fillText(' the ', cx, y);
  ctx.globalAlpha = 1;
  cx += w2;

  ctx.font = regular;
  ctx.fillText('Lines', cx, y);
  ctx.textAlign = 'center';
}

/** Подпись клуба внизу — она есть на каждой карточке. */
function footer(ctx, color) {
  wordmark(ctx, W / 2, H - 104, 50, color);
}

function bigScore(ctx, mean, { x, y, color, sub }) {
  if (mean == null) return;
  ctx.textAlign = 'center';
  ctx.font = `400 190px ${SERIF}`;
  ctx.fillStyle = color;
  const value = num(mean);
  const wv = ctx.measureText(value).width;
  ctx.font = `400 70px ${SERIF}`;
  const wt = ctx.measureText(`/${scale()}`).width;
  const left = x - (wv + wt) / 2;

  ctx.textAlign = 'left';
  ctx.font = `400 190px ${SERIF}`;
  ctx.fillText(value, left, y);
  ctx.font = `400 70px ${SERIF}`;
  ctx.globalAlpha = .5;
  ctx.fillText(`/${scale()}`, left + wv, y);
  ctx.globalAlpha = 1;

  if (sub) {
    ctx.textAlign = 'center';
    ctx.font = `500 26px ${SANS}`;
    ctx.letterSpacing = '5px';
    ctx.fillStyle = color;
    ctx.globalAlpha = .55;
    ctx.fillText(sub.toUpperCase(), x, y + 54);
    ctx.globalAlpha = 1;
    ctx.letterSpacing = '0px';
  }
}

/** Бейдж-пилюля: рамка и мелкая прописная подпись, как на самом сайте. */
function badge(ctx, text, x, y, color) {
  ctx.font = `500 24px ${SANS}`;
  ctx.letterSpacing = '3px';
  ctx.textAlign = 'left';
  const label = text.toUpperCase();
  const w = ctx.measureText(label).width + 40;
  const h = 44;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  roundRect(ctx, x, y - h / 2, w, h, h / 2);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.fillText(label, x + 20, y + 9);
  ctx.letterSpacing = '0px';
  return w;
}

function avatar(ctx, member, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = member.color;
  ctx.fill();
  ctx.fillStyle = 'rgba(43,28,20,.82)';
  ctx.font = `600 ${Math.round(r * 0.95)}px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(member.initial, x, y + 1);
  ctx.textBaseline = 'alphabetic';
}

/* ── карточка 1: обложка и балл ───────────────────────────────────────── */

function drawCover(ctx, book) {
  const art = artOf(book);
  const mean = avg(book);

  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, art.bg);
  g.addColorStop(1, shade(art.bg, -14));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Два акцентных пятна — эхо рисунка на обложке; второе внизу слева,
  // иначе вся тяжесть композиции уходит вправо вверх.
  ctx.fillStyle = art.acc;
  ctx.globalAlpha = .2;
  ctx.beginPath(); ctx.arc(W * 0.82, H * 0.14, 290, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = .12;
  ctx.beginPath(); ctx.arc(W * 0.1, H * 0.86, 220, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;

  // Высота всего блока считается заранее, чтобы он встал ровно по центру
  // и не оставлял пустую половину карточки.
  const titleOpts = { maxW: 840, font: `400 108px ${SERIF}`, lh: 116, maxLines: 4 };
  const titleH = paraHeight(ctx, book.title, titleOpts);
  const total = 26 + 96 + titleH + 96 + 46 + 84 + 116 + 140 + 54;

  let y = (H - total) / 2 + 26;

  ctx.textAlign = 'center';
  ctx.font = `500 26px ${SANS}`;
  ctx.letterSpacing = '8px';
  ctx.fillStyle = art.fg;
  ctx.globalAlpha = .6;
  ctx.fillText(String(book.genre || '').toUpperCase(), W / 2, y);
  ctx.globalAlpha = 1;
  ctx.letterSpacing = '0px';

  y += 96;
  y = para(ctx, book.title, { ...titleOpts, x: W / 2, y, color: art.fg });

  y += 96;
  ctx.font = `italic 400 46px ${SERIF}`;
  ctx.fillStyle = art.fg;
  ctx.globalAlpha = .74;
  ctx.fillText(book.author, W / 2, y);
  ctx.globalAlpha = 1;

  y += 84;
  ctx.strokeStyle = art.acc;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 60, y); ctx.lineTo(W / 2 + 60, y);
  ctx.stroke();

  y += 256;
  bigScore(ctx, mean, { x: W / 2, y, color: art.fg, sub: 'средний балл клуба' });

  if (book.discussed) {
    ctx.textAlign = 'center';
    ctx.font = `400 30px ${SANS}`;
    ctx.fillStyle = art.fg;
    ctx.globalAlpha = .5;
    ctx.fillText(`обсуждали ${fmtDate(book.discussed)}`, W / 2, H - 190);
    ctx.globalAlpha = 1;
  }
  footer(ctx, art.fg);
}

/* ── карточка 2: цитата ───────────────────────────────────────────────── */

function drawQuote(ctx, book, { line, member, kind }) {
  const p = palette();
  ctx.fillStyle = p.paper;
  ctx.fillRect(0, 0, W, H);

  const art = artOf(book);
  ctx.globalAlpha = .32;
  const g = ctx.createRadialGradient(W / 2, H * 0.26, 40, W / 2, H * 0.26, 620);
  g.addColorStop(0, art.acc);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;

  ctx.textAlign = 'center';
  ctx.font = `400 200px ${SERIF}`;
  ctx.fillStyle = p.gold;
  ctx.globalAlpha = .22;
  ctx.fillText('«', W / 2, 360);
  ctx.globalAlpha = 1;

  const opts = { maxW: 860, font: `400 86px ${SERIF}`, lh: 104, maxLines: 8 };
  const h = paraHeight(ctx, line.text, opts);
  const y = (H - h) / 2 - 40;
  const bottom = para(ctx, line.text, { ...opts, x: W / 2, y, color: p.ink });

  ctx.font = `500 34px ${SANS}`;
  ctx.fillStyle = p.gold;
  ctx.fillText(`— ${member.name}`, W / 2, bottom + 120);

  if (kind === 'book') {
    ctx.font = `500 24px ${SANS}`;
    ctx.letterSpacing = '5px';
    ctx.fillStyle = p.faint;
    ctx.fillText('ЦИТАТА ИЗ КНИГИ', W / 2, bottom + 176);
    ctx.letterSpacing = '0px';
  }

  ctx.font = `400 44px ${SERIF}`;
  ctx.fillStyle = p.ink;
  const tb = para(ctx, book.title, {
    x: W / 2, y: H - 320, maxW: 820, font: `400 52px ${SERIF}`,
    color: p.ink, lh: 60, maxLines: 2
  });
  ctx.font = `italic 400 32px ${SERIF}`;
  ctx.fillStyle = p.dim;
  ctx.fillText(book.author, W / 2, tb + 56);

  const mean = avg(book);
  if (mean != null) {
    ctx.font = `500 30px ${SANS}`;
    ctx.fillStyle = p.gold;
    ctx.fillText(`${num(mean)} / ${scale()}`, W / 2, tb + 120);
  }
  footer(ctx, p.dim);
}

/* ── карточка 3: оценки участниц ──────────────────────────────────────── */

function drawScores(ctx, book) {
  const p = palette();
  const art = artOf(book);
  const mean = avg(book);

  const rated = state.members
    .map(m => ({ m, mean: memberScore(book, m.id), reread: book.reviews?.[m.id]?.reread }))
    .filter(x => x.mean != null);

  // Тёмная шапка растёт по названию, а не задана числом: у длинных названий
  // текст иначе упирался в её край, у коротких оставалась пустая полоса.
  const titleOpts = { maxW: 840, font: `400 84px ${SERIF}`, lh: 92, maxLines: 3 };
  const titleH = paraHeight(ctx, book.title, titleOpts);
  const headH = 200 + titleH + 92 + 60 + 90;

  ctx.fillStyle = p.paper;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = art.bg;
  ctx.fillRect(0, 0, W, headH);

  ctx.textAlign = 'center';
  ctx.font = `500 26px ${SANS}`;
  ctx.letterSpacing = '8px';
  ctx.fillStyle = art.fg;
  ctx.globalAlpha = .6;
  ctx.fillText('ОЦЕНКИ КЛУБА', W / 2, 190);
  ctx.globalAlpha = 1;
  ctx.letterSpacing = '0px';

  const tb = para(ctx, book.title, { ...titleOpts, x: W / 2, y: 200 + 92, color: art.fg });
  ctx.font = `italic 400 38px ${SERIF}`;
  ctx.fillStyle = art.fg;
  ctx.globalAlpha = .72;
  ctx.fillText(book.author, W / 2, tb + 60);
  ctx.globalAlpha = 1;

  // Строки участниц равномерно занимают всё, что осталось до среднего балла.
  const avgBlockTop = H - 480;
  const zone = avgBlockTop - headH;
  const rowH = Math.min(230, zone / Math.max(rated.length, 1));
  let y = headH + (zone - rowH * rated.length) / 2 + rowH / 2;

  rated.forEach(({ m, mean: mv, reread }) => {
    avatar(ctx, m, 152, y - 26, 48);

    ctx.textAlign = 'left';
    ctx.font = `400 54px ${SERIF}`;
    ctx.fillStyle = p.ink;
    ctx.fillText(m.name, 234, y - 8);

    if (reread != null) {
      badge(ctx, reread ? 'перечитает' : 'не перечитает', 234, y + 30,
            reread ? '#4f8f66' : '#c07a68');
    }

    ctx.textAlign = 'right';
    ctx.font = `400 92px ${SERIF}`;
    ctx.fillStyle = p.gold;
    ctx.fillText(num(mv), W - 130, y + 10);

    const barY = y + 74;
    ctx.fillStyle = 'rgba(43,28,20,.10)';
    roundRect(ctx, 152, barY, W - 284, 16, 8);
    ctx.fill();
    ctx.fillStyle = m.color;
    roundRect(ctx, 152, barY, (W - 284) * (mv / scale()), 16, 8);
    ctx.fill();

    y += rowH;
  });

  if (mean != null) {
    ctx.textAlign = 'center';
    ctx.font = `500 26px ${SANS}`;
    ctx.letterSpacing = '6px';
    ctx.fillStyle = p.faint;
    ctx.fillText('СРЕДНИЙ БАЛЛ', W / 2, avgBlockTop + 90);
    ctx.letterSpacing = '0px';
    ctx.font = `400 130px ${SERIF}`;
    ctx.fillStyle = p.gold;
    ctx.fillText(`${num(mean)} / ${scale()}`, W / 2, avgBlockTop + 220);
  }
  footer(ctx, p.dim);
}

/* ── карточка 4: профиль по критериям ─────────────────────────────────── */

function drawRadar(ctx, book) {
  const p = palette();
  const art = artOf(book);
  const crits = state.criteria;
  const n = crits.length;

  ctx.fillStyle = art.bg;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.font = `500 26px ${SANS}`;
  ctx.letterSpacing = '8px';
  ctx.fillStyle = art.fg;
  ctx.globalAlpha = .6;
  ctx.fillText('ПРОФИЛЬ КНИГИ', W / 2, 210);
  ctx.globalAlpha = 1;
  ctx.letterSpacing = '0px';

  const cx = W / 2, cy = 880, R = 290;
  const ang = i => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pt = (i, v) => [cx + R * (v / scale()) * Math.cos(ang(i)),
                        cy + R * (v / scale()) * Math.sin(ang(i))];

  const poly = vals => {
    ctx.beginPath();
    vals.forEach((v, i) => { const [x, y] = pt(i, v); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.closePath();
  };

  ctx.globalAlpha = .3;
  ctx.strokeStyle = art.fg;
  ctx.lineWidth = 2;
  [2, 4, 6, 8, 10].forEach(v => { poly(crits.map(() => v)); ctx.stroke(); });
  crits.forEach((_, i) => {
    const [x, y] = pt(i, scale());
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke();
  });
  ctx.globalAlpha = 1;

  state.members.forEach(m => {
    const vals = crits.map(c => memberScore(book, m.id, c.id));
    if (vals.some(v => typeof v !== 'number')) return;
    poly(vals);
    ctx.strokeStyle = m.color;
    ctx.lineWidth = 4;
    ctx.globalAlpha = .8;
    ctx.stroke();
    ctx.globalAlpha = 1;
  });

  const means = crits.map(c => avg(book, c.id) ?? 0);
  poly(means);
  ctx.fillStyle = art.acc;
  ctx.globalAlpha = .3;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = art.acc;
  ctx.lineWidth = 7;
  ctx.lineJoin = 'round';
  ctx.stroke();

  ctx.font = `500 30px ${SANS}`;
  ctx.fillStyle = art.fg;
  const PAD = 60;
  crits.forEach((c, i) => {
    const a = ang(i);
    const label = c.short || c.label;
    const align = Math.abs(Math.cos(a)) < .3 ? 'center' : (Math.cos(a) > 0 ? 'left' : 'right');
    const tw = ctx.measureText(label).width;
    // Подпись прижимается к полю карточки вместе со своей шириной — просто
    // ограничить точку привязки мало, текст всё равно уезжал за край.
    let x = cx + (R + 62) * Math.cos(a);
    if (align === 'left') x = Math.min(x, W - PAD - tw);
    else if (align === 'right') x = Math.max(x, PAD + tw);
    else x = Math.max(PAD + tw / 2, Math.min(W - PAD - tw / 2, x));

    ctx.textAlign = align;
    ctx.globalAlpha = .8;
    ctx.fillText(label, x, cy + (R + 62) * Math.sin(a) + 10);
    ctx.globalAlpha = 1;
  });

  ctx.textAlign = 'center';
  const tb = para(ctx, book.title, {
    x: W / 2, y: 1470, maxW: 840, font: `400 74px ${SERIF}`,
    color: art.fg, lh: 84, maxLines: 2
  });
  ctx.font = `italic 400 36px ${SERIF}`;
  ctx.fillStyle = art.fg;
  ctx.globalAlpha = .72;
  ctx.fillText(book.author, W / 2, tb + 68);
  ctx.globalAlpha = 1;
  footer(ctx, art.fg);
}

/* ── карточка 5: впечатление участницы ────────────────────────────────── */

/**
 * Отзыв целиком, по одной карточке на человека. Кегль подбирается под длину:
 * короткое впечатление читается крупно, длинное всё равно помещается.
 */
function drawImpression(ctx, book, { member, text }) {
  const p = palette();
  const art = artOf(book);

  ctx.fillStyle = p.paper;
  ctx.fillRect(0, 0, W, H);

  // Цветная полоса сверху — цвет участницы, чтобы карточки различались.
  ctx.fillStyle = member.color;
  ctx.fillRect(0, 0, W, 10);
  ctx.globalAlpha = .16;
  const g = ctx.createLinearGradient(0, 0, 0, 620);
  g.addColorStop(0, member.color);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, 620);
  ctx.globalAlpha = 1;

  avatar(ctx, member, W / 2, 260, 62);

  ctx.textAlign = 'center';
  ctx.font = `400 56px ${SERIF}`;
  ctx.fillStyle = p.ink;
  ctx.fillText(member.name, W / 2, 400);

  const mine = memberScore(book, member.id);
  if (mine != null) {
    ctx.font = `500 26px ${SANS}`;
    ctx.letterSpacing = '5px';
    ctx.fillStyle = p.gold;
    ctx.fillText(`${num(mine)} ИЗ ${scale()}`, W / 2, 456);
    ctx.letterSpacing = '0px';
  }

  const len = String(text).length;
  const [size, lh] = len <= 160 ? [64, 80]
    : len <= 380 ? [52, 66]
    : len <= 700 ? [44, 56]
    : [38, 48];

  const top = 580, bottomLimit = H - 440;
  const opts = {
    maxW: 860, font: `400 ${size}px ${SERIF}`, lh,
    maxLines: Math.max(4, Math.floor((bottomLimit - top) / lh))
  };
  const h = paraHeight(ctx, text, opts);
  const y = top + Math.max(0, (bottomLimit - top - h) / 2);
  para(ctx, text, { ...opts, x: W / 2, y, color: p.ink });

  ctx.fillStyle = art.acc;
  ctx.globalAlpha = .3;
  roundRect(ctx, 120, H - 410, W - 240, 4, 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  const tb = para(ctx, book.title, {
    x: W / 2, y: H - 320, maxW: 840, font: `400 56px ${SERIF}`,
    color: p.ink, lh: 64, maxLines: 2
  });
  ctx.font = `italic 400 34px ${SERIF}`;
  ctx.fillStyle = p.dim;
  ctx.textAlign = 'center';
  ctx.fillText(book.author, W / 2, tb + 58);
  footer(ctx, p.dim);
}

/* ── подбор цвета ─────────────────────────────────────────────────────── */

/** Осветляет или затемняет hex-цвет на заданный процент. */
function shade(hex, pct) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    .map(c => Math.max(0, Math.min(255, Math.round(c + (pct / 100) * 255))));
  return `rgb(${ch.join(',')})`;
}

/* ── список карточек для книги ────────────────────────────────────────── */

function linesOf(book) {
  const out = [];
  state.members.forEach(m => {
    const rev = book.reviews?.[m.id];
    if (rev?.quote?.text) out.push({ member: m, line: rev.quote, kind: 'book' });
    if (rev?.line?.text) out.push({ member: m, line: rev.line, kind: 'club' });
  });
  return out;
}

/** Какие карточки имеет смысл рисовать для этой книги. */
export function cardsFor(book) {
  const cards = [{ id: 'cover', name: 'Обложка', draw: c => drawCover(c, book) }];

  linesOf(book).slice(0, 3).forEach(({ member, line, kind }, i) => {
    cards.push({
      id: `${kind === 'book' ? 'quote' : 'line'}-${member.id}`,
      name: i === 0 ? 'Цитата' : `Цитата · ${member.name}`,
      draw: c => drawQuote(c, book, { line, member, kind })
    });
  });

  state.members.forEach(m => {
    const text = book.reviews?.[m.id]?.text;
    if (!text) return;
    cards.push({
      id: `note-${m.id}`,
      name: `Впечатление · ${m.name}`,
      draw: c => drawImpression(c, book, { member: m, text })
    });
  });

  const rated = state.members.filter(m => memberScore(book, m.id) != null);
  if (rated.length) {
    cards.push({ id: 'scores', name: 'Оценки', draw: c => drawScores(c, book) });
    cards.push({ id: 'radar', name: 'Профиль', draw: c => drawRadar(c, book) });
  }
  return cards;
}

/** Рисует карточку в готовый canvas нужного размера. */
export function renderCard(canvas, card, px = W) {
  const dpr = px === W ? 1 : 1;         // превью и так рисуется в своём размере
  canvas.width = Math.round(px * dpr);
  canvas.height = Math.round(px * (H / W) * dpr);
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.scale(canvas.width / W, canvas.height / H);
  card.draw(ctx);
  ctx.restore();
  return canvas;
}
