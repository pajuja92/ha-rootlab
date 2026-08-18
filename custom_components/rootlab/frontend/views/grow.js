import { t } from "../i18n.js";
import { combo, emo, esc, todayISO, wireCombos } from "../util.js";
import { PLANT_PRESETS } from "../presets.js";
import { openPlantCard } from "./plants.js"; // cykl plants↔grow bezpieczny: użycie dopiero w handlerze

/* Zakładka „Uprawy" — kalendarz upraw per miejsce z planu ogrodu, dziennik obsadzeń,
   siewy sukcesywne, ostrzeżenia płodozmianowe i plan sezonu z AI. */

const st = (app) => (app._grow ??= { year: new Date().getFullYear(), area: "" });

const PHENO = PLANT_PRESETS.filter((p) => p.harvest);
const AREA_EMOJI = { greenhouse: "🏠", bed: "🥬", orchard: "🍎", lawn: "🌿" };

const areas = (app) => (app.data.layout?.items || []).filter((i) => "w" in i);

/* Miejsce uprawy = strefa; rysunek na planie to tylko jej kształt. */
export function areaOptions(app) {
  return (app.data.zones || []).map((z) => ({
    value: z.id,
    label: z.name,
    secondary: z.kind ? t("editor.palette." + z.kind) : "",
    icon: z.emoji || "🪴",
  }));
}

export const areaLabel = (app, id) => {
  const z = (app.data.zones || []).find((x) => x.id === id);
  return z ? `${z.emoji || "🪴"} ${z.name}` : t("grow.area.unknown");
};

/* --- daty: "MM-DD" ↔ pozycja % na osi roku --- */
const doy = (mmdd, year) => {
  const [m, d] = String(mmdd).split("-").map(Number);
  return (Date.UTC(year, m - 1, d) - Date.UTC(year, 0, 1)) / 86400000;
};
const yearDays = (year) => ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365);
const pct = (mmdd, year) => (doy(mmdd, year) / yearDays(year)) * 100;
const shiftMMDD = (mmdd, year, days) => {
  const d = new Date(Date.UTC(year, 0, 1) + (doy(mmdd, year) + days) * 86400000);
  return `${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
};

/* Bieżąca faza wegetacji uprawy (kolor paska na liście roślin). */
export function plantingPhase(p) {
  const now = new Date();
  const y = now.getFullYear();
  if (p.done?.finished || p.year < y) return "done";
  if (p.year > y) return "planned";
  const today = `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const start = p.plan?.sow || p.plan?.transplant;
  if (start && today < start) return "planned";
  if (p.method === "indoor" && p.plan?.transplant && today < p.plan.transplant) return "sow";
  if (p.plan?.harvest_from && today < p.plan.harvest_from) return "grow";
  if (p.plan?.harvest_to && today <= p.plan.harvest_to) return "harvest";
  return "done";
}

function band(from, to, year, cls) {
  if (!from || !to) return "";
  const a = pct(from, year);
  const b = Math.max(a + 0.8, pct(to, year));
  return `<span class="grow-band ${cls}" style="left:${a}%;width:${b - a}%"></span>`;
}

const todayMark = (year) => {
  const today = new Date();
  return year === today.getFullYear()
    ? `<span class="grow-today" style="left:${pct(`${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`, year)}%"></span>`
    : "";
};

function rowHtml(app, p) {
  const s = st(app);
  const start = p.plan?.sow || p.plan?.transplant;
  const growFrom = p.method === "indoor" ? p.plan?.transplant || p.plan?.sow : start;
  const finished = Boolean(p.done?.finished);
  const doneBits = [p.done?.sow ? "🌱✓" : "", p.done?.transplant ? "🪴✓" : ""].filter(Boolean).join(" ");
  return `<div class="grow-row ${finished ? "done" : ""}" data-grow-edit="${p.id}">
    <div class="grow-name">${emo(p.emoji || "🌱", 18)} <b>${esc(p.name)}</b> ${doneBits}
      <br><small style="color:var(--secondary-text-color)">${esc(areaLabel(app, p.zone_id))} · ${t("grow.method." + (p.method || "direct"))}${finished ? ` · ${t("grow.finished")}` : ""}</small>
    </div>
    <div class="grow-track">
      ${p.method === "indoor" ? band(p.plan?.sow, p.plan?.transplant, s.year, "sow") : ""}
      ${band(growFrom, p.plan?.harvest_from, s.year, "grow")}
      ${band(p.plan?.harvest_from, p.plan?.harvest_to, s.year, "harvest")}
      ${todayMark(s.year)}
    </div>
  </div>`;
}

/* Roślina bez uprawy w danym roku: wiersz na liście bez pasków — klik ustawia terminy w karcie. */
function plantRowHtml(app, p, year) {
  const zone = app.data.zones.find((z) => z.id === p.zone_id);
  return `<div class="grow-row" data-grow-plant="${p.id}">
    <div class="grow-name">${emo(p.emoji || "🌱", 18)} <b>${esc(p.name)}</b>
      <br><small style="color:var(--secondary-text-color)">${zone ? `${emo(zone.emoji || "🪴", 14)} ${esc(zone.name)}` : t("zone.none")} · ${t("grow.nodates")}</small>
    </div>
    <div class="grow-track">${todayMark(year)}</div>
  </div>`;
}


export function render(app) {
  const s = st(app);
  const opts = areaOptions(app);
  const toolbar = `<div class="toolbar">
    <button class="btn" data-action="grow-add"><ha-icon icon="mdi:plus"></ha-icon>${t("grow.add")}</button>
    <button class="btn ai" data-action="grow-ai"><ha-icon icon="mdi:creation"></ha-icon>${t("grow.ai")}</button>
    <div class="spacer"></div>
    <button class="icon-btn" data-action="grow-year" data-d="-1" title="−1"><ha-icon icon="mdi:chevron-left"></ha-icon></button>
    <b>${s.year}</b>
    <button class="icon-btn" data-action="grow-year" data-d="1" title="+1"><ha-icon icon="mdi:chevron-right"></ha-icon></button>
    <span style="width:220px">${combo({ name: "grow_area", value: s.area, options: opts, placeholder: t("grow.area.all") })}</span>
  </div>`;
  if (!opts.length) {
    return `${toolbar}<div class="empty"><ha-icon icon="mdi:calendar-month"></ha-icon><p>${t("grow.noareas")}</p></div>`;
  }
  const list = (app.data.plantings || [])
    .filter((p) => p.year === s.year && (!s.area || p.zone_id === s.area))
    .sort((a, b) => (a.plan?.sow || a.plan?.transplant || "").localeCompare(b.plan?.sow || b.plan?.transplant || ""));
  // rośliny bez uprawy w tym roku — na liście, bez pasków na osi
  const linkedIds = new Set((app.data.plantings || []).filter((p) => p.year === s.year).map((p) => p.plant_id).filter(Boolean));
  const undated = (app.data.plants || [])
    .filter((p) => !linkedIds.has(p.id) && (!s.area || p.zone_id === s.area))
    .sort((a, b) => a.name.localeCompare(b.name));
  const months = `<div class="grow-row" style="border-bottom:none;cursor:default">
    <div class="grow-name"></div>
    <div class="grow-months">${t("months").map((m) => `<span>${m}</span>`).join("")}</div>
  </div>`;
  return (
    toolbar +
    `<div class="card">${months}${
      list.length || undated.length
        ? list.map((p) => rowHtml(app, p)).join("") + undated.map((p) => plantRowHtml(app, p, s.year)).join("")
        : `<p style="color:var(--secondary-text-color);font-size:14px">${t("grow.empty")}</p>`
    }</div>
    <div class="editor-hint">${t("grow.legend")}</div>`
  );
}

export function bind(app, root) {
  const bar = root.querySelector(".toolbar");
  if (bar) wireCombos(bar);
  root.querySelector('input[name="grow_area"]')?.addEventListener("change", (ev) => {
    st(app).area = ev.target.value;
    app.render();
  });
  root.querySelectorAll("[data-grow-edit]").forEach((el) =>
    el.addEventListener("click", () => {
      const p = (app.data.plantings || []).find((x) => x.id === el.dataset.growEdit);
      if (p) growDialog(app, p);
    })
  );
  root.querySelectorAll("[data-grow-plant]").forEach((el) =>
    el.addEventListener("click", () => openPlantCard(app, el.dataset.growPlant, true))
  );
}

/* --- płodozmian: ta sama rodzina w tym samym miejscu w poprzednich 3 latach --- */
function rotationWarning(app, presetFamily, zoneId, year, excludeId) {
  if (!presetFamily || !zoneId) return "";
  const hit = (app.data.plantings || []).find(
    (p) =>
      p.id !== excludeId &&
      p.zone_id === zoneId &&
      p.family === presetFamily &&
      p.year >= year - 3 &&
      p.year < year
  );
  return hit ? t("grow.rotation", { year: hit.year, family: hit.family, name: hit.name }) : "";
}

export const dateInput = (name, year, mmdd) =>
  `<input type="date" name="${name}" value="${mmdd ? `${year}-${mmdd}` : ""}">`;
export const fdMMDD = (fd, name) => {
  const v = fd.get(name);
  return v ? String(v).slice(5) : null;
};

export function growDialog(app, editing = null) {
  const s = st(app);
  const presetOpts = PHENO.map((p, i) => ({ value: String(i), label: p.name, secondary: p.family, icon: p.emoji }));
  const presetIdx = editing ? PHENO.findIndex((p) => p.name === editing.name) : -1;
  const methodOpts = (preset) =>
    [
      (preset?.sow_indoor || preset?.transplant) && { value: "indoor", label: t("grow.method.indoor") },
      (preset?.sow_direct || (!preset?.sow_indoor && !editing)) && { value: "direct", label: t("grow.method.direct") },
    ].filter(Boolean);
  const preset = presetIdx >= 0 ? PHENO[presetIdx] : null;
  const dlg = app.dialog(
    `<h2>${editing ? t("grow.edit") : t("grow.new")}</h2>
    <form>
      <label>${t("grow.preset")}</label>
      ${combo({ name: "preset", value: presetIdx >= 0 ? String(presetIdx) : "", options: presetOpts, allowEmpty: false })}
      <label>${t("grow.area")}</label>
      ${combo({ name: "zone_id", value: editing?.zone_id || st(app).area || "", options: areaOptions(app), allowEmpty: false })}
      <div style="display:flex;gap:10px">
        <span style="flex:1"><label>${t("grow.method")}</label>
        ${combo({ name: "method", value: editing?.method || "", options: methodOpts(preset).length ? methodOpts(preset) : [{ value: "direct", label: t("grow.method.direct") }], allowEmpty: false })}</span>
        <span><label>${t("grow.year")}</label>
        <input type="number" name="year" value="${editing?.year ?? s.year}" min="2020" max="2040" style="width:90px"></span>
      </div>
      <div id="grow-rot" class="warn-hint" style="display:none;margin-top:8px"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 10px">
        <span><label>${t("grow.date.sow")}</label>${dateInput("sow", editing?.year ?? s.year, editing?.plan?.sow)}</span>
        <span><label>${t("grow.date.transplant")}</label>${dateInput("transplant", editing?.year ?? s.year, editing?.plan?.transplant)}</span>
        <span><label>${t("grow.date.harvest_from")}</label>${dateInput("harvest_from", editing?.year ?? s.year, editing?.plan?.harvest_from)}</span>
        <span><label>${t("grow.date.harvest_to")}</label>${dateInput("harvest_to", editing?.year ?? s.year, editing?.plan?.harvest_to)}</span>
      </div>
      ${
        editing
          ? `<div class="actions" style="justify-content:flex-start;margin-top:12px">
              ${!editing.done?.sow ? `<button type="button" class="btn small ghost" data-mark="sow">🌱 ${t("grow.done.sow")}</button>` : `<span class="chip">🌱 ${esc(editing.done.sow)}</span>`}
              ${editing.method === "indoor" ? (!editing.done?.transplant ? `<button type="button" class="btn small ghost" data-mark="transplant">🪴 ${t("grow.done.transplant")}</button>` : `<span class="chip">🪴 ${esc(editing.done.transplant)}</span>`) : ""}
              ${!editing.done?.finished ? `<button type="button" class="btn small ghost" data-mark="finished">🏁 ${t("grow.done.finish")}</button>` : `<span class="chip">🏁 ${esc(editing.done.finished)}</span>`}
            </div>`
          : `<div style="display:flex;gap:10px;margin-top:4px">
              <span style="flex:1"><label>${t("grow.succession")}</label>
              <input type="number" name="succ_days" min="7" max="60" placeholder="—" style="width:100%"></span>
              <span style="flex:1"><label>${t("grow.succession.count")}</label>
              <input type="number" name="succ_count" min="1" max="11" placeholder="0" style="width:100%"></span>
            </div>
            <label style="display:flex;align-items:center;gap:8px;margin-top:12px;cursor:pointer">
              <input type="checkbox" name="make_tasks" checked>${t("grow.maketasks")}</label>`
      }
      <div class="dialog-actions">
        ${editing ? `<button type="button" class="btn plain" id="grow-del" style="margin-right:auto;color:var(--rl-crisis)">${t("delete")}</button>` : ""}
        <button type="button" class="btn plain" data-cancel>${t("cancel")}</button>
        <button type="submit" class="btn">${t("save")}</button>
      </div>
    </form>`,
    async (fd) => {
      const chosen = PHENO[parseInt(fd.get("preset"), 10)];
      if (!chosen) return;
      const year = parseInt(fd.get("year"), 10) || s.year;
      const base = {
        id: editing?.id ?? null,
        zone_id: fd.get("zone_id"),
        name: chosen.name,
        species: chosen.species,
        family: chosen.family,
        emoji: chosen.emoji,
        plant_id: editing?.plant_id ?? null,
        year,
        method: fd.get("method") || "direct",
        plan: {
          sow: fdMMDD(fd, "sow"),
          transplant: fdMMDD(fd, "transplant"),
          harvest_from: fdMMDD(fd, "harvest_from"),
          harvest_to: fdMMDD(fd, "harvest_to"),
        },
        done: editing?.done ?? {},
        succession_days: editing?.succession_days ?? null,
        notes: editing?.notes ?? "",
      };
      const succDays = editing ? 0 : parseInt(fd.get("succ_days"), 10) || 0;
      const succCount = editing ? 0 : Math.min(11, parseInt(fd.get("succ_count"), 10) || 0);
      const series = [base];
      if (succDays && succCount) {
        base.succession_days = succDays;
        for (let k = 1; k <= succCount; k++) {
          const shift = (mmdd) => (mmdd ? shiftMMDD(mmdd, year, k * succDays) : null);
          series.push({
            ...base,
            id: null,
            plan: {
              sow: shift(base.plan.sow),
              transplant: shift(base.plan.transplant),
              harvest_from: shift(base.plan.harvest_from),
              harvest_to: shift(base.plan.harvest_to),
            },
          });
        }
      }
      const tasks = editing || !fd.get("make_tasks") ? [] : series.flatMap((p) => plantingTasks(app, p));
      try {
        if (editing) {
          app.data = await app.ws("item/save", { kind: "plantings", item: base });
          if (editing.plant_id) {
            // strefa uprawy = strefa rośliny — trzymaj kartę w tej samej strefie
            app.data = await app.ws("item/save", {
              kind: "plants",
              item: { id: editing.plant_id, zone_id: base.zone_id || null },
            });
          }
        } else {
          app.data = await app.ws("grow/apply", { plantings: series, tasks });
        }
      } catch (e) {
        app.toast(`⚠ ${e.message || e}`, true);
        return;
      }
      app.render();
      app.toast(tasks.length ? t("grow.tasks.added", { n: tasks.length }) : t("toast.saved"));
    }
  );

  const updateRotation = () => {
    const chosen = PHENO[parseInt(dlg.querySelector('input[name="preset"]').value, 10)];
    const zoneId = dlg.querySelector('input[name="zone_id"]').value;
    const year = parseInt(dlg.querySelector('input[name="year"]').value, 10) || s.year;
    const warning = rotationWarning(app, chosen?.family, zoneId, year, editing?.id);
    const box = dlg.querySelector("#grow-rot");
    box.style.display = warning ? "" : "none";
    box.textContent = warning;
  };
  // preset → prefill dat i metody
  dlg.querySelector('input[name="preset"]').addEventListener("change", (ev) => {
    const chosen = PHENO[parseInt(ev.target.value, 10)];
    if (!chosen) return;
    const year = parseInt(dlg.querySelector('input[name="year"]').value, 10) || s.year;
    const method = chosen.sow_indoor ? "indoor" : "direct";
    dlg.querySelector('input[name="method"]').value = method;
    const mi = dlg.querySelector('div[data-combo="method"] .combo-input');
    if (mi) mi.value = t("grow.method." + method);
    const set = (name, mmdd) => (dlg.querySelector(`input[name="${name}"]`).value = mmdd ? `${year}-${mmdd}` : "");
    set("sow", (method === "indoor" ? chosen.sow_indoor : chosen.sow_direct)?.[0]);
    set("transplant", method === "indoor" ? chosen.transplant?.[0] : null);
    set("harvest_from", chosen.harvest?.[0]);
    set("harvest_to", chosen.harvest?.[1]);
    updateRotation();
  });
  dlg.querySelector('input[name="zone_id"]').addEventListener("change", updateRotation);
  dlg.querySelector('input[name="year"]').addEventListener("change", updateRotation);
  updateRotation();
  // dziennik: ✔ posiane / wysadzone / zakończ
  dlg.querySelectorAll("[data-mark]").forEach((el) =>
    el.addEventListener("click", async () => {
      const done = { ...(editing.done || {}), [el.dataset.mark]: todayISO() };
      try {
        app.data = await app.ws("item/save", { kind: "plantings", item: { id: editing.id, done } });
      } catch (e) {
        app.toast(`⚠ ${e.message || e}`, true);
        return;
      }
      app.render();
      growDialog(app, app.data.plantings.find((x) => x.id === editing.id));
    })
  );
  dlg.querySelector("#grow-del")?.addEventListener("click", () => {
    if (!confirm(t("grow.delete.confirm"))) return;
    dlg.close();
    app.deleteItem("plantings", editing.id);
  });
}

/* Zadania z terminarza uprawy (siew / wysadzenie / początek zbiorów). */
function plantingTasks(app, p) {
  const where = areaLabel(app, p.zone_id);
  const mk = (mmdd, title) =>
    mmdd && {
      id: null,
      plant_id: p.plant_id || null,
      category: "maintenance",
      title: `${title}: ${p.name} — ${where}`,
      details: p.species || "",
      due: `${p.year}-${mmdd}`,
      done: false,
      source: "grow",
      created: todayISO(),
    };
  return [
    mk(p.plan.sow, t(p.method === "indoor" ? "grow.task.sow.indoor" : "grow.task.sow")),
    p.method === "indoor" ? mk(p.plan.transplant, t("grow.task.transplant")) : null,
    mk(p.plan.harvest_from, t("grow.task.harvest")),
  ].filter(Boolean);
}

/* --- Plan sezonu z AI: wybór miejsc + życzenia → podgląd → akceptacja --- */
function aiDialog(app) {
  const opts = areaOptions(app);
  app.dialog(
    `<h2>${t("grow.ai")}</h2>
    <form>
      <label>${t("grow.ai.areas")}</label>
      ${opts
        .map(
          (o, i) => `<label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:2px 0">
            <input type="checkbox" name="a${i}" checked>${o.label}${o.secondary ? ` <small style="color:var(--secondary-text-color)">${esc(o.secondary)}</small>` : ""}</label>`
        )
        .join("")}
      <label>${t("grow.ai.wishes")}</label>
      <textarea name="wishes" placeholder="${t("grow.ai.wishes.ph")}" style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid var(--divider-color);border-radius:8px;background:var(--primary-background-color);color:var(--primary-text-color);font:inherit;min-height:56px"></textarea>
      <div class="dialog-actions">
        <button type="button" class="btn plain" data-cancel>${t("cancel")}</button>
        <button type="submit" class="btn ai"><ha-icon icon="mdi:creation"></ha-icon>${t("gen.run")}</button>
      </div>
    </form>`,
    async (fd) => {
      const chosen = opts.filter((_, i) => fd.get(`a${i}`));
      if (!chosen.length) return;
      const items = areas(app);
      const areasPayload = chosen.map((o) => {
        const zone = app.data.zones.find((z) => z.id === o.value);
        const rect = items.find((x) => x.zone_id === o.value); // kształt strefy z planu, jeśli narysowany
        return {
          id: o.value,
          label: o.label,
          kind: zone?.kind || "zone",
          zone: zone?.name || null,
          planting: zone?.planting || null,
          size_m: rect ? [Math.round(rect.w * 10) / 10, Math.round(rect.h * 10) / 10] : null,
        };
      });
      const catalog = PHENO.map((p) => ({
        name: p.name,
        family: p.family,
        sow_indoor: p.sow_indoor,
        sow_direct: p.sow_direct,
        transplant: p.transplant,
        harvest: p.harvest,
        spacing_cm: p.spacing_cm,
      }));
      app.toast(t("tasks.generating"));
      let res;
      try {
        res = await app.ws("grow/generate", { areas: areasPayload, catalog, wishes: fd.get("wishes").trim() || null });
      } catch (e) {
        app.toast(`⚠ ${e.message || e}`, true);
        return;
      }
      if (!res.plantings?.length) {
        app.toast(t("gen.none"));
        return;
      }
      aiPreview(app, res.plantings);
    }
  );
}

function aiPreview(app, proposals) {
  const s = st(app);
  app.dialog(
    `<h2>${t("grow.ai")}</h2>
    <form>
      <p style="font-size:13px;color:var(--secondary-text-color)">${t("grow.ai.preview", { n: proposals.length })}</p>
      ${proposals
        .map(
          (p, i) => `<label style="display:flex;gap:8px;align-items:flex-start;cursor:pointer;padding:6px 0;border-bottom:1px solid var(--divider-color)">
          <input type="checkbox" name="p${i}" checked style="margin-top:3px">
          <span style="min-width:0"><b>${esc(p.name)}</b> — ${esc(areaLabel(app, p.area_id))}
            <span class="chip">${t("grow.method." + p.method)}</span><br>
            <small style="color:var(--secondary-text-color)">${[p.sow && `${t("grow.date.sow")} ${p.sow}`, p.transplant && `${t("grow.date.transplant")} ${p.transplant}`, `${t("grow.date.harvest_from")} ${p.harvest_from}`].filter(Boolean).join(" · ")}</small><br>
            <small>${esc(p.reason || "")}</small></span></label>`
        )
        .join("")}
      <label style="display:flex;align-items:center;gap:8px;margin-top:12px;cursor:pointer">
        <input type="checkbox" name="make_tasks" checked>${t("grow.maketasks")}</label>
      <div class="dialog-actions">
        <button type="button" class="btn plain" data-cancel>${t("cancel")}</button>
        <button type="submit" class="btn">${t("chat.accept")}</button>
      </div>
    </form>`,
    async (fd) => {
      const picked = proposals.filter((_, i) => fd.get(`p${i}`));
      if (!picked.length) return;
      const plantings = picked.map((p) => {
        const preset = PHENO.find((x) => x.name === p.name);
        return {
          id: null,
          zone_id: p.area_id, // nazwa pola na drucie AI zostaje area_id — niesie id strefy
          name: p.name,
          species: preset?.species || "",
          family: preset?.family || "",
          emoji: preset?.emoji || "🌱",
          plant_id: null,
          year: s.year,
          method: p.method,
          plan: { sow: p.sow, transplant: p.transplant, harvest_from: p.harvest_from, harvest_to: p.harvest_to },
          done: {},
          succession_days: null,
          notes: p.reason || "",
        };
      });
      const tasks = fd.get("make_tasks") ? plantings.flatMap((p) => plantingTasks(app, p)) : [];
      try {
        app.data = await app.ws("grow/apply", { plantings, tasks });
      } catch (e) {
        app.toast(`⚠ ${e.message || e}`, true);
        return;
      }
      app.render();
      app.toast(t("grow.ai.applied", { n: plantings.length }));
    },
    { wide: true }
  );
}

export const actions = {
  "grow-add": (app) => growDialog(app),
  "grow-ai": (app) => {
    if (!areas(app).length) {
      app.toast(t("grow.noareas"), true);
      return;
    }
    aiDialog(app);
  },
  "grow-year": (app, el) => {
    st(app).year += parseInt(el.dataset.d, 10);
    app.render();
  },
};
