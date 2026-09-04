/* Объёмное наведение на обложку: она поворачивается вслед за курсором.
 *
 * Контейнер задаёт перспективу, внутренняя обёртка поворачивается по двум
 * осям пропорционально тому, насколько курсор ушёл от центра, и чуть
 * приподнимается. Поверх ползёт блик — он и делает поворот читаемым,
 * иначе плоская картинка почти не выдаёт наклон.
 *
 * Пока курсор внутри — переход короткий, чтобы обложка не «плыла» следом;
 * на выходе — длинный, чтобы она мягко вернулась в исходное положение. */

const MAX_TILT = 11;      // максимальный угол поворота, градусы
const LIFT = 1.035;       // насколько обложка «подаётся» к зрителю

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function apply(box, inner, x, y) {
  const r = box.getBoundingClientRect();
  if (!r.width || !r.height) return;

  // −1…1 от центра по каждой оси
  const px = (x - r.left) / r.width * 2 - 1;
  const py = (y - r.top) / r.height * 2 - 1;

  inner.style.setProperty('--ry', `${(px * MAX_TILT).toFixed(2)}deg`);
  inner.style.setProperty('--rx', `${(-py * MAX_TILT).toFixed(2)}deg`);
  inner.style.setProperty('--ts', LIFT);
  // Блик идёт за курсором, слегка опережая его по горизонтали.
  inner.style.setProperty('--gx', `${(((px + 1) / 2) * 100).toFixed(1)}%`);
  inner.style.setProperty('--gy', `${(((py + 1) / 2) * 100).toFixed(1)}%`);
}

function reset(inner) {
  inner.style.setProperty('--rx', '0deg');
  inner.style.setProperty('--ry', '0deg');
  inner.style.setProperty('--ts', '1');
  inner.style.setProperty('--gx', '50%');
  inner.style.setProperty('--gy', '0%');
}

/**
 * Оборачивает обложку в слои для наклона и вешает слежение за курсором.
 * Вызывается после отрисовки; повторный вызов на том же узле безопасен.
 */
export function mountTilt(root = document) {
  root.querySelectorAll('.tilt').forEach(box => {
    if (box.dataset.tilt) return;
    box.dataset.tilt = '1';

    const inner = box.querySelector('.tilt-inner');
    if (!inner) return;
    reset(inner);
    if (reduced()) return;      // при отключённой анимации оставляем как есть

    box.addEventListener('pointermove', e => {
      if (e.pointerType === 'touch') return;   // на тач-экране «наведения» нет
      box.classList.add('tilting');
      apply(box, inner, e.clientX, e.clientY);
    });
    box.addEventListener('pointerleave', () => {
      box.classList.remove('tilting');
      reset(inner);
    });
    box.addEventListener('pointercancel', () => {
      box.classList.remove('tilting');
      reset(inner);
    });
  });
}

/** Разметка-обёртка: сцена с перспективой, внутри — поворачиваемый слой. */
export function tiltWrap(innerHTML, cls = '') {
  return `<div class="tilt ${cls}">
    <div class="tilt-inner">
      ${innerHTML}
      <span class="tilt-gloss" aria-hidden="true"></span>
    </div>
  </div>`;
}
