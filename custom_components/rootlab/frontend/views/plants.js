import { t } from "../i18n.js";
import { esc, entityOptions } from "../util.js";

export const SENSOR_FIELDS = [
  { key: "soil", labelKey: "plant.sensor.soil", icon: "mdi:water-percent" },
  { key: "temp", labelKey: "plant.sensor.temp", icon: "mdi:thermometer" },
  { key: "hum", labelKey: "plant.sensor.hum", icon: "mdi:cloud-percent-outline" },
];

export function render(app) {
  const { zones, plants } = app.data;
  const toolbar = `<div class="toolbar">
    <button class="btn ghost" data-action="add-zone"><ha-icon icon="mdi:plus"></ha-icon>${t("zones.add")}</button>
    <button class="btn" data-action="add-plant"><ha-icon icon="mdi:plus"></ha-icon>${t("plants.add")}</button>
  </div>`;
  if (!plants.length) {
    return `${toolbar}<div class="empty">
      <ha-icon icon="mdi:sprout"></ha-icon>
      <p>${zones.length ? t("plants.empty.zones") : t("plants.empty.nozones")}</p>
    </div>`;
  }
  const groups = zones.map((z) => ({ zone: z, plants: plants.filter((p) => p.zone_id === z.id) }));
  const orphans = plants.filter((p) => !p.zone_id || !zones.some((z) => z.id === p.zone_id));
  if (orphans.length) groups.push({ zone: { id: null, name: t("zone.none"), emoji: "🏷️" }, plants: orphans });
  return (
    toolbar +
    groups
      .filter((g) => g.plants.length)
      .map(
        (g) => `
      <div class="section-title"><span class="emoji">${esc(g.zone.emoji || "🪴")}</span>${esc(g.zone.name)}
        ${
          g.zone.id
            ? `<button class="icon-btn" data-action="edit-zone" data-id="${g.zone.id}" title="${t("edit")}"><ha-icon icon="mdi:pencil-outline"></ha-icon></button>
        <button class="icon-btn" data-action="delete-zone" data-id="${g.zone.id}" title="${t("delete")}"><ha-icon icon="mdi:trash-can-outline"></ha-icon></button>`
            : ""
        }
      </div>
      <div class="grid">${g.plants.map((p) => plantCard(app, p)).join("")}</div>`
      )
      .join("")
  );
}

function plantCard(app, p) {
  const sensors = SENSOR_FIELDS.filter((f) => p.sensors?.[f.key]).map((f) => {
    const entityId = p.sensors[f.key];
    const st = app.hass.states[entityId];
    const unavailable = !st || st.state === "unavailable" || st.state === "unknown";
    const val = unavailable ? "—" : `${st.state}${st.attributes.unit_of_measurement ? " " + st.attributes.unit_of_measurement : ""}`;
    return `<button class="sensor-chip ${unavailable ? "unavailable" : ""}" data-action="more-info" data-entity="${esc(entityId)}" title="${t(f.labelKey)}">
      <ha-icon icon="${f.icon}"></ha-icon><span class="val">${esc(val)}</span></button>`;
  });
  return `<div class="card plant">
    <div class="header"><span class="emoji">${esc(p.emoji || "🌱")}</span><h3>${esc(p.name)}</h3></div>
    ${p.species ? `<div class="species">${esc(p.species)}</div>` : ""}
    ${
      sensors.length
        ? `<div class="sensors">${sensors.join("")}</div>`
        : `<div class="sensors"><button class="btn ghost small" data-action="edit-plant" data-id="${p.id}"><ha-icon icon="mdi:link-variant"></ha-icon>${t("plant.link")}</button></div>`
    }
    <div class="actions">
      <button class="icon-btn" data-action="edit-plant" data-id="${p.id}" title="${t("edit")}"><ha-icon icon="mdi:pencil-outline"></ha-icon></button>
      <button class="icon-btn" data-action="delete-plant" data-id="${p.id}" title="${t("delete")}"><ha-icon icon="mdi:trash-can-outline"></ha-icon></button>
    </div>
  </div>`;
}

function zoneDialog(app, zone) {
  app.dialog(
    `<h2>${zone ? t("zone.edit") : t("zone.new")}</h2>
    <form>
      <label>${t("name")}</label>
      <input name="name" required maxlength="60" value="${esc(zone?.name)}" placeholder="${t("zone.name.ph")}" autofocus>
      <label>${t("zone.emoji")}</label>
      <input name="emoji" maxlength="4" value="${esc(zone?.emoji)}" placeholder="🏡">
      <div class="dialog-actions">
        <button type="button" class="btn plain" data-cancel>${t("cancel")}</button>
        <button type="submit" class="btn">${t("save")}</button>
      </div>
    </form>`,
    (fd) => app.saveItem("zones", { id: zone?.id ?? null, name: fd.get("name").trim(), emoji: fd.get("emoji").trim() })
  );
}

function plantDialog(app, plant) {
  const zoneOpts = app.data.zones
    .map((z) => `<option value="${z.id}" ${plant?.zone_id === z.id ? "selected" : ""}>${esc(z.name)}</option>`)
    .join("");
  app.dialog(
    `<h2>${plant ? t("plant.edit") : t("plant.new")}</h2>
    <form>
      <label>${t("name")}</label>
      <input name="name" required maxlength="60" value="${esc(plant?.name)}" placeholder="${t("plant.name.ph")}" autofocus>
      <label>${t("plant.species")}</label>
      <input name="species" maxlength="80" value="${esc(plant?.species)}">
      <label>${t("zone.emoji")}</label>
      <input name="emoji" maxlength="4" value="${esc(plant?.emoji)}" placeholder="🍅">
      <label>${t("plant.zone")}</label>
      <select name="zone_id"><option value="">${t("plant.zone.none")}</option>${zoneOpts}</select>
      ${SENSOR_FIELDS.map(
        (f) =>
          `<label>${t(f.labelKey)} ${t("plant.sensor.entity")}</label><select name="sensor_${f.key}">${entityOptions(app.hass, ["sensor"], plant?.sensors?.[f.key], t("none"))}</select>`
      ).join("")}
      <div class="dialog-actions">
        <button type="button" class="btn plain" data-cancel>${t("cancel")}</button>
        <button type="submit" class="btn">${t("save")}</button>
      </div>
    </form>`,
    (fd) =>
      app.saveItem("plants", {
        id: plant?.id ?? null,
        name: fd.get("name").trim(),
        species: fd.get("species").trim(),
        emoji: fd.get("emoji").trim(),
        zone_id: fd.get("zone_id") || null,
        sensors: Object.fromEntries(SENSOR_FIELDS.map((f) => [f.key, fd.get(`sensor_${f.key}`) || null])),
      })
  );
}

export const actions = {
  "add-zone": (app) => zoneDialog(app),
  "edit-zone": (app, el) => zoneDialog(app, app.data.zones.find((z) => z.id === el.dataset.id)),
  "delete-zone": (app, el) => {
    const zone = app.data.zones.find((z) => z.id === el.dataset.id);
    if (confirm(t("zone.delete.confirm", { name: zone.name }))) app.deleteItem("zones", zone.id);
  },
  "add-plant": (app) => plantDialog(app),
  "edit-plant": (app, el) => plantDialog(app, app.data.plants.find((p) => p.id === el.dataset.id)),
  "delete-plant": (app, el) => {
    const plant = app.data.plants.find((p) => p.id === el.dataset.id);
    if (confirm(t("plant.delete.confirm", { name: plant.name }))) app.deleteItem("plants", plant.id);
  },
  "more-info": (app, el) => {
    app.fire("hass-more-info", { entityId: el.dataset.entity });
  },
};
