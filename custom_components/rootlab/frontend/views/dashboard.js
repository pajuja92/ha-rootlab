import { t } from "../i18n.js";
import { esc, todayISO } from "../util.js";
import { dueLabel, pendingTasks } from "./tasks.js";

const num = (v) => (v == null || v === "" ? null : parseFloat(v));

export function render(app) {
  const { _error } = app.data;
  if (_error) return `<div class="empty"><ha-icon icon="mdi:leaf-off"></ha-icon><p>${t("dash.error")}${esc(_error)}</p></div>`;
  if (!app.data.zones.length && !app.data.plants.length) {
    return `<div class="empty">
      <ha-icon icon="mdi:sprout"></ha-icon>
      <p>${t("dash.welcome")}</p>
      <button class="btn" data-action="add-zone"><ha-icon icon="mdi:plus"></ha-icon>${t("dash.addzone")}</button>
    </div>`;
  }
  return [alerts(app), zonesSection(app), waterSection(app), tasksSection(app), forecastSection(app), weatherSection(app)].join("");
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
  const { zones, plants, tasks } = app.data;
  // Pulpit: tylko niepuste strefy, bez edycji — klik otwiera kartę strefy (statystyki/zadania)
  const nonEmpty = zones.filter((z) => plants.some((p) => p.zone_id === z.id));
  if (!nonEmpty.length) return "";
  return `
    <div class="section-title"><ha-icon icon="mdi:map-outline"></ha-icon>${t("zones.title")}</div>
    <div class="grid">
      ${nonEmpty
        .map((z) => {
          const zonePlants = plants.filter((p) => p.zone_id === z.id);
          const ids = new Set(zonePlants.map((p) => p.id));
          const open = (tasks || []).filter((task) => !task.done && ids.has(task.plant_id)).length;
          return `<div class="card" data-action="zone-card" data-id="${z.id}" style="cursor:pointer">
            <div class="header"><span class="emoji">${esc(z.emoji || "🪴")}</span><h3>${esc(z.name)}</h3></div>
            <div class="zone-stat"><span class="num">${zonePlants.length}</span><span class="lbl">${zonePlants.length === 1 ? t("zone.plants.one") : t("zone.plants.many")}</span>
              ${open ? `<span class="chip harvest" style="margin-left:auto">${open} ⏳</span>` : ""}</div>
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
    .map((s) => {
      const run = active[s.id];
      return `<div class="section-row active"><span class="dot"></span>
        <div class="info"><span class="name">${esc(s.name)}</span></div>
        ${
          run.paused
            ? `<span class="chip harvest">${t("water.run.paused")}</span>
               <span style="font-size:13px;color:var(--secondary-text-color)">${t("water.run.left", { min: Math.round((run.remaining_s || 0) / 60) })}</span>`
            : `<span class="chip water">${t("water.now")}</span><span class="countdown" data-end="${esc(run.end)}"></span>`
        }</div>`;
    });
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

/* --- Prognoza (encja weather HA) --- */

function forecastSection(app) {
  const mode = app.forecastMode || "hourly";
  let body;
  if (app.forecast === undefined) {
    body = "…";
  } else if (app.forecast === null || !app.data.settings?.has_weather_entity) {
    body = `<div class="ai-hint"><ha-icon icon="mdi:weather-cloudy-clock"></ha-icon>${t("forecast.none")}</div>`;
  } else {
    const rows = app.forecast[mode];
    body = rows?.length
      ? chart(rows, mode)
      : `<div class="ai-hint"><ha-icon icon="mdi:weather-cloudy-alert"></ha-icon>${t("forecast.unavailable")}</div>`;
  }
  return `
    <div class="section-title"><ha-icon icon="mdi:chart-line"></ha-icon>${t("dash.forecast")}</div>
    <div class="card">
      <div class="chart-tabs">
        <button class="btn small ${mode === "hourly" ? "" : "plain"}" data-action="forecast-mode" data-mode="hourly">${t("forecast.hourly")}</button>
        <button class="btn small ${mode === "daily" ? "" : "plain"}" data-action="forecast-mode" data-mode="daily">${t("forecast.daily")}</button>
      </div>
      ${body}
    </div>`;
}

function chart(rows, mode) {
  const W = 720, H = 190, padL = 30, padR = 8, padT = 14, padB = 26;
  const iw = W - padL - padR, ih = H - padT - padB;
  const temps = rows.flatMap((r) => [num(r.temperature), num(r.templow)]).filter((v) => v != null);
  if (!temps.length) return `<div class="ai-hint">${t("forecast.unavailable")}</div>`;
  let tMin = Math.min(...temps), tMax = Math.max(...temps);
  if (tMax - tMin < 4) { tMax += 2; tMin -= 2; }
  const rains = rows.map((r) => num(r.precipitation) ?? 0);
  const rMax = Math.max(1, ...rains);
  const x = (i) => padL + (i + 0.5) * (iw / rows.length);
  const yT = (v) => padT + (1 - (v - tMin) / (tMax - tMin)) * ih;
  const yR = (v) => (v / rMax) * (ih * 0.5);

  const bars = rows
    .map((r, i) => {
      const rv = num(r.precipitation) ?? 0;
      if (!rv) return "";
      const bh = yR(rv);
      return `<rect class="rain-bar" x="${x(i) - iw / rows.length * 0.3}" y="${padT + ih - bh}" width="${(iw / rows.length) * 0.6}" height="${bh}"><title>${rv} mm</title></rect>`;
    })
    .join("");
  const line = (key, cls) => {
    const pts = rows
      .map((r, i) => (num(r[key]) != null ? `${x(i).toFixed(1)},${yT(num(r[key])).toFixed(1)}` : null))
      .filter(Boolean);
    return pts.length > 1 ? `<polyline class="temp-line ${cls}" points="${pts.join(" ")}"/>` : "";
  };
  const labels = rows
    .map((r, i) => {
      const step = mode === "hourly" ? 4 : 1;
      if (i % step) return "";
      const d = new Date(r.datetime);
      const txt = mode === "hourly" ? `${d.getHours()}:00` : t("days")[(d.getDay() + 6) % 7];
      return `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${txt}</text>`;
    })
    .join("");
  const tempLabels = rows
    .map((r, i) => {
      const step = mode === "hourly" ? 4 : 1;
      const v = num(r.temperature);
      if (i % step || v == null) return "";
      return `<text x="${x(i)}" y="${yT(v) - 6}" text-anchor="middle" style="fill:var(--rl-harvest)">${Math.round(v)}°</text>`;
    })
    .join("");
  const grid = [tMin, (tMin + tMax) / 2, tMax]
    .map(
      (v) => `<line class="gridline" x1="${padL}" x2="${W - padR}" y1="${yT(v)}" y2="${yT(v)}"/>
        <text x="2" y="${yT(v) + 3}">${Math.round(v)}°</text>`
    )
    .join("");
  return `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
    ${grid}${bars}${line("templow", "min")}${line("temperature", "")}${tempLabels}${labels}
  </svg>`;
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
  "forecast-mode": (app, el) => { app.forecastMode = el.dataset.mode; app.render(); },
};
