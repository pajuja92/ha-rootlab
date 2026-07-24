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
  return alerts(app) + widgetsBody(app);
}

/* --- Widgety pulpitu: kolejność i widoczność edytowalne (localStorage) --- */

const WIDGETS = [
  { id: "zones", titleKey: "zones.title", render: zonesSection },
  { id: "water", titleKey: "dash.water", render: waterSection },
  { id: "tasks", titleKey: "dash.tasks", render: tasksSection },
  { id: "forecast", titleKey: "dash.forecast", render: forecastSection },
  { id: "verify", titleKey: "verify.title", render: verifySection },
  { id: "weather", titleKey: "dash.weather", render: weatherSection },
];

function dashCfg() {
  try {
    const cfg = JSON.parse(localStorage.getItem("rootlab_dash"));
    if (Array.isArray(cfg?.order) && Array.isArray(cfg?.hidden)) {
      // dopnij nowe widgety, których konfiguracja jeszcze nie zna
      for (const w of WIDGETS) if (!cfg.order.includes(w.id)) cfg.order.push(w.id);
      return cfg;
    }
  } catch (e) { /* uszkodzona konfiguracja → domyślna */ }
  return { order: WIDGETS.map((w) => w.id), hidden: [] };
}
const saveDashCfg = (cfg) => localStorage.setItem("rootlab_dash", JSON.stringify(cfg));

function widgetsBody(app) {
  const cfg = dashCfg();
  const edit = !!app.dashEdit;
  const toolbar = `<div class="toolbar" style="margin-bottom:8px"><div class="spacer"></div>
    <button class="btn small ${edit ? "" : "ghost"}" data-action="dash-edit">
      <ha-icon icon="${edit ? "mdi:check" : "mdi:tune"}" style="--mdc-icon-size:16px"></ha-icon>${edit ? t("dash.done") : t("dash.customize")}</button>
  </div>`;
  const body = cfg.order
    .map((id) => {
      const w = WIDGETS.find((x) => x.id === id);
      if (!w) return "";
      const hidden = cfg.hidden.includes(id);
      if (!edit && hidden) return "";
      let content = hidden ? "" : w.render(app);
      if (!content && edit) {
        content = `<div class="section-title">${t(w.titleKey)}</div>
          <div class="card" style="opacity:.6;font-size:13px;color:var(--secondary-text-color)">—</div>`;
      }
      if (!edit) return content;
      return `<div class="widget-wrap ${hidden ? "w-hidden" : ""}">
        ${content || `<div class="section-title">${t(w.titleKey)}</div>`}
        <div class="widget-ctl">
          <button class="icon-btn" data-action="dash-move" data-id="${id}" data-dir="-1" title="↑"><ha-icon icon="mdi:arrow-up"></ha-icon></button>
          <button class="icon-btn" data-action="dash-move" data-id="${id}" data-dir="1" title="↓"><ha-icon icon="mdi:arrow-down"></ha-icon></button>
          <button class="icon-btn" data-action="dash-vis" data-id="${id}"><ha-icon icon="${hidden ? "mdi:eye-off" : "mdi:eye"}"></ha-icon></button>
        </div>
      </div>`;
    })
    .join("");
  return toolbar + body;
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

/* --- Prognoza (encja weather HA): wykres łączony lub osobne, legenda, tooltipy --- */

const S = (rows, key) => rows.map((r) => num(r[key]));
const avg = (vals) => {
  const xs = vals.filter((v) => v != null);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
};

function forecastSection(app) {
  const mode = app.forecastMode || "hourly";
  const split = !!app.forecastSplit;
  let body;
  if (app.forecast === undefined) {
    body = "…";
  } else if (app.forecast === null || !app.data.settings?.has_weather_entity) {
    body = `<div class="ai-hint"><ha-icon icon="mdi:weather-cloudy-clock"></ha-icon>${t("forecast.none")}</div>`;
  } else {
    const rows = app.forecast[mode];
    if (!rows?.length) {
      body = `<div class="ai-hint"><ha-icon icon="mdi:weather-cloudy-alert"></ha-icon>${t("forecast.unavailable")}</div>`;
    } else {
      body =
        (split ? chartsSplit(rows, mode) : chartCombined(rows, mode)) +
        legendHtml(rows, mode, split) +
        (mode === "hourly" ? summaryChips(app, rows) : "") +
        sourceLine(app);
    }
  }
  return `
    <div class="section-title"><ha-icon icon="mdi:chart-line"></ha-icon>${t("dash.forecast")}</div>
    <div class="card">
      <div class="chart-tabs">
        <button class="btn small ${mode === "hourly" ? "" : "plain"}" data-action="forecast-mode" data-mode="hourly">${t("forecast.hourly")}</button>
        <button class="btn small ${mode === "daily" ? "" : "plain"}" data-action="forecast-mode" data-mode="daily">${t("forecast.daily")}</button>
        <div class="spacer" style="flex:1"></div>
        <button class="btn small ${split ? "" : "plain"}" data-action="forecast-split" title="${t("forecast.split")}">
          <ha-icon icon="mdi:chart-multiple" style="--mdc-icon-size:16px"></ha-icon>${t("forecast.split")}</button>
      </div>
      ${body}
    </div>`;
}

function sourceLine(app) {
  const entityId = app.data.settings?.weather_entity;
  const entityName = entityId
    ? app.hass.states[entityId]?.attributes?.friendly_name || entityId
    : "—";
  const station = app.weather?.stacja ? `IMGW ${app.weather.stacja}` : "";
  return `<div style="font-size:12px;color:var(--secondary-text-color);margin-top:8px">
    ${t("forecast.source")}: ${esc(entityName)}${station ? ` · ${t("dash.weather")}: ${esc(station)}` : ""}</div>`;
}

function summaryChips(app, rows) {
  const hum = avg(S(rows, "humidity"));
  const press = avg(S(rows, "pressure"));
  const rain = S(rows, "precipitation").filter((v) => v != null).reduce((a, b) => a + b, 0);
  const prob = Math.max(0, ...S(rows, "precipitation_probability").filter((v) => v != null));
  const chip = (icon, label, val) =>
    val == null
      ? ""
      : `<span class="sensor-chip" title="${esc(label)}"><ha-icon icon="${icon}"></ha-icon>${esc(label)}: ${esc(val)}</span>`;
  return `<div class="sensors" style="margin-top:10px">
    ${chip("mdi:cloud-percent-outline", t("forecast.avghum"), hum != null ? Math.round(hum) + " %" : null)}
    ${chip("mdi:gauge", t("forecast.avgpress"), press != null ? Math.round(press) + " hPa" : null)}
    ${chip("mdi:weather-pouring", t("forecast.rainsum"), `${Math.round(rain * 10) / 10} mm`)}
    ${chip("mdi:umbrella-outline", t("forecast.probmax"), `${Math.round(prob)} %`)}
  </div>`;
}

function legendHtml(rows, mode, split) {
  const has = (key) => S(rows, key).some((v) => v != null);
  const items = [];
  items.push(`<span><i style="background:var(--rl-harvest)"></i>${t("forecast.legend.temp")}</span>`);
  if (mode === "daily" && has("templow"))
    items.push(`<span><i style="background:var(--rl-water)"></i>${t("forecast.legend.tmin")}</span>`);
  if (has("precipitation"))
    items.push(`<span><i class="bar" style="background:var(--rl-water)"></i>${t("forecast.legend.rain")}</span>`);
  if (has("precipitation_probability"))
    items.push(`<span><i class="dash"></i>${t("forecast.legend.prob")}</span>`);
  if (split && has("humidity"))
    items.push(`<span><i style="background:var(--rl-green)"></i>${t("forecast.hum")}</span>`);
  if (split && has("pressure"))
    items.push(`<span><i style="background:var(--rl-ai)"></i>${t("forecast.press")}</span>`);
  return `<div class="chart-legend">${items.join("")}</div>`;
}

const xLabel = (r, mode) => {
  const d = new Date(r.datetime);
  return mode === "hourly" ? `${d.getHours()}:00` : t("days")[(d.getDay() + 6) % 7];
};

/* Wykres łączony: temperatura (linia), opad (słupki), szansa opadów (kreskowana). */
function chartCombined(rows, mode) {
  const W = 720, H = 200, padL = 30, padR = 30, padT = 16, padB = 26;
  const iw = W - padL - padR, ih = H - padT - padB;
  const temps = rows.flatMap((r) => [num(r.temperature), num(r.templow)]).filter((v) => v != null);
  if (!temps.length) return `<div class="ai-hint">${t("forecast.unavailable")}</div>`;
  let tMin = Math.min(...temps), tMax = Math.max(...temps);
  if (tMax - tMin < 4) { tMax += 2; tMin -= 2; }
  const rains = S(rows, "precipitation").map((v) => v ?? 0);
  const rMax = Math.max(1, ...rains);
  const slot = iw / rows.length;
  const x = (i) => padL + (i + 0.5) * slot;
  const yT = (v) => padT + (1 - (v - tMin) / (tMax - tMin)) * ih;
  const yP = (v) => padT + (1 - v / 100) * ih; // skala % (prawa oś)

  const bars = rows
    .map((r, i) => {
      const rv = num(r.precipitation) ?? 0;
      if (!rv) return "";
      const bh = (rv / rMax) * (ih * 0.5);
      return `<rect class="rain-bar" x="${x(i) - slot * 0.3}" y="${padT + ih - bh}" width="${slot * 0.6}" height="${bh}"><title>${rv} mm</title></rect>`;
    })
    .join("");
  const line = (key, cls, yFn) => {
    const pts = rows
      .map((r, i) => (num(r[key]) != null ? `${x(i).toFixed(1)},${yFn(num(r[key])).toFixed(1)}` : null))
      .filter(Boolean);
    return pts.length > 1 ? `<polyline class="${cls}" points="${pts.join(" ")}"/>` : "";
  };
  const step = mode === "hourly" ? 4 : 1;
  const labels = rows
    .map((r, i) => (i % step ? "" : `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${xLabel(r, mode)}</text>`))
    .join("");
  const tempLabels = rows
    .map((r, i) => {
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
  const probAxis = [0, 50, 100]
    .map((v) => `<text x="${W - padR + 4}" y="${yP(v) + 3}" style="fill:var(--rl-water)">${v}%</text>`)
    .join("");
  // tygodniowy: szczegóły dnia w dymku po najechaniu (nie zaśmiecamy widoku)
  const tips =
    mode === "daily"
      ? rows
          .map((r, i) => {
            const linesTip = [
              new Date(r.datetime).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "numeric" }),
              num(r.temperature) != null ? `↑ ${Math.round(num(r.temperature))}°  ${num(r.templow) != null ? "↓ " + Math.round(num(r.templow)) + "°" : ""}` : null,
              num(r.precipitation_probability) != null ? `☔ ${Math.round(num(r.precipitation_probability))} %` : null,
              num(r.precipitation) != null ? `🌧 ${num(r.precipitation)} mm` : null,
              num(r.humidity) != null ? `💧 ${Math.round(num(r.humidity))} %` : null,
              num(r.pressure) != null ? `◎ ${Math.round(num(r.pressure))} hPa` : null,
            ].filter(Boolean);
            const tw = 132;
            const tx = Math.min(Math.max(x(i) - tw / 2, padL), W - padR - tw);
            return `<g class="fc-day">
              <rect class="hit" x="${padL + i * slot}" y="0" width="${slot}" height="${H}" fill="transparent"/>
              <g class="fc-tip">
                <rect x="${tx}" y="6" width="${tw}" height="${linesTip.length * 13 + 10}" rx="6"/>
                ${linesTip.map((ln, j) => `<text x="${tx + 8}" y="${21 + j * 13}">${esc(ln)}</text>`).join("")}
              </g>
            </g>`;
          })
          .join("")
      : "";
  return `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
    ${grid}${probAxis}${bars}${line("templow", "temp-line min", yT)}${line("temperature", "temp-line", yT)}
    ${line("precipitation_probability", "prob-line", yP)}${tempLabels}${labels}${tips}
  </svg>`;
}

/* Tryb rozdzielony: osobny mini-wykres na każdą dostępną wielkość. */
function chartsSplit(rows, mode) {
  const metrics = [
    { label: `${t("forecast.legend.temp")} (°C)`, series: [["temperature", "temp-line"], ["templow", "temp-line min"]] },
    { label: `${t("forecast.legend.rain")} + ${t("forecast.legend.prob")}`, bars: "precipitation", prob: true },
    { label: `${t("forecast.hum")} (%)`, series: [["humidity", "hum-line"]] },
    { label: `${t("forecast.press")} (hPa)`, series: [["pressure", "press-line"]] },
  ];
  return metrics
    .map((metric) => {
      const keys = (metric.series || []).map(([k]) => k).concat(metric.bars ? [metric.bars] : []);
      if (!keys.some((k) => S(rows, k).some((v) => v != null))) return "";
      return chartMini(rows, metric, mode);
    })
    .filter(Boolean)
    .join("");
}

function chartMini(rows, metric, mode) {
  const W = 720, H = 130, padL = 34, padR = 30, padT = 18, padB = 22;
  const iw = W - padL - padR, ih = H - padT - padB;
  const slot = iw / rows.length;
  const x = (i) => padL + (i + 0.5) * slot;
  const vals = (metric.series || []).flatMap(([k]) => S(rows, k)).filter((v) => v != null);
  let out = `<text x="${padL}" y="11" style="fill:var(--primary-text-color);font-size:11px">${esc(metric.label)}</text>`;
  if (metric.bars) {
    const rains = S(rows, metric.bars).map((v) => v ?? 0);
    const rMax = Math.max(1, ...rains);
    out += rows
      .map((r, i) => {
        const rv = num(r[metric.bars]) ?? 0;
        if (!rv) return "";
        const bh = (rv / rMax) * ih;
        return `<rect class="rain-bar" x="${x(i) - slot * 0.3}" y="${padT + ih - bh}" width="${slot * 0.6}" height="${bh}"><title>${rv} mm</title></rect>`;
      })
      .join("");
    out += `<text x="2" y="${padT + 4}" style="fill:var(--rl-water)">${rMax} mm</text>`;
    if (metric.prob) {
      const yP = (v) => padT + (1 - v / 100) * ih;
      const pts = rows
        .map((r, i) => (num(r.precipitation_probability) != null ? `${x(i).toFixed(1)},${yP(num(r.precipitation_probability)).toFixed(1)}` : null))
        .filter(Boolean);
      if (pts.length > 1) out += `<polyline class="prob-line" points="${pts.join(" ")}"/>`;
      out += `<text x="${W - padR + 4}" y="${padT + 4}" style="fill:var(--rl-water)">100%</text>`;
    }
  } else if (vals.length) {
    let vMin = Math.min(...vals), vMax = Math.max(...vals);
    if (vMax - vMin < 2) { vMax += 1; vMin -= 1; }
    const y = (v) => padT + (1 - (v - vMin) / (vMax - vMin)) * ih;
    out += [vMin, vMax]
      .map((v) => `<line class="gridline" x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}"/><text x="2" y="${y(v) + 3}">${Math.round(v)}</text>`)
      .join("");
    for (const [key, cls] of metric.series) {
      const pts = rows
        .map((r, i) => (num(r[key]) != null ? `${x(i).toFixed(1)},${y(num(r[key])).toFixed(1)}` : null))
        .filter(Boolean);
      if (pts.length > 1) out += `<polyline class="temp-line ${cls}" points="${pts.join(" ")}"/>`;
    }
  }
  const step = mode === "hourly" ? 4 : 1;
  out += rows
    .map((r, i) => (i % step ? "" : `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${xLabel(r, mode)}</text>`))
    .join("");
  return `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="margin-top:4px">${out}</svg>`;
}

/* Ranking trafności prognoz (weryfikator: modele vs czujniki/IMGW). */
function verifySection(app) {
  const v = app.verifyStats;
  if (v === undefined) {
    // leniwe pobranie przy pierwszym renderze pulpitu
    app.verifyStats = null;
    app.ws("verify/stats").then((r) => {
      app.verifyStats = r;
      if (app.tab === "dashboard") app.render();
    }).catch(() => {});
    return "";
  }
  if (!v || !v.sources?.length) {
    return `
      <div class="section-title"><ha-icon icon="mdi:scale-balance"></ha-icon>${t("verify.title")}</div>
      <div class="card"><div class="ai-hint"><ha-icon icon="mdi:timer-sand"></ha-icon>${t("verify.collecting")}</div></div>`;
  }
  const best = v.sources.find((x) => x.mae_temp != null);
  return `
    <div class="section-title"><ha-icon icon="mdi:scale-balance"></ha-icon>${t("verify.title")}</div>
    <div class="card">
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr style="color:var(--secondary-text-color);font-size:12px;text-align:left">
          <th style="padding:4px 8px">${t("verify.source")}</th>
          <th style="padding:4px 8px">${t("verify.mae")}</th>
          <th style="padding:4px 8px">${t("verify.rainerr")}</th>
          <th style="padding:4px 8px">${t("verify.days")}</th>
        </tr>
        ${v.sources
          .map(
            (row) => `<tr style="border-top:1px solid var(--divider-color)">
            <td style="padding:6px 8px">${row === best ? "🏆 " : ""}${esc(row.label)}</td>
            <td style="padding:6px 8px">${row.mae_temp != null ? row.mae_temp.toFixed(2) + " °C" : "—"}</td>
            <td style="padding:6px 8px">${row.rain_err != null ? row.rain_err.toFixed(1) + " mm" : "—"}</td>
            <td style="padding:6px 8px">${row.days}</td>
          </tr>`
          )
          .join("")}
      </table>
      <div style="font-size:12px;color:var(--secondary-text-color);margin-top:8px">
        ${t("verify.note")}${v.since ? ` ${t("verify.since")} ${esc(v.since)}.` : ""}</div>
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
  "forecast-mode": (app, el) => { app.forecastMode = el.dataset.mode; app.render(); },
  "forecast-split": (app) => { app.forecastSplit = !app.forecastSplit; app.render(); },
  "dash-edit": (app) => { app.dashEdit = !app.dashEdit; app.render(); },
  "dash-move": (app, el) => {
    const cfg = dashCfg();
    const i = cfg.order.indexOf(el.dataset.id);
    const j = i + parseInt(el.dataset.dir, 10);
    if (i < 0 || j < 0 || j >= cfg.order.length) return;
    [cfg.order[i], cfg.order[j]] = [cfg.order[j], cfg.order[i]];
    saveDashCfg(cfg);
    app.render();
  },
  "dash-vis": (app, el) => {
    const cfg = dashCfg();
    const id = el.dataset.id;
    cfg.hidden = cfg.hidden.includes(id) ? cfg.hidden.filter((x) => x !== id) : [...cfg.hidden, id];
    saveDashCfg(cfg);
    app.render();
  },
};
