import { t } from "../i18n.js";
import { esc, uid } from "../util.js";
import { insideRect, isShaded, northVector, shadowEllipse, shadowLength } from "../shade.js";
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
  });

const lat = (app) => app.data.settings?.latitude || app.hass.config.latitude || 52;
const isArea = (i) => "w" in i;

export function render(app) {
  const s = st(app);
  const layout = app.data.layout;
  const selectedItem = layout.items.find((i) => i.id === s.selected);
  const plantOpts = app.data.plants
    .map((p) => `<option value="plant:${p.id}" ${s.palette === "plant:" + p.id ? "selected" : ""}>${esc(p.emoji || "🌱")} ${esc(p.name)}</option>`)
    .join("");
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
      <button class="btn ghost" data-action="editor-garden"><ha-icon icon="mdi:cog-outline"></ha-icon>${t("editor.garden")}</button>
    </div>
    <div class="editor-wrap">${svg(app)}</div>
    <div class="editor-hint">${s.mode === "edit" ? t("editor.hint.edit") : t("editor.hint.view")} · ${t("editor.greenhouse.info")}</div>`;
}

function svg(app) {
  const s = st(app);
  const { width_m: W, height_m: H, north_deg: north = 0, items } = app.data.layout;
  const latitude = lat(app);
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
  const compass = `<g class="compass" transform="translate(${W - 1.4} 1.4)">
    <circle r="1" fill="var(--card-background-color)" stroke="var(--divider-color)" stroke-width="0.06"/>
    <line x1="0" y1="0" x2="${n.x * 0.7}" y2="${n.y * 0.7}" stroke="var(--rl-crisis)" stroke-width="0.12"/>
    <text x="${n.x * 0.95}" y="${n.y * 0.95 + 0.3}" text-anchor="middle">N</text>
  </g>`;

  return `<svg id="garden-svg" class="editor-svg ${s.mode === "view" ? "view-mode" : ""}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
    <defs><pattern id="rl-grid" width="1" height="1" patternUnits="userSpaceOnUse">
      <path d="M 1 0 L 0 0 0 1" fill="none" class="grid-line"/></pattern></defs>
    <rect width="${W}" height="${H}" fill="url(#rl-grid)"/>
    ${areaNodes}${shadows}${nodes}${compass}
    <rect id="draw-preview" class="draw-preview" hidden />
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
  let drag = null; // {type: move|resize|draw, ...}
  const layout = app.data.layout;
  const clamp = (v, max) => Math.round(Math.min(Math.max(v, 0), max) * 10) / 10;

  svgEl.addEventListener("pointerdown", (ev) => {
    const p = svgPoint(svgEl, ev);
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
    if (drag.type === "move") {
      drag.moved = true;
      drag.item.x = clamp(p.x + drag.dx, layout.width_m);
      drag.item.y = clamp(p.y + drag.dy, layout.height_m);
      if (isArea(drag.item)) {
        app.render(); // rect + label + handle — prościej przerysować
      } else {
        drag.node.setAttribute("transform", `translate(${drag.item.x} ${drag.item.y})`);
      }
    } else if (drag.type === "resize") {
      drag.moved = true;
      drag.item.w = Math.max(0.5, clamp(p.x - drag.item.x, layout.width_m));
      drag.item.h = Math.max(0.5, clamp(p.y - drag.item.y, layout.height_m));
      app.render();
    } else if (drag.type === "draw") {
      drag.moved = true;
      drag.x1 = p.x;
      drag.y1 = p.y;
      const pr = root.getElementById("draw-preview");
      pr.hidden = false;
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
    if (d.type === "move" || d.type === "resize") {
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

export const actions = {
  "editor-mode": (app, el) => {
    st(app).mode = el.dataset.mode;
    st(app).selected = null;
    app.render();
  },
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
        <label>${t("editor.north")}</label>
        <input name="north" type="range" min="0" max="359" value="${layout.north_deg || 0}"
          oninput="this.nextElementSibling.textContent = this.value + '°'">
        <b>${layout.north_deg || 0}°</b>
        <div class="dialog-actions">
          <button type="button" class="btn plain" data-cancel>${t("cancel")}</button>
          <button type="submit" class="btn">${t("save")}</button>
        </div>
      </form>`,
      (fd) => {
        layout.width_m = parseFloat(fd.get("w")) || layout.width_m;
        layout.height_m = parseFloat(fd.get("h")) || layout.height_m;
        layout.north_deg = parseInt(fd.get("north"), 10) || 0;
        saveLayout(app);
      }
    );
  },
};
