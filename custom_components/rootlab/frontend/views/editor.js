import { t } from "../i18n.js";
import { esc, uid } from "../util.js";
import { insideRect, isShaded, northVector, shadowEllipse, shadowLength } from "../shade.js";
import { ATTRIBUTION, MAX_Z, gridHtml, latToY, lonToX, metersPerPixel, xToLon, yToLat } from "../satmap.js";
import { openPlantCard } from "./plants.js";

export const ENABLED = true;

const AREA_KINDS = ["greenhouse", "bed", "lawn"];
const CIRCLE_DEFAULTS = {
  plant: { diameter_m: 0.5, height_m: 0.6 },
  tree: { diameter_m: 3, height_m: 5 },
  shrub: { diameter_m: 1, height_m: 1.2 },
  object: { diameter_m: 2, height_m: 2.5 },
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
    palette: "tree",
    month: new Date().getMonth() + 1,
    selected: null,
    mode: "edit",
    sat: true,
  });

const gardenLat = (app) =>
  app.data.layout.location?.latitude || app.hass.config.latitude || 52;
const isArea = (i) => "w" in i;

export function render(app) {
  const s = st(app);
  const layout = app.data.layout;
  const selectedItem = layout.items.find((i) => i.id === s.selected);
  const plantOpts = app.data.plants
    .map((p) => `<option value="plant:${p.id}" ${s.palette === "plant:" + p.id ? "selected" : ""}>${esc(p.emoji || "🌱")} ${esc(p.name)}</option>`)
    .join("");
  const satActive = s.sat && layout.location;
  return `
    <div class="toolbar">
      <div class="mode-toggle">
        <button class="${s.mode === "edit" ? "on" : ""}" data-action="editor-mode" data-mode="edit"><ha-icon icon="mdi:pencil" style="--mdc-icon-size:16px"></ha-icon>${t("editor.mode.edit")}</button>
        <button class="${s.mode === "view" ? "on" : ""}" data-action="editor-mode" data-mode="view"><ha-icon icon="mdi:eye-outline" style="--mdc-icon-size:16px"></ha-icon>${t("editor.mode.view")}</button>
      </div>
      ${
        s.mode === "edit"
          ? `<select class="inline" data-bind="palette">
        <optgroup label="${t("editor.group.areas")}">
          ${AREA_KINDS.map((k) => `<option value="${k}" ${s.palette === k ? "selected" : ""}>${AREA_EMOJI[k]} ${t("editor.palette." + k)}</option>`).join("")}
        </optgroup>
        <optgroup label="${t("editor.group.objects")}">
          <option value="tree" ${s.palette === "tree" ? "selected" : ""}>🌳 ${t("editor.palette.tree")}</option>
          <option value="shrub" ${s.palette === "shrub" ? "selected" : ""}>🌿 ${t("editor.palette.shrub")}</option>
          <option value="object" ${s.palette === "object" ? "selected" : ""}>📦 ${t("editor.palette.object")}</option>
        </optgroup>
        ${plantOpts ? `<optgroup label="${t("tab.plants")}">${plantOpts}</optgroup>` : ""}
      </select>`
          : ""
      }
      <span class="month-slider"><ha-icon icon="mdi:weather-sunny" style="--mdc-icon-size:18px;color:var(--rl-harvest)"></ha-icon>
        <input type="range" min="1" max="12" value="${s.month}" data-bind="month">
        <b id="month-label">${t("months")[s.month - 1]}</b></span>
      <div class="spacer"></div>
      ${
        selectedItem && s.mode === "edit"
          ? `<button class="btn small ghost" data-action="editor-edit"><ha-icon icon="mdi:pencil-outline"></ha-icon>${esc(selectedItem.label)}</button>
             <button class="icon-btn" data-action="editor-delete" title="${t("delete")}"><ha-icon icon="mdi:trash-can-outline"></ha-icon></button>`
          : ""
      }
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

function svg(app, satActive) {
  const s = st(app);
  const { width_m: W, height_m: H, north_deg: north = 0, items } = app.data.layout;
  const latitude = gardenLat(app);
  const circles = items.filter((i) => !isArea(i));
  const areas = items.filter(isArea);
  const greenhouses = areas.filter((a) => a.kind === "greenhouse");

  const areaNodes = areas
    .map(
      (a) => `<g class="item-g" data-id="${a.id}">
      <rect class="area ${a.kind} ${a.id === s.selected ? "selected" : ""}" x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}" rx="0.2"/>
      <text x="${a.x + a.w / 2}" y="${a.y + 0.7}">${AREA_EMOJI[a.kind] || ""} ${esc(a.label)}</text>
      ${
        a.id === s.selected && s.mode === "edit"
          ? `<circle class="resize-handle" data-id="${a.id}" cx="${a.x + a.w}" cy="${a.y + a.h}" r="0.35"/>`
          : ""
      }
    </g>`
    )
    .join("");

  const shadows = circles
    .filter((i) => i.height_m > 0.3)
    .map((i) => {
      const e = shadowEllipse(i, shadowLength(i.height_m, latitude, s.month), north);
      return `<ellipse class="shadow" cx="${e.cx}" cy="${e.cy}" rx="${e.rx}" ry="${e.ry}" transform="rotate(${e.rot} ${i.x} ${i.y})"/>`;
    })
    .join("");

  const nodes = circles
    .map((i) => {
      const shaded = circles.some((c) => isShaded(i, c, shadowLength(c.height_m, latitude, s.month), north));
      const inGh = i.kind === "plant" && greenhouses.some((g) => insideRect(i, g));
      const r = Math.max(i.diameter_m / 2, 0.25);
      return `<g class="item ${i.id === s.selected ? "selected" : ""}" data-id="${i.id}" transform="translate(${i.x} ${i.y})">
        <circle r="${r}" fill="${KIND_FILL[i.kind] || KIND_FILL.object}" fill-opacity="0.75"/>
        <text y="${r + 0.6}">${esc(i.label)}${inGh ? " 🏠" : ""}${shaded ? " ☁" : ""}</text>
      </g>`;
    })
    .join("");

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

async function saveLayout(app) {
  app.data = await app.ws("layout/save", { layout: app.data.layout });
  app.render();
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
  const s = st(app);
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
  root.querySelector('[data-bind="palette"]')?.addEventListener("change", (ev) => (s.palette = ev.target.value));
  const slider = root.querySelector('[data-bind="month"]');
  slider?.addEventListener("input", (ev) => {
    root.getElementById("month-label").textContent = t("months")[ev.target.value - 1];
  });
  slider?.addEventListener("change", (ev) => {
    s.month = parseInt(ev.target.value, 10);
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
      // obrót planu: przeciągnij igłę kompasu
      const W = layout.width_m;
      drag = { type: "rotate", cx: W - 1.6, cy: 1.6, deg: layout.north_deg || 0 };
      svgEl.setPointerCapture(ev.pointerId);
      return;
    }
    const handle = ev.target.closest(".resize-handle");
    const node = ev.target.closest("[data-id]");
    if (s.mode === "view") {
      if (node) viewItem(app, node.dataset.id);
      return;
    }
    svgEl.setPointerCapture(ev.pointerId);
    if (handle) {
      const item = layout.items.find((i) => i.id === handle.dataset.id);
      drag = { type: "resize", item, moved: false };
    } else if (node) {
      const item = layout.items.find((i) => i.id === node.dataset.id);
      drag = { type: "move", item, node, dx: item.x - p.x, dy: item.y - p.y, moved: false };
    } else if (AREA_KINDS.includes(s.palette)) {
      drag = { type: "draw", x0: p.x, y0: p.y, moved: false };
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
    }
  });

  const finish = () => {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (d.type === "rotate") {
      layout.north_deg = d.deg;
      saveLayout(app);
    } else if (d.type === "move" || d.type === "resize") {
      if (d.moved) saveLayout(app);
      else {
        s.selected = s.selected === d.item.id ? null : d.item.id;
        app.render();
      }
    } else if (d.type === "draw") {
      if (d.moved && Math.abs((d.x1 ?? d.x0) - d.x0) > 0.5 && Math.abs((d.y1 ?? d.y0) - d.y0) > 0.5) {
        const item = {
          id: uid(),
          kind: s.palette,
          label: t("editor.palette." + s.palette),
          x: clamp(Math.min(d.x0, d.x1), layout.width_m),
          y: clamp(Math.min(d.y0, d.y1), layout.height_m),
          w: clamp(Math.abs(d.x1 - d.x0), layout.width_m),
          h: clamp(Math.abs(d.y1 - d.y0), layout.height_m),
        };
        layout.items.push(item);
        s.selected = item.id;
        saveLayout(app);
      } else {
        s.selected = null;
        app.render();
      }
    } else if (d.type === "place") {
      addCircle(app, d);
    }
  };
  svgEl.addEventListener("pointerup", finish);
  svgEl.addEventListener("pointercancel", () => (drag = null));
}

function addCircle(app, p) {
  const s = st(app);
  const layout = app.data.layout;
  let kind = s.palette;
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
  const item = {
    id: uid(),
    kind,
    plant_id: plantId,
    label,
    x: Math.round(p.x * 10) / 10,
    y: Math.round(p.y * 10) / 10,
    ...CIRCLE_DEFAULTS[kind],
  };
  layout.items.push(item);
  s.selected = item.id;
  saveLayout(app);
}

function viewItem(app, itemId) {
  const item = app.data.layout.items.find((i) => i.id === itemId);
  if (!item) return;
  if (item.kind === "plant" && item.plant_id && app.data.plants.some((p) => p.id === item.plant_id)) {
    openPlantCard(app, item.plant_id);
    return;
  }
  const dims = isArea(item)
    ? `${item.w} × ${item.h} m`
    : `⌀ ${item.diameter_m} m · ↑ ${item.height_m} m`;
  app.dialog(
    `<h2>${AREA_EMOJI[item.kind] || "📦"} ${esc(item.label)}</h2>
    <p style="color:var(--secondary-text-color)">${dims}</p>
    ${item.kind === "greenhouse" ? `<div class="ai-hint"><ha-icon icon="mdi:home-thermometer-outline"></ha-icon>${t("editor.greenhouse.info")}</div>` : ""}
    <div class="dialog-actions"><button type="button" class="btn plain" data-cancel>${t("close")}</button></div>`,
    () => {}
  );
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
  let points = []; // {lat, lon} — obrys ogrodu
  let drawMode = false;
  let dims = null;

  const dlg = app.dialog(
    `<h2>${t("editor.location")}</h2>
    <div class="map-toolbar">
      <button type="button" class="icon-btn" id="map-rl" title="${t("editor.map.rotl")}"><ha-icon icon="mdi:rotate-left"></ha-icon></button>
      <button type="button" class="icon-btn" id="map-rr" title="${t("editor.map.rotr")}"><ha-icon icon="mdi:rotate-right"></ha-icon></button>
      <span style="font-size:12px;color:var(--secondary-text-color);min-width:34px" id="map-ang">${ang}°</span>
      <button type="button" class="btn small ghost" id="map-outline"><ha-icon icon="mdi:vector-polygon"></ha-icon>${t("editor.map.outline")}</button>
      <button type="button" class="btn small plain" id="map-clear" style="display:none">${t("editor.map.clear")}</button>
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
      px.map((c) => `<div class="map-pt" style="left:${c[0]}px;top:${c[1]}px"></div>`).join("")
    );
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
    tiles.innerHTML = gridHtml(lat, lon, z, diag, diag) + polyHtml();
    dlg.querySelector("#map-coords").textContent = `${lat.toFixed(5)}, ${lon.toFixed(5)} · zoom ${z}`;
    dlg.querySelector("#map-ang").textContent = `${ang}°`;
  };
  requestAnimationFrame(paint);

  const updateDims = () => {
    const el = dlg.querySelector("#map-dims");
    const apply = dlg.querySelector("#map-apply");
    if (points.length < 3) {
      el.textContent = drawMode ? t("editor.map.outline.hint") : "";
      apply.style.display = "none";
      dims = null;
      return;
    }
    // środek + bbox w układzie planu (obrót o ang), metry z Web Mercatora
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
    apply.style.display = "";
  };

  let gesture = null; // {type: pan|rotate, ...}
  view.addEventListener("pointerdown", (ev) => {
    if (ev.target.closest("button")) return;
    const rect = view.getBoundingClientRect();
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
    if (g.type === "rotate") {
      updateDims();
      return;
    }
    if (!g.moved && drawMode) {
      // klik = punkt obrysu (środek ekranu → mapa: odwróć obrót)
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
    ang = ((ang + delta) % 360 + 360) % 360;
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
    paint();
    updateDims();
  });
  dlg.querySelector("#map-apply").addEventListener("click", () => {
    if (!dims) return;
    layout.width_m = dims.w;
    layout.height_m = dims.h;
    lat = dims.lat;
    lon = dims.lon;
    paint();
  });
  dlg.querySelector("#map-save").addEventListener("click", () => {
    layout.location = { latitude: +lat.toFixed(6), longitude: +lon.toFixed(6), zoom: z };
    layout.north_deg = ang;
    st(app).sat = true;
    dlg.close();
    saveLayout(app);
  });
}

export const actions = {
  "editor-mode": (app, el) => {
    st(app).mode = el.dataset.mode;
    st(app).selected = null;
    app.render();
  },
  "editor-sat": (app) => {
    st(app).sat = !st(app).sat;
    app.render();
  },
  "editor-location": (app) => locationDialog(app),
  "editor-delete": (app) => {
    const s = st(app);
    if (!confirm(t("editor.item.delete.confirm"))) return;
    app.data.layout.items = app.data.layout.items.filter((i) => i.id !== s.selected);
    s.selected = null;
    saveLayout(app);
  },
  "editor-edit": (app) => {
    const s = st(app);
    const item = app.data.layout.items.find((i) => i.id === s.selected);
    if (!item) return;
    const area = isArea(item);
    app.dialog(
      `<h2>${t("editor.item.edit")}</h2>
      <form>
        <label>${t("editor.label")}</label>
        <input name="label" required maxlength="40" value="${esc(item.label)}" autofocus>
        ${
          area
            ? `<label>${t("editor.width")}</label><input name="w" type="number" step="0.1" min="0.5" value="${item.w}">
               <label>${t("editor.height")}</label><input name="h" type="number" step="0.1" min="0.5" value="${item.h}">`
            : `<label>${t("editor.diameter")}</label><input name="diameter" type="number" step="0.1" min="0.1" max="30" value="${item.diameter_m}">
               <label>${t("editor.heightm")}</label><input name="height" type="number" step="0.1" min="0" max="40" value="${item.height_m}">`
        }
        <div class="dialog-actions">
          <button type="button" class="btn plain" data-cancel>${t("cancel")}</button>
          <button type="submit" class="btn">${t("save")}</button>
        </div>
      </form>`,
      (fd) => {
        item.label = fd.get("label").trim();
        if (area) {
          item.w = parseFloat(fd.get("w")) || item.w;
          item.h = parseFloat(fd.get("h")) || item.h;
        } else {
          item.diameter_m = parseFloat(fd.get("diameter")) || item.diameter_m;
          item.height_m = parseFloat(fd.get("height")) || 0;
        }
        saveLayout(app);
      }
    );
  },
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
        saveLayout(app);
      }
    );
  },
};
