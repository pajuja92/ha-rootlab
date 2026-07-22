import { t } from "../i18n.js";
import { esc } from "../util.js";

export function render(app) {
  const filter = (app.knowledgeFilter || "").toLowerCase();
  const items = (app.data.knowledge || [])
    .filter(
      (k) =>
        !filter ||
        (k.title || "").toLowerCase().includes(filter) ||
        (k.content || "").toLowerCase().includes(filter)
    )
    .slice()
    .reverse();
  const toolbar = `<div class="toolbar">
    <div class="spacer"></div>
    <button class="btn" data-action="kn-add"><ha-icon icon="mdi:plus"></ha-icon>${t("knowledge.add")}</button>
  </div>`;
  const search = `<input class="kn-search" id="kn-search" placeholder="${t("knowledge.search.ph")}" value="${esc(app.knowledgeFilter || "")}">`;
  if (!(app.data.knowledge || []).length) {
    return `${toolbar}<div class="empty"><ha-icon icon="mdi:book-open-variant"></ha-icon><p>${t("knowledge.empty")}</p></div>`;
  }
  return `${toolbar}${search}
    <div class="grid">
      ${items
        .map((k) => {
          const plant = app.data.plants.find((p) => p.id === k.plant_id);
          const expanded = app.knowledgeOpen === k.id;
          return `<div class="card kn-item">
            <h3>${esc(k.title)}</h3>
            <div class="meta">
              ${k.source === "ai" ? `<span class="chip ai"><ha-icon icon="mdi:creation" style="--mdc-icon-size:12px"></ha-icon> AI</span>` : ""}
              ${plant ? `<span>${esc(plant.emoji || "🌱")} ${esc(plant.name)}</span>` : ""}
              <span>${esc(k.created || "")}</span>
            </div>
            <div class="body ${expanded ? "" : "clamp"}" data-action="kn-toggle" data-id="${k.id}" style="cursor:pointer">${esc(k.content)}</div>
            <div class="actions">
              <button class="icon-btn" data-action="kn-edit" data-id="${k.id}" title="${t("edit")}"><ha-icon icon="mdi:pencil-outline"></ha-icon></button>
              <button class="icon-btn" data-action="kn-delete" data-id="${k.id}" title="${t("delete")}"><ha-icon icon="mdi:trash-can-outline"></ha-icon></button>
            </div>
          </div>`;
        })
        .join("")}
    </div>`;
}

export function bind(app, root) {
  const search = root.getElementById("kn-search");
  search?.addEventListener("input", () => {
    app.knowledgeFilter = search.value;
    const pos = search.selectionStart;
    app.render();
    const again = app.shadowRoot.getElementById("kn-search");
    if (again) {
      again.focus();
      again.setSelectionRange(pos, pos);
    }
  });
}

function knDialog(app, item) {
  app.dialog(
    `<h2>${item ? t("knowledge.edit") : t("knowledge.new")}</h2>
    <form>
      <label>${t("kn.title")}</label>
      <input name="title" required maxlength="140" value="${esc(item?.title)}" autofocus>
      <label>${t("kn.content")}</label>
      <textarea name="content" required style="min-height:160px">${esc(item?.content)}</textarea>
      <div class="dialog-actions">
        <button type="button" class="btn plain" data-cancel>${t("cancel")}</button>
        <button type="submit" class="btn">${t("save")}</button>
      </div>
    </form>`,
    (fd) =>
      app.saveItem("knowledge", {
        id: item?.id ?? null,
        title: fd.get("title").trim(),
        content: fd.get("content").trim(),
        source: item?.source || "manual",
        plant_id: item?.plant_id ?? null,
        created: item?.created || new Date().toISOString().slice(0, 10),
      }),
    { wide: true }
  );
}

export const actions = {
  "kn-add": (app) => knDialog(app),
  "kn-edit": (app, el) => knDialog(app, app.data.knowledge.find((k) => k.id === el.dataset.id)),
  "kn-delete": (app, el) => {
    if (confirm(t("knowledge.delete.confirm"))) app.deleteItem("knowledge", el.dataset.id);
  },
  "kn-toggle": (app, el) => {
    app.knowledgeOpen = app.knowledgeOpen === el.dataset.id ? null : el.dataset.id;
    app.render();
  },
};
