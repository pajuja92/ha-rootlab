// Pozycja Słońca wg równań NOAA (General Solar Position Calculations, spencerowskie
// szeregi Fouriera na deklinację i równanie czasu) + geometria cienia korony.
//
// Cień obiektu liczymy z parametrów bryły: wysokość całkowita (szczyt korony),
// początek korony (dół korony / pień), promień korony — rzutowanych wzdłuż
// promienia słonecznego. Rzut korony (walca h1..h2 o promieniu r) na grunt to
// KAPSUŁA: odcinek od L1=h1/tan(el) do L2=h2/tan(el) w kierunku "od Słońca",
// o promieniu r. Kierunek cienia = azymut Słońca + 180°, obrócony o orientację planu.

const RAD = Math.PI / 180;

/* Pozycja Słońca dla współrzędnych i czasu (JS Date — liczymy z komponentów UTC,
   więc strefa/DST są obsłużone przez samą datę). Zwraca stopnie:
   elevation (nad horyzontem, ujemna = noc), azimuth (od północy, zgodnie z zegarem). */
export function solarPosition(latDeg, lonDeg, date) {
  const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 1);
  const doy = Math.floor((date.getTime() - startOfYear) / 86400000) + 1;
  const hourUTC =
    date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const g = ((2 * Math.PI) / 365) * (doy - 1 + (hourUTC - 12) / 24); // fractional year
  const eqtime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(g) -
      0.032077 * Math.sin(g) -
      0.014615 * Math.cos(2 * g) -
      0.040849 * Math.sin(2 * g)); // minuty
  const decl =
    0.006918 -
    0.399912 * Math.cos(g) +
    0.070257 * Math.sin(g) -
    0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) -
    0.002697 * Math.cos(3 * g) +
    0.00148 * Math.sin(3 * g); // radiany
  const trueSolarMin = hourUTC * 60 + eqtime + 4 * lonDeg;
  const ha = (trueSolarMin / 4 - 180) * RAD; // kąt godzinny
  const lat = latDeg * RAD;
  const cosZen =
    Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(ha);
  const zen = Math.acos(Math.min(1, Math.max(-1, cosZen)));
  const elevation = 90 - zen / RAD;
  // atan2: azymut od południa, dodatni na zachód → przeliczenie na "od północy, cw"
  const azS = Math.atan2(
    Math.sin(ha),
    Math.cos(ha) * Math.sin(lat) - Math.tan(decl) * Math.cos(lat)
  );
  const azimuth = (azS / RAD + 180 + 360) % 360;
  return { elevation, azimuth };
}

/* Wektor kierunku na planie dla azymutu 0 (północ) obróconego o deg zgodnie z zegarem. */
export function northVector(deg = 0) {
  const a = deg * RAD;
  return { x: Math.sin(a), y: -Math.cos(a) };
}

/* Domyślny początek korony, gdy obiekt nie ma ustawionego crown_base_m. */
export const crownBase = (item) =>
  item.crown_base_m ?? ({ tree: 0.4, shrub: 0.15 }[item.kind] ?? 0) * (item.height_m || 0);

/* Kapsuła cienia obiektu: {ax, ay, bx, by, r} w metrach planu, albo null (noc / za niski). */
export function shadowCapsule(item, sun, northDeg = 0) {
  const hTop = item.height_m || 0;
  if (!sun || sun.elevation <= 0.5 || hTop < 0.3) return null;
  const el = Math.max(sun.elevation, 3) * RAD; // przy horyzoncie ograniczamy długość
  const k = 1 / Math.tan(el);
  const h1 = Math.min(crownBase(item), hTop);
  const r = Math.max((item.diameter_m || 0.5) / 2, 0.1);
  const dir = northVector(northDeg + sun.azimuth + 180);
  return {
    ax: item.x + dir.x * h1 * k,
    ay: item.y + dir.y * h1 * k,
    bx: item.x + dir.x * hTop * k,
    by: item.y + dir.y * hTop * k,
    r,
  };
}

/* Odległość punktu od odcinka — test trafienia w kapsułę cienia. */
function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const u = len2 ? Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  return Math.hypot(px - (ax + u * dx), py - (ay + u * dy));
}

export function isShaded(target, caster, capsule) {
  if (!capsule || caster.id === target.id) return false;
  return distToSegment(target.x, target.y, capsule.ax, capsule.ay, capsule.bx, capsule.by) <= capsule.r;
}

/* Czy punktowy obiekt (roślina) stoi wewnątrz obszaru-prostokąta? */
export function insideRect(item, rect) {
  return (
    "w" in rect &&
    item.x >= rect.x &&
    item.x <= rect.x + rect.w &&
    item.y >= rect.y &&
    item.y <= rect.y + rect.h
  );
}
