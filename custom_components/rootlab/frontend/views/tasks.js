import { t } from "../i18n.js";
import { esc, todayISO } from "../util.js";

const CATEGORIES = ["maintenance", "protection", "crisis", "manual"];
const CAT_ICONS = {
  maintenance: "mdi:content-cut",
  protection: "mdi:shield-outline",
  crisis: "mdi:leaf-off",
  manual: "mdi:account-outline",
};

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

export function render(app) {
  const pending = pendingTasks(app.data.tasks);
  const done = (app.data.tasks || []).filter((task) => task.done).slice(-10).reverse();
  const toolbar = `<div class="toolbar">
    <div class="spacer"></div>
    <button class="btn ghost" data-action="task-add"><ha-icon icon="mdi:plus"></ha-icon>${t("tasks.add")}</button>
    <button class="btn ai" data-action="tasks-generate" ${app.busyGenerate ? "disabled" : ""}>
      <ha-icon icon="mdi:creation"></ha-icon>${app.busyGenerate ? t("tasks.generating") : t("tasks.generate")}</button>
  </div>`;
  const error = app.generateError
    ? `<div class="warn-hint"><ha-icon icon="mdi:alert-circle-outline"></ha-icon>${esc(app.generateError)}</div>`
    : "";
  if (!pending.length && !done.length) {
    return `${toolbar}${error}<div class="empty">
      <ha-icon icon="mdi:clipboard-check-outline"></ha-icon>
      <p>${t("tasks.empty")}</p>
      <p style="font-size:13px">${t("tasks.empty.nokey")}</p>
    </div>`;
  }
  const groups = CATEGORIES.map((cat) => ({ cat, tasks: pending.filter((task) => (task.category || "manual") === cat) })).filter(
    (g) => g.tasks.length
  );
  return `${toolbar}${error}
    ${groups
      .map(
        (g) => `
      <div class="section-title"><ha-icon icon="${CAT_ICONS[g.cat]}"></ha-icon>${t(`tasks.cat.${g.cat}`)}</div>
      <div class="card">${g.tasks.map((task) => row(app, task)).join("")}</div>`
      )
      .join("")}
    ${
      done.length
        ? `<div class="section-title"><ha-icon icon="mdi:check-all"></ha-icon>✓</div>
           <div class="card">${done.map((task) => row(app, task)).join("")}</div>`
        : ""
    }
    ${!pending.length ? `<div class="empty"><p>${t("tasks.empty")}</p></div>` : ""}`;
}

function row(app, task) {
  const plant = task.plant_id ? app.data.plants.find((p) => p.id === task.plant_id) : null;
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

function addDialog(app) {
  const plantOpts = app.data.plants.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("");
  app.dialog(
    `<h2>${t("task.new")}</h2>
    <form>
      <label>${t("task.title")}</label>
      <input name="title" required maxlength="120" autofocus>
      <label>${t("task.details")}</label>
      <input name="details" maxlength="240">
      <label>${t("task.plant")}</label>
      <select name="plant_id"><option value="">${t("none")}</option>${plantOpts}</select>
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

export const actions = {
  "task-add": (app) => addDialog(app),
  "task-done": (app, el) => {
    const task = app.data.tasks.find((x) => x.id === el.dataset.id);
    app.saveItem("tasks", { ...task, done: !task.done });
  },
  "task-delete": (app, el) => {
    if (confirm(t("task.delete.confirm"))) app.deleteItem("tasks", el.dataset.id);
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
  "tasks-generate": async (app) => {
    app.busyGenerate = true;
    app.generateError = null;
    app.render();
    try {
      app.data = await app.ws("tasks/generate");
    } catch (e) {
      app.generateError = e.message || String(e);
    }
    app.busyGenerate = false;
    app.render();
  },
};
