import { t } from "../i18n.js";
import { combo, emo, emojiPngUrl, entityOptions, esc, nowStamp, optionsWithSuggestions, resizeImage, sensorState, todayISO, uid, zoneSuggestions } from "../util.js";
import { iconOptions } from "../icons.js";
import { PLANT_PRESETS } from "../presets.js";
import { openCrisis } from "../crisis.js";
import { startChat } from "./chat.js"; // cykl bezpieczny: użycie w handlerze
import { lineElements } from "../shade.js";
import { areaLabel, areaOptions, bind as growBind, dateInput, fdMMDD, growDialog, plantingPhase, render as growRender } from "./grow.js";

/* Ikona rośliny: własny obrazek (miniatura base64) albo emoji→SVG. */
export const plantIcon = (p, size = 18) =>
  p?.icon
    ? `<img class="emo" src="data:image/jpeg;base64,${p.icon}" width="${size}" height="${size}" style="border-radius:50%;object-fit:cover" alt="">`
    : emo(p?.emoji || "🌱", size);

export const SENSOR_FIELDS = [
  { key: "soil", labelKey: "plant.sensor.soil", icon: "mdi:water-percent" },
  { key: "temp", labelKey: "plant.sensor.temp", icon: "mdi:thermometer" },
  { key: "hum", labelKey: "plant.sensor.hum", icon: "mdi:cloud-percent-outline" },
];

export function render(app) {
  const sub = (app._plantsSub ??= "plants");
  const switcher = `<div class="subtabs">
    <button class="subtab" data-action="plants-sub" data-sub="plants" ${sub === "plants" ? "data-active" : ""}><ha-icon icon="mdi:sprout"></ha-icon>${t("tab.plants")}</button>
    <button class="subtab" data-action="plants-sub" data-sub="grow" ${sub === "grow" ? "data-active" : ""}><ha-icon icon="mdi:calendar-month"></ha-icon>${t("tab.grow")}</button>
  </div>`;
  if (sub === "grow") return switcher + growRender(app);
  const { zones, plants } = app.data;
  const toolbar = `<div class="toolbar">
    <button class="btn ghost" data-action="add-zone"><ha-icon icon="mdi:plus"></ha-icon>${t("zones.add")}</button>
    <button class="btn" data-action="add-plant"><ha-icon icon="mdi:plus"></ha-icon>${t("plants.add")}</button>
  </div>`;
  // uprawy bieżącego roku pogrupowane po strefie miejsca (grządki/szklarnie z planu)
  const year = new Date().getFullYear();
  // fallback dla upraw bez żywej karty rośliny (stare dane albo usunięta roślina)
  const plantings = (app.data.plantings || []).filter(
    (p) => p.year === year && (!p.plant_id || !plants.some((x) => x.id === p.plant_id))
  );
  const zonePlantings = (zoneId) =>
    plantings.filter((p) => (zoneId ? p.zone_id === zoneId : !zones.some((z) => z.id === p.zone_id)));
  if (!plants.length && !plantings.length) {
    return `${switcher}${toolbar}<div class="empty">
      <ha-icon icon="mdi:sprout"></ha-icon>
      <p>${zones.length ? t("plants.empty.zones") : t("plants.empty.nozones")}</p>
    </div>`;
  }
  const groups = zones.map((z) => ({ zone: z, plants: plants.filter((p) => p.zone_id === z.id) }));
  const orphans = plants.filter((p) => !p.zone_id || !zones.some((z) => z.id === p.zone_id));
  if (orphans.length || zonePlantings(null).length)
    groups.push({ zone: { id: null, name: t("zone.none"), emoji: "🏷️" }, plants: orphans });
  return (
    switcher +
    toolbar +
    groups
      .filter((g) => g.plants.length || g.zone.id) // puste strefy też widoczne (edycja tylko tutaj)
      .map(
        (g) => `
      <div class="section-title">${emo(g.zone.emoji || "🪴", 20)}${esc(g.zone.name)}
        ${
          g.zone.id
            ? `<button class="icon-btn" data-action="zone-card" data-id="${g.zone.id}" title="${t("plant.details")}"><ha-icon icon="mdi:card-account-details-outline"></ha-icon></button>
        <button class="icon-btn" data-action="edit-zone" data-id="${g.zone.id}" title="${t("edit")}"><ha-icon icon="mdi:pencil-outline"></ha-icon></button>
        <button class="icon-btn" data-action="delete-zone" data-id="${g.zone.id}" title="${t("delete")}"><ha-icon icon="mdi:trash-can-outline"></ha-icon></button>`
            : ""
        }
      </div>
      ${
        g.plants.length
          ? `<div class="grid">${g.plants.map((p) => plantCard(app, p)).join("")}</div>`
          : zonePlantings(g.zone.id).length
            ? ""
            : `<div class="card" style="color:var(--secondary-text-color);font-size:14px">${t("plants.zone.empty")}</div>`
      }
      ${plantingsCard(app, zonePlantings(g.zone.id), year)}`
      )
      .join("")
  );
}

/* Uprawy z kalendarza w widoku roślin — pasek w kolorze bieżącej fazy wegetacji. */
const PHASE_COLOR = {
  planned: "var(--secondary-text-color)",
  sow: "var(--rl-ai)",
  grow: "var(--rl-green)",
  harvest: "var(--rl-harvest)",
  done: "var(--divider-color)",
};

function plantingsCard(app, list, year) {
  if (!list.length) return "";
  const rows = list
    .sort((a, b) => (a.plan?.sow || a.plan?.transplant || "").localeCompare(b.plan?.sow || b.plan?.transplant || ""))
    .map((p) => {
      const phase = plantingPhase(p);
      return `<div class="note-row" data-planting="${p.id}" style="cursor:pointer;border-left:4px solid ${PHASE_COLOR[phase]};padding-left:10px;align-items:center">
        ${emo(p.emoji || "🌱", 20)}
        <span class="txt"><b>${esc(p.name)}</b> <small style="color:var(--secondary-text-color)">${esc(areaLabel(app, p.zone_id))}</small></span>
        <span class="chip" style="background:color-mix(in srgb, ${PHASE_COLOR[phase]} 18%, transparent);color:inherit">${t("grow.phase." + phase)}</span>
      </div>`;
    })
    .join("");
  return `<div class="card" style="margin-top:8px">
    <div class="section-title" style="margin-top:0">${t("tab.grow")} ${year}</div>${rows}</div>`;
}

export function bind(app, root) {
  if (app._plantsSub === "grow") {
    growBind(app, root);
    return;
  }
  root.querySelectorAll("[data-planting]").forEach((el) =>
    el.addEventListener("click", () => {
      const p = (app.data.plantings || []).find((x) => x.id === el.dataset.planting);
      if (p) growDialog(app, p);
    })
  );
}

/* Wycinek planu ogrodu ze strefą: prostokąty + rośliny/nasadzenia w środku. */
function zoneMiniMap(app, zone) {
  const items = app.data.layout?.items || [];
  const rects = items.filter((i) => "w" in i && i.zone_id === zone.id);
  if (!rects.length) return "";
  const pad = 0.8;
  const minX = Math.min(...rects.map((r) => r.x)) - pad;
  const minY = Math.min(...rects.map((r) => r.y)) - pad;
  const maxX = Math.max(...rects.map((r) => r.x + r.w)) + pad;
  const maxY = Math.max(...rects.map((r) => r.y + r.h)) + pad;
  const inView = (x, y) => x >= minX && x <= maxX && y >= minY && y <= maxY;
  const circles = items.filter(
    (i) => !("w" in i) && !Array.isArray(i.path) && i.kind !== "irrigation" && inView(i.x, i.y)
  );
  const lineEls = items
    .filter((i) => i.kind === "row" || i.kind === "hedge")
    .flatMap((i) => lineElements(i))
    .filter((e) => inView(e.x, e.y));
  const nodes = [...circles, ...lineEls]
    .map((c) => {
      const r = Math.max((c.diameter_m || 0.5) / 2, 0.15);
      const plant = c.plant_id ? app.data.plants.find((p) => p.id === c.plant_id) : null;
      const href = plant?.icon
        ? `data:image/jpeg;base64,${plant.icon}`
        : emojiPngUrl(plant?.emoji || c.emoji || "🌱");
      const gs = Math.max(Math.min(r * 1.2, 1.4), 0.4);
      return `<g transform="translate(${c.x} ${c.y})"><circle r="${r}" fill="var(--rl-green)" fill-opacity="0.35"/>${href ? `<image href="${href}" x="${-gs / 2}" y="${-gs / 2}" width="${gs}" height="${gs}"/>` : ""}</g>`;
    })
    .join("");
  return `<svg viewBox="${minX} ${minY} ${maxX - minX} ${maxY - minY}" style="width:100%;max-height:220px;background:color-mix(in srgb, var(--rl-green) 6%, transparent);border-radius:8px;display:block;margin-bottom:8px">
    ${rects.map((r) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="0.2" fill="none" stroke="var(--rl-soil)" stroke-width="0.08"/>`).join("")}
    ${nodes}
  </svg>`;
}

/* Karta strefy: diagnoza AI, mini-plan, rośliny, uprawy, notatki + pomiary światła. */
export function openZoneCard(app, zoneId) {
  const zone = app.data.zones.find((z) => z.id === zoneId);
  if (!zone) return;
  const zonePlants = app.data.plants.filter((p) => p.zone_id === zone.id);
  const plantIds = new Set(zonePlants.map((p) => p.id));
  const zoneTasks = (app.data.tasks || []).filter(
    (task) => !task.done && task.plant_id && plantIds.has(task.plant_id)
  );
  const year = new Date().getFullYear();
  const zonePlantings = (app.data.plantings || []).filter((p) => p.zone_id === zone.id && p.year === year);
  const notes = [...(zone.notes || [])].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const plantRows = zonePlants
    .map((p) => {
      const sensors = SENSOR_FIELDS.filter((f) => p.sensors?.[f.key])
        .map((f) => {
          const st = sensorState(app.hass, p.sensors[f.key]);
          return `<span class="sensor-chip ${st.unavailable ? "unavailable" : ""}" style="padding:2px 8px;font-size:12px"><ha-icon icon="${f.icon}" style="--mdc-icon-size:14px"></ha-icon>${esc(st.text)}</span>`;
        })
        .join(" ");
      return `<div class="note-row">${plantIcon(p, 20)}
        <span class="txt"><b>${esc(p.name)}</b>${p.species ? ` <small style="color:var(--secondary-text-color)">${esc(p.species)}</small>` : ""}<br>${sensors}</span>
        <button class="btn small ghost" data-action="plant-card" data-id="${p.id}">${t("plant.details")}</button></div>`;
    })
    .join("");
  const noteRows = notes
    .map((n) => {
      const light =
        n.light_pct != null
          ? `<span class="chip">💡 ${n.light_pct}%${n.lux ? ` · ${n.lux} lx` : ""}</span> `
          : "";
      const reads = Object.entries(n.readings || {})
        .map(([k, v]) => `<span class="sensor-chip" style="padding:2px 8px;font-size:11px">${esc(k)}: ${esc(v)}</span>`)
        .join(" ");
      return `<div class="history-item" style="display:flex;gap:10px;align-items:flex-start">
        <ha-icon icon="${n.light_pct != null ? "mdi:white-balance-sunny" : "mdi:note-text-outline"}" style="--mdc-icon-size:18px;color:var(--secondary-text-color);flex:none;margin-top:2px"></ha-icon>
        <div style="min-width:0;flex:1"><span style="color:var(--secondary-text-color);font-size:12px">${esc(n.date || "")}</span><br>
          ${light}${esc(n.text || "")}${reads ? `<br>${reads}` : ""}</div>
        <button class="icon-btn" data-zn-del="${n.id}" title="${t("delete")}"><ha-icon icon="mdi:trash-can-outline" style="--mdc-icon-size:16px"></ha-icon></button>
      </div>`;
    })
    .join("");
  const dlg = app.dialog(
    `<h2>${emo(zone.emoji || "🪴", 26)} ${esc(zone.name)}</h2>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
      ${zone.kind ? `<span class="chip">${t("editor.palette." + zone.kind)}</span>` : ""}
      ${zone.planting ? `<span class="chip">${t("planting." + zone.planting)}</span>` : ""}
      <span class="chip">${zonePlants.length} ${zonePlants.length === 1 ? t("zone.plants.one") : t("zone.plants.many")}</span>
      <span class="chip ${zoneTasks.length ? "harvest" : ""}">${zoneTasks.length} ⏳</span>
    </div>
    <div class="actions" style="justify-content:flex-start">
      <button type="button" class="btn small ai" id="zc-diag"><ha-icon icon="mdi:stethoscope"></ha-icon>${t("zone.diagnose")}</button>
      <button type="button" class="btn small ghost" id="zc-light"><ha-icon icon="mdi:white-balance-sunny"></ha-icon>${t("zone.light")}</button>
      <button type="button" class="btn small ghost" data-action="edit-zone" data-id="${zone.id}"><ha-icon icon="mdi:pencil-outline"></ha-icon>${t("edit")}</button>
    </div>
    ${zoneMiniMap(app, zone)}
    <div class="section-title">${t("zonecard.plants")}</div>
    ${plantRows || `<p style="font-size:14px;color:var(--secondary-text-color)">${t("zonecard.empty")}</p>`}
    ${
      zonePlantings.length
        ? `<div class="section-title">${t("zone.plantings")}</div>` +
          zonePlantings
            .map((p) => `<div class="note-row">${emo(p.emoji || "🌱", 18)}<span class="txt">${esc(p.name)}</span></div>`)
            .join("")
        : ""
    }
    <div class="section-title">${t("zone.notes")}</div>
    <div class="mic-wrap">
      <textarea id="zc-note" placeholder="${t("plant.note.ph")}" style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid var(--divider-color);border-radius:8px;background:var(--primary-background-color);color:var(--primary-text-color);font:inherit;min-height:44px"></textarea>
    </div>
    <div class="actions" style="justify-content:flex-start">
      <button type="button" class="btn small ghost" id="zc-note-add"><ha-icon icon="mdi:plus"></ha-icon>${t("plant.note.add")}</button>
    </div>
    ${noteRows || `<div class="history-item">${t("plant.history.empty")}</div>`}
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
  import("../stt.js").then((stt) => stt.attachMic(app, dlg.querySelector("#zc-note")));
  dlg.querySelector("#zc-diag").addEventListener("click", async () => {
    dlg.close();
    const stamp = nowStamp();
    try {
      await startChat(app, {
        id: null,
        plant_id: null,
        zone_id: zone.id,
        title: `${t("zone.diagnose")}: ${zone.name}`,
        created: stamp,
        updated: stamp,
        messages: [],
      });
    } catch (e) {
      app.toast(`⚠ ${e.message || e}`, true);
      return;
    }
    app.render();
  });
  dlg.querySelector("#zc-light").addEventListener("click", () => lightMeterDialog(app, zone));
  const saveNotes = async (list) => {
    try {
      app.data = await app.ws("item/save", { kind: "zones", item: { id: zone.id, notes: list } });
    } catch (e) {
      app.toast(`⚠ ${e.message || e}`, true);
      return false;
    }
    return true;
  };
  dlg.querySelector("#zc-note-add").addEventListener("click", async () => {
    const text = dlg.querySelector("#zc-note").value.trim();
    if (!text) return;
    if (await saveNotes([...(zone.notes || []), { id: uid(), date: nowStamp(), text }])) {
      app.toast(t("toast.added"));
      openZoneCard(app, zone.id);
    }
  });
  dlg.querySelectorAll("[data-zn-del]").forEach((el) =>
    el.addEventListener("click", async () => {
      if (!await app.confirm(t("hist.delete.confirm"))) return;
      if (await saveNotes((zone.notes || []).filter((n) => n.id !== el.dataset.znDel))) {
        app.toast(t("toast.deleted"));
        openZoneCard(app, zone.id);
      }
    })
  );
}

/* Światłomierz z kamery.
   Android/Chrome: ręczna ekspozycja (exposureTime × ISO) → szacunek w luksach
   z pełną rozpiętością (słońce ≫ cień). Gdzie się nie da (iOS): względny %
   skorygowany o udział prześwietlonych pikseli (celowanie w słońce → ~100%).
   Wynik = mediana z okna uśredniania (odporna na myszkowanie automatyki). */
function lightMeterDialog(app, zone) {
  const measured = { pct: null, lux: null, sensorLux: null, manual: false };
  const dlg = app.dialog(
    `<h2>💡 ${t("zone.light")}</h2>
    <div id="lm-err" class="warn-hint" style="display:none;margin-bottom:8px"></div>
    <video id="lm-video" autoplay playsinline muted style="width:100%;max-height:240px;object-fit:cover;border-radius:8px;background:#000"></video>
    <div style="text-align:center;margin:10px 0">
      <div id="lm-val" style="font-size:34px;font-weight:600">—</div>
      <div id="lm-cat" style="color:var(--secondary-text-color)"></div>
      <div id="lm-range" style="font-size:12px;color:var(--secondary-text-color)"></div>
      <div id="lm-mode" style="font-size:11px;color:var(--secondary-text-color);margin-top:2px"></div>
    </div>
    <form>
      <div style="display:flex;gap:10px;align-items:flex-end">
        <span><label>${t("zone.light.window")}</label>
        <input name="window" id="lm-window" type="number" min="1" max="30" step="1" value="3" style="width:90px"></span>
        <span style="flex:1"><label>${t("photo.note")}</label>
        <input name="text" placeholder="${t("plant.note.ph")}"></span>
      </div>
      <p style="font-size:12px;color:var(--secondary-text-color);margin:8px 0">${t("zone.light.hint")}</p>
      <div class="dialog-actions">
        <button type="button" class="btn plain" data-cancel>${t("cancel")}</button>
        <button type="submit" class="btn"><ha-icon icon="mdi:content-save-outline"></ha-icon>${t("zone.light.save")}</button>
      </div>
    </form>`,
    async (fd) => {
      // odczyty czujników roślin strefy w chwili pomiaru
      const readings = {};
      app.data.plants
        .filter((p) => p.zone_id === zone.id)
        .forEach((p) =>
          SENSOR_FIELDS.forEach((f) => {
            if (!p.sensors?.[f.key]) return;
            const st = sensorState(app.hass, p.sensors[f.key]);
            if (!st.unavailable) readings[`${p.name} · ${t(f.labelKey)}`] = st.text;
          })
        );
      const note = {
        id: uid(),
        date: nowStamp(),
        text: (fd.get("text") || "").trim(),
        light_pct: measured.pct,
        lux: measured.sensorLux ?? measured.lux,
        readings,
      };
      try {
        app.data = await app.ws("item/save", {
          kind: "zones",
          item: { id: zone.id, notes: [...(zone.notes || []), note] },
        });
      } catch (e) {
        app.toast(`⚠ ${e.message || e}`, true);
        return;
      }
      app.toast(t("toast.added"));
      openZoneCard(app, zone.id);
    }
  );
  const video = dlg.querySelector("#lm-video");
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 48;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  let stream = null;
  let track = null;
  let timer = null;
  const samples = []; // {t, pct, lux}
  const median = (arr) => {
    if (!arr.length) return null;
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };
  const fmtLux = (lx) => (lx >= 10000 ? `${Math.round(lx / 1000)} klx` : lx >= 1000 ? `${(lx / 1000).toFixed(1)} klx` : `${Math.round(lx)} lx`);
  // ręczna ekspozycja (Android/Chrome): auto-zakres czasu naświetlania
  const exp = { manual: false, timeUnits: null, min: null, max: null, iso: 100, cooldown: 0 };
  const setupManual = async () => {
    const caps = track.getCapabilities?.() || {};
    if (!caps.exposureTime || !(caps.exposureMode || []).includes("manual")) return;
    exp.min = caps.exposureTime.min;
    exp.max = caps.exposureTime.max;
    exp.timeUnits = Math.min(Math.max(50, exp.min), exp.max); // start: krótko (jasno na dworze)
    const adv = { exposureMode: "manual", exposureTime: exp.timeUnits };
    if (caps.iso) {
      exp.iso = caps.iso.min;
      adv.iso = exp.iso;
    }
    try {
      await track.applyConstraints({ advanced: [adv] });
      exp.manual = true;
      measured.manual = true;
    } catch (e) {
      exp.manual = false; // zostaje tryb względny
    }
  };
  const retune = async (avg) => {
    // trzymaj kadr w środku zakresu; poza nim zmieniaj czas naświetlania ×2
    if (exp.cooldown > 0) {
      exp.cooldown--;
      return false;
    }
    let next = exp.timeUnits;
    if (avg > 215 && exp.timeUnits > exp.min) next = Math.max(exp.min, exp.timeUnits / 2);
    else if (avg < 35 && exp.timeUnits < exp.max) next = Math.min(exp.max, exp.timeUnits * 2);
    if (next === exp.timeUnits) return false;
    exp.timeUnits = next;
    exp.cooldown = 3; // daj kamerze czas na zastosowanie
    try {
      await track.applyConstraints({ advanced: [{ exposureTime: next }] });
    } catch (e) {}
    return true;
  };
  (async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      video.srcObject = stream;
      track = stream.getVideoTracks()[0];
      await setupManual();
      dlg.querySelector("#lm-mode").textContent = t(exp.manual ? "zone.light.mode.lux" : "zone.light.mode.rel");
    } catch (e) {
      const err = dlg.querySelector("#lm-err");
      if (err) {
        err.style.display = "";
        err.textContent = t("zone.light.nocam");
      }
      return;
    }
    timer = setInterval(async () => {
      const val = dlg.querySelector("#lm-val");
      if (!video.videoWidth || !val) return;
      ctx.drawImage(video, 0, 0, 64, 48);
      const d = ctx.getImageData(0, 0, 64, 48).data;
      const n = d.length / 4;
      const ys = new Float32Array(n);
      let sum = 0;
      let clipped = 0;
      for (let i = 0, j = 0; i < d.length; i += 4, j++) {
        const y = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        ys[j] = y;
        sum += y;
        if (y >= 250) clipped++;
      }
      const avg = sum / n;
      const clipFrac = clipped / n;
      if (exp.manual && (await retune(avg))) return; // po zmianie ekspozycji pomiń klatkę
      const now = Date.now();
      let pct;
      let lux = null;
      // luksy z fotometrii: jasność / (czas naświetlania × ISO); stała dobrana zgrubnie.
      // Działa też w trybie auto, jeśli kamera raportuje dobrane wartości ekspozycji.
      const auto = !exp.manual ? track.getSettings?.() || {} : null;
      const tUnits = exp.manual ? exp.timeUnits : auto.exposureTime;
      if (tUnits) {
        const tSec = tUnits * 1e-4; // Chrome: jednostka 100 µs
        const iso = exp.manual ? exp.iso : auto.iso || 100;
        lux = (15 * (avg / 255)) / (tSec * (iso / 100));
        pct = Math.round(Math.min(100, (Math.log10(Math.max(lux, 1)) / 5) * 100)); // 100 klx → 100%
        if (!exp.manual && !exp.autoLuxSeen) {
          exp.autoLuxSeen = true;
          const mode = dlg.querySelector("#lm-mode");
          if (mode) mode.textContent = t("zone.light.mode.autolux");
        }
      } else {
        // tryb względny: automatyka ekspozycji normalizuje kadr do „średnio szarego",
        // więc silne źródło światła poznajemy po prześwietleniach i jasnych percentylach
        ys.sort();
        const p90 = ys[Math.floor(n * 0.9)] / 255;
        pct = Math.round(100 * Math.min(1, 0.55 * (avg / 255) + 0.45 * p90 + Math.min(0.5, clipFrac * 3)));
      }
      samples.push({ t: now, pct, lux });
      const win = (parseInt(dlg.querySelector("#lm-window").value, 10) || 3) * 1000;
      while (samples.length && samples[0].t < now - win) samples.shift();
      measured.pct = median(samples.map((s) => s.pct));
      measured.lux = exp.manual ? Math.round(median(samples.map((s) => s.lux))) : null;
      const shown = measured.sensorLux ?? measured.lux;
      val.textContent = shown != null ? fmtLux(shown) : `${measured.pct}%`;
      const pcts = samples.map((s) => s.pct);
      dlg.querySelector("#lm-range").textContent =
        pcts.length > 1 ? `${t("zone.light.window.short")}: ${Math.min(...pcts)}–${Math.max(...pcts)}%` : "";
      const luxRef = shown;
      const cat =
        luxRef != null
          ? luxRef >= 30000
            ? "zone.light.full"
            : luxRef >= 8000
              ? "zone.light.bright"
              : luxRef >= 1500
                ? "zone.light.partial"
                : "zone.light.shade"
          : measured.pct >= 75
            ? "zone.light.full"
            : measured.pct >= 45
              ? "zone.light.bright"
              : measured.pct >= 18
                ? "zone.light.partial"
                : "zone.light.shade";
      dlg.querySelector("#lm-cat").textContent = `${t(cat)}${measured.pct != null ? ` · ${measured.pct}%` : ""}`;
    }, 400);
  })();
  if ("AmbientLightSensor" in window) {
    try {
      const sensor = new window.AmbientLightSensor();
      sensor.addEventListener("reading", () => (measured.sensorLux = Math.round(sensor.illuminance)));
      sensor.start();
      dlg.addEventListener("close", () => sensor.stop(), { once: true });
    } catch (e) {
      // brak wsparcia/uprawnień — zostaje pomiar z kamery
    }
  }
  dlg.addEventListener(
    "close",
    () => {
      clearInterval(timer);
      stream?.getTracks().forEach((tr) => tr.stop());
    },
    { once: true }
  );
}

const linkedPlantings = (app, plantId) => (app.data.plantings || []).filter((x) => x.plant_id === plantId);

/* Faza wegetacji dla kafelka: najbardziej aktywna uprawa bieżącego roku. */
function tilePhase(app, plantId) {
  const year = new Date().getFullYear();
  const pls = linkedPlantings(app, plantId).filter((x) => x.year === year);
  if (!pls.length) return null;
  return pls.map(plantingPhase).find((ph) => ph !== "done") || "done";
}

function plantCard(app, p) {
  const sensors = SENSOR_FIELDS.filter((f) => p.sensors?.[f.key]).map((f) => {
    const entityId = p.sensors[f.key];
    const st = sensorState(app.hass, entityId);
    return `<button class="sensor-chip ${st.unavailable ? "unavailable" : ""}" data-action="more-info" data-entity="${esc(entityId)}" title="${t(f.labelKey)}">
      <ha-icon icon="${f.icon}"></ha-icon><span class="val">${esc(st.text)}</span></button>`;
  });
  const phase = tilePhase(app, p.id);
  return `<div class="card plant" ${phase ? `style="border-top:4px solid ${PHASE_COLOR[phase]}"` : ""}>
    <div class="header">${plantIcon(p, 24)}<h3>${esc(p.name)}</h3></div>
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

const PLANTING_KINDS = ["soil", "pot", "raised"];
const ZONE_KINDS = ["greenhouse", "bed", "orchard", "lawn"];

/* Kanoniczny edytor strefy — Strefa (Rośliny) i Obszar (Plan ogrodu) to ten sam
   byt: nazwa, ikona, typ miejsca, nasadzenie + rozmiary rysunku, jeśli istnieje. */
export function zoneDialog(app, zone, shapeItem = null) {
  const plantingOpts = PLANTING_KINDS.map((v) => ({ value: v, label: t("planting." + v) }));
  const kindOpts = ZONE_KINDS.map((v) => ({ value: v, label: t("editor.palette." + v) }));
  const shape =
    shapeItem ||
    (zone ? (app.data.layout?.items || []).find((i) => "w" in i && i.zone_id === zone.id) : null) ||
    null;
  const dlg = app.dialog(
    `<h2>${zone ? t("zone.edit") : t("zone.new")}</h2>
    <form>
      <label>${t("name")}</label>
      <input name="name" required maxlength="60" value="${esc(zone?.name)}" placeholder="${t("zone.name.ph")}" autofocus>
      <label>${t("zone.emoji")}</label>
      ${combo({ name: "emoji", value: zone?.emoji || "", options: iconOptions() })}
      <label>${t("zone.kind")}</label>
      ${combo({ name: "kind", value: zone?.kind || "", options: kindOpts })}
      <label>${t("zone.planting")}</label>
      ${combo({ name: "planting", value: zone?.planting || "", options: plantingOpts })}
      <div id="gh-params" style="${(zone?.kind || "") === "greenhouse" ? "" : "display:none"}">
        <div style="display:flex;gap:10px">
          <span style="flex:1"><label>${t("zone.gh.height")}</label>
          <input name="gh_height" type="number" step="0.1" min="1" value="${zone?.gh_height_m ?? 2.5}"></span>
          <span style="flex:1"><label>${t("zone.gh.light")}</label>
          <input name="gh_light" type="number" step="5" min="10" max="100" value="${zone?.gh_light_pct ?? 80}"></span>
          <span style="flex:1"><label>${t("zone.gh.temp")}</label>
          <input name="gh_temp" type="number" step="0.5" min="0" max="20" value="${zone?.gh_temp_delta ?? 5}"></span>
        </div>
        <label style="display:flex;align-items:center;gap:8px;margin-top:10px;cursor:pointer;font-size:13px">
          <input type="checkbox" name="gh_heated" ${zone?.gh_heated ? "checked" : ""}>${t("zone.gh.heated")}</label>
      </div>
      ${
        shape
          ? `<div style="display:flex;gap:10px">
        <span style="flex:1"><label>${t("editor.width")}</label>
        <input name="w" type="number" step="0.1" min="0.5" value="${shape.w}"></span>
        <span style="flex:1"><label>${t("editor.height")}</label>
        <input name="h" type="number" step="0.1" min="0.5" value="${shape.h}"></span>
      </div>`
          : ""
      }
      <div class="dialog-actions">
        ${shape ? `<button type="button" class="btn plain" id="zshape-del" style="margin-right:auto;color:var(--rl-crisis)">${t("zone.shape.delete")}</button>` : ""}
        <button type="button" class="btn plain" data-cancel>${t("cancel")}</button>
        <button type="submit" class="btn">${t("save")}</button>
      </div>
    </form>`,
    async (fd) => {
      const item = {
        id: zone?.id ?? null,
        name: fd.get("name").trim(),
        emoji: fd.get("emoji").trim(),
        kind: fd.get("kind") || null,
        planting: fd.get("planting") || null,
      };
      if (item.kind === "greenhouse") {
        item.gh_height_m = parseFloat(fd.get("gh_height")) || 2.5;
        item.gh_light_pct = parseInt(fd.get("gh_light"), 10) || 80;
        item.gh_temp_delta = parseFloat(fd.get("gh_temp")) || 5;
        item.gh_heated = Boolean(fd.get("gh_heated"));
      }
      try {
        app.data = await app.ws("item/save", { kind: "zones", item });
        if (shape) {
          const layout = app.data.layout;
          const it = layout.items.find((i) => i.id === shape.id);
          if (it) {
            it.w = parseFloat(fd.get("w")) || it.w;
            it.h = parseFloat(fd.get("h")) || it.h;
            it.label = item.name;
            it.kind = item.kind || it.kind;
            app.data = await app.ws("layout/save", { layout });
          }
        }
      } catch (e) {
        app.toast(`⚠ ${e.message || e}`, true);
        return;
      }
      app.render();
      app.toast(t(zone ? "toast.saved" : "toast.added"));
    }
  );
  // typ „szklarnia" → pokaż parametry mikroklimatu
  dlg.querySelector('input[name="kind"]').addEventListener("change", (ev) => {
    dlg.querySelector("#gh-params").style.display = ev.target.value === "greenhouse" ? "" : "none";
  });
  // usunięcie samego rysunku z planu — strefa zostaje
  dlg.querySelector("#zshape-del")?.addEventListener("click", async () => {
    if (!await app.confirm(t("editor.item.delete.confirm"))) return;
    const layout = app.data.layout;
    layout.items = layout.items.filter((i) => i.id !== shape.id);
    dlg.close();
    try {
      app.data = await app.ws("layout/save", { layout });
    } catch (e) {
      app.toast(`⚠ ${e.message || e}`, true);
      return;
    }
    app.render();
    app.toast(t("toast.deleted"));
  });
}

/* Wspólne pola formularza rośliny (nowa roślina + tryb edycji karty). */
function plantFormFields(app, draft) {
  // urządzenia strefy: jedno z daną rolą → predefiniowane; więcej → ⭐ na górze listy
  SENSOR_FIELDS.forEach((f) => {
    if (!draft.sensors[f.key]) {
      const sugg = zoneSuggestions(app, draft.zone_id, f.key);
      if (sugg.length === 1) draft.sensors[f.key] = sugg[0].entity;
    }
  });
  const anySugg = SENSOR_FIELDS.some((f) => zoneSuggestions(app, draft.zone_id, f.key).length);
  const zoneOpts = app.data.zones.map((z) => ({ value: z.id, label: z.name, icon: z.emoji || "🪴" }));
  const baseSensorOpts = entityOptions(app.hass, ["sensor"]);
  return `<label>${t("name")}</label>
    <input name="name" required maxlength="60" value="${esc(draft.name)}" placeholder="${t("plant.name.ph")}">
    <label>${t("plant.species")}</label>
    <input name="species" maxlength="80" value="${esc(draft.species)}">
    <label>${t("zone.emoji")}</label>
    ${combo({ name: "emoji", value: draft.emoji || "", options: iconOptions() })}
    <label>${t("plant.icon")}</label>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
      <span id="pf-icon-prev">${plantIcon(draft, 22)}</span>
      <input type="file" id="pf-icon-file" accept="image/*" hidden>
      <input type="hidden" name="icon" value="${esc(draft.icon || "")}">
      <button type="button" class="btn small ghost" id="pf-icon-btn"><ha-icon icon="mdi:image-plus-outline"></ha-icon>${t("plant.icon.upload")}</button>
      ${draft.icon ? `<button type="button" class="btn small plain" id="pf-icon-del">${t("delete")}</button>` : ""}
    </div>
    <label>${t("plant.zone")}</label>
    ${combo({ name: "zone_id", value: draft.zone_id, options: zoneOpts })}
    <label>${t("plant.planting")}</label>
    ${combo({
      name: "planting",
      value: draft.planting,
      allowEmpty: false,
      options: [
        {
          value: "",
          label: `${t("planting.parent")} (${(() => {
            const zp = app.data.zones.find((z) => z.id === draft.zone_id)?.planting;
            return zp ? t("planting." + zp) : t("planting.none");
          })()})`,
        },
        ...PLANTING_KINDS.map((v) => ({ value: v, label: t("planting." + v) })),
      ],
    })}
    ${anySugg ? `<p style="font-size:12px;color:var(--secondary-text-color);margin:6px 0 0">${t("plant.sensors.auto")}</p>` : ""}
    ${SENSOR_FIELDS.map(
      (f) =>
        `<label>${t(f.labelKey)} ${t("plant.sensor.entity")}</label>` +
        combo({
          name: `sensor_${f.key}`,
          value: draft.sensors[f.key] || "",
          options: optionsWithSuggestions(app.hass, baseSensorOpts, zoneSuggestions(app, draft.zone_id, f.key)),
        })
    ).join("")}`;
}

const plantFromForm = (fd) => ({
  name: fd.get("name").trim(),
  species: fd.get("species").trim(),
  emoji: fd.get("emoji").trim(),
  icon: fd.get("icon") || null,
  zone_id: fd.get("zone_id") || null,
  planting: fd.get("planting") || null,
  sensors: Object.fromEntries(SENSOR_FIELDS.map((f) => [f.key, fd.get(`sensor_${f.key}`) || null])),
});

const draftFromDlg = (dlg) => ({
  name: dlg.querySelector('input[name="name"]').value,
  species: dlg.querySelector('input[name="species"]').value,
  emoji: dlg.querySelector('input[name="emoji"]').value,
  icon: dlg.querySelector('input[name="icon"]').value,
  zone_id: dlg.querySelector('input[name="zone_id"]').value,
  planting: dlg.querySelector('input[name="planting"]').value,
  sensors: Object.fromEntries(
    SENSOR_FIELDS.map((f) => [f.key, dlg.querySelector(`input[name="sensor_${f.key}"]`).value])
  ),
});

/* Wgrywanie własnego obrazka rośliny (miniatura 96 px w plant.icon). */
function wireIconField(app, dlg) {
  const file = dlg.querySelector("#pf-icon-file");
  const hidden = dlg.querySelector('input[name="icon"]');
  if (!file) return;
  dlg.querySelector("#pf-icon-btn").addEventListener("click", () => file.click());
  file.addEventListener("change", async (ev) => {
    if (!ev.target.files[0]) return;
    try {
      const img = await resizeImage(ev.target.files[0], 96, app);
      hidden.value = img.data;
      dlg.querySelector("#pf-icon-prev").innerHTML =
        `<img src="${img.preview}" width="22" height="22" style="border-radius:50%;object-fit:cover">`;
    } catch (e) {
      app.toast(`⚠ ${t("photo.unreadable")}`, true);
    }
    ev.target.value = "";
  });
  dlg.querySelector("#pf-icon-del")?.addEventListener("click", (ev) => {
    hidden.value = "";
    dlg.querySelector("#pf-icon-prev").innerHTML = emo("🌱", 22);
    ev.target.closest("button").remove();
  });
}

/* Dialog nowej rośliny (edycja istniejącej = tryb edycji karty rośliny). */
export function plantDialog(app, draft = null) {
  draft ??= { name: "", species: "", emoji: "", icon: "", zone_id: "", planting: "", sensors: {} };
  const presetOpts = PLANT_PRESETS.map((p, i) => ({
    value: String(i),
    label: p.name,
    secondary: p.species,
    icon: p.emoji,
  }));
  const dlg = app.dialog(
    `<h2>${t("plant.new")}</h2>
    <form>
      <label>${t("plant.preset")}</label>${combo({ name: "preset", options: presetOpts })}
      ${plantFormFields(app, draft)}
      <div class="dialog-actions">
        <button type="button" class="btn plain" data-cancel>${t("cancel")}</button>
        <button type="submit" class="btn">${t("save")}</button>
      </div>
    </form>`,
    (fd) => app.saveItem("plants", { id: null, ...plantFromForm(fd) })
  );
  // preset → prefill pól
  dlg.querySelector('input[name="preset"]')?.addEventListener("change", (ev) => {
    const preset = PLANT_PRESETS[parseInt(ev.target.value, 10)];
    if (!preset) return;
    dlg.querySelector('input[name="name"]').value = preset.name;
    dlg.querySelector('input[name="species"]').value = preset.species;
    const em = dlg.querySelector('input[name="emoji"]');
    em.value = preset.emoji;
    em.dispatchEvent(new Event("change")); // odśwież podgląd ikony w combo
  });
  // zmiana strefy → przelicz sugestie czujników z urządzeń tej strefy
  dlg.querySelector('input[name="zone_id"]').addEventListener("change", () => {
    plantDialog(app, draftFromDlg(dlg));
  });
  wireIconField(app, dlg);
}

/* --- Karta rośliny: czujniki, notatki, zdjęcia, historia diagnoz, AI --- */

export async function openPlantCard(app, plantId, edit = false) {
  const plant = app.data.plants.find((p) => p.id === plantId);
  if (!plant) return;
  let photos = [];
  try {
    photos = await app.ws("plant/photos", { plant_id: plantId });
  } catch (e) {
    photos = [];
  }
  (edit ? renderCardEdit : renderCard)(app, plant, photos);
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
  const zone = app.data.zones.find((z) => z.id === plant.zone_id);
  const plantingKind = plant.planting || zone?.planting;
  // sztuki zasadzone na grządkach liniowych z planu ogrodu
  const onRows = (app.data.layout?.items || [])
    .filter((i) => i.kind === "row")
    .flatMap((i) => (i.plants || []).filter((pl) => pl.plant_id === plant.id));
  const rowTotal = onRows.reduce((s, x) => s + (x.count || 0), 0);
  const infoChips = [
    zone ? `<span class="chip">${emo(zone.emoji || "🪴", 14)} ${esc(zone.name)}</span>` : "",
    plantingKind ? `<span class="chip">${t("planting." + plantingKind)}</span>` : "",
    rowTotal ? `<span class="chip">🥕 ${t("plant.onrow", { n: rowTotal })}</span>` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const growRows = linkedPlantings(app, plant.id)
    .sort((a, b) => b.year - a.year || (a.plan?.sow || "").localeCompare(b.plan?.sow || ""))
    .map((pl) => {
      const ph = plantingPhase(pl);
      const dates = [
        pl.plan?.sow && `${t("grow.date.sow")} ${pl.plan.sow}`,
        pl.plan?.transplant && `${t("grow.date.transplant")} ${pl.plan.transplant}`,
        pl.plan?.harvest_from &&
          `${t("grow.date.harvest_from")} ${pl.plan.harvest_from}${pl.plan?.harvest_to ? ` – ${pl.plan.harvest_to}` : ""}`,
      ]
        .filter(Boolean)
        .join(" · ");
      const done = [
        pl.done?.sow && `🌱 ${pl.done.sow}`,
        pl.done?.transplant && `🪴 ${pl.done.transplant}`,
        pl.done?.finished && `🏁 ${pl.done.finished}`,
      ]
        .filter(Boolean)
        .join(" · ");
      return `<div class="note-row" style="align-items:center;border-left:4px solid ${PHASE_COLOR[ph]};padding-left:10px">
        <span class="txt">${esc(areaLabel(app, pl.zone_id))} · ${t("grow.method." + (pl.method || "direct"))} · ${pl.year}<br>
          <small style="color:var(--secondary-text-color)">${dates}${done ? `<br>${done}` : ""}</small></span>
        <span class="chip" style="background:color-mix(in srgb, ${PHASE_COLOR[ph]} 18%, transparent);color:inherit">${t("grow.phase." + ph)}</span>
      </div>`;
    })
    .join("");
  const dlg = app.dialog(
    `<h2>${plantIcon(plant, 26)} ${esc(plant.name)}</h2>
    ${plant.species ? `<div class="species" style="margin:0 0 8px">${esc(plant.species)}</div>` : ""}
    ${infoChips ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">${infoChips}</div>` : ""}
    ${sensors ? `<div class="sensors">${sensors}</div>` : ""}
    <div class="actions" style="justify-content:flex-start">
      <button type="button" class="btn small ai" id="pc-diag"><ha-icon icon="mdi:leaf-off"></ha-icon>${t("plant.diagnose")}</button>
      <button type="button" class="btn small ghost" id="pc-edit"><ha-icon icon="mdi:pencil-outline"></ha-icon>${t("edit")}</button>
    </div>
    ${growRows ? `<div class="section-title">${t("tab.grow")}</div>${growRows}` : ""}

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
  dlg.querySelector("#pc-edit").addEventListener("click", () => renderCardEdit(app, plant, photos));
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
      img = await resizeImage(ev.target.files[0], 900, app);
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
      if (!await app.confirm(t("hist.delete.confirm"))) return;
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

/* Tryb edycji karty rośliny: pola rośliny + terminy aktywnej uprawy + dziennik + usuwanie. */
function renderCardEdit(app, plant, photos, draft = null) {
  draft ??= {
    name: plant.name || "",
    species: plant.species || "",
    emoji: plant.emoji || "",
    icon: plant.icon || "",
    zone_id: plant.zone_id || "",
    planting: plant.planting || "",
    sensors: { ...(plant.sensors || {}) },
  };
  const linked = linkedPlantings(app, plant.id);
  const active = linked.find((x) => !x.done?.finished) || linked[linked.length - 1] || null;
  const gyear = active?.year ?? new Date().getFullYear();
  const dlg = app.dialog(
    `<h2>${plantIcon(plant, 26)} ${esc(plant.name)} — ${t("edit")}</h2>
    <form>
      ${plantFormFields(app, draft)}
      <div class="section-title">${t("tab.grow")}</div>
      ${active ? "" : `<p style="font-size:12px;color:var(--secondary-text-color);margin:0 0 6px">${t("plant.grow.hint")}</p>`}
      <div style="display:flex;gap:10px">
        <span style="flex:1"><label>${t("grow.method")}</label>
        ${combo({
          name: "method",
          value: active?.method || "direct",
          options: [
            { value: "indoor", label: t("grow.method.indoor") },
            { value: "direct", label: t("grow.method.direct") },
          ],
          allowEmpty: false,
        })}</span>
        <span><label>${t("grow.year")}</label>
        <input type="number" name="gyear" value="${gyear}" min="2020" max="2040" style="width:90px"></span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 10px">
        <span><label>${t("grow.date.sow")}</label>${dateInput("sow", gyear, active?.plan?.sow)}</span>
        <span><label>${t("grow.date.transplant")}</label>${dateInput("transplant", gyear, active?.plan?.transplant)}</span>
        <span><label>${t("grow.date.harvest_from")}</label>${dateInput("harvest_from", gyear, active?.plan?.harvest_from)}</span>
        <span><label>${t("grow.date.harvest_to")}</label>${dateInput("harvest_to", gyear, active?.plan?.harvest_to)}</span>
      </div>
      ${
        active
          ? `<div class="actions" style="justify-content:flex-start;margin-top:12px">
          ${!active.done?.sow ? `<button type="button" class="btn small ghost" data-mark="sow">🌱 ${t("grow.done.sow")}</button>` : `<span class="chip">🌱 ${esc(active.done.sow)}</span>`}
          ${active.method === "indoor" ? (!active.done?.transplant ? `<button type="button" class="btn small ghost" data-mark="transplant">🪴 ${t("grow.done.transplant")}</button>` : `<span class="chip">🪴 ${esc(active.done.transplant)}</span>`) : ""}
          ${!active.done?.finished ? `<button type="button" class="btn small ghost" data-mark="finished">🏁 ${t("grow.done.finish")}</button>` : `<span class="chip">🏁 ${esc(active.done.finished)}</span>`}
        </div>`
          : ""
      }
      <div class="dialog-actions">
        <button type="button" class="btn plain" id="pce-del" style="margin-right:auto;color:var(--rl-crisis)">${t("delete")}</button>
        <button type="button" class="btn plain" id="pce-back">${t("cancel")}</button>
        <button type="submit" class="btn">${t("save")}</button>
      </div>
    </form>`,
    async (fd) => {
      const plan = {
        sow: fdMMDD(fd, "sow"),
        transplant: fdMMDD(fd, "transplant"),
        harvest_from: fdMMDD(fd, "harvest_from"),
        harvest_to: fdMMDD(fd, "harvest_to"),
      };
      try {
        app.data = await app.ws("item/save", { kind: "plants", item: { id: plant.id, ...plantFromForm(fd) } });
        if (active) {
          // miejsce uprawy = strefa rośliny (jedna tożsamość)
          app.data = await app.ws("item/save", {
            kind: "plantings",
            item: {
              id: active.id,
              zone_id: fd.get("zone_id") || null,
              method: fd.get("method") || "direct",
              year: parseInt(fd.get("gyear"), 10) || active.year,
              plan,
            },
          });
        } else if (fd.get("zone_id") && (plan.sow || plan.transplant || plan.harvest_from)) {
          // roślina bez uprawy: terminy → nowa uprawa w strefie rośliny
          const preset = PLANT_PRESETS.find((x) => x.name === fd.get("name").trim());
          app.data = await app.ws("grow/apply", {
            plantings: [
              {
                id: null,
                zone_id: fd.get("zone_id"),
                name: fd.get("name").trim(),
                species: fd.get("species").trim(),
                family: preset?.family || "",
                emoji: fd.get("emoji").trim() || "🌱",
                plant_id: plant.id,
                year: parseInt(fd.get("gyear"), 10) || gyear,
                method: fd.get("method") || "direct",
                plan,
                done: {},
                succession_days: null,
                notes: "",
              },
            ],
            tasks: [],
          });
        }
      } catch (e) {
        app.toast(`⚠ ${e.message || e}`, true);
        return;
      }
      app.toast(t("toast.saved"));
      renderCard(app, app.data.plants.find((p) => p.id === plant.id) || plant, photos);
    },
    { wide: true }
  );
  dlg.querySelector('input[name="zone_id"]').addEventListener("change", () => {
    renderCardEdit(app, plant, photos, draftFromDlg(dlg));
  });
  wireIconField(app, dlg);
  dlg.querySelectorAll("[data-mark]").forEach((el) =>
    el.addEventListener("click", async () => {
      const done = { ...(active.done || {}), [el.dataset.mark]: todayISO() };
      try {
        app.data = await app.ws("item/save", { kind: "plantings", item: { id: active.id, done } });
      } catch (e) {
        app.toast(`⚠ ${e.message || e}`, true);
        return;
      }
      renderCardEdit(app, app.data.plants.find((p) => p.id === plant.id) || plant, photos, draftFromDlg(dlg));
    })
  );
  dlg.querySelector("#pce-back").addEventListener("click", () => renderCard(app, plant, photos));
  dlg.querySelector("#pce-del").addEventListener("click", async () => {
    if (!await app.confirm(t("plant.delete.confirm", { name: plant.name }))) return;
    dlg.close();
    app.deleteItem("plants", plant.id);
  });
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
  "plants-sub": (app, el) => {
    app._plantsSub = el.dataset.sub;
    app.render();
  },
  "add-zone": (app) => zoneDialog(app),
  "edit-zone": (app, el) => zoneDialog(app, app.data.zones.find((z) => z.id === el.dataset.id)),
  "delete-zone": async (app, el) => {
    const zone = app.data.zones.find((z) => z.id === el.dataset.id);
    if (!await app.confirm(t("zone.delete.confirm", { name: zone.name }))) return;
    try {
      app.data = await app.ws("item/delete", { kind: "zones", item_id: zone.id });
      // strefa = obszar: usuń też jej rysunki z planu
      const layout = app.data.layout;
      const before = layout.items.length;
      layout.items = layout.items.filter((i) => i.zone_id !== zone.id);
      if (layout.items.length !== before) app.data = await app.ws("layout/save", { layout });
    } catch (e) {
      app.toast(`⚠ ${e.message || e}`, true);
      return;
    }
    app.render();
    app.toast(t("toast.deleted"));
  },
  "add-plant": (app) => plantDialog(app),
  "edit-plant": (app, el) => openPlantCard(app, el.dataset.id, true),
  "delete-plant": async (app, el) => {
    const plant = app.data.plants.find((p) => p.id === el.dataset.id);
    if (await app.confirm(t("plant.delete.confirm", { name: plant.name }))) app.deleteItem("plants", plant.id);
  },
  "plant-card": (app, el) => openPlantCard(app, el.dataset.id),
  "zone-card": (app, el) => openZoneCard(app, el.dataset.id),
  "more-info": (app, el) => {
    app.fire("hass-more-info", { entityId: el.dataset.entity });
  },
};
