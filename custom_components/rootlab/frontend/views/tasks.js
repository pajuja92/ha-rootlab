import { t } from "../i18n.js";
import { combo, esc, todayISO } from "../util.js";

const CATEGORIES = ["maintenance", "protection", "crisis", "manual"];
const CAT_ICONS = {
  maintenance: "mdi:content-cut",
  protection: "mdi:shield-outline",
  crisis: "mdi:leaf-off",
  manual: "mdi:account-outline",
};

const st = (app) =>
  (app.tasksState ??= {
    view: "list",
    plant: "",
    zone: "",
    cat: "",
    group: "category",
    month: todayISO().slice(0, 7), // YYYY-MM
  });

export const pendingTasks = (tasks) =>
  (tasks || [])
    .filter((task) => !task.done && (!task.snoozed_until || task.snoozed_until <= todayISO()))
    .sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"));

export const dueLabel = (due) => {
  if (!due) return "";
  const today = todayISO();
  if (due < today) return `<span class="overdue">${t("tasks.overdue")} (${esc(due)})</span>`;
  if (due === today) return t("tasks.today");
  const diff = Math.round((new Date(due) - new Date(today)) / 86400000);
  return diff === 1 ? t("tasks.tomorrow") : t("tasks.in", { n: diff });
};

const plantOf = (app, task) => app.data.plants.find((p) => p.id === task.plant_id);
const zoneOf = (app, task) => {
  const plant = plantOf(app, task);
  return plant ? app.data.zones.find((z) => z.id === plant.zone_id) : null;
};

function applyFilters(app, tasks) {
  const s = st(app);
  return tasks.filter((task) => {
    if (s.cat && (task.category || "manual") !== s.cat) return false;
    if (s.plant && task.plant_id !== s.plant) return false;
    if (s.zone && zoneOf(app, task)?.id !== s.zone) return false;
    return true;
  });
}

export function render(app) {
  const s = st(app);
  const toolbar = `<div class="toolbar">
    <div class="mode-toggle">
      <button class="${s.view === "list" ? "on" : ""}" data-action="tasks-view" data-view="list"><ha-icon icon="mdi:format-list-bulleted" style="--mdc-icon-size:16px"></ha-icon>${t("tasks.view.list")}</button>
      <button class="${s.view === "cal" ? "on" : ""}" data-action="tasks-view" data-view="cal"><ha-icon icon="mdi:calendar-month-outline" style="--mdc-icon-size:16px"></ha-icon>${t("tasks.view.cal")}</button>
    </div>
    <div class="spacer"></div>
    <button class="btn ghost" data-action="task-add"><ha-icon icon="mdi:plus"></ha-icon>${t("tasks.add")}</button>
    <button class="btn ai" data-action="tasks-generate" ${app.busyGenerate ? "disabled" : ""}>
      <ha-icon icon="mdi:creation"></ha-icon>${app.busyGenerate ? t("tasks.generating") : t("tasks.generate")}</button>
  </div>`;
  const filters = filterBar(app);
  const error = app.generateError
    ? `<div class="warn-hint"><ha-icon icon="mdi:alert-circle-outline"></ha-icon>${esc(app.generateError)}</div>`
    : "";
  const body = s.view === "cal" ? calendar(app) : list(app);
  return toolbar + filters + error + body;
}

function filterBar(app) {
  const s = st(app);
  const plantOpts = app.data.plants.map((p) => ({ value: p.id, label: `${p.emoji || "🌱"} ${p.name}` }));
  const zoneOpts = app.data.zones.map((z) => ({ value: z.id, label: `${z.emoji || "🪴"} ${z.name}` }));
  const catOpts = CATEGORIES.map((c) => ({ value: c, label: t(`tasks.cat.${c}`) }));
  return `<div class="filter-bar">
    ${combo({ name: "f_plant", value: s.plant, options: plantOpts, placeholder: t("tasks.filter.plant") })}
    ${combo({ name: "f_zone", value: s.zone, options: zoneOpts, placeholder: t("tasks.filter.zone") })}
    ${combo({ name: "f_cat", value: s.cat, options: catOpts, placeholder: t("tasks.filter.cat") })}
    ${
      s.view === "list"
        ? `<select data-bind="group" title="${t("tasks.group")}">
            <option value="category" ${s.group === "category" ? "selected" : ""}>${t("tasks.group")}: ${t("tasks.group.category")}</option>
            <option value="zone" ${s.group === "zone" ? "selected" : ""}>${t("tasks.group")}: ${t("tasks.group.zone")}</option>
            <option value="plant" ${s.group === "plant" ? "selected" : ""}>${t("tasks.group")}: ${t("tasks.group.plant")}</option>
          </select>`
        : ""
    }
  </div>`;
}

/* ---------- LISTA ---------- */

function list(app) {
  const s = st(app);
  const pending = applyFilters(app, pendingTasks(app.data.tasks));
  const done = applyFilters(app, (app.data.tasks || []).filter((task) => task.done)).slice(-10).reverse();
  if (!pending.length && !done.length) {
    return `<div class="empty">
      <ha-icon icon="mdi:clipboard-check-outline"></ha-icon>
      <p>${t("tasks.empty")}</p>
      <p style="font-size:13px">${t("tasks.empty.nokey")}</p>
    </div>`;
  }
  let groups;
  if (s.group === "zone") {
    groups = [
      ...app.data.zones.map((z) => ({
        icon: null, emoji: z.emoji || "🪴", label: z.name,
        tasks: pending.filter((task) => zoneOf(app, task)?.id === z.id),
      })),
      { icon: "mdi:tag-outline", label: t("zone.none"), tasks: pending.filter((task) => !zoneOf(app, task)) },
    ];
  } else if (s.group === "plant") {
    groups = [
      ...app.data.plants.map((p) => ({
        icon: null, emoji: p.emoji || "🌱", label: p.name,
        tasks: pending.filter((task) => task.plant_id === p.id),
      })),
      { icon: "mdi:sprout-outline", label: t("tasks.group.general"), tasks: pending.filter((task) => !plantOf(app, task)) },
    ];
  } else {
    groups = CATEGORIES.map((cat) => ({
      icon: CAT_ICONS[cat], label: t(`tasks.cat.${cat}`),
      tasks: pending.filter((task) => (task.category || "manual") === cat),
    }));
  }
  return (
    groups
      .filter((g) => g.tasks.length)
      .map(
        (g) => `
      <div class="section-title">${g.icon ? `<ha-icon icon="${g.icon}"></ha-icon>` : `<span class="emoji">${esc(g.emoji)}</span>`}${esc(g.label)}</div>
      <div class="card">${g.tasks.map((task) => row(app, task)).join("")}</div>`
      )
      .join("") +
    (done.length
      ? `<div class="section-title"><ha-icon icon="mdi:check-all"></ha-icon>✓</div>
         <div class="card">${done.map((task) => row(app, task)).join("")}</div>`
      : "") +
    (!pending.length ? `<div class="empty"><p>${t("tasks.empty")}</p></div>` : "")
  );
}

function row(app, task) {
  const plant = plantOf(app, task);
  return `<div class="task-row ${task.done ? "done" : ""}">
    <input type="checkbox" data-action="task-done" data-id="${task.id}" ${task.done ? "checked" : ""}>
    <div class="body">
      <div class="title">${esc(task.title)}</div>
      <div class="meta">
        ${plant ? `<span>${esc(plant.emoji || "🌱")} ${esc(plant.name)}</span>` : ""}
        ${task.due ? `<span>${dueLabel(task.due)}</span>` : ""}
        ${task.source === "ai" ? `<span class="chip ai"><ha-icon icon="mdi:creation" style="--mdc-icon-size:12px"></ha-icon> AI</span>` : ""}
        ${task.details ? `<span>${esc(task.details)}</span>` : ""}
      </div>
    </div>
    ${
      task.done
        ? ""
        : `<button class="icon-btn" data-action="task-snooze" data-id="${task.id}" title="${t("tasks.snooze")}"><ha-icon icon="mdi:alarm-snooze"></ha-icon></button>`
    }
    <button class="icon-btn" data-action="task-delete" data-id="${task.id}" title="${t("delete")}"><ha-icon icon="mdi:trash-can-outline"></ha-icon></button>
  </div>`;
}

/* ---------- KALENDARZ ---------- */

function calendar(app) {
  const s = st(app);
  const [year, month] = s.month.split("-").map(Number);
  const first = new Date(year, month - 1, 1);
  const startOffset = (first.getDay() + 6) % 7; // Pn=0
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = todayISO();
  const tasks = applyFilters(app, pendingTasks(app.data.tasks));
  const byDay = {};
  const noDate = [];
  for (const task of tasks) {
    if (!task.due) noDate.push(task);
    else (byDay[task.due] ??= []).push(task);
  }
  // zaległe pokazujemy w dniu dzisiejszym (z obwódką)
  const monthName = new Date(year, month - 1, 1).toLocaleDateString(app.hass.language || "pl", {
    month: "long",
    year: "numeric",
  });
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(`<div class="cal-cell other"></div>`);
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    let dayTasks = byDay[iso] || [];
    if (iso === today) {
      const overdue = tasks.filter((task) => task.due && task.due < today);
      dayTasks = [...overdue, ...dayTasks];
    }
    const shown = dayTasks.slice(0, 3);
    cells.push(`<div class="cal-cell ${iso === today ? "today" : ""}">
      <div class="d">${d}</div>
      ${shown
        .map(
          (task) => `<button class="cal-chip ${task.category || "manual"} ${task.due < today ? "overdue" : ""}"
            data-action="task-open" data-id="${task.id}" title="${esc(task.title)}">${esc(task.title)}</button>`
        )
        .join("")}
      ${dayTasks.length > 3 ? `<span class="cal-more">+${dayTasks.length - 3}</span>` : ""}
    </div>`);
  }
  return `
    <div class="cal-head">
      <button class="icon-btn" data-action="cal-nav" data-dir="-1"><ha-icon icon="mdi:chevron-left"></ha-icon></button>
      <b>${esc(monthName)}</b>
      <button class="icon-btn" data-action="cal-nav" data-dir="1"><ha-icon icon="mdi:chevron-right"></ha-icon></button>
    </div>
    <div class="cal-grid">
      ${t("days").map((d) => `<div class="cal-dow">${d}</div>`).join("")}
      ${cells.join("")}
    </div>
    ${
      noDate.length
        ? `<div class="section-title" style="margin-top:16px"><ha-icon icon="mdi:calendar-question"></ha-icon>${t("tasks.nodate")}</div>
           <div class="card">${noDate.map((task) => row(app, task)).join("")}</div>`
        : ""
    }`;
}

function taskDialog(app, task) {
  const plant = plantOf(app, task);
  app.dialog(
    `<h2>${esc(task.title)}</h2>
    <div class="meta" style="display:flex;gap:8px;flex-wrap:wrap;font-size:13px;color:var(--secondary-text-color)">
      <span class="chip ${task.category === "protection" ? "harvest" : task.category === "crisis" ? "crisis" : ""}">${t("tasks.cat." + (task.category || "manual"))}</span>
      ${plant ? `<span>${esc(plant.emoji || "🌱")} ${esc(plant.name)}</span>` : ""}
      ${task.due ? `<span>${t("task.due")}: ${esc(task.due)} (${dueLabel(task.due)})</span>` : ""}
    </div>
    ${task.details ? `<p style="font-size:14px">${esc(task.details)}</p>` : ""}
    <div class="dialog-actions">
      <button type="button" class="btn plain" data-action="task-delete" data-id="${task.id}">${t("delete")}</button>
      <button type="button" class="btn ghost" data-action="task-snooze" data-id="${task.id}">${t("tasks.snooze")}</button>
      <button type="button" class="btn" data-action="task-done-close" data-id="${task.id}">✓ ${t("tasks.markdone")}</button>
    </div>`,
    () => {}
  );
}

function addDialog(app) {
  const plantOpts = app.data.plants.map((p) => ({ value: p.id, label: `${p.emoji || "🌱"} ${p.name}`, secondary: p.species }));
  app.dialog(
    `<h2>${t("task.new")}</h2>
    <form>
      <label>${t("task.title")}</label>
      <input name="title" required maxlength="120" autofocus>
      <label>${t("task.details")}</label>
      <input name="details" maxlength="240">
      <label>${t("task.plant")}</label>
      ${combo({ name: "plant_id", options: plantOpts })}
      <label>${t("task.due")}</label>
      <input name="due" type="date" value="${todayISO()}">
      <div class="dialog-actions">
        <button type="button" class="btn plain" data-cancel>${t("cancel")}</button>
        <button type="submit" class="btn">${t("save")}</button>
      </div>
    </form>`,
    (fd) =>
      app.saveItem("tasks", {
        id: null,
        title: fd.get("title").trim(),
        details: fd.get("details").trim(),
        plant_id: fd.get("plant_id") || null,
        due: fd.get("due") || null,
        category: "manual",
        source: "user",
        done: false,
      })
  );
}

export function bind(app, root) {
  const s = st(app);
  root.querySelectorAll(".filter-bar input[type=hidden]").forEach((el) =>
    el.addEventListener("change", () => {
      s.plant = root.querySelector('input[name="f_plant"]')?.value || "";
      s.zone = root.querySelector('input[name="f_zone"]')?.value || "";
      s.cat = root.querySelector('input[name="f_cat"]')?.value || "";
      app.render();
    })
  );
  root.querySelector('.filter-bar [data-bind="group"]')?.addEventListener("change", (ev) => {
    s.group = ev.target.value;
    app.render();
  });
  // comboboxy filtrów są poza dialogiem — podłącz je tutaj
  import("../util.js").then((u) => u.wireCombos(root.querySelector(".filter-bar") || root));
}

export const actions = {
  "tasks-view": (app, el) => {
    st(app).view = el.dataset.view;
    app.render();
  },
  "cal-nav": (app, el) => {
    const s = st(app);
    const [y, m] = s.month.split("-").map(Number);
    const d = new Date(y, m - 1 + parseInt(el.dataset.dir, 10), 1);
    s.month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    app.render();
  },
  "task-open": (app, el) => {
    const task = app.data.tasks.find((x) => x.id === el.dataset.id);
    if (task) taskDialog(app, task);
  },
  "task-add": (app) => addDialog(app),
  "task-done": (app, el) => {
    const task = app.data.tasks.find((x) => x.id === el.dataset.id);
    app.saveItem("tasks", { ...task, done: !task.done });
  },
  "task-done-close": (app, el) => {
    const task = app.data.tasks.find((x) => x.id === el.dataset.id);
    app.shadowRoot.getElementById("form-dialog")?.close();
    app.saveItem("tasks", { ...task, done: true });
  },
  "task-delete": (app, el) => {
    if (!confirm(t("task.delete.confirm"))) return;
    app.shadowRoot.getElementById("form-dialog")?.close();
    app.deleteItem("tasks", el.dataset.id);
  },
  "task-snooze": (app, el) => {
    app.dialog(
      `<h2>${t("tasks.snooze.title")}</h2>
      <form>
        <input name="ndays" type="number" min="1" max="60" value="3" autofocus>
        <div class="dialog-actions">
          <button type="button" class="btn plain" data-cancel>${t("cancel")}</button>
          <button type="submit" class="btn">${t("tasks.snooze")}</button>
        </div>
      </form>`,
      (fd) => {
        const task = app.data.tasks.find((x) => x.id === el.dataset.id);
        const d = new Date();
        d.setDate(d.getDate() + (parseInt(fd.get("ndays"), 10) || 1));
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        app.saveItem("tasks", { ...task, snoozed_until: iso, due: task.due && task.due < iso ? iso : task.due });
      }
    );
  },
  "tasks-generate": (app) => generateDialog(app),
};

/* ---------- MODAL GENEROWANIA: zakres → podgląd różnic → wdrożenie wybranych ---------- */

function generateDialog(app) {
  const zones = [...app.data.zones, { id: null, name: t("zone.none"), emoji: "🏷️" }];
  const aiPlants = new Set(
    pendingTasks(app.data.tasks)
      .filter((task) => task.source === "ai" && task.plant_id)
      .map((task) => task.plant_id)
  );
  let preview = null; // {generated, to_remove}

  const scopeHtml = zones
    .map((z) => {
      const plants = app.data.plants.filter((p) => (p.zone_id || null) === z.id);
      if (!plants.length) return "";
      return `<div class="gen-zone">
        <label class="gen-zone-head"><input type="checkbox" data-zone="${z.id ?? ""}" checked>
          <b>${esc(z.emoji || "🪴")} ${esc(z.name)}</b></label>
        ${plants
          .map(
            (p) => `<label class="gen-plant"><input type="checkbox" name="pl_${p.id}" data-zoneof="${z.id ?? ""}" checked>
              ${esc(p.emoji || "🌱")} ${esc(p.name)}
              ${aiPlants.has(p.id) ? `<span class="chip ai">✦ ${t("gen.has_ai")}</span>` : ""}</label>`
          )
          .join("")}
      </div>`;
    })
    .join("");

  const dlg = app.dialog(
    `<h2><ha-icon icon="mdi:creation" style="color:var(--rl-ai)"></ha-icon> ${t("gen.title")}</h2>
    <div id="gen-form">
      <label>${t("gen.categories")}</label>
      <div class="day-picker">
        <label><input type="checkbox" name="cat_maintenance" checked>${t("tasks.cat.maintenance")}</label>
        <label><input type="checkbox" name="cat_protection" checked>${t("tasks.cat.protection")}</label>
      </div>
      <label>${t("gen.scope")}</label>
      ${scopeHtml || `<p style="font-size:13px;color:var(--secondary-text-color)">${t("plants.empty.nozones")}</p>`}
      <label class="gen-plant" style="margin-left:0"><input type="checkbox" name="inc_general" checked> ${t("gen.general")}</label>
    </div>
    <div id="gen-result"></div>
    <div class="dialog-actions">
      <button type="button" class="btn plain" data-cancel>${t("cancel")}</button>
      <button type="button" class="btn ai" id="gen-run"><ha-icon icon="mdi:creation"></ha-icon><span id="gen-run-label">${t("gen.run")}</span></button>
      <button type="button" class="btn" id="gen-apply" style="display:none">${t("gen.apply")}</button>
    </div>`,
    () => {},
    { wide: true }
  );

  // strefa ↔ rośliny: checkbox strefy przełącza dzieci; dziecko aktualizuje strefę
  dlg.querySelectorAll("[data-zone]").forEach((zc) =>
    zc.addEventListener("change", () => {
      dlg.querySelectorAll(`[data-zoneof="${zc.dataset.zone}"]`).forEach((pc) => (pc.checked = zc.checked));
    })
  );
  dlg.querySelectorAll("[data-zoneof]").forEach((pc) =>
    pc.addEventListener("change", () => {
      const siblings = [...dlg.querySelectorAll(`[data-zoneof="${pc.dataset.zoneof}"]`)];
      dlg.querySelector(`[data-zone="${pc.dataset.zoneof}"]`).checked = siblings.some((x) => x.checked);
    })
  );

  const catChip = (c) =>
    `<span class="chip ${c === "protection" ? "harvest" : c === "crisis" ? "crisis" : ""}">${t("tasks.cat." + (c || "manual"))}</span>`;
  const plantName = (pid) => {
    const p = app.data.plants.find((x) => x.id === pid);
    return p ? `${p.emoji || "🌱"} ${p.name}` : t("tasks.group.general");
  };

  dlg.querySelector("#gen-run").addEventListener("click", async () => {
    const cats = ["maintenance", "protection"].filter((c) => dlg.querySelector(`[name="cat_${c}"]`).checked);
    const checked = [...dlg.querySelectorAll('[name^="pl_"]')].filter((x) => x.checked).map((x) => x.name.slice(3));
    const scopeAll = checked.length === app.data.plants.length;
    const includeGeneral = dlg.querySelector('[name="inc_general"]').checked;
    const run = dlg.querySelector("#gen-run");
    run.disabled = true;
    dlg.querySelector("#gen-run-label").textContent = t("tasks.generating");
    dlg.querySelector("#gen-result").innerHTML = "";
    try {
      preview = await app.ws("tasks/generate", {
        categories: cats.length ? cats : null,
        plant_ids: scopeAll ? null : checked,
        include_general: includeGeneral,
      });
    } catch (e) {
      preview = null;
      dlg.querySelector("#gen-result").innerHTML =
        `<div class="warn-hint"><ha-icon icon="mdi:alert-circle-outline"></ha-icon>${esc(e.message || String(e))}</div>`;
    }
    run.disabled = false;
    dlg.querySelector("#gen-run-label").textContent = t("gen.rerun");
    if (!preview) return;
    const { generated, to_remove: removed } = preview;
    const rows = [];
    if (!generated.length && !removed.length) {
      rows.push(`<div class="ai-hint"><ha-icon icon="mdi:creation"></ha-icon>${t("gen.none")}</div>`);
    }
    if (generated.length) {
      rows.push(`<label style="margin-top:14px">${t("gen.diff.new", { n: generated.length })}</label>`);
      rows.push(
        generated
          .map(
            (task, i) => `<label class="gen-plant diff-add"><input type="checkbox" class="gen-add" data-i="${i}" checked>
              <span>＋</span> ${catChip(task.category)} <b>${esc(task.title)}</b>
              <small style="color:var(--secondary-text-color)">${esc(plantName(task.plant_id))}${task.due ? " · " + esc(task.due) : ""}</small></label>`
          )
          .join("")
      );
    }
    if (removed.length) {
      rows.push(`<label style="margin-top:10px">${t("gen.diff.removed", { n: removed.length })}</label>`);
      rows.push(
        removed
          .map(
            (task) => `<label class="gen-plant diff-del"><input type="checkbox" class="gen-del" data-id="${task.id}" checked>
              <span>−</span> ${catChip(task.category)} <s>${esc(task.title)}</s>
              <small style="color:var(--secondary-text-color)">${esc(plantName(task.plant_id))}</small></label>`
          )
          .join("")
      );
    }
    dlg.querySelector("#gen-result").innerHTML = rows.join("");
    dlg.querySelector("#gen-apply").style.display = generated.length || removed.length ? "" : "none";
  });

  dlg.querySelector("#gen-apply").addEventListener("click", async () => {
    if (!preview) return;
    const add = [...dlg.querySelectorAll(".gen-add")]
      .filter((x) => x.checked)
      .map((x) => preview.generated[parseInt(x.dataset.i, 10)]);
    const removeIds = [...dlg.querySelectorAll(".gen-del")].filter((x) => x.checked).map((x) => x.dataset.id);
    app.data = await app.ws("tasks/apply", { add, remove_ids: removeIds });
    dlg.close();
    app.render();
    app.toast(t("toast.applied"));
  });
}
