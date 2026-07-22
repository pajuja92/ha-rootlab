import { t } from "../i18n.js";
import { esc, entityOptions, todayISO } from "../util.js";

const KINDS = ["drip", "sprinkler", "other"];

export function render(app) {
  const irr = app.data.irrigation;
  const active = app.data.active || {};
  const paused = irr.paused_until;
  const toolbar = `<div class="toolbar">
    <div class="spacer"></div>
    <button class="btn ghost" data-action="${paused ? "water-resume" : "water-pause"}">
      <ha-icon icon="${paused ? "mdi:play" : "mdi:pause"}"></ha-icon>${paused ? t("water.resume") : t("water.pause")}</button>
    <button class="btn" data-action="add-section"><ha-icon icon="mdi:plus"></ha-icon>${t("water.section.add")}</button>
  </div>`;
  let banner = "";
  if (paused) {
    banner = `<div class="banner"><ha-icon icon="mdi:pause-circle-outline"></ha-icon>
      ${paused === "indef" ? t("water.paused.indef") : t("water.paused.until", { date: paused })}
      <span class="spacer"></span>
      <button class="btn small plain" data-action="water-resume">${t("water.resume")}</button></div>`;
  } else if (irr.skip_date === todayISO()) {
    banner = `<div class="banner"><ha-icon icon="mdi:weather-pouring"></ha-icon>${t("water.skip.today")}
      <span class="spacer"></span>
      <button class="btn small plain" data-action="water-unskip">${t("water.skip.undo")}</button></div>`;
  }
  if (!irr.sections.length) {
    return `${toolbar}<div class="empty"><ha-icon icon="mdi:water"></ha-icon><p>${t("water.empty")}</p></div>`;
  }
  return `${toolbar}${banner}
    <div class="card">
      ${timeline(irr.sections, active)}
      ${irr.sections.map((s) => sectionRow(app, s, active[s.id])).join("")}
    </div>`;
}

function timeline(sections, active) {
  const blocks = [];
  const activeIds = new Set(Object.keys(active));
  for (const s of sections) {
    const sch = s.schedule || {};
    const dur = sch.duration_min || 10;
    for (const time of sch.times || []) {
      const [h, m] = time.split(":").map(Number);
      if (isNaN(h)) continue;
      const left = ((h * 60 + m) / 1440) * 100;
      const width = Math.max((dur / 1440) * 100, 0.6);
      blocks.push(`<div class="block ${activeIds.has(s.id) ? "active" : ""}" style="left:${left}%;width:${width}%" title="${esc(s.name)} ${time}"></div>`);
    }
  }
  const now = new Date();
  const nowLeft = ((now.getHours() * 60 + now.getMinutes()) / 1440) * 100;
  return `<div class="timeline">${blocks.join("")}<div class="now" style="left:${nowLeft}%"></div></div>
    <div class="timeline-scale"><span>0:00</span><span>6:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div>`;
}

function sectionRow(app, s, activeEnd) {
  const sch = s.schedule || {};
  const days = (sch.days || []).map((d) => t("days")[d]).join(", ");
  const times = (sch.times || []).join(", ");
  const sched = days && times ? `${days} · ${times} · ${sch.duration_min || 10} min` : t("water.nosched");
  const zone = app.data.zones.find((z) => z.id === s.zone_id);
  const entityWarn = s.entity_id ? "" : ` <span class="chip crisis">${t("water.noentity")}</span>`;
  const kindLabel = KINDS.includes(s.kind) ? t(`water.kind.${s.kind}`) : "";
  return `<div class="section-row ${activeEnd ? "active" : ""}">
    <span class="dot"></span>
    <div class="info">
      <span class="name">${esc(s.name)}</span>
      ${zone ? `<span class="chip">${esc(zone.emoji || "")} ${esc(zone.name)}</span>` : ""}
      ${kindLabel ? `<span class="chip water">${kindLabel}</span>` : ""}${entityWarn}
      <div class="sched">▷ ${sched}</div>
    </div>
    ${
      activeEnd
        ? `<span class="chip water">${t("water.now")}</span><span class="countdown" data-end="${esc(activeEnd)}"></span>
           <button class="btn small plain" data-action="water-stop" data-id="${s.id}">${t("stop")}</button>`
        : [5, 10, 15]
            .map((m) => `<button class="btn small ghost" data-action="water-run" data-id="${s.id}" data-min="${m}" ${s.entity_id ? "" : "disabled"}>▶ ${m}′</button>`)
            .join("")
    }
    <button class="icon-btn" data-action="edit-section" data-id="${s.id}" title="${t("edit")}"><ha-icon icon="mdi:pencil-outline"></ha-icon></button>
    <button class="icon-btn" data-action="delete-section" data-id="${s.id}" title="${t("delete")}"><ha-icon icon="mdi:trash-can-outline"></ha-icon></button>
  </div>`;
}

function sectionDialog(app, section) {
  const sch = section?.schedule || {};
  const zoneOpts = app.data.zones
    .map((z) => `<option value="${z.id}" ${section?.zone_id === z.id ? "selected" : ""}>${esc(z.name)}</option>`)
    .join("");
  app.dialog(
    `<h2>${section ? t("water.section.edit") : t("water.section.new")}</h2>
    <form>
      <label>${t("name")}</label>
      <input name="name" required maxlength="60" value="${esc(section?.name)}" placeholder="${t("water.section.name.ph")}" autofocus>
      <label>${t("plant.zone")}</label>
      <select name="zone_id"><option value="">${t("plant.zone.none")}</option>${zoneOpts}</select>
      <label>${t("water.entity")}</label>
      <select name="entity_id">${entityOptions(app.hass, ["switch", "valve", "input_boolean"], section?.entity_id, t("none"))}</select>
      <label>${t("water.kind")}</label>
      <select name="kind">${KINDS.map((k) => `<option value="${k}" ${section?.kind === k ? "selected" : ""}>${t(`water.kind.${k}`)}</option>`).join("")}</select>
      <label>${t("water.days")}</label>
      <div class="day-picker">
        ${t("days").map((d, i) => `<label><input type="checkbox" name="day${i}" ${(sch.days || []).includes(i) ? "checked" : ""}>${d}</label>`).join("")}
      </div>
      <label>${t("water.times")}</label>
      <input name="times" value="${esc((sch.times || []).join(", "))}" placeholder="06:00, 19:00" pattern="^\\s*([01]?\\d|2[0-3]):[0-5]\\d(\\s*,\\s*([01]?\\d|2[0-3]):[0-5]\\d)*\\s*$">
      <label>${t("water.duration")}</label>
      <input name="duration" type="number" min="1" max="120" value="${sch.duration_min || 10}">
      <div class="dialog-actions">
        <button type="button" class="btn plain" data-cancel>${t("cancel")}</button>
        <button type="submit" class="btn">${t("save")}</button>
      </div>
    </form>`,
    (fd) =>
      app.saveItem("sections", {
        id: section?.id ?? null,
        name: fd.get("name").trim(),
        zone_id: fd.get("zone_id") || null,
        entity_id: fd.get("entity_id") || null,
        kind: fd.get("kind"),
        schedule: {
          days: t("days").map((_, i) => i).filter((i) => fd.get(`day${i}`)),
          times: (fd.get("times") || "")
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean)
            .map((x) => x.padStart(5, "0")),
          duration_min: parseInt(fd.get("duration"), 10) || 10,
        },
      })
  );
}

function pauseDialog(app) {
  app.dialog(
    `<h2>${t("water.pause.title")}</h2>
    <form>
      <label style="display:flex;align-items:center;gap:8px;margin-top:16px">
        <input type="radio" name="mode" value="indef" checked style="width:auto">${t("water.pause.indef")}</label>
      <label style="display:flex;align-items:center;gap:8px">
        <input type="radio" name="mode" value="days" style="width:auto">${t("water.pause.days")}
        <input name="ndays" type="number" min="1" max="60" value="3" style="width:80px"></label>
      <div class="dialog-actions">
        <button type="button" class="btn plain" data-cancel>${t("cancel")}</button>
        <button type="submit" class="btn">${t("water.pause")}</button>
      </div>
    </form>`,
    async (fd) => {
      let until = "indef";
      if (fd.get("mode") === "days") {
        const d = new Date();
        d.setDate(d.getDate() + (parseInt(fd.get("ndays"), 10) || 1));
        until = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      }
      app.data = await app.ws("irrigation/pause", { until });
      app.render();
    }
  );
}

export const actions = {
  "add-section": (app) => sectionDialog(app),
  "edit-section": (app, el) => sectionDialog(app, app.data.irrigation.sections.find((s) => s.id === el.dataset.id)),
  "delete-section": (app, el) => {
    const s = app.data.irrigation.sections.find((x) => x.id === el.dataset.id);
    if (confirm(t("water.section.delete.confirm", { name: s.name }))) app.deleteItem("sections", s.id);
  },
  "water-run": async (app, el) => {
    app.data = await app.ws("irrigation/run", { section_id: el.dataset.id, minutes: parseInt(el.dataset.min, 10) });
    app.render();
  },
  "water-stop": async (app, el) => {
    app.data = await app.ws("irrigation/stop", { section_id: el.dataset.id });
    app.render();
  },
  "water-pause": (app) => pauseDialog(app),
  "water-resume": async (app) => {
    app.data = await app.ws("irrigation/pause", { until: null });
    app.render();
  },
  "water-unskip": async (app) => {
    app.data = await app.ws("irrigation/skip", { date: null });
    app.render();
  },
};
