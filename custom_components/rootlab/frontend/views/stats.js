import { t } from "../i18n.js";
import { esc } from "../util.js";

const COLORS = [
  "var(--rl-harvest)",
  "var(--rl-water)",
  "var(--rl-green)",
  "var(--rl-ai)",
  "var(--rl-crisis)",
  "var(--rl-soil)",
  "var(--secondary-text-color)",
];

export function render(app) {
  const v = app.verifyStats;
  if (v === undefined) {
    app.verifyStats = null;
    app.ws("verify/stats").then((r) => {
      app.verifyStats = r;
      if (app.tab === "stats") app.render();
    }).catch(() => {});
    return `<div class="empty"><ha-icon icon="mdi:timer-sand"></ha-icon></div>`;
  }
  return rankingCard(app, v) + todayCard(app, v) + infoCard();
}

function rankingCard(app, v) {
  const body = v?.sources?.length
    ? `<table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr style="color:var(--secondary-text-color);font-size:12px;text-align:left">
          <th style="padding:4px 8px">#</th>
          <th style="padding:4px 8px">${t("verify.source")}</th>
          <th style="padding:4px 8px">${t("verify.mae")}</th>
          <th style="padding:4px 8px">${t("verify.rainerr")}</th>
          <th style="padding:4px 8px">${t("verify.days")}</th>
        </tr>
        ${v.sources
          .map(
            (row, i) => `<tr style="border-top:1px solid var(--divider-color)">
            <td style="padding:6px 8px">${i === 0 && row.mae_temp != null ? "🏆" : i + 1}</td>
            <td style="padding:6px 8px">${esc(row.label)}</td>
            <td style="padding:6px 8px">${row.mae_temp != null ? row.mae_temp.toFixed(2) + " °C" : "—"}</td>
            <td style="padding:6px 8px">${row.rain_err != null ? row.rain_err.toFixed(1) + " mm" : "—"}</td>
            <td style="padding:6px 8px">${row.days}</td>
          </tr>`
          )
          .join("")}
      </table>
      ${v.since ? `<div style="font-size:12px;color:var(--secondary-text-color);margin-top:8px">${t("verify.since")} ${esc(v.since)}.</div>` : ""}`
    : `<div class="ai-hint"><ha-icon icon="mdi:timer-sand"></ha-icon>${t("verify.collecting")}</div>`;
  return `
    <div class="section-title"><ha-icon icon="mdi:scale-balance"></ha-icon>${t("verify.title")}</div>
    <div class="card">${body}</div>`;
}

function todayCard(app, v) {
  const today = v?.today;
  if (!today?.sources?.length) {
    return `
      <div class="section-title"><ha-icon icon="mdi:chart-timeline-variant"></ha-icon>${t("stats.today")}</div>
      <div class="card"><div class="ai-hint"><ha-icon icon="mdi:weather-night"></ha-icon>${t("stats.nodata")}</div></div>`;
  }
  const W = 720, H = 240, padL = 32, padR = 10, padT = 14, padB = 24;
  const iw = W - padL - padR, ih = H - padT - padB;
  const all = today.sources
    .flatMap((src) => src.temps || [])
    .concat(Object.values(today.actual_temps || {}))
    .filter((val) => val != null && isFinite(val));
  if (!all.length) {
    return `
      <div class="section-title"><ha-icon icon="mdi:chart-timeline-variant"></ha-icon>${t("stats.today")}</div>
      <div class="card"><div class="ai-hint">${t("stats.nodata")}</div></div>`;
  }
  let vMin = Math.min(...all), vMax = Math.max(...all);
  if (vMax - vMin < 4) { vMax += 2; vMin -= 2; }
  const x = (h) => padL + ((h + 0.5) / 24) * iw;
  const y = (val) => padT + (1 - (val - vMin) / (vMax - vMin)) * ih;
  const lines = today.sources
    .map((src, i) => {
      const pts = (src.temps || [])
        .map((val, h) => (val != null ? `${x(h).toFixed(1)},${y(val).toFixed(1)}` : null))
        .filter(Boolean);
      return pts.length > 1
        ? `<polyline points="${pts.join(" ")}" fill="none" stroke="${COLORS[i % COLORS.length]}" stroke-width="1.6" opacity="0.85"/>`
        : "";
    })
    .join("");
  const actual = Object.entries(today.actual_temps || {})
    .map(
      ([h, val]) =>
        `<circle cx="${x(parseInt(h, 10))}" cy="${y(val)}" r="3.4" fill="var(--primary-text-color)" stroke="var(--card-background-color)" stroke-width="1"/>`
    )
    .join("");
  const grid = [vMin, (vMin + vMax) / 2, vMax]
    .map(
      (val) => `<line class="gridline" x1="${padL}" x2="${W - padR}" y1="${y(val)}" y2="${y(val)}"/>
      <text x="2" y="${y(val) + 3}">${Math.round(val)}°</text>`
    )
    .join("");
  const labels = [0, 4, 8, 12, 16, 20]
    .map((h) => `<text x="${x(h)}" y="${H - 6}" text-anchor="middle">${h}:00</text>`)
    .join("");
  const legend =
    today.sources
      .map(
        (src, i) => `<span><i style="background:${COLORS[i % COLORS.length]}"></i>${esc(src.label)}</span>`
      )
      .join("") +
    `<span><i style="background:var(--primary-text-color);width:8px;height:8px;border-radius:50%"></i>${t("stats.actual")}</span>`;
  return `
    <div class="section-title"><ha-icon icon="mdi:chart-timeline-variant"></ha-icon>${t("stats.today")} (${esc(today.date || "")})</div>
    <div class="card">
      <svg class="chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${grid}${lines}${actual}${labels}</svg>
      <div class="chart-legend">${legend}</div>
    </div>`;
}

function infoCard() {
  return `<div class="card" style="margin-top:var(--rl-gap)">
    <div class="ai-hint" style="margin-top:0"><ha-icon icon="mdi:information-outline"></ha-icon>${t("verify.note")}</div>
  </div>`;
}
