/* Окно «Поделиться»: карусель карточек 9:16 и кнопка «Скачать» под каждой.
 *
 * Превью рисуются уменьшенными — держать пять полноразмерных холстов
 * 1080×1920 в памяти незачем; при скачивании карточка перерисовывается
 * в полном размере во временный canvas. */

import { slugify } from './data.js';
import { esc } from './ui.js';
import { icon, hydrateIcons } from './icons.js';
import { openModal } from './modal.js';
import { cardsFor, renderCard, ensureFonts, W, H } from './sharecards.js';

const PREVIEW_W = 420;     // ширина холста для превью, px

export function openShareModal(book) {
  const cards = cardsFor(book);

  const body = openModal('Поделиться', `
    <p class="field-hint share-hint">Карточки 9:16 — под сторис. Пролистайте
      и скачайте ту, что понравится.</p>
    <div class="share-strip" id="shareStrip">
      ${cards.map((c, i) => `<figure class="share-card" data-i="${i}">
        <canvas class="share-canvas" aria-label="${esc(c.name)}"></canvas>
        <figcaption>${esc(c.name)}</figcaption>
        <button type="button" class="btn btn-ghost share-dl" data-i="${i}">
          ${icon('download')} Скачать
        </button>
      </figure>`).join('')}
    </div>
    <div class="share-dots" id="shareDots">
      ${cards.map((c, i) => `<button type="button" class="share-dot" data-i="${i}"
        aria-label="${esc(c.name)}"${i ? '' : ' aria-current="true"'}></button>`).join('')}
    </div>
  `, 'modal-share');

  hydrateIcons(body);

  const strip = body.querySelector('#shareStrip');
  const canvases = [...body.querySelectorAll('.share-canvas')];

  // Шрифты нужны до первой отрисовки: canvas берёт только уже загруженные,
  // иначе заголовки уедут в подстановочный шрифт.
  ensureFonts().then(() => {
    canvases.forEach((cv, i) => renderCard(cv, cards[i], PREVIEW_W));
  });

  body.addEventListener('click', e => {
    const dl = e.target.closest('.share-dl');
    if (dl) { download(book, cards[+dl.dataset.i]); return; }
    const dot = e.target.closest('.share-dot');
    if (dot) {
      strip.children[+dot.dataset.i]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  });

  // Точка под каруселью подсвечивает карточку, которая сейчас по центру.
  strip.addEventListener('scroll', () => {
    const mid = strip.scrollLeft + strip.clientWidth / 2;
    let best = 0, bestD = Infinity;
    [...strip.children].forEach((el, i) => {
      const d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - mid);
      if (d < bestD) { bestD = d; best = i; }
    });
    body.querySelectorAll('.share-dot').forEach((d, i) =>
      d.toggleAttribute('aria-current', i === best));
  }, { passive: true });
}

/** Перерисовывает карточку в полном размере и отдаёт файл. */
async function download(book, card) {
  await ensureFonts();
  const cv = document.createElement('canvas');
  renderCard(cv, card, W);
  const blob = await new Promise(res => cv.toBlob(res, 'image/png'));
  if (!blob) return;

  const filename = `${slugify(book.title)}-${card.id}.png`;

  // В предпросмотре артефакта Claude страница не может скачивать файлы сама —
  // там для этого есть отдельный механизм. На обычном сайте его нет, поэтому
  // сначала пробуем его, а если не отвечает, работаем обычной ссылкой.
  const save = await globalThis.claude?.use?.('downloads').catch(() => null);
  if (save) {
    try { await save.save({ filename, data: blob }); } catch { /* отказались */ }
    return;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Отзываем ссылку не сразу: Safari начинает скачивание не мгновенно.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export { W as CARD_W, H as CARD_H };
