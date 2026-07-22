import { t } from "../i18n.js";
import { esc, todayISO } from "../util.js";
import { dueLabel, pendingTasks } from "./tasks.js";

const num = (v) => (v == null || v === "" ? null : parseFloat(v));

export function render(app) {
  const { zones, plants, _error } = app.data;
  if (_error) return `<div class="empty"><ha-icon icon="mdi:leaf-off"></ha-icon><p>${t("dash.error")}${esc(_error)}</p></div>`;
  if (!zones.length && !plants.length) {
    return `<div class="empty">
      <ha-icon icon="mdi:sprout"></ha-icon>
      <p>${t("dash.welcome")}</p>
      <button class="btn" data-action="add-zone"><ha-icon icon="mdi:plus"></ha-icon>${t("dash.addzone")}</button>
    </div>`;
  }
  return [alerts(app), zonesSection(app), waterSection(app), tasksSection(app), weatherSection(app)].join("");
}

function alerts(app) {
  const w = app.weather;
  if (!w) return "";
  const out = [];
  const temp = num(w.temperatura);
  const rain = num(w.suma_opadu);
  if (temp != null && temp <= 2) {
    out.push(`<div class="warn-hint"><ha-icon icon="mdi:snowflake-alert"></ha-icon>${t("weather.frost", { t: temp })}</div>`);
  }
  const irr = app.data.irrigation;
  if (rain != null && rain >= 2 && irr.sections.length && irr.skip_date !== todayISO() && !app.rainDismissed) {
    out.push(`<div class="ai-hint"><ha-icon icon="mdi:creation"></ha-icon>
      <span style="flex:1">${t("weather.rain.suggest", { mm: rain })}</span>
      <button class="btn small" data-action="weather-skip">${t("weather.rain.skip")}</button>
      <button class="btn small plain" data-action="weather-dismiss">${t("weather.rain.anyway")}</button>
    </div>`);
  }
  return out.length ? `<div style="margin-bottom:var(--rl-gap)">${out.join("")}</div>` : "";
}

function zonesSection(app) {
  const { zones, plants } = app.data;
  if (!zones.length) return "";
  return `
    <div class="section-title"><ha-icon icon="mdi:map-outline"></ha-icon>${t("zones.title")}</div>
    <div class="grid">
      ${zones
        .map((z) => {
          const count = plants.filter((p) => p.zone_id === z.id).length;
          return `<div class="card">
            <div class="header"><span class="emoji">${esc(z.emoji || "🪴")}</span><h3>${esc(z.name)}</h3></div>
            <div class="zone-stat"><span class="num">${count}</span><span class="lbl">${count === 1 ? t("zone.plants.one") : t("zone.plants.many")}</span></div>
          </div>`;
        })
        .join("")}
    </div>`;
}

function waterSection(app) {
  const { sections } = app.data.irrigation;
  if (!sections.length) return "";
  const active = app.data.active || {};
  const rows = sections
    .filter((s) => active[s.id])
    .map(
      (s) => `<div class="section-row active"><span class="dot"></span>
        <div class="info"><span class="name">${esc(s.name)}</span></div>
        <span class="chip water">${t("water.now")}</span>
        <span class="countdown" data-end="${esc(active[s.id])}"></span></div>`
    );
  return `
    <div class="section-title"><ha-icon icon="mdi:water"></ha-icon>${t("dash.water")}</div>
    <div class="card">${rows.length ? rows.join("") : `<span style="font-size:14px;color:var(--secondary-text-color)">${sections.length} × <ha-icon icon="mdi:sprinkler-variant" style="--mdc-icon-size:16px"></ha-icon></span>`}</div>`;
}

function tasksSection(app) {
  const top = pendingTasks(app.data.tasks).slice(0, 3);
  if (!top.length) return "";
  return `
    <div class="section-title"><ha-icon icon="mdi:clipboard-check-outline"></ha-icon>${t("dash.tasks")}</div>
    <div class="card">
      ${top
        .map(
          (task) => `<div class="task-row">
            <input type="checkbox" data-action="task-done" data-id="${task.id}">
            <div class="body"><div class="title">${esc(task.title)}</div>
            <div class="meta">${dueLabel(task.due)}</div></div>
          </div>`
        )
        .join("")}
    </div>`;
}

function weatherSection(app) {
  const w = app.weather;
  let body;
  if (!w) {
    body = `<div class="ai-hint"><ha-icon icon="mdi:weather-cloudy-alert"></ha-icon>${t("weather.unavailable")}</div>`;
  } else {
    const rows = [
      ["mdi:thermometer", t("weather.temp"), w.temperatura != null ? `${w.temperatura} °C` : "—"],
      ["mdi:cloud-percent-outline", t("weather.hum"), w.wilgotnosc_wzgledna != null ? `${w.wilgotnosc_wzgledna} %` : "—"],
      ["mdi:weather-pouring", t("weather.rain"), w.suma_opadu != null ? `${w.suma_opadu} mm` : "—"],
      ["mdi:weather-windy", t("weather.wind"), w.predkosc_wiatru != null ? `${w.predkosc_wiatru} m/s` : "—"],
      ["mdi:gauge", t("weather.pressure"), w.cisnienie ? `${w.cisnienie} hPa` : "—"],
    ];
    body = `<div class="sensors">
        ${rows.map(([icon, label, val]) => `<span class="sensor-chip" title="${esc(label)}"><ha-icon icon="${icon}"></ha-icon>${esc(val)}</span>`).join("")}
      </div>
      <div class="meta" style="font-size:12px;color:var(--secondary-text-color);margin-top:10px">
        ${t("weather.station")}: ${esc(w.stacja)} · ${t("weather.measured")} ${esc(w.data_pomiaru)} ${esc(w.godzina_pomiaru)}:00 (IMGW)</div>`;
  }
  return `<div class="section-title"><ha-icon icon="mdi:weather-partly-cloudy"></ha-icon>${t("dash.weather")}</div><div class="card">${body}</div>`;
}

export const actions = {
  "weather-skip": (app) => app.ws("irrigation/skip", { date: todayISO() }).then((d) => { app.data = d; app.render(); }),
  "weather-dismiss": (app) => { app.rainDismissed = true; app.render(); },
};
