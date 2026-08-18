import { t } from "../i18n.js";
import { combo, emojiSvgUrl, esc, uid, wireCombos } from "../util.js";
import { crownBase, insideRect, isShaded, lineElements, northVector, shadowCapsule, solarPosition } from "../shade.js";
import { PLANT_PRESETS } from "../presets.js";
import { ATTRIBUTION, MAX_Z, gridHtml, latToY, lonToX, metersPerPixel, xToLon, yToLat } from "../satmap.js";
import { openPlantCard, openZoneCard, plantDialog } from "./plants.js";

export const ENABLED = true;

const AREA_KINDS = ["greenhouse", "bed", "orchard", "lawn"];
const CIRCLE_DEFAULTS = {
  plant: { diameter_m: 0.5, height_m: 0.6, crown_base_m: 0 },
  tree: { diameter_m: 3, height_m: 5, crown_base_m: 2 },
  shrub: { diameter_m: 1, height_m: 1.2, crown_base_m: 0.2 },
  compost: { diameter_m: 1.2, height_m: 1, crown_base_m: 0 },
};
const KIND_FILL = {
  plant: "var(--rl-green)",
  tree: "color-mix(in srgb, var(--rl-green) 70%, black)",
  shrub: "var(--rl-soil)",
  compost: "color-mix(in srgb, var(--rl-soil) 65%, black)",
};
const KIND_GLYPH = { tree: "🌳", shrub: "🌿", compost: "♻️", hedge: "🌲", row: "🥕" };
const isLine = (i) => i.kind === "hedge" || i.kind === "row";
const AREA_EMOJI = { greenhouse: "🏠", bed: "🥕", orchard: "🍎", lawn: "🌱" };

const st = (app) =>
  (app.editorState ??= {
    palette: "",
    detailPalette: "",
    month: new Date().getMonth() + 1,
    hour: 12,
    mode: "view",
    zoom: 1,
    sat: true,
    zoneDetail: null,
  });

const gardenLat = (app) =>
  app.data.layout.location?.latitude || app.hass.config.latitude || 52;
const gardenLon = (app) =>
  app.data.layout.location?.longitude || app.hass.config.longitude || 21;

function sunFor(app) {
  const s = st(app);
  const now = new Date();
  const date = new Date(now.getFullYear(), s.month - 1, 15, s.hour, 0, 0);
  return solarPosition(gardenLat(app), gardenLon(app), date);
}

const isArea = (i) => "w" in i;
/* Nazwa obszaru = nazwa strefy (rysunek to tylko kształt strefy). */
const areaName = (app, a) => app.data.zones.find((z) => z.id === a.zone_id)?.name || a.label;
const isPath = (i) => Array.isArray(i.path);
const isSpray = (i) => i.kind === "irrigation" && i.mode === "sprinkler";
const isCircle = (i) => !isArea(i) && !isPath(i) && !isSpray(i);

/* Jedna reprezentacja na roślinę / sekcję nawadniania. */
const placedPlantIds = (app) =>
  new Set(app.data.layout.items.filter((i) => i.plant_id).map((i) => i.plant_id));
const placedSectionIds = (app) =>
  new Set(app.data.layout.items.filter((i) => i.kind === "irrigation").map((i) => i.section_id));
const unplacedPlants = (app) => {
  const placed = placedPlantIds(app);
  return app.data.plants.filter((p) => !placed.has(p.id));
};
const unplacedSections = (app) => {
  const placed = placedSectionIds(app);
  return (app.data.irrigation.sections || []).filter((s) => !placed.has(s.id));
};

export function render(app) {
  const s = st(app);
  if (s.zoneDetail) {
    const area = app.data.layout.items.find((i) => i.id === s.zoneDetail);
    if (area) return renderDetail(app, area);
    s.zoneDetail = null;
  }
  const layout = app.data.layout;
  const satActive = s.sat && layout.location;
  const plantOpts = unplacedPlants(app)
    .map((p) => `<option value="plant:${p.id}" ${s.palette === "plant:" + p.id ? "selected" : ""}>${esc(p.emoji || "🌱")} ${esc(p.name)}</option>`)
    .join("");
  const irrOpts = unplacedSections(app)
    .map(
      (sec) => `<option value="irr:${sec.id}" ${s.palette === "irr:" + sec.id ? "selected" : ""}>💧 ${esc(sec.name)} (${t("water.kind." + (sec.kind || "other"))})</option>`
    )
    .join("");
  return `
    <div class="toolbar">
      <div class="mode-toggle">
        <button class="${s.mode === "view" ? "on" : ""}" data-action="editor-mode" data-mode="view"><ha-icon icon="mdi:eye-outline" style="--mdc-icon-size:16px"></ha-icon>${t("editor.mode.view")}</button>
        <button class="${s.mode === "edit" ? "on" : ""}" data-action="editor-mode" data-mode="edit"><ha-icon icon="mdi:pencil" style="--mdc-icon-size:16px"></ha-icon>${t("editor.mode.edit")}</button>
      </div>
      ${
        s.mode === "edit"
          ? `<select class="inline" data-bind="palette">
        <option value="" ${s.palette ? "" : "selected"}>${t("editor.palette.none")}</option>
        <optgroup label="${t("editor.group.areas")}">
          ${AREA_KINDS.map((k) => `<option value="${k}" ${s.palette === k ? "selected" : ""}>${AREA_EMOJI[k]} ${t("editor.palette." + k)}</option>`).join("")}
          ${app.data.zones
            .filter((z) => !layout.items.some((i) => "w" in i && i.zone_id === z.id))
            .map((z) => `<option value="zone-draw:${z.id}" ${s.palette === "zone-draw:" + z.id ? "selected" : ""}>${esc(z.emoji || "🪴")} ${esc(z.name)} (${t("editor.palette.draw")})</option>`)
            .join("")}
        </optgroup>
        <optgroup label="${t("editor.group.objects")}">
          <option value="tree" ${s.palette === "tree" ? "selected" : ""}>🌳 ${t("editor.palette.tree")}</option>
          <option value="shrub" ${s.palette === "shrub" ? "selected" : ""}>🌿 ${t("editor.palette.shrub")}</option>
          <option value="compost" ${s.palette === "compost" ? "selected" : ""}>♻️ ${t("editor.palette.compost")}</option>
          <option value="fence" ${s.palette === "fence" ? "selected" : ""}>🪵 ${t("editor.palette.fence")}</option>
          <option value="hedge" ${s.palette === "hedge" ? "selected" : ""}>🌲 ${t("editor.palette.hedge")}</option>
        </optgroup>
        ${irrOpts ? `<optgroup label="${t("editor.group.irrigation")}">${irrOpts}</optgroup>` : ""}
        ${plantOpts ? `<optgroup label="${t("tab.plants")}">${plantOpts}</optgroup>` : ""}
      </select>`
          : ""
      }
      <span class="month-slider">
        <input type="range" min="1" max="12" value="${s.month}" data-bind="month">
        <b id="month-label">${t("months")[s.month - 1]}</b>
        <input type="range" min="0" max="23" value="${s.hour}" data-bind="hour" style="width:90px">
        <b id="hour-label">${String(s.hour).padStart(2, "0")}:00</b>
        <b id="sun-label">${sunLabel(app)}</b></span>
      <div class="spacer"></div>
      <button class="icon-btn" data-action="editor-zoom" data-d="-1" title="−"><ha-icon icon="mdi:magnify-minus-outline"></ha-icon></button>
      <b style="font-size:12px">${Math.round((s.zoom || 1) * 100)}%</b>
      <button class="icon-btn" data-action="editor-zoom" data-d="1" title="+"><ha-icon icon="mdi:magnify-plus-outline"></ha-icon></button>
      <button class="btn small ${satActive ? "" : "plain"}" data-action="editor-sat" title="${t("editor.sat")}"
        ${layout.location ? "" : "disabled"}><ha-icon icon="mdi:satellite-variant"></ha-icon></button>
      <button class="btn ghost" data-action="editor-location"><ha-icon icon="mdi:map-marker-outline"></ha-icon>${t("editor.location")}</button>
      <button class="btn ghost" data-action="editor-garden"><ha-icon icon="mdi:cog-outline"></ha-icon>${t("editor.garden")}</button>
    </div>
    <div class="editor-wrap">
      <div id="editor-stage" style="position:relative;overflow:hidden;border-radius:8px;width:${Math.round((s.zoom || 1) * 100)}%;margin:0 auto">
        ${satActive ? `<div class="sat-wrap"><div id="sat-under"></div></div><div class="sat-attr">${ATTRIBUTION}</div>` : ""}
        ${svg(app, satActive)}
      </div>
    </div>
    <div class="editor-hint">${s.mode === "edit" ? t("editor.hint.edit") : t("editor.hint.view")} · ${t("editor.greenhouse.info")}</div>`;
}

function sunLabel(app) {
  const sun = sunFor(app);
  return sun.elevation > 0 ? `☀ ${Math.round(sun.elevation)}°` : "🌙";
}

function circleNode(app, i, caps) {
  const greenhouses = app.data.layout.items.filter((a) => isArea(a) && a.kind === "greenhouse");
  const shaded = caps.some(({ c, cap }) => isShaded(i, c, cap));
  const inGh = i.kind === "plant" && greenhouses.some((g) => insideRect(i, g));
  const r = Math.max(i.diameter_m / 2, 0.25);
  const plant = i.plant_id ? app.data.plants.find((p) => p.id === i.plant_id) : null;
  const glyph = plant ? plant.emoji || "🌱" : KIND_GLYPH[i.kind] || "";
  const assignable = ["plant", "tree", "shrub"].includes(i.kind) && !i.plant_id;
  const hoverText = `${esc(plant ? plant.name : i.label)}${inGh ? " 🏠" : ""}${shaded ? " ☁" : ""}${assignable ? " ❓" : ""}`;
  return `<g class="item circle-item ${shaded ? "is-shaded" : ""}" data-id="${i.id}" transform="translate(${i.x} ${i.y})">
    <circle r="${r}" fill="${KIND_FILL[i.kind] || KIND_FILL.shrub}" fill-opacity="0.8"/>
    ${assignable ? `<circle class="unassigned-ring" r="${r + 0.12}"/>` : ""}
    ${(() => {
      if (!glyph) return "";
      // emoji → SVG OpenMoji; rozmiar w metrach dopasowany do promienia
      const gs = Math.max(Math.min(r * 1.2, 1.5), 0.45);
      const url = emojiSvgUrl(glyph);
      return url ? `<image href="${url}" x="${-gs / 2}" y="${-gs / 2}" width="${gs}" height="${gs}"/>` : "";
    })()}
    <text class="hover-label" y="${r + 0.65}">${hoverText}</text>
  </g>`;
}

/* Żywopłot / rządek: niewidoczna gruba linia do klikania + elementy w rozstawie. */
function lineNode(item) {
  const els = lineElements(item);
  const pts = item.path.map((p) => p.join(",")).join(" ");
  const mid = item.path[Math.floor(item.path.length / 2)] || [0, 0];
  const fill = item.kind === "hedge" ? KIND_FILL.tree : KIND_FILL.plant;
  return `<g class="item path-item" data-id="${item.id}">
    <polyline points="${pts}" fill="none" stroke="transparent" stroke-width="0.7"/>
    ${els
      .map((e) => {
        const r = Math.max(e.diameter_m / 2, 0.15);
        const gs = Math.max(Math.min(r * 1.6, 1.2), 0.35);
        const url = emojiSvgUrl(e.emoji);
        return `<g transform="translate(${e.x} ${e.y})"><circle r="${r}" fill="${fill}" fill-opacity="0.75"/>${url ? `<image href="${url}" x="${-gs / 2}" y="${-gs / 2}" width="${gs}" height="${gs}"/>` : ""}</g>`;
      })
      .join("")}
    <text class="hover-label" x="${mid[0]}" y="${mid[1] - 0.4}">${KIND_GLYPH[item.kind]} ${esc(item.label)} (${els.length})</text>
  </g>`;
}

function pathNode(item) {
  const pts = item.path.map((p) => p.join(",")).join(" ");
  const mid = item.path[Math.floor(item.path.length / 2)] || [0, 0];
  const cls = item.kind === "fence" ? "fence" : "drip";
  return `<g class="item path-item" data-id="${item.id}">
    <polyline class="path ${cls}" points="${pts}"/>
    <polyline points="${pts}" fill="none" stroke="transparent" stroke-width="0.7"/>
    <text class="hover-label" x="${mid[0]}" y="${mid[1] - 0.4}">${item.kind === "fence" ? "🪵" : "💧"} ${esc(item.label)}</text>
  </g>`;
}

function sprayNode(item) {
  return `<g class="item spray-item" data-id="${item.id}" transform="translate(${item.x} ${item.y})">
    <circle class="spray" r="${item.radius_m || 2}"/>
    <circle class="spray-head" r="0.22"/>
    <text class="hover-label" y="-${(item.radius_m || 2) + 0.3}">💦 ${esc(item.label)}</text>
  </g>`;
}

function svg(app, satActive) {
  const s = st(app);
  const { width_m: W, height_m: H, north_deg: north = 0, items } = app.data.layout;
  const sun = sunFor(app);
  const circles = items.filter(isCircle);
  // nasadzenia liniowe rzucają cień jak seria kół
  const lineEls = items.filter(isLine).flatMap((i) => lineElements(i));
  const caps = [...circles, ...lineEls].map((c) => ({ c, cap: shadowCapsule(c, sun, north) }));
  const areas = items.filter(isArea);

  const areaNodes = areas
    .map(
      (a) => `<g class="item-g" data-id="${a.id}">
      <rect class="area ${a.kind}" x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}" rx="0.2"/>
      <text x="${a.x + a.w / 2}" y="${a.y + 0.7}">${AREA_EMOJI[a.kind] || ""} ${esc(areaName(app, a))}</text>
      ${
        s.mode === "edit"
          ? `<circle class="resize-handle" data-id="${a.id}" cx="${a.x + a.w}" cy="${a.y + a.h}" r="0.35"/>`
          : ""
      }
    </g>`
    )
    .join("");

  const shadows = caps
    .filter(({ cap }) => cap)
    .map(
      ({ cap }) =>
        `<line class="shadow-line" x1="${cap.ax}" y1="${cap.ay}" x2="${cap.bx}" y2="${cap.by}" stroke-width="${2 * cap.r}"/>`
    )
    .join("");

  const paths = items.filter((i) => isPath(i) && !isLine(i)).map(pathNode).join("");
  const lines = items.filter(isLine).map((i) => lineNode(i)).join("");
  const sprays = items.filter(isSpray).map(sprayNode).join("");
  const nodes = circles.map((i) => circleNode(app, i, caps)).join("");

  const n = northVector(north);
  const compass = `<g class="compass" transform="translate(${W - 1.6} 1.6)">
    <circle r="1.1" fill="var(--card-background-color)" stroke="var(--divider-color)" stroke-width="0.06"/>
    <line class="needle" x1="0" y1="0" x2="${n.x * 0.75}" y2="${n.y * 0.75}" stroke="var(--rl-crisis)" stroke-width="0.14"/>
    <text class="n-label" x="${n.x * 0.95}" y="${n.y * 0.95 + 0.3}" text-anchor="middle">N</text>
  </g>`;

  return `<svg id="garden-svg" class="editor-svg ${s.mode === "view" ? "view-mode" : ""} ${satActive ? "sat-on" : ""}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
    <defs><pattern id="rl-grid" width="1" height="1" patternUnits="userSpaceOnUse">
      <path d="M 1 0 L 0 0 0 1" fill="none" class="grid-line"/></pattern></defs>
    <rect width="${W}" height="${H}" fill="url(#rl-grid)"/>
    ${areaNodes}${sprays}${paths}${lines}${shadows}${nodes}${compass}
    <rect id="draw-preview" class="draw-preview" style="display:none" />
    <polyline id="path-preview" style="display:none" />
    <circle id="spray-preview" style="display:none" />
  </svg>`;
}

/* --- Widok szczegółowy strefy --- */

function renderDetail(app, area) {
  const s = st(app);
  const layout = app.data.layout;
  const zone = app.data.zones.find((z) => z.id === area.zone_id);
  const plantOpts = unplacedPlants(app)
    .map(
      (p) => `<option value="plant:${p.id}" ${s.detailPalette === "plant:" + p.id ? "selected" : ""}>${esc(p.emoji || "🌱")} ${esc(p.name)}</option>`
    )
    .join("");
  const pad = Math.max(1, Math.min(area.w, area.h) * 0.1);
  const north = layout.north_deg || 0;
  const sun = sunFor(app);
  const circles = layout.items.filter(isCircle);
  const lineEls = layout.items.filter(isLine).flatMap((i) => lineElements(i));
  const caps = [...circles, ...lineEls].map((c) => ({ c, cap: shadowCapsule(c, sun, north) }));
  const inside = circles.filter((i) => insideRect(i, area));
  const shadows = caps
    .filter(({ cap }) => cap)
    .map(
      ({ cap }) =>
        `<line class="shadow-line" x1="${cap.ax}" y1="${cap.ay}" x2="${cap.bx}" y2="${cap.by}" stroke-width="${2 * cap.r}"/>`
    )
    .join("");
  return `
    <div class="toolbar">
      <button class="btn ghost" data-action="editor-back"><ha-icon icon="mdi:arrow-left"></ha-icon>${t("editor.back")}</button>
      <b style="font-size:16px">${AREA_EMOJI[area.kind]} ${esc(areaName(app, area))}</b>
      ${zone ? `<span class="chip">${esc(zone.emoji || "🪴")} ${esc(zone.name)}</span>` : `<span class="chip harvest">${t("editor.area.unlinked")}</span>`}
      <div class="spacer"></div>
      <select class="inline" data-bind="detail-palette">
        <option value="">${t("editor.palette.pick")}</option>
        <option value="row" ${s.detailPalette === "row" ? "selected" : ""}>🥕 ${t("editor.palette.row")}</option>
        <optgroup label="${t("tab.plants")}">
          <option value="new">➕ ${t("plant.new")}</option>
          ${plantOpts}
        </optgroup>
        <optgroup label="${t("editor.group.objects")}">
          <option value="tree" ${s.detailPalette === "tree" ? "selected" : ""}>🌳 ${t("editor.palette.tree")}</option>
          <option value="shrub" ${s.detailPalette === "shrub" ? "selected" : ""}>🌿 ${t("editor.palette.shrub")}</option>
          <option value="compost" ${s.detailPalette === "compost" ? "selected" : ""}>♻️ ${t("editor.palette.compost")}</option>
        </optgroup>
      </select>
      <button class="btn ghost" data-action="editor-area-edit" data-id="${area.id}"><ha-icon icon="mdi:pencil-outline"></ha-icon>${t("edit")}</button>
    </div>
    <div class="editor-wrap">
      <svg id="detail-svg" class="editor-svg" viewBox="${area.x - pad} ${area.y - pad} ${area.w + 2 * pad} ${area.h + 2 * pad}" preserveAspectRatio="xMidYMid meet">
        <defs><pattern id="rl-grid2" width="1" height="1" patternUnits="userSpaceOnUse">
          <path d="M 1 0 L 0 0 0 1" fill="none" class="grid-line"/></pattern></defs>
        <rect x="${area.x - pad}" y="${area.y - pad}" width="${area.w + 2 * pad}" height="${area.h + 2 * pad}" fill="url(#rl-grid2)"/>
        <rect class="area ${area.kind}" x="${area.x}" y="${area.y}" width="${area.w}" height="${area.h}" rx="0.2"/>
        ${layout.items
          .filter((i) => isLine(i) && i.path?.some(([x, y]) => x >= area.x && x <= area.x + area.w && y >= area.y && y <= area.y + area.h))
          .map((i) => lineNode(i))
          .join("")}
        ${shadows}
        ${inside.map((i) => circleNode(app, i, caps)).join("")}
        <polyline id="path-preview" style="display:none" />
      </svg>
    </div>
    <div class="editor-hint">${t("editor.detail.hint")}</div>`;
}

async function saveLayout(app, msg = null) {
  try {
    app.data = await app.ws("layout/save", { layout: app.data.layout });
  } catch (e) {
    app.toast(`⚠ ${e.message || e}`, true);
    return;
  }
  app.render();
  if (msg) app.toast(msg);
}

function svgPoint(svgEl, ev) {
  const pt = svgEl.createSVGPoint();
  pt.x = ev.clientX;
  pt.y = ev.clientY;
  return pt.matrixTransform(svgEl.getScreenCTM().inverse());
}

function renderUnderlay(app, root) {
  const under = root.getElementById("sat-under");
  if (!under) return;
  const layout = app.data.layout;
  const loc = layout.location;
  const stage = root.getElementById("editor-stage");
  const wPx = stage.clientWidth;
  if (!wPx || !loc) return;
  const hPx = (wPx * layout.height_m) / layout.width_m;
  const pxPerM = wPx / layout.width_m;
  const phi = loc.latitude;
  let z = Math.round(Math.log2(156543.03392 * Math.cos((phi * Math.PI) / 180) * pxPerM));
  z = Math.max(3, Math.min(MAX_Z, z));
  const scale = pxPerM * metersPerPixel(phi, z);
  const diag = Math.ceil(Math.sqrt(wPx * wPx + hPx * hPx) / scale) + 256;
  under.style.width = `${diag}px`;
  under.style.height = `${diag}px`;
  under.dataset.scale = scale;
  under.style.transform = `translate(-50%,-50%) rotate(${layout.north_deg || 0}deg) scale(${scale})`;
  under.innerHTML = gridHtml(phi, loc.longitude, z, diag, diag);
}

export function bind(app, root) {
  const s = st(app);
  if (s.zoneDetail) {
    bindDetail(app, root);
    return;
  }
  root.querySelector('[data-bind="palette"]')?.addEventListener("change", (ev) => {
    s.palette = ev.target.value;
    root.getElementById("garden-svg")?.classList.toggle("armed", Boolean(s.palette));
  });
  const slider = root.querySelector('[data-bind="month"]');
  slider?.addEventListener("input", (ev) => {
    root.getElementById("month-label").textContent = t("months")[ev.target.value - 1];
  });
  slider?.addEventListener("change", (ev) => {
    s.month = parseInt(ev.target.value, 10);
    app.render();
  });
  const hourSlider = root.querySelector('[data-bind="hour"]');
  hourSlider?.addEventListener("input", (ev) => {
    root.getElementById("hour-label").textContent = `${String(ev.target.value).padStart(2, "0")}:00`;
  });
  hourSlider?.addEventListener("change", (ev) => {
    s.hour = parseInt(ev.target.value, 10);
    app.render();
  });

  const svgEl = root.getElementById("garden-svg");
  if (!svgEl) return;
  renderUnderlay(app, root);
  // uzbrojona paleta = celownik; Shift = rączka (przesuwanie/rozmiar)
  svgEl.classList.toggle("armed", Boolean(s.palette));
  if (app._edKeys) {
    window.removeEventListener("keydown", app._edKeys.kd);
    window.removeEventListener("keyup", app._edKeys.ku);
  }
  app._edKeys = {
    kd: (ev) => ev.key === "Shift" && svgEl.classList.add("shifting"),
    ku: (ev) => ev.key === "Shift" && svgEl.classList.remove("shifting"),
  };
  window.addEventListener("keydown", app._edKeys.kd);
  window.addEventListener("keyup", app._edKeys.ku);
  let drag = null;
  const layout = app.data.layout;
  const clamp = (v, max) => Math.round(Math.min(Math.max(v, 0), max) * 10) / 10;

  const syncAreaNode = (item) => {
    const g = svgEl.querySelector(`.item-g[data-id="${item.id}"]`);
    if (!g) return;
    const rect = g.querySelector("rect.area");
    rect.setAttribute("x", item.x);
    rect.setAttribute("y", item.y);
    rect.setAttribute("width", item.w);
    rect.setAttribute("height", item.h);
    const text = g.querySelector("text");
    text.setAttribute("x", item.x + item.w / 2);
    text.setAttribute("y", item.y + 0.7);
    const handle = g.querySelector(".resize-handle");
    if (handle) {
      handle.setAttribute("cx", item.x + item.w);
      handle.setAttribute("cy", item.y + item.h);
    }
  };

  const syncCompass = (deg) => {
    const n = northVector(deg);
    const needle = svgEl.querySelector(".compass .needle");
    const label = svgEl.querySelector(".compass .n-label");
    needle.setAttribute("x2", n.x * 0.75);
    needle.setAttribute("y2", n.y * 0.75);
    label.setAttribute("x", n.x * 0.95);
    label.setAttribute("y", n.y * 0.95 + 0.3);
    const under = root.getElementById("sat-under");
    if (under && under.dataset.scale) {
      under.style.transform = `translate(-50%,-50%) rotate(${deg}deg) scale(${under.dataset.scale})`;
    }
  };

  const sectionFor = (pal) => app.data.irrigation.sections.find((x) => x.id === pal.slice(4));
  const isPathPalette = () =>
    ["fence", "hedge"].includes(s.palette) ||
    (s.palette.startsWith("irr:") && sectionFor(s.palette)?.kind === "drip");
  const isSprayPalette = () => s.palette.startsWith("irr:") && sectionFor(s.palette)?.kind !== "drip";

  svgEl.addEventListener("pointerdown", (ev) => {
    ev.preventDefault(); // blokada zaznaczania tekstu strony podczas pracy na mapie
    const p = svgPoint(svgEl, ev);
    const compass = ev.target.closest(".compass");
    if (compass && s.mode === "edit") {
      const W = layout.width_m;
      drag = { type: "rotate", cx: W - 1.6, cy: 1.6, deg: layout.north_deg || 0 };
      svgEl.setPointerCapture(ev.pointerId);
      return;
    }
    const handle = ev.target.closest(".resize-handle");
    const node = ev.target.closest("[data-id]");
    if (s.mode === "view") {
      if (node) viewClick(app, node.dataset.id);
      return;
    }
    svgEl.setPointerCapture(ev.pointerId);
    if (handle || node) {
      const item = layout.items.find((i) => i.id === (handle || node).dataset.id);
      // bez Shift: klik = otwarcie; z Shiftem: przesuwanie / zmiana rozmiaru
      if (!ev.shiftKey || isPath(item)) {
        drag = { type: "click-item", item };
      } else if (handle) {
        drag = { type: "resize", item, moved: false };
      } else {
        drag = { type: "move", item, node, dx: item.x - p.x, dy: item.y - p.y, moved: false };
      }
    } else if (!s.palette) {
      // pusta paleta — klik w puste pole nic nie dodaje
    } else if (AREA_KINDS.includes(s.palette) || s.palette.startsWith("zone-draw:")) {
      drag = { type: "draw", x0: p.x, y0: p.y, moved: false };
    } else if (isPathPalette()) {
      drag = { type: "path", pts: [[clamp(p.x, layout.width_m), clamp(p.y, layout.height_m)]] };
    } else if (isSprayPalette()) {
      drag = { type: "spray", x0: p.x, y0: p.y, r: 0 };
    } else {
      drag = { type: "place", x: p.x, y: p.y };
    }
  });

  svgEl.addEventListener("pointermove", (ev) => {
    if (!drag) return;
    const p = svgPoint(svgEl, ev);
    if (drag.type === "rotate") {
      drag.deg = Math.round(
        ((Math.atan2(p.x - drag.cx, -(p.y - drag.cy)) * 180) / Math.PI + 360) % 360
      );
      syncCompass(drag.deg);
    } else if (drag.type === "move") {
      drag.moved = true;
      drag.item.x = clamp(p.x + drag.dx, layout.width_m);
      drag.item.y = clamp(p.y + drag.dy, layout.height_m);
      if (isArea(drag.item)) syncAreaNode(drag.item);
      else drag.node.setAttribute("transform", `translate(${drag.item.x} ${drag.item.y})`);
    } else if (drag.type === "resize") {
      drag.moved = true;
      drag.item.w = Math.max(0.5, clamp(p.x - drag.item.x, layout.width_m));
      drag.item.h = Math.max(0.5, clamp(p.y - drag.item.y, layout.height_m));
      syncAreaNode(drag.item);
    } else if (drag.type === "draw") {
      drag.moved = true;
      drag.x1 = p.x;
      drag.y1 = p.y;
      const pr = root.getElementById("draw-preview");
      pr.style.display = "";
      pr.setAttribute("x", Math.min(drag.x0, p.x));
      pr.setAttribute("y", Math.min(drag.y0, p.y));
      pr.setAttribute("width", Math.abs(p.x - drag.x0));
      pr.setAttribute("height", Math.abs(p.y - drag.y0));
    } else if (drag.type === "path") {
      const last = drag.pts[drag.pts.length - 1];
      const nx = clamp(p.x, layout.width_m);
      const ny = clamp(p.y, layout.height_m);
      if (Math.hypot(nx - last[0], ny - last[1]) > 0.4) {
        drag.pts.push([nx, ny]);
        const pr = root.getElementById("path-preview");
        pr.style.display = "";
        pr.setAttribute("points", drag.pts.map((pt) => pt.join(",")).join(" "));
      }
    } else if (drag.type === "spray") {
      drag.r = Math.max(0.3, Math.hypot(p.x - drag.x0, p.y - drag.y0));
      const pr = root.getElementById("spray-preview");
      pr.style.display = "";
      pr.setAttribute("cx", drag.x0);
      pr.setAttribute("cy", drag.y0);
      pr.setAttribute("r", drag.r);
    }
  });

  const finish = () => {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (d.type === "rotate") {
      layout.north_deg = d.deg;
      saveLayout(app, t("toast.saved"));
    } else if (d.type === "click-item") {
      openItemDialog(app, d.item);
    } else if (d.type === "move" || d.type === "resize") {
      if (d.moved) saveLayout(app);
      else openItemDialog(app, d.item);
    } else if (d.type === "draw") {
      if (d.moved && Math.abs((d.x1 ?? d.x0) - d.x0) > 0.5 && Math.abs((d.y1 ?? d.y0) - d.y0) > 0.5) {
        let kind = s.palette;
        let zone = null;
        if (kind.startsWith("zone-draw:")) {
          zone = app.data.zones.find((z) => z.id === kind.slice(10));
          kind = zone?.kind || "bed";
        }
        const item = {
          id: uid(),
          kind,
          label: zone ? zone.name : t("editor.palette." + kind),
          zone_id: zone?.id || null,
          x: clamp(Math.min(d.x0, d.x1), layout.width_m),
          y: clamp(Math.min(d.y0, d.y1), layout.height_m),
          w: clamp(Math.abs(d.x1 - d.x0), layout.width_m),
          h: clamp(Math.abs(d.y1 - d.y0), layout.height_m),
        };
        layout.items.push(item);
        s.palette = ""; // jednorazowe dodawanie
        if (zone) {
          saveLayout(app, t("toast.added"));
        } else {
          // narysowanie miejsca tworzy strefę — jedna tożsamość
          const nz = { id: uid(), name: item.label, emoji: AREA_EMOJI[kind] || "🪴", kind, planting: null };
          item.zone_id = nz.id;
          (async () => {
            try {
              app.data = await app.ws("item/save", { kind: "zones", item: nz });
              app.data = await app.ws("layout/save", { layout });
            } catch (e) {
              app.toast(`⚠ ${e.message || e}`, true);
              return;
            }
            app.render();
            app.toast(t("toast.added"));
            areaDialog(app, item);
          })();
        }
      } else {
        app.render();
      }
    } else if (d.type === "path") {
      if (d.pts.length >= 2) {
        let item;
        let after = null;
        if (s.palette === "fence") {
          item = { id: uid(), kind: "fence", label: t("editor.palette.fence"), path: d.pts };
          s.palette = "";
        } else if (s.palette === "hedge") {
          item = {
            id: uid(), kind: "hedge", label: t("editor.palette.hedge"), path: d.pts,
            name: "", emoji: "🌲", spacing_m: 0.5, diameter_m: 0.6, height_m: 2,
          };
          after = () => hedgeDialog(app, item);
          s.palette = "";
        } else {
          const section = sectionFor(s.palette);
          if (!section) {
            app.render();
            return;
          }
          item = {
            id: uid(),
            kind: "irrigation",
            mode: "drip",
            section_id: section.id,
            label: section.name,
            path: d.pts,
          };
          s.palette = "";
        }
        layout.items.push(item);
        saveLayout(app, t("toast.added"));
        after?.();
      } else {
        app.render();
      }
    } else if (d.type === "spray") {
      const section = sectionFor(s.palette);
      if (section && d.r >= 0.5) {
        layout.items.push({
          id: uid(),
          kind: "irrigation",
          mode: "sprinkler",
          section_id: section.id,
          label: section.name,
          x: Math.round(d.x0 * 10) / 10,
          y: Math.round(d.y0 * 10) / 10,
          radius_m: Math.round(d.r * 10) / 10,
        });
        s.palette = "";
        saveLayout(app, t("toast.added"));
      } else {
        app.render();
      }
    } else if (d.type === "place") {
      addCircle(app, d);
    }
  };
  svgEl.addEventListener("pointerup", finish);
  svgEl.addEventListener("pointercancel", () => (drag = null));
}

function bindDetail(app, root) {
  const s = st(app);
  const area = app.data.layout.items.find((i) => i.id === s.zoneDetail);
  const layout = app.data.layout;
  root.querySelector('[data-bind="detail-palette"]')?.addEventListener("change", (ev) => {
    if (ev.target.value === "new") {
      // nowa roślina prosto z obszaru — strefa obszaru prefilowana; po zapisie pojawi się w liście do posadzenia
      ev.target.value = "";
      s.detailPalette = "";
      plantDialog(app, { name: "", species: "", emoji: "", zone_id: area?.zone_id || "", planting: "", sensors: {} });
      return;
    }
    s.detailPalette = ev.target.value;
  });
  const svgEl = root.getElementById("detail-svg");
  if (!svgEl || !area) return;
  let drag = null;
  const clampA = (v, min, max) => Math.round(Math.min(Math.max(v, min), max) * 10) / 10;

  const inArea = (x, y) => [clampA(x, area.x, area.x + area.w), clampA(y, area.y, area.y + area.h)];
  svgEl.addEventListener("pointerdown", (ev) => {
    ev.preventDefault();
    const p = svgPoint(svgEl, ev);
    const node = ev.target.closest(".item[data-id]");
    svgEl.setPointerCapture(ev.pointerId);
    if (node) {
      const item = layout.items.find((i) => i.id === node.dataset.id);
      if (item && isLine(item)) {
        drag = { type: "line-click", item };
      } else {
        drag = ev.shiftKey
          ? { type: "move", item, node, dx: item.x - p.x, dy: item.y - p.y, moved: false }
          : { type: "click", item };
      }
    } else if (s.detailPalette === "row") {
      drag = { type: "path", pts: [inArea(p.x, p.y)] };
    } else {
      drag = { type: "place", x: p.x, y: p.y };
    }
  });
  svgEl.addEventListener("pointermove", (ev) => {
    if (!drag) return;
    const p = svgPoint(svgEl, ev);
    if (drag.type === "move") {
      drag.moved = true;
      drag.item.x = clampA(p.x + drag.dx, area.x, area.x + area.w);
      drag.item.y = clampA(p.y + drag.dy, area.y, area.y + area.h);
      drag.node.setAttribute("transform", `translate(${drag.item.x} ${drag.item.y})`);
    } else if (drag.type === "path") {
      const [nx, ny] = inArea(p.x, p.y);
      const last = drag.pts[drag.pts.length - 1];
      if (Math.hypot(nx - last[0], ny - last[1]) > 0.2) {
        drag.pts.push([nx, ny]);
        const pr = root.getElementById("path-preview");
        pr.style.display = "";
        pr.setAttribute("points", drag.pts.map((pt) => pt.join(",")).join(" "));
      }
    }
  });
  svgEl.addEventListener("pointerup", () => {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (d.type === "line-click") {
      (d.item.kind === "hedge" ? hedgeDialog : rowDialog)(app, d.item);
      return;
    }
    if (d.type === "click") {
      circleDialog(app, d.item);
      return;
    }
    if (d.type === "move") {
      if (d.moved) saveLayout(app);
      else circleDialog(app, d.item);
      return;
    }
    if (d.type === "path") {
      if (d.pts.length >= 2) {
        const item = {
          id: uid(), kind: "row", label: t("editor.palette.row"), path: d.pts,
          zone_id: area.zone_id || null, plants: [],
        };
        layout.items.push(item);
        s.detailPalette = ""; // jednorazowe dodawanie
        saveLayout(app, t("toast.added"));
        rowDialog(app, item);
      } else {
        app.render();
      }
      return;
    }
    if (!s.detailPalette) return;
    if (d.x < area.x || d.x > area.x + area.w || d.y < area.y || d.y > area.y + area.h) return;
    placeFromPalette(app, s.detailPalette, d, () => (s.detailPalette = ""));
  });
}

function placeFromPalette(app, palette, p, onPlaced = null) {
  const layout = app.data.layout;
  let kind = palette;
  let plantId = null;
  let label;
  if (kind.startsWith("plant:")) {
    plantId = kind.slice(6);
    const plant = app.data.plants.find((x) => x.id === plantId);
    if (!plant || placedPlantIds(app).has(plantId)) return; // 1 reprezentacja na roślinę
    kind = "plant";
    label = plant.name;
  } else {
    label = t(`editor.palette.${kind}`);
  }
  if (!CIRCLE_DEFAULTS[kind]) return;
  layout.items.push({
    id: uid(),
    kind,
    plant_id: plantId,
    label,
    x: Math.round(p.x * 10) / 10,
    y: Math.round(p.y * 10) / 10,
    ...CIRCLE_DEFAULTS[kind],
  });
  onPlaced?.();
  saveLayout(app, t("toast.added"));
}

function addCircle(app, p) {
  const s = st(app);
  placeFromPalette(app, s.palette, p, () => (s.palette = "")); // jednorazowe dodawanie
}

/* Klik elementu w trybie edycji: otwórz właściwy dialog / szczegóły strefy. */
function openItemDialog(app, item) {
  const s = st(app);
  if (isArea(item)) {
    s.zoneDetail = item.id;
    app.render();
  } else if (item.kind === "hedge") {
    hedgeDialog(app, item);
  } else if (item.kind === "row") {
    rowDialog(app, item);
  } else if (isPath(item)) {
    pathDialog(app, item);
  } else if (isSpray(item)) {
    sprayDialog(app, item);
  } else {
    circleDialog(app, item);
  }
}

/* --- Klik w trybie podglądu --- */

function viewClick(app, itemId) {
  const item = app.data.layout.items.find((i) => i.id === itemId);
  if (!item) return;
  if (isArea(item)) {
    if (item.zone_id && app.data.zones.some((z) => z.id === item.zone_id)) {
      openZoneCard(app, item.zone_id);
    } else {
      areaInfoDialog(app, item);
    }
    return;
  }
  if (item.plant_id && app.data.plants.some((p) => p.id === item.plant_id)) {
    openPlantCard(app, item.plant_id);
    return;
  }
  if (item.kind === "irrigation") {
    const section = app.data.irrigation.sections.find((x) => x.id === item.section_id);
    app.dialog(
      `<h2>💧 ${esc(item.label)}</h2>
      <p style="color:var(--secondary-text-color)">${t("water.kind." + (section?.kind || "other"))}${item.radius_m ? ` · ⌀ ${Math.round(item.radius_m * 2 * 10) / 10} m` : ""}</p>
      <div class="dialog-actions"><button type="button" class="btn plain" data-cancel>${t("close")}</button></div>`,
      () => {}
    );
    return;
  }
  const glyph = KIND_GLYPH[item.kind] || "🪵";
  const dims = isPath(item) ? "" : `⌀ ${item.diameter_m} m · ↑ ${item.height_m} m`;
  app.dialog(
    `<h2>${glyph} ${esc(item.label)}</h2>
    ${dims ? `<p style="color:var(--secondary-text-color)">${dims}</p>` : ""}
    ${["plant", "tree", "shrub"].includes(item.kind) && !item.plant_id ? `<div class="warn-hint"><ha-icon icon="mdi:link-variant-off"></ha-icon>${t("editor.unassigned")}</div>` : ""}
    <div class="dialog-actions"><button type="button" class="btn plain" data-cancel>${t("close")}</button></div>`,
    () => {}
  );
}

function areaInfoDialog(app, item) {
  const inside = app.data.layout.items.filter((i) => isCircle(i) && insideRect(i, item));
  app.dialog(
    `<h2>${AREA_EMOJI[item.kind] || "📦"} ${esc(areaName(app, item))}</h2>
    <p style="color:var(--secondary-text-color)">${item.w} × ${item.h} m · ${t("editor.area.unlinked")}</p>
    ${item.kind === "greenhouse" ? `<div class="ai-hint"><ha-icon icon="mdi:home-thermometer-outline"></ha-icon>${t("editor.greenhouse.info")}</div>` : ""}
    ${
      inside.length
        ? `<div class="section-title">${t("zonecard.plants")}</div>` +
          inside.map((i) => `<div class="note-row"><span class="txt">${esc(i.label)}</span></div>`).join("")
        : ""
    }
    <div class="dialog-actions"><button type="button" class="btn plain" data-cancel>${t("close")}</button></div>`,
    () => {}
  );
}

/* --- Dialogi edycyjne --- */

function areaDialog(app, item) {
  const zoneOpts = app.data.zones.map((z) => ({ value: z.id, label: `${z.emoji || "🪴"} ${z.name}` }));
  const dlg = app.dialog(
    `<h2>${t("editor.item.edit")}</h2>
    <form>
      <label>${t("name")}</label>
      <input name="label" required maxlength="60" value="${esc(areaName(app, item))}" autofocus>
      <label>${t("editor.zone.link")}</label>
      ${combo({ name: "zone_id", value: item.zone_id || "", options: zoneOpts })}
      <label>${t("editor.width")}</label><input name="w" type="number" step="0.1" min="0.5" value="${item.w}">
      <label>${t("editor.height")}</label><input name="h" type="number" step="0.1" min="0.5" value="${item.h}">
      <div class="dialog-actions">
        <button type="button" class="btn plain" id="area-del" style="margin-right:auto;color:var(--rl-crisis)">${t("delete")}</button>
        <button type="button" class="btn plain" data-cancel>${t("cancel")}</button>
        <button type="submit" class="btn">${t("save")}</button>
      </div>
    </form>`,
    async (fd) => {
      // edycja po id — app.data mogło zostać podmienione od czasu otwarcia dialogu
      const layout = app.data.layout;
      const it = layout.items.find((i) => i.id === item.id) || item;
      const name = fd.get("label").trim();
      it.zone_id = fd.get("zone_id") || it.zone_id || null;
      it.w = parseFloat(fd.get("w")) || it.w;
      it.h = parseFloat(fd.get("h")) || it.h;
      it.label = name;
      try {
        if (it.zone_id) {
          // nazwa obszaru edytuje strefę — rysunek to tylko kształt
          app.data = await app.ws("item/save", { kind: "zones", item: { id: it.zone_id, name } });
        }
        app.data = await app.ws("layout/save", { layout });
      } catch (e) {
        app.toast(`⚠ ${e.message || e}`, true);
        return;
      }
      app.render();
      app.toast(t("toast.saved"));
    }
  );
  dlg.querySelector("#area-del").addEventListener("click", () => {
    if (!confirm(t("editor.item.delete.confirm"))) return;
    app.data.layout.items = app.data.layout.items.filter((i) => i.id !== item.id);
    st(app).zoneDetail = null;
    dlg.close();
    saveLayout(app, t("toast.deleted"));
  });
}

const presetIdxByName = (name) => {
  const i = PLANT_PRESETS.findIndex((p) => p.name === name);
  return i >= 0 ? String(i) : "";
};
const presetComboOpts = () =>
  PLANT_PRESETS.map((p, i) => ({ value: String(i), label: p.name, secondary: p.species, icon: p.emoji }));

/* Żywopłot: jedna roślina powtarzana w rozstawie — wymiary głównie pod cień. */
function hedgeDialog(app, item) {
  const dlg = app.dialog(
    `<h2>🌲 ${t("editor.palette.hedge")}</h2>
    <form>
      <label>${t("name")}</label>
      <input name="label" required maxlength="60" value="${esc(item.label)}">
      <label>${t("plant.preset")}</label>
      ${combo({ name: "preset", value: presetIdxByName(item.name), options: presetComboOpts() })}
      <div style="display:flex;gap:10px">
        <span style="flex:1"><label>${t("hedge.spacing")}</label>
        <input name="spacing" type="number" step="0.05" min="0.1" value="${item.spacing_m}" style="width:100%"></span>
        <span style="flex:1"><label>${t("editor.diameter")}</label>
        <input name="diameter" type="number" step="0.1" min="0.1" value="${item.diameter_m}" style="width:100%"></span>
        <span style="flex:1"><label>${t("editor.heightm")}</label>
        <input name="height" type="number" step="0.1" min="0.1" value="${item.height_m}" style="width:100%"></span>
      </div>
      <div class="dialog-actions">
        <button type="button" class="btn plain" id="line-del" style="margin-right:auto;color:var(--rl-crisis)">${t("delete")}</button>
        <button type="button" class="btn plain" data-cancel>${t("cancel")}</button>
        <button type="submit" class="btn">${t("save")}</button>
      </div>
    </form>`,
    (fd) => {
      const it = app.data.layout.items.find((i) => i.id === item.id) || item;
      it.label = fd.get("label").trim();
      it.spacing_m = parseFloat(fd.get("spacing")) || it.spacing_m;
      it.diameter_m = parseFloat(fd.get("diameter")) || it.diameter_m;
      it.height_m = parseFloat(fd.get("height")) || it.height_m;
      const preset = PLANT_PRESETS[parseInt(fd.get("preset"), 10)];
      if (preset) {
        it.name = preset.name;
        it.emoji = preset.emoji;
      }
      saveLayout(app, t("toast.saved"));
    }
  );
  // preset → prefill nazwy i wymiarów (rozstaw = rozstawa presetu albo średnica)
  dlg.querySelector('input[name="preset"]').addEventListener("change", (ev) => {
    const p = PLANT_PRESETS[parseInt(ev.target.value, 10)];
    if (!p) return;
    dlg.querySelector('input[name="label"]').value = p.name;
    dlg.querySelector('input[name="diameter"]').value = p.diameter_m || 0.6;
    dlg.querySelector('input[name="height"]').value = p.height_m || 2;
    dlg.querySelector('input[name="spacing"]').value = p.spacing_cm ? p.spacing_cm / 100 : p.diameter_m || 0.5;
  });
  lineDelete(app, dlg, item);
}

/* Grządka (linia): rośliny z kart + liczba sztuk — równe odcinki, roślina na odcinek. */
function rowDialog(app, item) {
  const zoneOpts = app.data.zones.map((z) => ({ value: z.id, label: z.name, icon: z.emoji || "🪴" }));
  const plantOpts = app.data.plants.map((p) => ({ value: p.id, label: p.name, secondary: p.species, icon: p.emoji || "🌱" }));
  const rowBlock = (pl = {}) => `<div class="rowdef" style="display:flex;gap:8px;align-items:flex-end;margin-bottom:6px">
      <span style="flex:1">${combo({ name: "rp", value: pl.plant_id || "", options: plantOpts, allowEmpty: false })}</span>
      <span><label style="font-size:11px">${t("row.count")}</label>
      <input name="rc" type="number" step="1" min="1" max="500" value="${pl.count ?? 5}" style="width:70px"></span>
      <button type="button" class="icon-btn rowdef-del" title="${t("delete")}"><ha-icon icon="mdi:close"></ha-icon></button>
    </div>`;
  const dlg = app.dialog(
    `<h2>🥕 ${t("editor.palette.row")}</h2>
    <form>
      <label>${t("name")}</label>
      <input name="label" required maxlength="60" value="${esc(item.label)}">
      <label>${t("editor.zone.link")}</label>
      ${combo({ name: "zone_id", value: item.zone_id || "", options: zoneOpts })}
      <label>${t("row.plants")}</label>
      <div id="row-plants">${(item.plants?.length ? item.plants : [{}]).map(rowBlock).join("")}</div>
      <button type="button" class="btn small ghost" id="row-add"><ha-icon icon="mdi:plus"></ha-icon>${t("row.addplant")}</button>
      <div class="dialog-actions">
        <button type="button" class="btn plain" id="line-del" style="margin-right:auto;color:var(--rl-crisis)">${t("delete")}</button>
        <button type="button" class="btn plain" data-cancel>${t("cancel")}</button>
        <button type="submit" class="btn">${t("save")}</button>
      </div>
    </form>`,
    (fd) => {
      const it = app.data.layout.items.find((i) => i.id === item.id) || item;
      it.label = fd.get("label").trim();
      it.zone_id = fd.get("zone_id") || null;
      it.plants = [...dlg.querySelectorAll(".rowdef")]
        .map((el) => {
          const plant = app.data.plants.find((p) => p.id === el.querySelector('input[name="rp"]').value);
          if (!plant) return null;
          const preset = PLANT_PRESETS.find((x) => x.name === plant.name);
          return {
            plant_id: plant.id,
            name: plant.name,
            emoji: plant.emoji || "🌱",
            count: Math.max(1, parseInt(el.querySelector('input[name="rc"]').value, 10) || 1),
            diameter_m: preset?.diameter_m || 0.3,
            height_m: preset?.height_m || 0.4,
          };
        })
        .filter(Boolean);
      saveLayout(app, t("toast.saved"));
    }
  );
  dlg.querySelector("#row-add").addEventListener("click", () => {
    const box = dlg.querySelector("#row-plants");
    box.insertAdjacentHTML("beforeend", rowBlock());
    wireCombos(box.lastElementChild);
  });
  dlg.querySelector("#row-plants").addEventListener("click", (ev) => {
    const del = ev.target.closest(".rowdef-del");
    if (del) del.closest(".rowdef").remove();
  });
  lineDelete(app, dlg, item);
}

function lineDelete(app, dlg, item) {
  dlg.querySelector("#line-del").addEventListener("click", () => {
    if (!confirm(t("editor.item.delete.confirm"))) return;
    app.data.layout.items = app.data.layout.items.filter((i) => i.id !== item.id);
    dlg.close();
    saveLayout(app, t("toast.deleted"));
  });
}

function circleDialog(app, item) {
  const linkable = ["plant", "tree", "shrub"].includes(item.kind);
  const linked = item.plant_id ? app.data.plants.find((p) => p.id === item.plant_id) : null;
  const linkOpts = unplacedPlants(app).map((p) => ({ value: p.id, label: `${p.emoji || "🌱"} ${p.name}`, secondary: p.species }));
  if (linked) linkOpts.unshift({ value: linked.id, label: `${linked.emoji || "🌱"} ${linked.name}` });
  const dlg = app.dialog(
    `<h2>${t("editor.item.edit")}</h2>
    <form>
      <label>${t("editor.label")}</label>
      <input name="label" required maxlength="40" value="${esc(item.label)}" autofocus>
      <label>${t("editor.diameter")}</label><input name="diameter" type="number" step="0.1" min="0.1" max="30" value="${item.diameter_m}">
      <label>${t("editor.heightm")}</label><input name="height" type="number" step="0.1" min="0" max="40" value="${item.height_m}">
      <label>${t("editor.crownbase")}</label><input name="crownbase" type="number" step="0.1" min="0" max="40" value="${crownBase(item)}">
      ${
        linkable
          ? `<label>${t("editor.assign")}</label>
             ${combo({ name: "link_plant", value: item.plant_id || "", options: linkOpts })}
             ${!linked ? `<label>${t("editor.assign.new")}</label><input name="new_plant" maxlength="60" placeholder="${t("plant.name.ph")}">` : ""}`
          : ""
      }
      <div class="dialog-actions">
        <button type="button" class="btn plain" id="circle-del" style="margin-right:auto;color:var(--rl-crisis)">${t("delete")}</button>
        ${item.plant_id ? `<button type="button" class="btn ghost" data-action="plant-card" data-id="${item.plant_id}">${t("plant.details")}</button>` : ""}
        <button type="button" class="btn plain" data-cancel>${t("cancel")}</button>
        <button type="submit" class="btn">${t("save")}</button>
      </div>
    </form>`,
    async (fd) => {
      item.label = fd.get("label").trim();
      item.diameter_m = parseFloat(fd.get("diameter")) || item.diameter_m;
      item.height_m = parseFloat(fd.get("height")) || 0;
      item.crown_base_m = Math.min(parseFloat(fd.get("crownbase")) || 0, item.height_m);
      if (linkable) {
        const linkId = fd.get("link_plant");
        const newName = (fd.get("new_plant") || "").trim();
        if (newName && !linkId) {
          // nowa roślina: w szczegółach strefy dziedziczy jej strefę, na planie głównym — do uzupełnienia
          const areaId = st(app).zoneDetail;
          const area = areaId ? app.data.layout.items.find((i) => i.id === areaId) : null;
          const pid = uid();
          try {
            await app.ws("item/save", {
              kind: "plants",
              item: { id: pid, name: newName, zone_id: area?.zone_id || null, sensors: {} },
            });
          } catch (e) {
            app.toast(`⚠ ${e.message || e}`, true);
            return;
          }
          item.plant_id = pid;
          item.kind = "plant";
          item.label = newName;
        } else if (linkId) {
          const plant = app.data.plants.find((p) => p.id === linkId);
          if (plant) {
            item.plant_id = plant.id;
            item.kind = "plant";
            item.label = plant.name;
          }
        } else {
          item.plant_id = null;
        }
      }
      saveLayout(app, t("toast.saved"));
    }
  );
  dlg.querySelector("#circle-del").addEventListener("click", () => {
    if (!confirm(t("editor.item.delete.confirm"))) return;
    app.data.layout.items = app.data.layout.items.filter((i) => i.id !== item.id);
    dlg.close();
    saveLayout(app, t("toast.deleted"));
  });
}

function sprayDialog(app, item) {
  const dlg = app.dialog(
    `<h2>💦 ${esc(item.label)}</h2>
    <form>
      <label>${t("editor.spray.radius")}</label>
      <input name="radius" type="number" step="0.1" min="0.5" max="30" value="${item.radius_m || 2}">
      <div class="dialog-actions">
        <button type="button" class="btn plain" id="spray-del" style="margin-right:auto;color:var(--rl-crisis)">${t("delete")}</button>
        <button type="button" class="btn plain" data-cancel>${t("cancel")}</button>
        <button type="submit" class="btn">${t("save")}</button>
      </div>
    </form>`,
    (fd) => {
      item.radius_m = parseFloat(fd.get("radius")) || item.radius_m;
      saveLayout(app, t("toast.saved"));
    }
  );
  dlg.querySelector("#spray-del").addEventListener("click", () => {
    if (!confirm(t("editor.item.delete.confirm"))) return;
    app.data.layout.items = app.data.layout.items.filter((i) => i.id !== item.id);
    dlg.close();
    saveLayout(app, t("toast.deleted"));
  });
}

function pathDialog(app, item) {
  const dlg = app.dialog(
    `<h2>${item.kind === "fence" ? "🪵" : "💧"} ${esc(item.label)}</h2>
    <form>
      <label>${t("editor.label")}</label>
      <input name="label" required maxlength="40" value="${esc(item.label)}">
      <div class="dialog-actions">
        <button type="button" class="btn plain" id="path-del" style="margin-right:auto;color:var(--rl-crisis)">${t("delete")}</button>
        <button type="button" class="btn plain" data-cancel>${t("cancel")}</button>
        <button type="submit" class="btn">${t("save")}</button>
      </div>
    </form>`,
    (fd) => {
      item.label = fd.get("label").trim();
      saveLayout(app, t("toast.saved"));
    }
  );
  dlg.querySelector("#path-del").addEventListener("click", () => {
    if (!confirm(t("editor.item.delete.confirm"))) return;
    app.data.layout.items = app.data.layout.items.filter((i) => i.id !== item.id);
    dlg.close();
    saveLayout(app, t("toast.deleted"));
  });
}

/* Dialog lokalizacji: mapa satelitarna z obrotem (strzałki / Shift+drag),
   zoomem pod ⌘/Ctrl i obrysem ogrodu punktami (sugestia wymiarów planu). */
function locationDialog(app) {
  const layout = app.data.layout;
  const start = layout.location || {
    latitude: app.hass.config.latitude || 52.2,
    longitude: app.hass.config.longitude || 21.0,
    zoom: 18,
  };
  let lat = start.latitude;
  let lon = start.longitude;
  let z = Math.max(3, Math.min(MAX_Z, start.zoom || 18));
  let ang = layout.north_deg || 0;
  let points = (layout.outline || []).map((pt) => ({ ...pt })); // trwały obrys
  let applied = points.length >= 3;
  let drawMode = false;
  let dims = null;

  const dlg = app.dialog(
    `<h2>${t("editor.location")}</h2>
    <div class="map-toolbar">
      <button type="button" class="icon-btn" id="map-rl" title="${t("editor.map.rotl")}"><ha-icon icon="mdi:rotate-left"></ha-icon></button>
      <button type="button" class="icon-btn" id="map-rr" title="${t("editor.map.rotr")}"><ha-icon icon="mdi:rotate-right"></ha-icon></button>
      <span style="font-size:12px;color:var(--secondary-text-color);min-width:34px" id="map-ang">${ang}°</span>
      <button type="button" class="btn small ghost" id="map-outline"><ha-icon icon="mdi:vector-polygon"></ha-icon>${t("editor.map.outline")}</button>
      <button type="button" class="btn small plain" id="map-clear" style="display:${points.length ? "" : "none"}">${t("editor.map.clear")}</button>
      <span class="dims" id="map-dims"></span>
      <button type="button" class="btn small" id="map-apply" style="display:none">${t("editor.map.apply")}</button>
    </div>
    <div id="map-view">
      <div id="map-tiles"></div>
      <ha-icon class="map-cross" icon="mdi:crosshairs"></ha-icon>
      <div id="map-hint">${t("editor.map.zoomhint")}</div>
      <div class="map-zoom">
        <button type="button" id="map-zin"><ha-icon icon="mdi:plus"></ha-icon></button>
        <button type="button" id="map-zout"><ha-icon icon="mdi:minus"></ha-icon></button>
      </div>
      <div class="sat-attr">${ATTRIBUTION}</div>
    </div>
    <p id="map-coords" style="font-size:12px;color:var(--secondary-text-color);margin:8px 0 0"></p>
    <p class="editor-hint" id="map-mode-hint" style="margin:4px 0 0">${t("editor.location.hint")}</p>
    <div class="dialog-actions">
      <button type="button" class="btn plain" data-cancel>${t("cancel")}</button>
      <button type="button" class="btn" id="map-save">${t("save")}</button>
    </div>`,
    () => {},
    { wide: true }
  );
  const view = dlg.querySelector("#map-view");
  const tiles = dlg.querySelector("#map-tiles");
  const rad = () => (ang * Math.PI) / 180;
  let diag = 0;

  const baseTransform = (dx = 0, dy = 0) =>
    `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${ang}deg)`;

  const polyHtml = () => {
    if (!points.length) return "";
    const cx = lonToX(lon, z) - diag / 2;
    const cy = latToY(lat, z) - diag / 2;
    const px = points.map((pt) => [lonToX(pt.lon, z) - cx, latToY(pt.lat, z) - cy]);
    const shape =
      px.length >= 3
        ? `<polygon points="${px.map((c) => c.join(",")).join(" ")}"/>`
        : px.length === 2
          ? `<polyline points="${px.map((c) => c.join(",")).join(" ")}"/>`
          : "";
    return (
      `<svg id="map-poly" width="${diag}" height="${diag}">${shape}</svg>` +
      px
        .map((c, i) => `<div class="map-pt" data-i="${i}" style="left:${c[0]}px;top:${c[1]}px"></div>`)
        .join("")
    );
  };
  const repaintPoly = () => {
    const layer = tiles.querySelector("#poly-layer");
    if (layer) layer.innerHTML = polyHtml();
  };

  const paint = () => {
    const w = view.clientWidth;
    const h = view.clientHeight;
    if (!w) return;
    diag = Math.ceil(Math.hypot(w, h)) + 256;
    tiles.style.position = "absolute";
    tiles.style.left = "50%";
    tiles.style.top = "50%";
    tiles.style.width = `${diag}px`;
    tiles.style.height = `${diag}px`;
    tiles.style.transform = baseTransform();
    tiles.innerHTML =
      gridHtml(lat, lon, z, diag, diag) + `<div id="poly-layer">${polyHtml()}</div>`;
    dlg.querySelector("#map-coords").textContent = `${lat.toFixed(5)}, ${lon.toFixed(5)} · zoom ${z}`;
    dlg.querySelector("#map-ang").textContent = `${ang}°`;
  };
  requestAnimationFrame(() => {
    paint();
    updateDims();
  });

  const updateDims = () => {
    const el = dlg.querySelector("#map-dims");
    const apply = dlg.querySelector("#map-apply");
    if (points.length < 3) {
      el.textContent = drawMode ? t("editor.map.outline.hint") : "";
      apply.style.display = "none";
      dims = null;
      return;
    }
    const wx = points.map((pt) => lonToX(pt.lon, z));
    const wy = points.map((pt) => latToY(pt.lat, z));
    const cx = wx.reduce((a, b) => a + b, 0) / wx.length;
    const cy = wy.reduce((a, b) => a + b, 0) / wy.length;
    const a = rad();
    const rx = [];
    const ry = [];
    for (let i = 0; i < wx.length; i++) {
      const dx = wx[i] - cx;
      const dy = wy[i] - cy;
      rx.push(dx * Math.cos(a) - dy * Math.sin(a));
      ry.push(dx * Math.sin(a) + dy * Math.cos(a));
    }
    const centroidLat = yToLat(cy, z);
    const mpp = metersPerPixel(centroidLat, z);
    dims = {
      w: Math.max(2, Math.round((Math.max(...rx) - Math.min(...rx)) * mpp)),
      h: Math.max(2, Math.round((Math.max(...ry) - Math.min(...ry)) * mpp)),
      lat: centroidLat,
      lon: xToLon(cx, z),
    };
    el.textContent = t("editor.map.dims", { w: dims.w, h: dims.h });
    apply.textContent = t(applied ? "editor.map.update" : "editor.map.apply");
    apply.style.display = "";
  };

  let gesture = null;
  const screenToMapDelta = (sx, sy) => {
    const a = rad();
    return { mdx: sx * Math.cos(a) + sy * Math.sin(a), mdy: -sx * Math.sin(a) + sy * Math.cos(a) };
  };
  view.addEventListener("pointerdown", (ev) => {
    if (ev.target.closest("button")) return;
    const rect = view.getBoundingClientRect();
    const ptEl = ev.target.closest(".map-pt");
    if (ptEl) {
      gesture = { type: "point", i: parseInt(ptEl.dataset.i, 10) };
      view.setPointerCapture(ev.pointerId);
      return;
    }
    if (ev.shiftKey) {
      const sx = ev.clientX - rect.left - rect.width / 2;
      const sy = ev.clientY - rect.top - rect.height / 2;
      gesture = { type: "rotate", start: (Math.atan2(sy, sx) * 180) / Math.PI, ang0: ang };
    } else {
      gesture = { type: "pan", x: ev.clientX, y: ev.clientY, dx: 0, dy: 0, moved: false };
    }
    view.setPointerCapture(ev.pointerId);
  });
  view.addEventListener("pointermove", (ev) => {
    if (!gesture) return;
    const rect = view.getBoundingClientRect();
    if (gesture.type === "point") {
      const sx = ev.clientX - rect.left - rect.width / 2;
      const sy = ev.clientY - rect.top - rect.height / 2;
      const { mdx, mdy } = screenToMapDelta(sx, sy);
      points[gesture.i] = {
        lat: yToLat(latToY(lat, z) + mdy, z),
        lon: xToLon(lonToX(lon, z) + mdx, z),
      };
      repaintPoly();
      return;
    }
    if (gesture.type === "rotate") {
      const sx = ev.clientX - rect.left - rect.width / 2;
      const sy = ev.clientY - rect.top - rect.height / 2;
      const cur = (Math.atan2(sy, sx) * 180) / Math.PI;
      ang = Math.round((((gesture.ang0 + cur - gesture.start) % 360) + 360) % 360);
      tiles.style.transform = baseTransform();
      dlg.querySelector("#map-ang").textContent = `${ang}°`;
    } else {
      gesture.dx = ev.clientX - gesture.x;
      gesture.dy = ev.clientY - gesture.y;
      if (Math.hypot(gesture.dx, gesture.dy) > 4) gesture.moved = true;
      tiles.style.transform = baseTransform(gesture.dx, gesture.dy);
    }
  });
  view.addEventListener("pointerup", (ev) => {
    if (!gesture) return;
    const g = gesture;
    gesture = null;
    if (g.type === "point") {
      updateDims();
      return;
    }
    if (g.type === "rotate") {
      updateDims();
      return;
    }
    if (!g.moved && drawMode) {
      const rect = view.getBoundingClientRect();
      const sx = ev.clientX - rect.left - rect.width / 2;
      const sy = ev.clientY - rect.top - rect.height / 2;
      const a = rad();
      const mdx = sx * Math.cos(a) + sy * Math.sin(a);
      const mdy = -sx * Math.sin(a) + sy * Math.cos(a);
      points.push({
        lat: yToLat(latToY(lat, z) + mdy, z),
        lon: xToLon(lonToX(lon, z) + mdx, z),
      });
      paint();
      updateDims();
      return;
    }
    if (g.moved) {
      const a = rad();
      const mdx = g.dx * Math.cos(a) + g.dy * Math.sin(a);
      const mdy = -g.dx * Math.sin(a) + g.dy * Math.cos(a);
      lon = xToLon(lonToX(lon, z) - mdx, z);
      lat = yToLat(latToY(lat, z) - mdy, z);
      paint();
    }
  });

  const hint = dlg.querySelector("#map-hint");
  let hintTimer = null;
  view.addEventListener(
    "wheel",
    (ev) => {
      ev.preventDefault();
      if (!ev.metaKey && !ev.ctrlKey) {
        hint.classList.add("show");
        clearTimeout(hintTimer);
        hintTimer = setTimeout(() => hint.classList.remove("show"), 1400);
        return;
      }
      setZoom(z + (ev.deltaY < 0 ? 1 : -1));
    },
    { passive: false }
  );
  const setZoom = (nz) => {
    nz = Math.max(3, Math.min(MAX_Z, nz));
    if (nz !== z) {
      z = nz;
      paint();
      updateDims();
    }
  };
  dlg.querySelector("#map-zin").addEventListener("click", () => setZoom(z + 1));
  dlg.querySelector("#map-zout").addEventListener("click", () => setZoom(z - 1));
  const rot = (delta) => {
    ang = (((ang + delta) % 360) + 360) % 360;
    tiles.style.transform = baseTransform();
    dlg.querySelector("#map-ang").textContent = `${ang}°`;
    updateDims();
  };
  dlg.querySelector("#map-rl").addEventListener("click", () => rot(-15));
  dlg.querySelector("#map-rr").addEventListener("click", () => rot(15));
  dlg.querySelector("#map-outline").addEventListener("click", (ev) => {
    drawMode = !drawMode;
    ev.currentTarget.classList.toggle("plain", drawMode);
    dlg.querySelector("#map-clear").style.display = drawMode || points.length ? "" : "none";
    dlg.querySelector("#map-mode-hint").textContent = drawMode
      ? t("editor.map.outline.hint")
      : t("editor.location.hint");
    updateDims();
  });
  dlg.querySelector("#map-clear").addEventListener("click", () => {
    points = [];
    applied = false;
    paint();
    updateDims();
  });
  dlg.querySelector("#map-apply").addEventListener("click", () => {
    if (!dims) return;
    layout.width_m = dims.w;
    layout.height_m = dims.h;
    lat = dims.lat;
    lon = dims.lon;
    applied = true;
    paint();
    updateDims();
  });
  dlg.querySelector("#map-save").addEventListener("click", () => {
    layout.location = { latitude: +lat.toFixed(6), longitude: +lon.toFixed(6), zoom: z };
    layout.outline = points.length ? points : null; // obrys zostaje na następne wejście
    layout.north_deg = ang;
    st(app).sat = true;
    dlg.close();
    saveLayout(app, t("toast.saved"));
  });
}

export const actions = {
  "editor-mode": (app, el) => {
    st(app).mode = el.dataset.mode;
    app.render();
  },
  "editor-back": (app) => {
    st(app).zoneDetail = null;
    app.render();
  },
  "editor-area-edit": (app, el) => {
    const item = app.data.layout.items.find((i) => i.id === el.dataset.id);
    if (item) areaDialog(app, item);
  },
  "editor-zoom": (app, el) => {
    const s = st(app);
    const f = el.dataset.d === "1" ? 1.25 : 0.8;
    s.zoom = Math.round(Math.min(2.5, Math.max(0.3, (s.zoom || 1) * f)) * 100) / 100;
    app.render();
  },
  "editor-sat": (app) => {
    st(app).sat = !st(app).sat;
    app.render();
  },
  "editor-location": (app) => locationDialog(app),
  "editor-garden": (app) => {
    const layout = app.data.layout;
    app.dialog(
      `<h2>${t("editor.garden")}</h2>
      <form>
        <label>${t("editor.width")}</label>
        <input name="w" type="number" min="2" max="500" value="${layout.width_m}">
        <label>${t("editor.height")}</label>
        <input name="h" type="number" min="2" max="500" value="${layout.height_m}">
        <div class="dialog-actions">
          <button type="button" class="btn plain" data-cancel>${t("cancel")}</button>
          <button type="submit" class="btn">${t("save")}</button>
        </div>
      </form>`,
      (fd) => {
        layout.width_m = parseFloat(fd.get("w")) || layout.width_m;
        layout.height_m = parseFloat(fd.get("h")) || layout.height_m;
        saveLayout(app, t("toast.saved"));
      }
    );
  },
};
