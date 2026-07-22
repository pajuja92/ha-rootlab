// Czysta logika zacienienia — uproszczony model: cień w południe, skierowany na północ.
// northDeg = obrót planu: o ile stopni (zgodnie z zegarem) od "góry" leży północ.

export const DECLINATION = [-20.9, -13.0, -2.4, 9.4, 18.8, 23.1, 21.2, 13.5, 2.2, -9.6, -18.9, -23.0];

export function solarElevation(latDeg, month) {
  return 90 - latDeg + DECLINATION[month - 1];
}

export function shadowLength(heightM, latDeg, month) {
  const elev = solarElevation(latDeg, month);
  if (elev <= 3) return heightM * 19; // słońce przy horyzoncie — cień "bardzo długi"
  return heightM / Math.tan((elev * Math.PI) / 180);
}

export function northVector(northDeg = 0) {
  const a = (northDeg * Math.PI) / 180;
  return { x: Math.sin(a), y: -Math.cos(a) };
}

// Elipsa cienia: od obiektu w stronę północy planu.
export function shadowEllipse(item, L, northDeg = 0) {
  const n = northVector(northDeg);
  return {
    cx: item.x + (n.x * L) / 2,
    cy: item.y + (n.y * L) / 2,
    rx: Math.max(item.diameter_m / 2, 0.1),
    ry: Math.max(L / 2, 0.1),
    rot: northDeg,
  };
}

export function isShaded(target, caster, L, northDeg = 0) {
  if (caster.id === target.id || !L || !(caster.height_m > 0.3)) return false;
  // obróć wektor caster→target do układu, w którym północ jest "w górę"
  const a = (-northDeg * Math.PI) / 180;
  const dx0 = target.x - caster.x;
  const dy0 = target.y - caster.y;
  const dx = dx0 * Math.cos(a) - dy0 * Math.sin(a);
  const dy = dx0 * Math.sin(a) + dy0 * Math.cos(a);
  const rx = Math.max(caster.diameter_m / 2, 0.1);
  const ry = Math.max(L / 2, 0.1);
  const ex = dx / rx;
  const ey = (dy + L / 2) / ry;
  return ex * ex + ey * ey <= 1;
}

// Czy punktowy obiekt (roślina) stoi wewnątrz obszaru-prostokąta?
export function insideRect(item, rect) {
  return (
    "w" in rect &&
    item.x >= rect.x &&
    item.x <= rect.x + rect.w &&
    item.y >= rect.y &&
    item.y <= rect.y + rect.h
  );
}
