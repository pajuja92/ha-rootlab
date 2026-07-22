import { t } from "../i18n.js";
import { esc, uid } from "../util.js";
import { isShaded, shadowEllipse, shadowLength } from "../shade.js";

export const ENABLED = true;

const KIND_DEFAULTS = {
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

const st = (app) => (app.editorState ??= { palette: "tree", month: new Date().getMonth() + 1, selected: null });

export function render(app) {
  const s = st(app);
  const layout = app.data.layout;
  const selectedItem = layout.items.find((i) => i.id === s.selected);
  const plantOpts = app.data.plants
    .map((p) => `<option value="plant:${p.id}" ${s.palette === "plant:" + p.id ? "selected" : ""}>${esc(p.emoji || "🌱")} ${esc(p.name)}</option>`)
    .join("");
  return `
    <div class="toolbar">
      <select class="inline" data-bind="palette">
        ${plantOpts ? `<optgroup label="${t("tab.plants")}">${plantOpts}</optgroup>` : ""}
        <option value="tree" ${s.palette === "tree" ? "selected" : ""}>🌳 ${t("editor.palette.tree")}</option>
        <option value="shrub" ${s.palette === "shrub" ? "selected" : ""}>🌿 ${t("editor.palette.shrub")}</option>
        <option value="object" ${s.palette === "object" ? "selected" : ""}>🏠 ${t("editor.palette.object")}</option>
      </select>
      <span class="month-slider"><ha-icon icon="mdi:weather-sunny" style="--mdc-icon-size:18px;color:var(--rl-harvest)"></ha-icon>
        <input type="range" min="1" max="12" value="${s.month}" data-bind="month">
        <b id="month-label">${t("months")[s.month - 1]}</b></span>
      <div class="spacer"></div>
      ${
        selectedItem
          ? `<button class="btn small ghost" data-action="editor-edit"><ha-icon icon="mdi:pencil-outline"></ha-icon>${esc(selectedItem.label)}</button>
             <button class="icon-btn" data-action="editor-delete" title="${t("delete")}"><ha-icon icon="mdi:trash-can-outline"></ha-icon></button>`
          : ""
      }
      <button class="btn ghost" data-action="editor-garden"><ha-icon icon="mdi:ruler-square"></ha-icon>${t("editor.garden")}</button>
    </div>
    <div class="editor-wrap">${svg(app)}</div>
    <div class="editor-hint">${t("editor.hint")} · N ↑</div>`;
}

function svg(app) {
  const s = st(app);
  const { width_m: W, height_m: H, items } = app.data.layout;
  const lat = app.hass.config.latitude || 52;
  const shadows = items
    .filter((i) => i.height_m > 0.3)
    .map((i) => {
      const e = shadowEllipse(i, shadowLength(i.height_m, lat, s.month));
      return `<ellipse class="shadow" cx="${e.cx}" cy="${e.cy}" rx="${e.rx}" ry="${e.ry}"/>`;
    })
    .join("");
  const nodes = items
    .map((i) => {
      const shaded = items.some((c) => isShaded(i, c, shadowLength(c.height_m, lat, s.month)));
      const r = Math.max(i.diameter_m / 2, 0.25);
      return `<g class="item ${i.id === s.selected ? "selected" : ""}" data-id="${i.id}" transform="translate(${i.x} ${i.y})">
        <circle r="${r}" fill="${KIND_FILL[i.kind] || KIND_FILL.object}" fill-opacity="0.75"/>
        <text y="${r + 0.6}">${esc(i.label)}${shaded ? " ☁" : ""}</text>
      </g>`;
    })
    .join("");
  return `<svg id="garden-svg" class="editor-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
    <defs><pattern id="rl-grid" width="1" height="1" patternUnits="userSpaceOnUse">
      <path d="M 1 0 L 0 0 0 1" fill="none" class="grid-line"/></pattern></defs>
    <rect width="${W}" height="${H}" fill="url(#rl-grid)"/>
    ${shadows}${nodes}
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
  let drag = null;

  svgEl.addEventListener("pointerdown", (ev) => {
    const g = ev.target.closest(".item");
    const p = svgPoint(svgEl, ev);
    if (g) {
      const item = app.data.layout.items.find((i) => i.id === g.dataset.id);
      drag = { item, g, dx: item.x - p.x, dy: item.y - p.y, moved: false };
      svgEl.setPointerCapture(ev.pointerId);
    } else {
      addItem(app, p);
    }
  });
  svgEl.addEventListener("pointermove", (ev) => {
    if (!drag) return;
    const p = svgPoint(svgEl, ev);
    const { width_m: W, height_m: H } = app.data.layout;
    drag.item.x = Math.min(Math.max(p.x + drag.dx, 0), W);
    drag.item.y = Math.min(Math.max(p.y + drag.dy, 0), H);
    drag.item.x = Math.round(drag.item.x * 10) / 10;
    drag.item.y = Math.round(drag.item.y * 10) / 10;
    drag.moved = true;
    drag.g.setAttribute("transform", `translate(${drag.item.x} ${drag.item.y})`);
  });
  svgEl.addEventListener("pointerup", () => {
    if (!drag) return;
    if (drag.moved) {
      saveLayout(app);
    } else {
      s.selected = s.selected === drag.item.id ? null : drag.item.id;
      app.render();
    }
    drag = null;
  });
}

function addItem(app, p) {
  const s = st(app);
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
    ...KIND_DEFAULTS[kind],
  };
  app.data.layout.items.push(item);
  s.selected = item.id;
  saveLayout(app);
}

export const actions = {
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
    app.dialog(
      `<h2>${t("editor.item.edit")}</h2>
      <form>
        <label>${t("editor.label")}</label>
        <input name="label" required maxlength="40" value="${esc(item.label)}" autofocus>
        <label>${t("editor.kind")}</label>
        <select name="kind">
          ${["plant", "tree", "shrub", "object"].map((k) => `<option value="${k}" ${item.kind === k ? "selected" : ""}>${k === "plant" ? t("tab.plants") : t("editor.palette." + k)}</option>`).join("")}
        </select>
        <label>${t("editor.diameter")}</label>
        <input name="diameter" type="number" step="0.1" min="0.1" max="30" value="${item.diameter_m}">
        <label>${t("editor.heightm")}</label>
        <input name="height" type="number" step="0.1" min="0" max="40" value="${item.height_m}">
        <div class="dialog-actions">
          <button type="button" class="btn plain" data-cancel>${t("cancel")}</button>
          <button type="submit" class="btn">${t("save")}</button>
        </div>
      </form>`,
      (fd) => {
        item.label = fd.get("label").trim();
        item.kind = fd.get("kind");
        item.diameter_m = parseFloat(fd.get("diameter")) || item.diameter_m;
        item.height_m = parseFloat(fd.get("height")) || 0;
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
