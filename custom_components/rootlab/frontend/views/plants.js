import { t } from "../i18n.js";
import { combo, entityOptions, esc, nowStamp, optionsWithSuggestions, resizeImage, sensorState, uid, zoneSuggestions } from "../util.js";
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
      .filter((g) => g.plants.length || g.zone.id) // puste strefy też widoczne (edycja tylko tutaj)
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
      ${
        g.plants.length
          ? `<div class="grid">${g.plants.map((p) => plantCard(app, p)).join("")}</div>`
          : `<div class="card" style="color:var(--secondary-text-color);font-size:14px">${t("plants.zone.empty")}</div>`
      }`
      )
      .join("")
  );
}

/* Karta strefy (podgląd bez edycji): statystyki, rośliny, zadania. */
export function openZoneCard(app, zoneId) {
  const zone = app.data.zones.find((z) => z.id === zoneId);
  if (!zone) return;
  const zonePlants = app.data.plants.filter((p) => p.zone_id === zone.id);
  const plantIds = new Set(zonePlants.map((p) => p.id));
  const zoneTasks = (app.data.tasks || []).filter(
    (task) => !task.done && task.plant_id && plantIds.has(task.plant_id)
  );
  const plantRows = zonePlants
    .map((p) => {
      const sensors = SENSOR_FIELDS.filter((f) => p.sensors?.[f.key])
        .map((f) => {
          const st = sensorState(app.hass, p.sensors[f.key]);
          return `<span class="sensor-chip ${st.unavailable ? "unavailable" : ""}" style="padding:2px 8px;font-size:12px"><ha-icon icon="${f.icon}" style="--mdc-icon-size:14px"></ha-icon>${esc(st.text)}</span>`;
        })
        .join(" ");
      return `<div class="note-row"><span>${esc(p.emoji || "🌱")}</span>
        <span class="txt"><b>${esc(p.name)}</b>${p.species ? ` <small style="color:var(--secondary-text-color)">${esc(p.species)}</small>` : ""}<br>${sensors}</span>
        <button class="btn small ghost" data-action="plant-card" data-id="${p.id}">${t("plant.details")}</button></div>`;
    })
    .join("");
  app.dialog(
    `<h2><span class="emoji">${esc(zone.emoji || "🪴")}</span> ${esc(zone.name)}</h2>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
      <span class="chip">${zonePlants.length} ${zonePlants.length === 1 ? t("zone.plants.one") : t("zone.plants.many")}</span>
      <span class="chip ${zoneTasks.length ? "harvest" : ""}">${zoneTasks.length} ⏳</span>
    </div>
    <div class="section-title">${t("zonecard.plants")}</div>
    ${plantRows || `<p style="font-size:14px;color:var(--secondary-text-color)">${t("zonecard.empty")}</p>`}
    <div class="section-title">${t("zonecard.tasks")}</div>
    ${
      zoneTasks.length
        ? zoneTasks
            .map(
              (task) => `<div class="task-row">
                <input type="checkbox" data-action="task-done" data-id="${task.id}">
                <div class="body"><div class="title">${esc(task.title)}</div></div>
              </div>`
            )
            .join("")
        : `<p style="font-size:14px;color:var(--secondary-text-color)">${t("zonecard.notasks")}</p>`
    }
    <div class="dialog-actions"><button type="button" class="btn plain" data-cancel>${t("close")}</button></div>`,
    () => {},
    { wide: true }
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

function plantDialog(app, plant, draft = null) {
  draft ??= {
    name: plant?.name || "",
    species: plant?.species || "",
    emoji: plant?.emoji || "",
    zone_id: plant?.zone_id || "",
    sensors: { ...(plant?.sensors || {}) },
  };
  // urządzenia strefy: jedno z daną rolą → predefiniowane; więcej → ⭐ na górze listy
  SENSOR_FIELDS.forEach((f) => {
    if (!draft.sensors[f.key]) {
      const sugg = zoneSuggestions(app, draft.zone_id, f.key);
      if (sugg.length === 1) draft.sensors[f.key] = sugg[0].entity;
    }
  });
  const anySugg = SENSOR_FIELDS.some((f) => zoneSuggestions(app, draft.zone_id, f.key).length);
  const zoneOpts = app.data.zones.map((z) => ({ value: z.id, label: `${z.emoji || "🪴"} ${z.name}` }));
  const baseSensorOpts = entityOptions(app.hass, ["sensor"]);
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
      <input name="name" required maxlength="60" value="${esc(draft.name)}" placeholder="${t("plant.name.ph")}">
      <label>${t("plant.species")}</label>
      <input name="species" maxlength="80" value="${esc(draft.species)}">
      <label>${t("zone.emoji")}</label>
      <input name="emoji" maxlength="4" value="${esc(draft.emoji)}" placeholder="🍅">
      <label>${t("plant.zone")}</label>
      ${combo({ name: "zone_id", value: draft.zone_id, options: zoneOpts })}
      ${anySugg ? `<p style="font-size:12px;color:var(--secondary-text-color);margin:6px 0 0">${t("plant.sensors.auto")}</p>` : ""}
      ${SENSOR_FIELDS.map(
        (f) =>
          `<label>${t(f.labelKey)} ${t("plant.sensor.entity")}</label>` +
          combo({
            name: `sensor_${f.key}`,
            value: draft.sensors[f.key] || "",
            options: optionsWithSuggestions(app.hass, baseSensorOpts, zoneSuggestions(app, draft.zone_id, f.key)),
          })
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
  // zmiana strefy → przelicz sugestie czujników z urządzeń tej strefy
  dlg.querySelector('input[name="zone_id"]').addEventListener("change", (ev) => {
    const next = {
      name: dlg.querySelector('input[name="name"]').value,
      species: dlg.querySelector('input[name="species"]').value,
      emoji: dlg.querySelector('input[name="emoji"]').value,
      zone_id: ev.target.value,
      sensors: Object.fromEntries(
        SENSOR_FIELDS.map((f) => [f.key, dlg.querySelector(`input[name="sensor_${f.key}"]`).value])
      ),
    };
    plantDialog(app, plant, next);
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

const PHOTO_CONDITIONS = ["healthy", "ok", "weak", "sick"];
const SENSOR_LABEL_KEYS = { soil: "plant.sensor.soil", temp: "plant.sensor.temp", hum: "plant.sensor.hum" };
const HIST_ICON = { diag: "mdi:leaf-off", note: "mdi:note-text-outline", photo: "mdi:camera-outline", ask: "mdi:chat-question-outline" };

function readingBadges(f) {
  return Object.entries(f.readings || {})
    .map(
      ([k, v]) =>
        `<span class="sensor-chip" style="padding:2px 8px;font-size:12px">${esc(SENSOR_LABEL_KEYS[k] ? t(SENSOR_LABEL_KEYS[k]) : k)}: ${esc(v)}</span>`
    )
    .join(" ");
}

/* Wspólna oś czasu rośliny: diagnozy AI, notatki, zdjęcia, pytania do AI. */
function historyEntries(app, plant, photos) {
  const diag = (app.data.crisis_history || [])
    .filter((h) => h.plant_id === plant.id)
    .map((h) => ({ type: "diag", id: h.id, created: h.created || "", archived: !!h.archived, h }));
  const notes = (plant.notes || []).map((n) => ({ type: "note", id: n.id, created: n.date || "", archived: !!n.archived, n }));
  const phs = photos.map((f) => ({ type: "photo", id: f.id, created: f.created || "", archived: !!f.archived, f }));
  const asks = (plant.asks || []).map((a) => ({ type: "ask", id: a.id, created: a.created || "", archived: !!a.archived, a }));
  return [...diag, ...notes, ...phs, ...asks].sort((x, y) => y.created.localeCompare(x.created));
}

function historyRow(e, editMode) {
  let body = "";
  if (e.type === "diag") {
    body = `<b>${esc(e.h.diagnosis.problem)}</b> (${t("crisis.confidence")}: ${t("crisis.confidence." + e.h.diagnosis.confidence)})<br>
      <span style="font-size:12px">${esc(e.h.diagnosis.summary || "")}</span>`;
  } else if (e.type === "note") {
    body = `${t("hist.note")}<br><span style="font-size:13px">${esc((e.n.text || "").slice(0, 1000))}</span>`;
  } else if (e.type === "ask") {
    body = `<b>${esc(e.a.question)}</b><br><span style="font-size:13px">${esc((e.a.answer || "").slice(0, 1000))}</span>`;
  } else {
    const head = [e.f.condition ? t("photo.cond." + e.f.condition) : "", e.f.caption || ""].filter(Boolean).join(" · ");
    body = `${esc(head)}${head ? "<br>" : ""}${readingBadges(e.f)}`;
  }
  const thumb =
    e.type === "photo"
      ? `<img src="data:image/jpeg;base64,${e.f.image}" data-he-zoom alt="" style="width:72px;height:72px;object-fit:cover;border-radius:8px;cursor:pointer;flex:none">`
      : `<ha-icon icon="${HIST_ICON[e.type]}" style="--mdc-icon-size:18px;color:var(--secondary-text-color);flex:none;margin-top:2px"></ha-icon>`;
  const buttons = editMode
    ? `<span style="margin-left:auto;flex:none;display:flex;gap:2px">
        <button class="icon-btn" data-he-arch data-type="${e.type}" data-id="${e.id}" ${e.archived ? 'data-restore="1"' : ""} title="${t(e.archived ? "hist.restore" : "hist.archive")}">
          <ha-icon icon="mdi:archive-arrow-${e.archived ? "up" : "down"}-outline" style="--mdc-icon-size:16px"></ha-icon></button>
        <button class="icon-btn" data-he-del data-type="${e.type}" data-id="${e.id}" title="${t("delete")}">
          <ha-icon icon="mdi:trash-can-outline" style="--mdc-icon-size:16px"></ha-icon></button>
      </span>`
    : "";
  const bar = editMode ? `border-right:4px solid var(${e.archived ? "--rl-harvest" : "--rl-green"});` : "";
  return `<div class="history-item" style="display:flex;gap:10px;align-items:flex-start;${bar}${e.archived ? "opacity:.7;" : ""}">
    ${thumb}
    <div style="min-width:0;flex:1"><span style="color:var(--secondary-text-color);font-size:12px">${esc(e.created)}</span><br>${body}</div>
    ${buttons}</div>`;
}

function renderCard(app, plant, photos, aiAnswer = null, aiBusy = false, histEdit = false) {
  const entries = historyEntries(app, plant, photos).filter((e) => histEdit || !e.archived);
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
    <div class="actions" style="justify-content:flex-start">
      <button type="button" class="btn small ghost" id="pc-note-add"><ha-icon icon="mdi:plus"></ha-icon>${t("plant.note.add")}</button>
      <input type="file" id="pc-photo-file" accept="image/*" hidden>
      <button type="button" class="btn small ghost" id="pc-photo-add"><ha-icon icon="mdi:camera-plus-outline"></ha-icon>${t("plant.photo.add")}</button>
    </div>

    <div class="section-title" style="display:flex;align-items:center">${t("plant.history")}
      <label style="margin-left:auto;font-size:13px;font-weight:400;text-transform:none;letter-spacing:normal;display:flex;align-items:center;gap:6px;cursor:pointer">
        <input type="checkbox" id="pc-hist-edit" ${histEdit ? "checked" : ""}>${t("hist.edit")}</label>
    </div>
    ${
      entries.length
        ? entries.map((e) => historyRow(e, histEdit)).join("")
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
    renderCard(app, plant, photos, null, true, histEdit);
    let answer;
    try {
      answer = (await app.ws("ai/ask", { question, plant_id: plant.id })).answer;
      // backend dopisał pytanie do historii rośliny — odśwież dane
      try {
        app.data = await app.ws("data");
      } catch (e) {}
    } catch (e) {
      answer = (e.message || String(e));
    }
    app._lastQuestion = question;
    renderCard(app, app.data.plants.find((p) => p.id === plant.id) || plant, photos, answer, false, histEdit);
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
    const notes = [...(plant.notes || []), { id: uid(), date: nowStamp(), text }];
    try {
      app.data = await app.ws("item/save", { kind: "plants", item: { id: plant.id, notes } });
    } catch (e) {
      app.toast(`⚠ ${e.message || e}`, true);
      return;
    }
    app.toast(t("toast.added"));
    renderCard(app, app.data.plants.find((p) => p.id === plant.id), photos, aiAnswer, false, histEdit);
  });
  const fileInput = dlg.querySelector("#pc-photo-file");
  dlg.querySelector("#pc-photo-add").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async (ev) => {
    if (!ev.target.files[0]) return;
    let img;
    try {
      img = await resizeImage(ev.target.files[0], 900);
    } catch (e) {
      app.toast(`⚠ ${t("photo.unreadable")}`, true);
      return;
    }
    photoDialog(app, plant, img);
  });

  /* --- Historia: tryb edycji, archiwizacja i usuwanie wpisów --- */
  dlg.querySelector("#pc-hist-edit").addEventListener("change", (ev) => {
    renderCard(app, plant, photos, aiAnswer, aiBusy, ev.target.checked);
  });
  dlg.querySelectorAll("[data-he-zoom]").forEach((img) =>
    img.addEventListener("click", () => {
      const small = img.style.width === "72px";
      img.style.width = small ? "100%" : "72px";
      img.style.height = small ? "auto" : "72px";
    })
  );
  const refreshCard = (updatedPhotos) =>
    renderCard(
      app,
      app.data.plants.find((p) => p.id === plant.id) || plant,
      updatedPhotos || photos,
      aiAnswer,
      false,
      true
    );
  dlg.querySelectorAll("[data-he-arch]").forEach((el) =>
    el.addEventListener("click", async () => {
      const { type, id } = el.dataset;
      const archived = !el.dataset.restore;
      let updatedPhotos = null;
      try {
        if (type === "diag") {
          app.data = await app.ws("crisis/archive", { history_id: id, archived });
        } else if (type === "photo") {
          updatedPhotos = await app.ws("plant/photo/archive", { plant_id: plant.id, photo_id: id, archived });
        } else {
          const field = type === "note" ? "notes" : "asks";
          const list = (plant[field] || []).map((x) => (x.id === id ? { ...x, archived } : x));
          app.data = await app.ws("item/save", { kind: "plants", item: { id: plant.id, [field]: list } });
        }
      } catch (e) {
        app.toast(`⚠ ${e.message || e}`, true);
        return;
      }
      app.toast(t(archived ? "hist.archived.toast" : "hist.restored"));
      refreshCard(updatedPhotos);
    })
  );
  dlg.querySelectorAll("[data-he-del]").forEach((el) =>
    el.addEventListener("click", async () => {
      if (!confirm(t("hist.delete.confirm"))) return;
      const { type, id } = el.dataset;
      let updatedPhotos = null;
      try {
        if (type === "diag") {
          app.data = await app.ws("crisis/delete", { history_id: id });
        } else if (type === "photo") {
          updatedPhotos = await app.ws("plant/photo/delete", { plant_id: plant.id, photo_id: id });
        } else {
          const field = type === "note" ? "notes" : "asks";
          const list = (plant[field] || []).filter((x) => x.id !== id);
          app.data = await app.ws("item/save", { kind: "plants", item: { id: plant.id, [field]: list } });
        }
      } catch (e) {
        app.toast(`⚠ ${e.message || e}`, true);
        return;
      }
      app.toast(t("toast.deleted"));
      refreshCard(updatedPhotos);
    })
  );
}

/* Nowe zdjęcie: podgląd + notatka + stan rośliny; backend dołoży godzinę i odczyty encji. */
function photoDialog(app, plant, img) {
  const condOpts = PHOTO_CONDITIONS.map((c) => ({ value: c, label: t("photo.cond." + c) }));
  app.dialog(
    `<h2>${t("photo.add.title")}</h2>
    <form>
      <img src="${img.preview}" alt="" style="max-width:100%;max-height:220px;border-radius:8px;display:block;margin:0 auto 10px">
      <label>${t("photo.condition")}</label>
      ${combo({ name: "condition", value: "ok", options: condOpts, allowEmpty: false })}
      <label>${t("photo.note")}</label>
      <textarea name="caption" placeholder="${t("plant.note.ph")}" style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid var(--divider-color);border-radius:8px;background:var(--primary-background-color);color:var(--primary-text-color);font:inherit;min-height:44px"></textarea>
      <div class="dialog-actions">
        <button type="button" class="btn plain" data-cancel>${t("cancel")}</button>
        <button type="submit" class="btn">${t("save")}</button>
      </div>
    </form>`,
    async (fd) => {
      try {
        const updated = await app.ws("plant/photo/add", {
          plant_id: plant.id,
          image: img.data,
          caption: (fd.get("caption") || "").trim(),
          condition: fd.get("condition"),
        });
        app.toast(t("toast.added"));
        renderCard(app, plant, updated);
      } catch (e) {
        app.toast(`⚠ ${e.message || e}`, true);
      }
    }
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
  "zone-card": (app, el) => openZoneCard(app, el.dataset.id),
  "more-info": (app, el) => {
    app.fire("hass-more-info", { entityId: el.dataset.entity });
  },
};
