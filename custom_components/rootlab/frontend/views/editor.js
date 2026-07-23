import { t } from "../i18n.js";
import { combo, esc, uid } from "../util.js";
import { crownBase, insideRect, isShaded, northVector, shadowCapsule, solarPosition } from "../shade.js";
import { ATTRIBUTION, MAX_Z, gridHtml, latToY, lonToX, metersPerPixel, xToLon, yToLat } from "../satmap.js";
import { openPlantCard, openZoneCard } from "./plants.js";

export const ENABLED = true;

const AREA_KINDS = ["greenhouse", "bed", "lawn"];
const CIRCLE_DEFAULTS = {
  plant: { diameter_m: 0.5, height_m: 0.6, crown_base_m: 0 },
  tree: { diameter_m: 3, height_m: 5, crown_base_m: 2 },
  shrub: { diameter_m: 1, height_m: 1.2, crown_base_m: 0.2 },
  object: { diameter_m: 2, height_m: 2.5, crown_base_m: 0 },
};
const KIND_FILL = {
  plant: "var(--rl-green)",
  tree: "color-mix(in srgb, var(--rl-green) 70%, black)",
  shrub: "var(--rl-soil)",
  object: "var(--secondary-text-color)",
};
const AREA_EMOJI = { greenhouse: "🏠", bed: "🥕", lawn: "🌱" };

const st = (app) =>
  (app.editorState ??= {
    palette: "greenhouse",
    detailPalette: "",
    month: new Date().getMonth() + 1,
    hour: 12,
    mode: "view", // domyślnie podgląd
    sat: true,
    zoneDetail: null, // id obszaru otwartego w widoku szczegółowym
  });

const gardenLat = (app) =>
  app.data.layout.location?.latitude || app.hass.config.latitude || 52;
const gardenLon = (app) =>
  app.data.layout.location?.longitude || app.hass.config.longitude || 21;

/* Pozycja Słońca dla suwaków miesiąc+godzina (15. dzień miesiąca, czas lokalny). */
function sunFor(app) {
  const s = st(app);
  const now = new Date();
  const date = new Date(now.getFullYear(), s.month - 1, 15, s.hour, 0, 0);
  return solarPosition(gardenLat(app), gardenLon(app), date);
}
const isArea = (i) => "w" in i;

export function render(app) {
  const s = st(app);
  if (s.zoneDetail) {
    const area = app.data.layout.items.find((i) => i.id === s.zoneDetail);
    if (area) return renderDetail(app, area);
    s.zoneDetail = null;
  }
  const layout = app.data.layout;
  const satActive = s.sat && layout.location;
  return `
    <div class="toolbar">
      <div class="mode-toggle">
        <button class="${s.mode === "view" ? "on" : ""}" data-action="editor-mode" data-mode="view"><ha-icon icon="mdi:eye-outline" style="--mdc-icon-size:16px"></ha-icon>${t("editor.mode.view")}</button>
        <button class="${s.mode === "edit" ? "on" : ""}" data-action="editor-mode" data-mode="edit"><ha-icon icon="mdi:pencil" style="--mdc-icon-size:16px"></ha-icon>${t("editor.mode.edit")}</button>
      </div>
      ${
        s.mode === "edit"
          ? `<select class="inline" data-bind="palette">
              ${AREA_KINDS.map((k) => `<option value="${k}" ${s.palette === k ? "selected" : ""}>${AREA_EMOJI[k]} ${t("editor.palette." + k)}</option>`).join("")}
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
      <button class="btn small ${satActive ? "" : "plain"}" data-action="editor-sat" title="${t("editor.sat")}"
        ${layout.location ? "" : "disabled"}><ha-icon icon="mdi:satellite-variant"></ha-icon></button>
      <button class="btn ghost" data-action="editor-location"><ha-icon icon="mdi:map-marker-outline"></ha-icon>${t("editor.location")}</button>
      <button class="btn ghost" data-action="editor-garden"><ha-icon icon="mdi:cog-outline"></ha-icon>${t("editor.garden")}</button>
    </div>
    <div class="editor-wrap">
      <div id="editor-stage" style="position:relative;overflow:hidden;border-radius:8px">
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
  return `<g class="item" data-id="${i.id}" transform="translate(${i.x} ${i.y})">
    <circle r="${r}" fill="${KIND_FILL[i.kind] || KIND_FILL.object}" fill-opacity="0.75"/>
    <text y="${r + 0.6}">${esc(i.label)}${inGh ? " 🏠" : ""}${shaded ? " ☁" : ""}</text>
  </g>`;
}

function svg(app, satActive) {
  const s = st(app);
  const { width_m: W, height_m: H, north_deg: north = 0, items } = app.data.layout;
  const sun = sunFor(app);
  const circles = items.filter((i) => !isArea(i));
  const caps = circles.map((c) => ({ c, cap: shadowCapsule(c, sun, north) }));
  const areas = items.filter(isArea);

  const areaNodes = areas
    .map(
      (a) => `<g class="item-g" data-id="${a.id}">
      <rect class="area ${a.kind}" x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}" rx="0.2"/>
      <text x="${a.x + a.w / 2}" y="${a.y + 0.7}">${AREA_EMOJI[a.kind] || ""} ${esc(a.label)}</text>
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
    ${areaNodes}${shadows}${nodes}${compass}
    <rect id="draw-preview" class="draw-preview" style="display:none" />
  </svg>`;
}

/* --- Widok szczegółowy strefy: sadzenie roślin w konkretnych miejscach --- */

function renderDetail(app, area) {
  const s = st(app);
  const layout = app.data.layout;
  const zone = app.data.zones.find((z) => z.id === area.zone_id);
  const planted = new Set(layout.items.filter((i) => i.plant_id).map((i) => i.plant_id));
  const plantOpts = app.data.plants
    .map(
      (p) => `<option value="plant:${p.id}" ${s.detailPalette === "plant:" + p.id ? "selected" : ""}>
        ${esc(p.emoji || "🌱")} ${esc(p.name)}${planted.has(p.id) ? ` · ${t("editor.planted")}` : ""}</option>`
    )
    .join("");
  const pad = Math.max(1, Math.min(area.w, area.h) * 0.1);
  const north = layout.north_deg || 0;
  const sun = sunFor(app);
  const circles = layout.items.filter((i) => !isArea(i));
  const caps = circles.map((c) => ({ c, cap: shadowCapsule(c, sun, north) }));
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
      <b style="font-size:16px">${AREA_EMOJI[area.kind]} ${esc(area.label)}</b>
      ${zone ? `<span class="chip">${esc(zone.emoji || "🪴")} ${esc(zone.name)}</span>` : `<span class="chip harvest">${t("editor.area.unlinked")}</span>`}
      <div class="spacer"></div>
      <select class="inline" data-bind="detail-palette">
        <option value="">${t("editor.palette.pick")}</option>
        ${plantOpts ? `<optgroup label="${t("tab.plants")}">${plantOpts}</optgroup>` : ""}
        <optgroup label="${t("editor.group.objects")}">
          <option value="tree" ${s.detailPalette === "tree" ? "selected" : ""}>🌳 ${t("editor.palette.tree")}</option>
          <option value="shrub" ${s.detailPalette === "shrub" ? "selected" : ""}>🌿 ${t("editor.palette.shrub")}</option>
          <option value="object" ${s.detailPalette === "object" ? "selected" : ""}>📦 ${t("editor.palette.object")}</option>
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
        ${shadows}
        ${inside.map((i) => circleNode(app, i, caps)).join("")}
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

/* Podkład satelitarny pod planem: skala px/m planu dopasowana do metrów/px kafelków. */
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
  root.querySelector('[data-bind="palette"]')?.addEventListener("change", (ev) => (s.palette = ev.target.value));
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

  svgEl.addEventListener("pointerdown", (ev) => {
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
    if (handle) {
      const item = layout.items.find((i) => i.id === handle.dataset.id);
      drag = { type: "resize", item, moved: false };
    } else if (node) {
      const item = layout.items.find((i) => i.id === node.dataset.id);
      drag = { type: "move", item, node, dx: item.x - p.x, dy: item.y - p.y, moved: false };
    } else {
      drag = { type: "draw", x0: p.x, y0: p.y, moved: false };
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
    }
  });

  const finish = () => {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (d.type === "rotate") {
      layout.north_deg = d.deg;
      saveLayout(app, t("toast.saved"));
    } else if (d.type === "move" || d.type === "resize") {
      if (d.moved) saveLayout(app);
      else if (isArea(d.item)) {
        s.zoneDetail = d.item.id;
        app.render();
      } else {
        circleDialog(app, d.item);
      }
    } else if (d.type === "draw") {
      if (d.moved && Math.abs((d.x1 ?? d.x0) - d.x0) > 0.5 && Math.abs((d.y1 ?? d.y0) - d.y0) > 0.5) {
        const item = {
          id: uid(),
          kind: s.palette,
          label: t("editor.palette." + s.palette),
          zone_id: null,
          x: clamp(Math.min(d.x0, d.x1), layout.width_m),
          y: clamp(Math.min(d.y0, d.y1), layout.height_m),
          w: clamp(Math.abs(d.x1 - d.x0), layout.width_m),
          h: clamp(Math.abs(d.y1 - d.y0), layout.height_m),
        };
        layout.items.push(item);
        saveLayout(app, t("toast.added"));
        areaDialog(app, item); // od razu nazwij i powiąż ze strefą
      } else {
        app.render();
      }
    }
  };
  svgEl.addEventListener("pointerup", finish);
  svgEl.addEventListener("pointercancel", () => (drag = null));
}

function bindDetail(app, root) {
  const s = st(app);
  const area = app.data.layout.items.find((i) => i.id === s.zoneDetail);
  const layout = app.data.layout;
  root.querySelector('[data-bind="detail-palette"]')?.addEventListener("change", (ev) => (s.detailPalette = ev.target.value));
  const svgEl = root.getElementById("detail-svg");
  if (!svgEl || !area) return;
  let drag = null;
  const clampA = (v, min, max) => Math.round(Math.min(Math.max(v, min), max) * 10) / 10;

  svgEl.addEventListener("pointerdown", (ev) => {
    const p = svgPoint(svgEl, ev);
    const node = ev.target.closest(".item[data-id]");
    svgEl.setPointerCapture(ev.pointerId);
    if (node) {
      const item = layout.items.find((i) => i.id === node.dataset.id);
      drag = { type: "move", item, node, dx: item.x - p.x, dy: item.y - p.y, moved: false };
    } else {
      drag = { type: "place", x: p.x, y: p.y };
    }
  });
  svgEl.addEventListener("pointermove", (ev) => {
    if (!drag || drag.type !== "move") return;
    const p = svgPoint(svgEl, ev);
    drag.moved = true;
    drag.item.x = clampA(p.x + drag.dx, area.x, area.x + area.w);
    drag.item.y = clampA(p.y + drag.dy, area.y, area.y + area.h);
    drag.node.setAttribute("transform", `translate(${drag.item.x} ${drag.item.y})`);
  });
  svgEl.addEventListener("pointerup", () => {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (d.type === "move") {
      if (d.moved) saveLayout(app);
      else circleDialog(app, d.item);
      return;
    }
    // posadzenie: tylko wewnątrz obszaru i tylko gdy coś wybrano w palecie
    if (!s.detailPalette) return;
    if (d.x < area.x || d.x > area.x + area.w || d.y < area.y || d.y > area.y + area.h) return;
    let kind = s.detailPalette;
    let plantId = null;
    let label;
    if (kind.startsWith("plant:")) {
      plantId = kind.slice(6);
      const plant = app.data.plants.find((x) => x.id === plantId);
      if (!plant) return;
      kind = "plant";
      label = plant.name;
    } else {
      label = t(`editor.palette.${kind}`);
    }
    layout.items.push({
      id: uid(),
      kind,
      plant_id: plantId,
      label,
      x: Math.round(d.x * 10) / 10,
      y: Math.round(d.y * 10) / 10,
      ...CIRCLE_DEFAULTS[kind],
    });
    saveLayout(app, t("toast.added"));
  });
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
  if (item.kind === "plant" && item.plant_id && app.data.plants.some((p) => p.id === item.plant_id)) {
    openPlantCard(app, item.plant_id);
    return;
  }
  app.dialog(
    `<h2>📦 ${esc(item.label)}</h2>
    <p style="color:var(--secondary-text-color)">⌀ ${item.diameter_m} m · ↑ ${item.height_m} m</p>
    <div class="dialog-actions"><button type="button" class="btn plain" data-cancel>${t("close")}</button></div>`,
    () => {}
  );
}

function areaInfoDialog(app, item) {
  const inside = app.data.layout.items.filter((i) => !isArea(i) && insideRect(i, item));
  app.dialog(
    `<h2>${AREA_EMOJI[item.kind] || "📦"} ${esc(item.label)}</h2>
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
      <label>${t("editor.label")}</label>
      <input name="label" required maxlength="40" value="${esc(item.label)}" autofocus>
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
    (fd) => {
      item.label = fd.get("label").trim();
      item.zone_id = fd.get("zone_id") || null;
      item.w = parseFloat(fd.get("w")) || item.w;
      item.h = parseFloat(fd.get("h")) || item.h;
      // powiązanie: nazwa strefy z zakładki Rośliny, jeśli wybrano
      const zone = app.data.zones.find((z) => z.id === item.zone_id);
      if (zone && (!item.label || item.label === t("editor.palette." + item.kind))) item.label = zone.name;
      saveLayout(app, t("toast.saved"));
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

function circleDialog(app, item) {
  const dlg = app.dialog(
    `<h2>${t("editor.item.edit")}</h2>
    <form>
      <label>${t("editor.label")}</label>
      <input name="label" required maxlength="40" value="${esc(item.label)}" autofocus>
      <label>${t("editor.diameter")}</label><input name="diameter" type="number" step="0.1" min="0.1" max="30" value="${item.diameter_m}">
      <label>${t("editor.heightm")}</label><input name="height" type="number" step="0.1" min="0" max="40" value="${item.height_m}">
      <label>${t("editor.crownbase")}</label><input name="crownbase" type="number" step="0.1" min="0" max="40" value="${crownBase(item)}">
      <div class="dialog-actions">
        <button type="button" class="btn plain" id="circle-del" style="margin-right:auto;color:var(--rl-crisis)">${t("delete")}</button>
        ${item.plant_id ? `<button type="button" class="btn ghost" data-action="plant-card" data-id="${item.plant_id}">${t("plant.details")}</button>` : ""}
        <button type="button" class="btn plain" data-cancel>${t("cancel")}</button>
        <button type="submit" class="btn">${t("save")}</button>
      </div>
    </form>`,
    (fd) => {
      item.label = fd.get("label").trim();
      item.diameter_m = parseFloat(fd.get("diameter")) || item.diameter_m;
      item.height_m = parseFloat(fd.get("height")) || 0;
      item.crown_base_m = Math.min(parseFloat(fd.get("crownbase")) || 0, item.height_m);
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
