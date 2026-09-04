/* Общий каркас модального окна: заголовок, крестик, тело.
 * Им пользуются и форма «Добавить книгу», и окно «Поделиться». */

import { icon, hydrateIcons } from './icons.js';

function ensureModal() {
  if (document.getElementById('appModal')) return;
  const div = document.createElement('div');
  div.innerHTML = `<div class="modal-overlay" id="appModal" hidden>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
      <div class="modal-head">
        <h2 id="modalTitle"></h2>
        <button type="button" class="modal-close" id="modalClose" aria-label="Закрыть">${icon('x')}</button>
      </div>
      <div class="modal-body" id="modalBody"></div>
    </div>
  </div>`;
  document.body.appendChild(div.firstElementChild);

  const overlay = document.getElementById('appModal');
  document.getElementById('modalClose').addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !overlay.hidden) {
      closeModal();
      // Пока открыт диалог, Esc принадлежит только ему — иначе то же
      // нажатие следом закрыло бы ещё и страницу книги под ним.
      e.stopImmediatePropagation();
    }
  });
}

/** Открывает окно и возвращает его тело — чтобы навесить обработчики. */
export function openModal(title, bodyHTML, cls = '') {
  ensureModal();
  const overlay = document.getElementById('appModal');
  overlay.querySelector('.modal').className = `modal ${cls}`.trim();
  document.getElementById('modalTitle').textContent = title;
  const body = document.getElementById('modalBody');
  body.innerHTML = bodyHTML;
  overlay.hidden = false;
  document.body.style.overflow = 'hidden';
  hydrateIcons(body);
  return body;
}

export function closeModal() {
  const overlay = document.getElementById('appModal');
  if (!overlay) return;
  overlay.hidden = true;
  document.body.style.overflow = '';
}

export function initModal() { ensureModal(); }
