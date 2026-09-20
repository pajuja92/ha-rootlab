// Oś upraw: sortowanie, grupowanie po strefach, szukanie, archiwum.
// Uruchomienie: node tests/test_grow.mjs
import assert from "node:assert";
import { render } from "../custom_components/rootlab/frontend/views/grow.js";

const YEAR = 2026;
const zones = [
  { id: "z1", name: "Grządki", emoji: "🌱" },
  { id: "z2", name: "Szklarnia", emoji: "🏠" },
];
const plantings = [
  { id: "u1", name: "Pomidor", zone_id: "z2", year: YEAR, method: "indoor",
    plan: { sow: "02-20", transplant: "05-15", harvest_from: "07-15", harvest_to: "10-10" }, done: {} },
  { id: "u2", name: "Marchew", zone_id: "z1", year: YEAR, method: "direct",
    plan: { sow: "03-20", harvest_from: "06-15", harvest_to: "10-31" }, done: {} },
];
const plants = [
  { id: "p1", name: "Agrest", zone_id: "z1", lifecycle: "perennial" },
  { id: "p2", name: "Porzeczka", zone_id: "z1", archived: "2026-09-01" },
];
const app = (over = {}) => ({
  data: { zones, plants, plantings, layout: { items: [] } },
  _grow: { year: YEAR, area: "", q: "", sort: "zone", ...over },
});
const at = (html, id) => html.indexOf(`"${id}"`);

// alfabetycznie: Agrest < Marchew < Pomidor
let html = render(app({ sort: "name" }));
assert.ok(at(html, "p1") < at(html, "u2") && at(html, "u2") < at(html, "u1"), "sort alfabetyczny");

// wg zbioru: marchew (06-15) przed pomidorem (07-15), roślina bez terminów na końcu
html = render(app({ sort: "harvest" }));
assert.ok(at(html, "u2") < at(html, "u1") && at(html, "u1") < at(html, "p1"), "sort po zbiorze");

// wg siewu: pomidor (02-20) przed marchwią (03-20)
html = render(app({ sort: "sow" }));
assert.ok(at(html, "u1") < at(html, "u2"), "sort po siewie");

// strefami: separator strefy przed jej wierszami, kolejność stref jak na liście stref
html = render(app({ sort: "zone" }));
const seps = [...html.matchAll(/<div class="grow-sep">(.*?)<\/div>/g)];
assert.deepStrictEqual(seps.map((m) => m[1].replace(/<[^>]*>/g, "").trim()), ["Grządki", "Szklarnia"], "separatory stref");
assert.ok(seps[0].index < at(html, "u2") && at(html, "u2") < seps[1].index, "marchew i agrest pod Grządkami");
assert.ok(seps[0].index < at(html, "p1") && at(html, "p1") < seps[1].index, "agrest pod Grządkami");
assert.ok(seps[1].index < at(html, "u1"), "pomidor pod Szklarnią");

// szukanie bez diakrytyków: „marchew" znajduje tylko marchew
html = render(app({ q: "march" }));
assert.ok(at(html, "u2") > 0 && at(html, "u1") < 0 && at(html, "p1") < 0, "szukanie filtruje");

// archiwalna roślina nie pojawia się na osi w żadnym trybie
for (const sort of ["zone", "name", "harvest"]) {
  assert.ok(at(render(app({ sort })), "p2") < 0, `archiwum ukryte (${sort})`);
}

// filtr miejsca dalej działa razem z sortowaniem
html = render(app({ sort: "name", area: "z2" }));
assert.ok(at(html, "u1") > 0 && at(html, "u2") < 0, "filtr strefy");

console.log("OK test_grow");
