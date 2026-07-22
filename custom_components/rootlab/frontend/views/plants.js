import { t } from "../i18n.js";
import { combo, entityOptions, esc, resizeImage, sensorState } from "../util.js";
import { PLANT_PRESETS } from "../presets.js";
import { openCrisis } from "../crisis.js";

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
    const st = sensorState(app.hass, entityId);
    return `<button class="sensor-chip ${st.unavailable ? "unavailable" : ""}" data-action="more-info" data-entity="${esc(entityId)}" title="${t(f.labelKey)}">
      <ha-icon icon="${f.icon}"></ha-icon><span class="val">${esc(st.text)}</span></button>`;
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
      <button class="btn small ghost" data-action="plant-card" data-id="${p.id}"><ha-icon icon="mdi:card-account-details-outline"></ha-icon>${t("plant.details")}</button>
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
  const zoneOpts = app.data.zones.map((z) => ({ value: z.id, label: `${z.emoji || "🪴"} ${z.name}` }));
  const sensorOpts = entityOptions(app.hass, ["sensor"]);
  const presetOpts = PLANT_PRESETS.map((p, i) => ({
    value: String(i),
    label: `${p.emoji} ${p.name}`,
    secondary: p.species,
  }));
  const dlg = app.dialog(
    `<h2>${plant ? t("plant.edit") : t("plant.new")}</h2>
    <form>
      ${
        plant
          ? ""
          : `<label>${t("plant.preset")}</label>${combo({ name: "preset", options: presetOpts })}`
      }
      <label>${t("name")}</label>
      <input name="name" required maxlength="60" value="${esc(plant?.name)}" placeholder="${t("plant.name.ph")}">
      <label>${t("plant.species")}</label>
      <input name="species" maxlength="80" value="${esc(plant?.species)}">
      <label>${t("zone.emoji")}</label>
      <input name="emoji" maxlength="4" value="${esc(plant?.emoji)}" placeholder="🍅">
      <label>${t("plant.zone")}</label>
      ${combo({ name: "zone_id", value: plant?.zone_id || "", options: zoneOpts })}
      ${SENSOR_FIELDS.map(
        (f) =>
          `<label>${t(f.labelKey)} ${t("plant.sensor.entity")}</label>` +
          combo({ name: `sensor_${f.key}`, value: plant?.sensors?.[f.key] || "", options: sensorOpts })
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
  // preset → prefill pól
  dlg.querySelector('input[name="preset"]')?.addEventListener("change", (ev) => {
    const preset = PLANT_PRESETS[parseInt(ev.target.value, 10)];
    if (!preset) return;
    dlg.querySelector('input[name="name"]').value = preset.name;
    dlg.querySelector('input[name="species"]').value = preset.species;
    dlg.querySelector('input[name="emoji"]').value = preset.emoji;
  });
}

/* --- Karta rośliny: czujniki, notatki, zdjęcia, historia diagnoz, AI --- */

export async function openPlantCard(app, plantId) {
  const plant = app.data.plants.find((p) => p.id === plantId);
  if (!plant) return;
  let photos = [];
  try {
    photos = await app.ws("plant/photos", { plant_id: plantId });
  } catch (e) {
    photos = [];
  }
  renderCard(app, plant, photos);
}

function renderCard(app, plant, photos, aiAnswer = null, aiBusy = false) {
  const history = (app.data.crisis_history || []).filter((h) => h.plant_id === plant.id).slice(-5).reverse();
  const notes = (plant.notes || []).slice().reverse();
  const sensors = SENSOR_FIELDS.filter((f) => plant.sensors?.[f.key])
    .map((f) => {
      const st = sensorState(app.hass, plant.sensors[f.key]);
      return `<span class="sensor-chip ${st.unavailable ? "unavailable" : ""}"><ha-icon icon="${f.icon}"></ha-icon>${esc(st.text)}</span>`;
    })
    .join("");
  const dlg = app.dialog(
    `<h2><span class="emoji">${esc(plant.emoji || "🌱")}</span> ${esc(plant.name)}</h2>
    ${plant.species ? `<div class="species" style="margin:0 0 8px">${esc(plant.species)}</div>` : ""}
    ${sensors ? `<div class="sensors">${sensors}</div>` : ""}
    <div class="actions" style="justify-content:flex-start">
      <button type="button" class="btn small ai" id="pc-diag"><ha-icon icon="mdi:leaf-off"></ha-icon>${t("plant.diagnose")}</button>
      <button type="button" class="btn small ghost" data-action="edit-plant" data-id="${plant.id}"><ha-icon icon="mdi:pencil-outline"></ha-icon>${t("edit")}</button>
    </div>

    <div class="section-title">${t("plant.askai")}</div>
    <div class="mic-wrap">
      <textarea id="pc-question" placeholder="${t("plant.askai.ph")}" style="width:100%;box-sizing:border-box;padding:10px 40px 10px 12px;border:1px solid var(--divider-color);border-radius:8px;background:var(--primary-background-color);color:var(--primary-text-color);font:inherit;min-height:56px"></textarea>
    </div>
    <button type="button" class="btn small ai" id="pc-ask" ${aiBusy ? "disabled" : ""}>
      <ha-icon icon="mdi:creation"></ha-icon>${aiBusy ? t("ai.asking") : t("plant.askai")}</button>
    ${
      aiAnswer
        ? `<div class="diagnosis"><h3>${t("ai.answer")}</h3><div class="desc">${esc(aiAnswer)}</div>
           <button type="button" class="btn small ai" id="pc-kn" style="margin-top:10px"><ha-icon icon="mdi:book-plus-outline"></ha-icon>${t("knowledge.save")}</button></div>`
        : ""
    }

    <div class="section-title">${t("plant.notes")}</div>
    <div class="mic-wrap">
      <textarea id="pc-note" placeholder="${t("plant.note.ph")}" style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid var(--divider-color);border-radius:8px;background:var(--primary-background-color);color:var(--primary-text-color);font:inherit;min-height:44px"></textarea>
    </div>
    <button type="button" class="btn small ghost" id="pc-note-add"><ha-icon icon="mdi:plus"></ha-icon>${t("plant.note.add")}</button>
    ${notes
      .map(
        (n) => `<div class="note-row"><span class="date">${esc(n.date)}</span><span class="txt">${esc(n.text)}</span>
          <button class="icon-btn" data-note-del="${n.id}" title="${t("delete")}"><ha-icon icon="mdi:trash-can-outline"></ha-icon></button></div>`
      )
      .join("")}

    <div class="section-title">${t("plant.photos")}</div>
    <input type="file" id="pc-photo-file" accept="image/*" hidden>
    <button type="button" class="btn small ghost" id="pc-photo-add"><ha-icon icon="mdi:camera-plus-outline"></ha-icon>${t("plant.photo.add")}</button>
    ${
      photos.length
        ? `<div class="photo-grid">${photos
            .slice()
            .reverse()
            .map(
              (f) => `<div class="ph"><img src="data:image/jpeg;base64,${f.image}" alt="" title="${esc(f.created)} ${esc(f.caption || "")}">
                <button class="del" data-photo-del="${f.id}" title="${t("delete")}">✕</button></div>`
            )
            .join("")}</div>`
        : ""
    }

    <div class="section-title">${t("plant.history")}</div>
    ${
      history.length
        ? history
            .map(
              (h) => `<div class="history-item">${esc(h.created)} — <b>${esc(h.diagnosis.problem)}</b>
                (${t("crisis.confidence")}: ${t("crisis.confidence." + h.diagnosis.confidence)})<br>
                <span style="font-size:12px">${esc(h.diagnosis.summary || "")}</span></div>`
            )
            .join("")
        : `<div class="history-item">${t("plant.history.empty")}</div>`
    }`,
    () => {},
    { wide: true }
  );

  import("../stt.js").then((stt) => {
    stt.attachMic(app, dlg.querySelector("#pc-question"));
    stt.attachMic(app, dlg.querySelector("#pc-note"));
  });

  dlg.querySelector("#pc-diag").addEventListener("click", () => {
    dlg.close();
    openCrisis(app, plant.id);
  });
  dlg.querySelector("#pc-ask").addEventListener("click", async () => {
    const question = dlg.querySelector("#pc-question").value.trim();
    if (!question || aiBusy) return;
    renderCard(app, plant, photos, null, true);
    let answer;
    try {
      answer = (await app.ws("ai/ask", { question, plant_id: plant.id })).answer;
    } catch (e) {
      answer = (e.message || String(e));
    }
    app._lastQuestion = question;
    renderCard(app, plant, photos, answer, false);
  });
  dlg.querySelector("#pc-kn")?.addEventListener("click", async (ev) => {
    await app.ws("item/save", {
      kind: "knowledge",
      item: {
        id: null,
        title: (app._lastQuestion || t("ai.answer")) + ` (${plant.name})`,
        content: aiAnswer,
        source: "ai",
        plant_id: plant.id,
        created: new Date().toISOString().slice(0, 10),
      },
    });
    ev.target.closest("button").outerHTML = `<span class="chip ai">✓ ${t("knowledge.saved")}</span>`;
  });
  dlg.querySelector("#pc-note-add").addEventListener("click", async () => {
    const text = dlg.querySelector("#pc-note").value.trim();
    if (!text) return;
    const notes = [...(plant.notes || []), { id: crypto.randomUUID(), date: new Date().toISOString().slice(0, 10), text }];
    app.data = await app.ws("item/save", { kind: "plants", item: { id: plant.id, notes } });
    renderCard(app, app.data.plants.find((p) => p.id === plant.id), photos);
  });
  dlg.querySelectorAll("[data-note-del]").forEach((el) =>
    el.addEventListener("click", async () => {
      if (!confirm(t("note.delete.confirm"))) return;
      const notes = (plant.notes || []).filter((n) => n.id !== el.dataset.noteDel);
      app.data = await app.ws("item/save", { kind: "plants", item: { id: plant.id, notes } });
      renderCard(app, app.data.plants.find((p) => p.id === plant.id), photos);
    })
  );
  const fileInput = dlg.querySelector("#pc-photo-file");
  dlg.querySelector("#pc-photo-add").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async (ev) => {
    if (!ev.target.files[0]) return;
    const img = await resizeImage(ev.target.files[0], 900);
    const updated = await app.ws("plant/photo/add", { plant_id: plant.id, image: img.data });
    renderCard(app, plant, updated);
  });
  dlg.querySelectorAll("[data-photo-del]").forEach((el) =>
    el.addEventListener("click", async () => {
      if (!confirm(t("photo.delete.confirm"))) return;
      const updated = await app.ws("plant/photo/delete", { plant_id: plant.id, photo_id: el.dataset.photoDel });
      renderCard(app, plant, updated);
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
  "plant-card": (app, el) => openPlantCard(app, el.dataset.id),
  "more-info": (app, el) => {
    app.fire("hass-more-info", { entityId: el.dataset.entity });
  },
};
