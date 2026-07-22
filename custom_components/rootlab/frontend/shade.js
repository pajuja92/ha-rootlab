// Czysta logika zacienienia — uproszczony model: cień w południe, skierowany na północ.
// ponytail: pełny tor słońca (godzinowy azymut) dopiero, gdyby model okazał się za zgrubny.

export const DECLINATION = [-20.9, -13.0, -2.4, 9.4, 18.8, 23.1, 21.2, 13.5, 2.2, -9.6, -18.9, -23.0];

export function solarElevation(latDeg, month) {
  return 90 - latDeg + DECLINATION[month - 1];
}

export function shadowLength(heightM, latDeg, month) {
  const elev = solarElevation(latDeg, month);
  if (elev <= 3) return heightM * 19; // słońce przy horyzoncie — cień "bardzo długi"
  return heightM / Math.tan((elev * Math.PI) / 180);
}

// Cień rysujemy jako elipsę na północ od obiektu (w SVG północ = -y).
export function shadowEllipse(item, L) {
  return { cx: item.x, cy: item.y - L / 2, rx: Math.max(item.diameter_m / 2, 0.1), ry: Math.max(L / 2, 0.1) };
}

export function isShaded(target, caster, L) {
  if (caster.id === target.id || !L || !(caster.height_m > 0.3)) return false;
  const e = shadowEllipse(caster, L);
  const dx = (target.x - e.cx) / e.rx;
  const dy = (target.y - e.cy) / e.ry;
  return dx * dx + dy * dy <= 1;
}
