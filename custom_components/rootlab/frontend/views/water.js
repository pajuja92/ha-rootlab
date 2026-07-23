import { t } from "../i18n.js";
import {
  autoDetectRoles,
  combo,
  entityOptions,
  esc,
  haDeviceEntityIds,
  haDeviceOptions,
  optionsWithSuggestions,
  sensorState,
  todayISO,
  zoneSuggestions,
} from "../util.js";

const KINDS = ["drip", "sprinkler", "other"];

const ROLE_FIELDS = [
  { key: "valve", labelKey: "device.role.valve", domains: ["switch", "valve", "input_boolean"], icon: "mdi:pipe-valve" },
  { key: "flow", labelKey: "device.role.flow", domains: ["sensor"], icon: "mdi:waves-arrow-right" },
  { key: "soil", labelKey: "plant.sensor.soil", domains: ["sensor"], icon: "mdi:water-percent" },
  { key: "temp", labelKey: "plant.sensor.temp", domains: ["sensor"], icon: "mdi:thermometer" },
  { key: "hum", labelKey: "plant.sensor.hum", domains: ["sensor"], icon: "mdi:cloud-percent-outline" },
  { key: "battery", labelKey: "device.role.battery", domains: ["sensor"], icon: "mdi:battery" },
];

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
    </div>
    ${devicesSection(app)}`;
}

function devicesSection(app) {
  const devices = app.data.devices || [];
  return `
    <div class="section-title"><ha-icon icon="mdi:devices"></ha-icon>${t("devices.title")}
      <button class="icon-btn" data-action="device-add" title="${t("device.add")}"><ha-icon icon="mdi:plus"></ha-icon></button>
    </div>
    ${
      devices.length
        ? `<div class="grid">${devices.map((d) => deviceCard(app, d)).join("")}</div>`
        : `<div class="card" style="color:var(--secondary-text-color);font-size:14px">${t("devices.empty")}</div>`
    }`;
}

function deviceCard(app, d) {
  const zone = app.data.zones.find((z) => z.id === d.zone_id);
  const chips = ROLE_FIELDS.filter((f) => d.entities?.[f.key])
    .map((f) => {
      const entityId = d.entities[f.key];
      const st = sensorState(app.hass, entityId);
      return `<button class="sensor-chip ${st.unavailable ? "unavailable" : ""}" data-action="more-info" data-entity="${esc(entityId)}" title="${t(f.labelKey)}">
        <ha-icon icon="${f.icon}"></ha-icon><span class="val">${esc(st.text)}</span></button>`;
    })
    .join("");
  return `<div class="card">
    <div class="header"><ha-icon icon="mdi:devices" style="color:var(--rl-water)"></ha-icon><h3>${esc(d.name)}</h3>
      ${zone ? `<span class="chip">${esc(zone.emoji || "🪴")} ${esc(zone.name)}</span>` : ""}</div>
    <div class="sensors">${chips || `<span style="font-size:13px;color:var(--secondary-text-color)">${t("device.noentities")}</span>`}</div>
    <div class="actions">
      <button class="icon-btn" data-action="device-edit" data-id="${d.id}" title="${t("edit")}"><ha-icon icon="mdi:pencil-outline"></ha-icon></button>
      <button class="icon-btn" data-action="device-delete" data-id="${d.id}" title="${t("delete")}"><ha-icon icon="mdi:trash-can-outline"></ha-icon></button>
    </div>
  </div>`;
}

/* Dialog urządzenia — wybór urządzenia z HA wypełnia nazwę i role automatycznie. */
function deviceDialog(app, device) {
  const draft = {
    name: device?.name || "",
    zone_id: device?.zone_id || "",
    ha_device_id: device?.ha_device_id || "",
    entities: { ...(device?.entities || {}) },
  };
  renderDeviceDialog(app, device, draft);
}

function renderDeviceDialog(app, device, draft) {
  const zoneOpts = app.data.zones.map((z) => ({ value: z.id, label: `${z.emoji || "🪴"} ${z.name}` }));
  const scoped = draft.ha_device_id ? haDeviceEntityIds(app.hass, draft.ha_device_id) : null;
  const roleCombo = (f) => {
    let opts = entityOptions(app.hass, f.domains);
    if (scoped) {
      const inDevice = opts.filter((o) => scoped.includes(o.value));
      if (inDevice.length) opts = [...inDevice, ...opts.filter((o) => !scoped.includes(o.value))];
    }
    return combo({ name: `role_${f.key}`, value: draft.entities[f.key] || "", options: opts });
  };
  const dlg = app.dialog(
    `<h2>${device ? t("device.edit") : t("device.new")}</h2>
    <form>
      <label>${t("device.hadev")}</label>
      ${combo({ name: "ha_device_id", value: draft.ha_device_id, options: haDeviceOptions(app.hass) })}
      <label>${t("name")}</label>
      <input name="name" required maxlength="60" value="${esc(draft.name)}">
      <label>${t("plant.zone")}</label>
      ${combo({ name: "zone_id", value: draft.zone_id, options: zoneOpts })}
      ${ROLE_FIELDS.map((f) => `<label>${t(f.labelKey)}</label>${roleCombo(f)}`).join("")}
      <div class="dialog-actions">
        <button type="button" class="btn plain" data-cancel>${t("cancel")}</button>
        <button type="submit" class="btn">${t("save")}</button>
      </div>
    </form>`,
    (fd) =>
      app.saveItem("devices", {
        id: device?.id ?? null,
        name: fd.get("name").trim(),
        zone_id: fd.get("zone_id") || null,
        ha_device_id: fd.get("ha_device_id") || null,
        entities: Object.fromEntries(ROLE_FIELDS.map((f) => [f.key, fd.get(`role_${f.key}`) || null])),
      }),
    { wide: true }
  );
  dlg.querySelector('input[name="ha_device_id"]').addEventListener("change", (ev) => {
    // snapshot + autodetekcja ról z wybranego urządzenia HA
    draft.name = dlg.querySelector('input[name="name"]').value;
    draft.zone_id = dlg.querySelector('input[name="zone_id"]').value;
    ROLE_FIELDS.forEach((f) => (draft.entities[f.key] = dlg.querySelector(`input[name="role_${f.key}"]`).value));
    draft.ha_device_id = ev.target.value;
    if (draft.ha_device_id) {
      const detected = autoDetectRoles(app.hass, haDeviceEntityIds(app.hass, draft.ha_device_id));
      ROLE_FIELDS.forEach((f) => {
        if (!draft.entities[f.key] && detected[f.key]) draft.entities[f.key] = detected[f.key];
      });
      if (!draft.name) {
        const dev = app.hass.devices?.[draft.ha_device_id];
        draft.name = dev?.name_by_user || dev?.name || "";
      }
    }
    renderDeviceDialog(app, device, draft);
  });
}

function timeline(sections, active) {
  const blocks = [];
  for (const s of sections) {
    const sch = s.schedule || {};
    const dur = sch.duration_min || 10;
    for (const time of sch.times || []) {
      const [h, m] = time.split(":").map(Number);
      if (isNaN(h)) continue;
      const left = ((h * 60 + m) / 1440) * 100;
      const width = Math.max((dur / 1440) * 100, 0.6);
      const run = active[s.id];
      blocks.push(`<div class="block ${run && !run.paused ? "active" : ""}" style="left:${left}%;width:${width}%" title="${esc(s.name)} ${time}"></div>`);
    }
  }
  const now = new Date();
  const nowLeft = ((now.getHours() * 60 + now.getMinutes()) / 1440) * 100;
  return `<div class="timeline">${blocks.join("")}<div class="now" style="left:${nowLeft}%"></div></div>
    <div class="timeline-scale"><span>0:00</span><span>6:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div>`;
}

function sectionRow(app, s, run) {
  const sch = s.schedule || {};
  const days = (sch.days || []).map((d) => t("days")[d]).join(", ");
  const times = (sch.times || []).join(", ");
  const sched = days && times ? `${days} · ${times} · ${sch.duration_min || 10} min` : t("water.nosched");
  const zone = app.data.zones.find((z) => z.id === s.zone_id);
  const oneOffs = (app.data.irrigation.one_offs || []).filter((o) => o.section_id === s.id);
  const entityWarn = s.entity_id ? "" : ` <span class="chip crisis">${t("water.noentity")}</span>`;
  const kindLabel = KINDS.includes(s.kind) ? t(`water.kind.${s.kind}`) : "";
  let controls;
  if (run && run.paused) {
    controls = `<span class="chip harvest">${t("water.run.paused")}</span>
      <span style="font-size:13px;color:var(--secondary-text-color)">${t("water.run.left", { min: Math.round((run.remaining_s || 0) / 60) })}</span>
      <button class="btn small" data-action="water-resume-run" data-id="${s.id}"><ha-icon icon="mdi:play"></ha-icon>${t("water.run.resume")}</button>
      <button class="btn small plain" data-action="water-stop" data-id="${s.id}">${t("stop")}</button>`;
  } else if (run) {
    controls = `<span class="chip water">${t("water.now")}</span><span class="countdown" data-end="${esc(run.end)}"></span>
      <button class="btn small ghost" data-action="water-pause-run" data-id="${s.id}"><ha-icon icon="mdi:pause"></ha-icon>${t("water.run.pause")}</button>
      <button class="btn small plain" data-action="water-stop" data-id="${s.id}">${t("stop")}</button>`;
  } else {
    controls =
      [5, 10, 15]
        .map((m) => `<button class="btn small ghost" data-action="water-run" data-id="${s.id}" data-min="${m}" ${s.entity_id ? "" : "disabled"}>▶ ${m}′</button>`)
        .join("") +
      `<button class="icon-btn" data-action="water-oneoff" data-id="${s.id}" title="${t("water.oneoff")}"><ha-icon icon="mdi:calendar-plus"></ha-icon></button>`;
  }
  return `<div class="section-row ${run && !run.paused ? "active" : ""}">
    <span class="dot"></span>
    <div class="info">
      <span class="name">${esc(s.name)}</span>
      ${zone ? `<span class="chip">${esc(zone.emoji || "")} ${esc(zone.name)}</span>` : ""}
      ${kindLabel ? `<span class="chip water">${kindLabel}</span>` : ""}${entityWarn}
      <div class="sched">▷ ${sched}</div>
      ${oneOffs
        .map(
          (o) => `<div class="sched"><span class="chip harvest">${t("water.oneoff.badge")}</span> ${esc(o.date)} ${esc(o.time)} · ${o.duration_min} min
            <button class="icon-btn" data-action="water-oneoff-del" data-id="${o.id}" title="${t("delete")}" style="padding:2px"><ha-icon icon="mdi:close" style="--mdc-icon-size:14px"></ha-icon></button></div>`
        )
        .join("")}
    </div>
    ${controls}
    <button class="icon-btn" data-action="edit-section" data-id="${s.id}" title="${t("edit")}"><ha-icon icon="mdi:pencil-outline"></ha-icon></button>
    <button class="icon-btn" data-action="delete-section" data-id="${s.id}" title="${t("delete")}"><ha-icon icon="mdi:trash-can-outline"></ha-icon></button>
  </div>`;
}

function sectionDialog(app, section, draft = null) {
  const sch = section?.schedule || {};
  draft ??= { zone_id: section?.zone_id || "", entity_id: section?.entity_id || "" };
  // dokładnie jedno urządzenie z zaworem w strefie → prefill; więcej → ⭐ na górze listy
  const sugg = zoneSuggestions(app, draft.zone_id, "valve");
  if (!draft.entity_id && sugg.length === 1) draft.entity_id = sugg[0].entity;
  const zoneOpts = app.data.zones.map((z) => ({ value: z.id, label: `${z.emoji || "🪴"} ${z.name}` }));
  const valveOpts = optionsWithSuggestions(
    app.hass,
    entityOptions(app.hass, ["switch", "valve", "input_boolean"]),
    sugg
  );
  const dlg = app.dialog(
    `<h2>${section ? t("water.section.edit") : t("water.section.new")}</h2>
    <form>
      <label>${t("name")}</label>
      <input name="name" required maxlength="60" value="${esc(section?.name)}" placeholder="${t("water.section.name.ph")}">
      <label>${t("plant.zone")}</label>
      ${combo({ name: "zone_id", value: draft.zone_id, options: zoneOpts })}
      <label>${t("water.entity")}</label>
      ${combo({ name: "entity_id", value: draft.entity_id, options: valveOpts })}
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
  dlg.querySelector('input[name="zone_id"]').addEventListener("change", (ev) => {
    const next = {
      zone_id: ev.target.value,
      entity_id: dlg.querySelector('input[name="entity_id"]').value,
    };
    sectionDialog(app, section, next);
  });
}

function oneOffDialog(app, sectionId) {
  const section = app.data.irrigation.sections.find((s) => s.id === sectionId);
  app.dialog(
    `<h2>${t("water.oneoff.title")} — ${esc(section?.name)}</h2>
    <form>
      <label>${t("water.oneoff.date")}</label>
      <input name="date" type="date" required value="${todayISO()}" min="${todayISO()}">
      <label>${t("water.oneoff.time")}</label>
      <input name="time" type="time" required value="18:00">
      <label>${t("water.duration")}</label>
      <input name="duration" type="number" min="1" max="120" value="10">
      <div class="dialog-actions">
        <button type="button" class="btn plain" data-cancel>${t("cancel")}</button>
        <button type="submit" class="btn">${t("save")}</button>
      </div>
    </form>`,
    (fd) =>
      app.saveItem("one_offs", {
        id: null,
        section_id: sectionId,
        date: fd.get("date"),
        time: fd.get("time"),
        duration_min: parseInt(fd.get("duration"), 10) || 10,
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

const call = (type) => async (app, el) => {
  app.data = await app.ws(type, { section_id: el.dataset.id });
  app.render();
};

export const actions = {
  "add-section": (app) => sectionDialog(app),
  "device-add": (app) => deviceDialog(app),
  "device-edit": (app, el) => deviceDialog(app, app.data.devices.find((d) => d.id === el.dataset.id)),
  "device-delete": (app, el) => {
    const d = app.data.devices.find((x) => x.id === el.dataset.id);
    if (confirm(t("device.delete.confirm", { name: d.name }))) app.deleteItem("devices", d.id);
  },
  "edit-section": (app, el) => sectionDialog(app, app.data.irrigation.sections.find((s) => s.id === el.dataset.id)),
  "delete-section": (app, el) => {
    const s = app.data.irrigation.sections.find((x) => x.id === el.dataset.id);
    if (confirm(t("water.section.delete.confirm", { name: s.name }))) app.deleteItem("sections", s.id);
  },
  "water-run": async (app, el) => {
    app.data = await app.ws("irrigation/run", { section_id: el.dataset.id, minutes: parseInt(el.dataset.min, 10) });
    app.render();
  },
  "water-stop": call("irrigation/stop"),
  "water-pause-run": call("irrigation/pause_run"),
  "water-resume-run": call("irrigation/resume_run"),
  "water-oneoff": (app, el) => oneOffDialog(app, el.dataset.id),
  "water-oneoff-del": (app, el) => {
    if (confirm(t("water.oneoff.delete.confirm"))) app.deleteItem("one_offs", el.dataset.id);
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
