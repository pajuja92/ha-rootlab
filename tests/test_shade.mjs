// Testy pozycji Słońca (NOAA) i geometrii cienia: node tests/test_shade.mjs
import assert from "node:assert";
import {
  crownBase,
  insideRect,
  isShaded,
  shadowCapsule,
  solarPosition,
} from "../custom_components/rootlab/frontend/shade.js";

const LAT = 52.23, LON = 21.01; // Warszawa
const utc = (m, d, h) => new Date(Date.UTC(2026, m - 1, d, h, 0, 0));

// Przesilenie letnie, ~południe słoneczne (12:00 CEST = 10:00 UTC):
// elewacja ≈ 61°, azymut ≈ południe
let sun = solarPosition(LAT, LON, utc(6, 21, 10));
assert.ok(sun.elevation > 55 && sun.elevation < 65, `lato południe el=${sun.elevation.toFixed(1)}`);
assert.ok(sun.azimuth > 160 && sun.azimuth < 200, `lato południe az=${sun.azimuth.toFixed(1)}`);

// Przesilenie zimowe, południe (12:00 CET = 11:00 UTC): elewacja ≈ 14°
sun = solarPosition(LAT, LON, utc(12, 21, 11));
assert.ok(sun.elevation > 10 && sun.elevation < 18, `zima południe el=${sun.elevation.toFixed(1)}`);
assert.ok(sun.azimuth > 165 && sun.azimuth < 195, `zima południe az=${sun.azimuth.toFixed(1)}`);

// Letni poranek (6:00 lokalnie = 4:00 UTC): słońce nad horyzontem, na wschodzie
sun = solarPosition(LAT, LON, utc(6, 21, 4));
assert.ok(sun.elevation > 5, `poranek el=${sun.elevation.toFixed(1)}`);
assert.ok(sun.azimuth > 55 && sun.azimuth < 110, `poranek az=${sun.azimuth.toFixed(1)}`);

// Noc: elewacja ujemna → brak cienia
sun = solarPosition(LAT, LON, utc(6, 21, 22));
assert.ok(sun.elevation < 0, `noc el=${sun.elevation.toFixed(1)}`);
assert.equal(shadowCapsule({ x: 0, y: 0, height_m: 5, diameter_m: 3, kind: "tree" }, sun), null);

// Geometria: drzewo h=5, korona od 2 m, promień 1.5; lato, południe → cień na północ (-y)
const tree = { id: "t", x: 10, y: 10, kind: "tree", height_m: 5, crown_base_m: 2, diameter_m: 3 };
sun = solarPosition(LAT, LON, utc(6, 21, 10));
let cap = shadowCapsule(tree, sun);
assert.ok(cap.by < 10 && Math.abs(cap.bx - 10) < 1.5, "latem w południe cień pada na północ planu");
// koniec cienia dalej niż początek (korona od 2 m) i dłuższy zimą niż latem
const capW = shadowCapsule(tree, solarPosition(LAT, LON, utc(12, 21, 11)));
const lenS = Math.hypot(cap.bx - 10, cap.by - 10);
const lenW = Math.hypot(capW.bx - 10, capW.by - 10);
assert.ok(lenW > lenS * 2.5, `zimą cień znacznie dłuższy (${lenW.toFixed(1)} vs ${lenS.toFixed(1)})`);

// Popołudnie (16:00 lokalnie = 14:00 UTC): słońce na zachodzie → cień na wschód (+x)
cap = shadowCapsule(tree, solarPosition(LAT, LON, utc(6, 21, 14)));
assert.ok(cap.bx > 10, "po południu cień pada na wschód");

// Zacienienie: punkt w kapsule / poza nią
sun = solarPosition(LAT, LON, utc(6, 21, 10));
cap = shadowCapsule(tree, sun);
const mid = { id: "p", x: (cap.ax + cap.bx) / 2, y: (cap.ay + cap.by) / 2 };
assert.ok(isShaded(mid, tree, cap), "punkt w środku kapsuły jest w cieniu");
assert.ok(!isShaded({ id: "p", x: 10, y: 16 }, tree, cap), "punkt na południu nie jest w cieniu");
assert.ok(!isShaded(tree, tree, cap), "obiekt nie zacienia sam siebie");

// Obrót planu: north_deg=90 (północ w prawo) → południowy cień pada w prawo (+x)
cap = shadowCapsule(tree, sun, 90);
assert.ok(cap.bx > 10 && Math.abs(cap.by - 10) < 1.5, "przy north=90 cień idzie w prawo na ekranie");

// Domyślny początek korony
assert.equal(crownBase({ kind: "tree", height_m: 10 }), 4);
assert.equal(crownBase({ kind: "plant", height_m: 1 }), 0);
assert.equal(crownBase({ kind: "tree", height_m: 10, crown_base_m: 1.2 }), 1.2);

// Punkt w prostokącie (szklarnia)
const gh = { x: 5, y: 5, w: 4, h: 3 };
assert.ok(insideRect({ x: 6, y: 6 }, gh));
assert.ok(!insideRect({ x: 4.9, y: 6 }, gh));

console.log("Wszystkie testy pozycji Słońca i cienia przeszły.");
