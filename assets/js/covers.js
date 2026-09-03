/* Рисунок на типографской обложке.
   У каждой книги свой набор цветов (поле art в data/books.json) и мотив —
   простая геометрия, отсылающая к содержанию, а не украшение вообще.
   Всё в inline-SVG на сетке 200×300, цвета берутся из переменных обложки. */

const A = 'var(--acc)';

/** Повторяющиеся элементы удобнее собрать циклом, чем выписывать вручную. */
const times = (n, fn) => Array.from({ length: n }, (_, i) => fn(i)).join('');

const MOTIFS = {
  /* Мастер и Маргарита: полная луна над Москвой */
  moon: () => `
    <circle cx="140" cy="82" r="42" fill="${A}" opacity=".85"/>
    <circle cx="140" cy="82" r="60" fill="none" stroke="${A}" stroke-width="1" opacity=".3"/>
    <path d="M0 166h200" stroke="${A}" stroke-width="1" opacity=".28"/>`,

  /* Норвежский лес: дождь между стволами */
  rain: () => times(17, i => {
    const x = 8 + i * 11.4, top = 6 + (i * 37 % 46), len = 74 + (i * 53 % 62);
    return `<path d="M${x.toFixed(1)} ${top} v${len}" stroke="${A}" stroke-width="1"
      opacity="${(0.16 + (i % 4) * 0.11).toFixed(2)}"/>`;
  }),

  /* Убийство Роджера Экройда: веер ар-деко из угла */
  deco: () => times(5, i => {
    const r = 42 + i * 25;
    return `<path d="M200 ${18 + 0} m${-r} 0 a${r} ${r} 0 0 0 ${r} ${r}"
      fill="none" stroke="${A}" stroke-width="1" opacity="${(0.5 - i * 0.07).toFixed(2)}"/>`;
  }) + `<circle cx="200" cy="18" r="4" fill="${A}" opacity=".7"/>`,

  /* Пикник на обочине: свечение Зоны над обочиной */
  zone: () => times(4, i => {
    const r = 20 + i * 17;
    return `<circle cx="104" cy="92" r="${r}" fill="${A}"
      opacity="${(0.3 - i * 0.065).toFixed(3)}"/>`;
  }) + `<circle cx="104" cy="92" r="7" fill="${A}" opacity=".85"/>
    <path d="M0 152h58M78 152h44M142 152h58" stroke="${A}" stroke-width="1" opacity=".4"/>`,

  /* Щегол: картина в раме */
  frame: () => `
    <rect x="52" y="34" width="96" height="118" fill="none" stroke="${A}" stroke-width="2" opacity=".75"/>
    <rect x="62" y="44" width="76" height="98" fill="${A}" opacity=".14"/>
    <circle cx="100" cy="96" r="13" fill="${A}" opacity=".8"/>
    <path d="M100 109v22" stroke="${A}" stroke-width="1.5" opacity=".6"/>`,

  /* Слепота: молочная белизна, в которой почти ничего не различить */
  veil: () => `
    <circle cx="100" cy="96" r="78" fill="${A}" opacity=".5"/>
    <circle cx="100" cy="96" r="52" fill="${A}" opacity=".55"/>
    <path d="M18 168h164" stroke="${A}" stroke-width="1" opacity=".9"/>`,

  /* Краткая история времени: орбиты вокруг точки */
  orbit: () => times(3, i => `
    <ellipse cx="100" cy="94" rx="${76 - i * 6}" ry="${26 + i * 12}"
      fill="none" stroke="${A}" stroke-width="1"
      opacity="${(0.55 - i * 0.12).toFixed(2)}"
      transform="rotate(${-24 + i * 26} 100 94)"/>`)
    + `<circle cx="100" cy="94" r="6" fill="${A}"/>
       <circle cx="100" cy="94" r="14" fill="${A}" opacity=".22"/>`,

  /* Гордость и предубеждение: двойная рамка с ромбом */
  regency: () => `
    <rect x="16" y="18" width="168" height="264" fill="none" stroke="${A}" stroke-width="1" opacity=".55"/>
    <rect x="22" y="24" width="156" height="252" fill="none" stroke="${A}" stroke-width="1" opacity=".3"/>
    <path d="M100 44l11 13-11 13-11-13z" fill="${A}" opacity=".6"/>
    <path d="M64 84h72" stroke="${A}" stroke-width="1" opacity=".4"/>`,

  /* Сто лет одиночества: зной, лучи из угла */
  sun: () => times(11, i => {
    const a = (i * 9 - 2) * Math.PI / 180;
    const x = 176 - Math.cos(a) * 190, y = 22 + Math.sin(a) * 190;
    return `<path d="M176 22L${x.toFixed(1)} ${y.toFixed(1)}"
      stroke="${A}" stroke-width="1" opacity="${(0.1 + (i % 3) * 0.09).toFixed(2)}"/>`;
  }) + `<circle cx="176" cy="22" r="30" fill="${A}" opacity=".7"/>`,

  /* Все, чего я не сказала: круги по воде */
  water: () => times(6, i => {
    const y = 62 + i * 17;
    return `<path d="M6 ${y}q24 -9 48 0t48 0t48 0t48 0"
      fill="none" stroke="${A}" stroke-width="1"
      opacity="${(0.5 - i * 0.06).toFixed(2)}"/>`;
  }),

  /* Автостопом по галактике: планета с кольцом и звёзды */
  planet: () => `
    <circle cx="138" cy="70" r="30" fill="${A}" opacity=".82"/>
    <ellipse cx="138" cy="70" rx="52" ry="13" fill="none" stroke="${A}"
      stroke-width="1.5" opacity=".6" transform="rotate(-18 138 70)"/>
    ${times(7, i => `<circle cx="${16 + (i * 41 % 170)}" cy="${28 + (i * 67 % 148)}"
      r="${1 + (i % 2)}" fill="${A}" opacity=".65"/>`)}`,

  /* Мы: стеклянная сетка Единого Государства */
  grid: () => times(5, i => `<path d="M${20 + i * 40} 14v${268}"
      stroke="${A}" stroke-width="1" opacity=".3"/>`)
    + times(6, i => `<path d="M8 ${28 + i * 46}h${184}"
      stroke="${A}" stroke-width="1" opacity=".3"/>`)
    + `<rect x="60" y="74" width="40" height="46" fill="${A}" opacity=".8"/>`
};

export const DEFAULT_ART = { bg: '#1c1a17', fg: '#f0e9db', acc: '#c9a45c', motif: null };

/** Инлайн-SVG с рисунком обложки. Пустая строка, если мотив не задан. */
export function motifSVG(name) {
  const draw = MOTIFS[name];
  if (!draw) return '';
  return `<svg class="cover-art" viewBox="0 0 200 300" aria-hidden="true"
    preserveAspectRatio="xMidYMid slice">${draw()}</svg>`;
}

export function motifNames() {
  return Object.keys(MOTIFS);
}
