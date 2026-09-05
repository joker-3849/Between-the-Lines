/* Замок на правку: добавление, изменение и удаление книги спрашивают фразу.
 *
 * Это именно замок-щеколда, а не защита. Сайт статический: код открыт,
 * хеш фразы лежит в том же репозитории, а сами правки всё равно никуда не
 * сохраняются — они живут в памяти вкладки и попадают в data/books.json
 * только через коммит. То есть настоящий доступ определяется правом писать
 * в репозиторий, а фраза лишь бережёт полку от случайных нажатий и чужих
 * глаз. Если понадобится настоящее разграничение доступа, нужен сервер.
 *
 * Фраза не хранится: в club.json лежит SHA-256 от неё в нижнем регистре и
 * без крайних пробелов. Нет поля editPass — замка нет вовсе. */

import { state } from './data.js';
import { openModal, closeModal } from './modal.js';
import { icon } from './icons.js';

const KEY = 'btl.unlocked';

async function sha256(text) {
  // crypto.subtle есть только в защищённом контексте: https или localhost.
  // По file:// его нет — там замок не работает, о чём и сообщаем.
  if (!globalThis.crypto?.subtle) return null;
  const data = new TextEncoder().encode(text.trim().toLowerCase());
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

const passHash = () => state.club?.editPass || '';

/** Замок вообще настроен? */
export function locked() { return Boolean(passHash()); }

/** Уже открывали в этом браузере? */
export function unlocked() {
  if (!locked()) return true;
  try { return localStorage.getItem(KEY) === passHash(); } catch { return false; }
}

/** Забыть фразу — полка снова спросит её при следующей правке. */
export function forget() {
  try { localStorage.removeItem(KEY); } catch { /* приватный режим */ }
}

/**
 * Пускает к правке: если замок открыт — сразу, иначе спрашивает фразу.
 * Возвращает промис, который разрешается true только при успехе.
 */
export function requireUnlock() {
  if (unlocked()) return Promise.resolve(true);

  return new Promise(resolve => {
    const body = openModal('Правка полки', `
      <form id="lockForm" novalidate>
        <p class="field-hint" style="margin:-4px 0 16px">
          Добавлять и менять книги может тот, кто знает фразу клуба.
        </p>
        <div class="field">
          <label for="lockPass">Фраза</label>
          <input id="lockPass" type="password" autocomplete="current-password"
            autocapitalize="off" spellcheck="false">
          <p class="field-hint" id="lockError" hidden>Не подходит. Попробуйте ещё раз.</p>
        </div>
        <div class="modal-actions">
          <button type="submit" class="btn btn-primary">${icon('check')} Открыть</button>
          <button type="button" class="btn btn-ghost" id="lockCancel">Отмена</button>
        </div>
      </form>
    `, 'modal-lock');

    const input = body.querySelector('#lockPass');
    const error = body.querySelector('#lockError');
    let done = false;

    const finish = ok => { if (!done) { done = true; resolve(ok); } };

    body.querySelector('#lockCancel').addEventListener('click', () => { closeModal(); finish(false); });
    body.querySelector('#lockForm').addEventListener('submit', async e => {
      e.preventDefault();
      const hash = await sha256(input.value);

      if (hash === null) {
        error.textContent = 'Проверить фразу можно только на сайте по https '
          + 'или на localhost — по file:// браузер не даёт этого сделать.';
        error.hidden = false;
        return;
      }
      if (hash !== passHash()) {
        error.textContent = 'Не подходит. Попробуйте ещё раз.';
        error.hidden = false;
        input.select();
        return;
      }
      try { localStorage.setItem(KEY, passHash()); } catch { /* приватный режим */ }
      closeModal();
      finish(true);
    });

    // Закрыли крестиком или по Esc — считаем отказом.
    const overlay = document.getElementById('appModal');
    const watch = new MutationObserver(() => { if (overlay.hidden) { watch.disconnect(); finish(false); } });
    watch.observe(overlay, { attributes: true, attributeFilter: ['hidden'] });

    input.focus();
  });
}
