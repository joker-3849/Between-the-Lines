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
import { icon, hydrateIcons } from './icons.js';

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

/** Запомнить, что замок открыт этой фразой (хеш — он же и ключ). */
function latch(hash) {
  try { localStorage.setItem(KEY, hash); } catch { /* приватный режим */ }
}

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
          <button type="button" class="link" id="lockChange">Сменить фразу</button>
        </div>
      </form>
    `, 'modal-lock');

    const input = body.querySelector('#lockPass');
    const error = body.querySelector('#lockError');
    let done = false;

    const finish = ok => { if (!done) { done = true; resolve(ok); } };

    body.querySelector('#lockCancel').addEventListener('click', () => { closeModal(); finish(false); });
    // Смена фразы всё равно спросит текущую, поэтому она доступна и отсюда:
    // правку это окно не открывает, поэтому запрос считается отменённым.
    body.querySelector('#lockChange').addEventListener('click', () => { finish(false); openLockSettings(); });
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
      latch(passHash());
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

/* ── смена фразы ──────────────────────────────────────────────────────── */

/**
 * Меняет фразу клуба. Требует текущую — знать её достаточно, отдельных
 * ролей на статическом сайте нет.
 *
 * Сама фраза никуда не сохраняется: браузер считает от неё SHA-256 и
 * показывает готовую строку для data/club.json. Пока новый хеш не попал
 * в репозиторий, смена живёт только в этой вкладке — как и правки книг.
 */
export function openLockSettings() {
  const body = openModal('Фраза клуба', `
    <form id="passForm" novalidate>
      <p class="field-hint" style="margin:-4px 0 18px">
        Фразу знают все, кто правит полку. Чтобы сменить её, нужно назвать
        текущую — других прав на статическом сайте нет.
      </p>
      <div class="field">
        <label for="passOld">Текущая фраза</label>
        <input id="passOld" type="password" autocomplete="current-password"
          autocapitalize="off" spellcheck="false">
      </div>
      <div class="field-row">
        <div class="field">
          <label for="passNew">Новая фраза</label>
          <input id="passNew" type="password" autocomplete="new-password"
            autocapitalize="off" spellcheck="false">
        </div>
        <div class="field">
          <label for="passNew2">Ещё раз</label>
          <input id="passNew2" type="password" autocomplete="new-password"
            autocapitalize="off" spellcheck="false">
        </div>
      </div>
      <p class="field-hint" id="passError" hidden></p>
      <div class="modal-actions">
        <button type="submit" class="btn btn-primary">${icon('check')} Сменить фразу</button>
        <button type="button" class="btn btn-ghost" id="passClose">Отмена</button>
        ${unlocked() ? `<button type="button" class="link" id="passForget">Забыть фразу на этом устройстве</button>` : ''}
      </div>
    </form>
  `, 'modal-lock');

  const oldInput = body.querySelector('#passOld');
  const a = body.querySelector('#passNew');
  const b = body.querySelector('#passNew2');
  const error = body.querySelector('#passError');
  const fail = text => { error.textContent = text; error.hidden = false; };

  body.querySelector('#passClose').addEventListener('click', closeModal);
  body.querySelector('#passForget')?.addEventListener('click', () => {
    forget();
    closeModal();
  });

  body.querySelector('#passForm').addEventListener('submit', async e => {
    e.preventDefault();
    error.hidden = true;

    const next = a.value.trim();
    if (next.length < 4) return fail('Новая фраза короче четырёх знаков — так замок не держит.');
    if (next.toLowerCase() !== b.value.trim().toLowerCase()) return fail('Оба поля с новой фразой должны совпадать.');

    const [oldHash, newHash] = await Promise.all([sha256(oldInput.value), sha256(next)]);
    if (oldHash === null) {
      return fail('Сменить фразу можно только на сайте по https или на localhost — '
        + 'по file:// браузер не даёт считать хеш.');
    }
    if (oldHash !== passHash()) { oldInput.select(); return fail('Текущая фраза не подходит.'); }
    if (newHash === passHash()) return fail('Новая фраза совпадает с текущей.');

    // В этой вкладке фраза уже новая; в репозитории — только после коммита.
    state.club.editPass = newHash;
    latch(newHash);
    showPassJSON(newHash);
  });

  oldInput.focus();
}

function showPassJSON(hash) {
  const line = `"editPass": "${hash}"`;
  const body = openModal('Фраза клуба сменилась', `
    <p class="field-hint">В этой вкладке новая фраза уже работает. Чтобы она осталась
      насовсем, замените строку <code>editPass</code> в <code>data/club.json</code> на эту
      и закоммитьте — сайт статический и в файлы сам не пишет.</p>
    <textarea class="export-json" id="passJson" readonly spellcheck="false"
      style="min-height:96px">${line}</textarea>
    <p class="field-hint">Сама фраза нигде не хранится — только этот SHA-256. Забудете её —
      восстановить будет неоткуда, придётся вписать новый хеш вручную.</p>
    <div class="modal-actions">
      <button type="button" class="btn btn-primary" id="passCopy">${icon('copy')} Скопировать</button>
      <button type="button" class="btn btn-ghost" id="passDone">Готово</button>
    </div>
  `, 'modal-lock');

  const ta = body.querySelector('#passJson');
  const copy = body.querySelector('#passCopy');
  body.querySelector('#passDone').addEventListener('click', closeModal);
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(ta.value);
      copy.innerHTML = `${icon('check')} Скопировано`;
    } catch {
      ta.focus(); ta.select();
      copy.textContent = 'Не вышло — выделено, скопируйте вручную';
    }
    hydrateIcons(copy);
  });
}
