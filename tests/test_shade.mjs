// Testy logiki cienia: node tests/test_shade.mjs
import assert from "node:assert";
import { shadowLength, isShaded, solarElevation } from "../custom_components/rootlab/frontend/shade.js";

const LAT = 52; // Polska

// W grudniu cień jest znacznie dłuższy niż w czerwcu
const june = shadowLength(5, LAT, 6);
const december = shadowLength(5, LAT, 12);
assert.ok(december > june * 3, `grudzień (${december.toFixed(1)}m) powinien być >> czerwiec (${june.toFixed(1)}m)`);
assert.ok(june > 0);

// Elewacja: czerwiec wysoko, grudzień nisko
assert.ok(solarElevation(LAT, 6) > 55);
assert.ok(solarElevation(LAT, 12) < 20);

// Roślina tuż na północ od drzewa jest w jego cieniu; na południe — nie
const tree = { id: "t", x: 10, y: 10, diameter_m: 3, height_m: 5 };
const L = shadowLength(tree.height_m, LAT, 12);
assert.ok(isShaded({ id: "p", x: 10, y: 10 - Math.min(L, 2) }, tree, L), "roślina na północ powinna być w cieniu");
assert.ok(!isShaded({ id: "p", x: 10, y: 14 }, tree, L), "roślina na południe nie powinna być w cieniu");
assert.ok(!isShaded(tree, tree, L), "obiekt nie zacienia sam siebie");
assert.ok(!isShaded({ id: "p", x: 10, y: 9 }, { id: "s", x: 10, y: 10, diameter_m: 1, height_m: 0.2 }, 0.5), "niski obiekt nie rzuca cienia");

// Obrót północy: przy north_deg=90 północ jest w prawo (+x) — cień pada w prawo
import { insideRect } from "../custom_components/rootlab/frontend/shade.js";
assert.ok(isShaded({ id: "p", x: 12, y: 10 }, tree, L, 90), "przy north=90 cień pada w prawo");
assert.ok(!isShaded({ id: "p", x: 10, y: 8 }, tree, L, 90), "przy north=90 'w górę' nie ma cienia");

// Punkt w prostokącie (szklarnia)
const gh = { x: 5, y: 5, w: 4, h: 3 };
assert.ok(insideRect({ x: 6, y: 6 }, gh));
assert.ok(!insideRect({ x: 4.9, y: 6 }, gh));

console.log("Wszystkie testy cienia przeszły.");
