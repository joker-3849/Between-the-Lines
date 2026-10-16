/* Короткое сообщение внизу страницы: «книга удалена», «полку обновили».
 *
 * Это не ошибка и не вопрос — просто подтверждение, что действие
 * произошло, поэтому отдельного окна оно не заслуживает: полоса сама
 * появляется и сама пропадает. Живёт в той же стопке, что и полоса
 * сохранения, и встаёт над ней, когда видны обе. */

const LIFE = 5000;

let timer;

export function showNotice(text) {
  const bar = document.getElementById('noticeBar');
  if (!bar) return;
  bar.textContent = text;
  bar.hidden = false;
  clearTimeout(timer);
  timer = setTimeout(() => { bar.hidden = true; }, LIFE);
}
