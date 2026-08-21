import { t } from "../i18n.js";
import { TABS, esc, saveUiPrefs, uiPrefs } from "../util.js";

const PROMPT_KEYS = ["system", "tasks", "diagnose", "ask", "season", "inventory_scan"];
const TA_STYLE =
  "width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid var(--divider-color);border-radius:8px;background:var(--primary-background-color);color:var(--primary-text-color);font:inherit;min-height:96px;margin-bottom:8px";

export function render(app) {
  const overrides = app.data.ai_prompts || {};
  const defaults = app.data.ai_prompt_defaults || {};
  return `<div class="card" style="max-width:780px">
    <div class="section-title" style="margin-top:0">${t("settings.prompts")}</div>
    <p style="font-size:13px;color:var(--secondary-text-color);margin-top:0">${t("settings.prompts.hint")}</p>
    ${PROMPT_KEYS.map(
      (k) => `
      <label style="display:flex;align-items:center;gap:8px">${t("settings.prompt." + k)}
        ${overrides[k] ? `<span class="chip" style="font-size:11px;padding:1px 8px">${t("settings.changed")}</span>` : ""}
        <button class="icon-btn" data-prompt-reset="${k}" title="${t("settings.reset.one")}"><ha-icon icon="mdi:restore" style="--mdc-icon-size:16px"></ha-icon></button>
      </label>
      <textarea data-prompt="${k}" style="${TA_STYLE}">${esc(overrides[k] || defaults[k] || "")}</textarea>`
    ).join("")}
    <div class="actions" style="justify-content:flex-end">
      <button class="btn" data-action="prompts-save"><ha-icon icon="mdi:content-save-outline"></ha-icon>${t("save")}</button>
    </div>
  </div>
  ${catsCard(app)}
  ${uiCard(app)}
  ${shopCard(app)}`;
}

/* Kategorie inwentarza — lista zarządzana przez użytkownika (storage HA). */
function catsCard(app) {
  const cats = app.data.inventory_categories || [];
  return `<div class="card" style="max-width:780px;margin-top:16px">
    <div class="section-title" style="margin-top:0"><ha-icon icon="mdi:shape-outline"></ha-icon>${t("settings.cats.title")}</div>
    <p style="font-size:13px;color:var(--secondary-text-color);margin-top:0">${t("settings.cats.hint")}</p>
    <div class="chips" style="display:flex;flex-wrap:wrap;gap:6px">
      ${cats
        .map(
          (c, i) => `<span class="chip" style="display:inline-flex;align-items:center;gap:4px">${esc(c)}
            <button class="icon-btn" data-action="inv-cat-del" data-idx="${i}" title="${t("delete")}" style="padding:0"><ha-icon icon="mdi:close" style="--mdc-icon-size:14px"></ha-icon></button></span>`
        )
        .join("")}
    </div>
    <div style="display:flex;gap:8px;margin-top:12px">
      <input id="inv-cat-new" maxlength="60" placeholder="${t("settings.cats.add")}…" style="flex:1">
      <button class="btn small" data-action="inv-cat-add"><ha-icon icon="mdi:plus"></ha-icon>${t("settings.cats.add")}</button>
    </div>
  </div>`;
}

/* Nawigacja i wygląd — preferencje per urządzenie (localStorage, nie storage HA). */
function uiCard(app) {
  const ui = uiPrefs();
  const chk = (id, checked, label) =>
    `<label style="display:flex;align-items:center;gap:8px;margin:6px 0"><input type="checkbox" id="${id}" ${checked ? "checked" : ""} style="width:auto">${label}</label>`;
  return `<div class="card" style="max-width:780px;margin-top:16px">
    <div class="section-title" style="margin-top:0"><ha-icon icon="mdi:cellphone-cog"></ha-icon>${t("ui.title")}</div>
    <p style="font-size:13px;color:var(--secondary-text-color);margin-top:0">${t("ui.hint")}</p>
    <label>${t("ui.bottom")}</label>
    <div class="check-list" id="ui-bottom" style="margin-bottom:8px">
      ${TABS.map(
        (tb) => `<label><input type="checkbox" value="${tb.id}" ${ui.bottomTabs.includes(tb.id) ? "checked" : ""}>
          <ha-icon icon="${tb.icon}" style="--mdc-icon-size:18px"></ha-icon>${t("tab." + tb.id)}</label>`
      ).join("")}
    </div>
    ${chk("ui-bottom-labels", ui.bottomLabels, t("ui.bottom.labels"))}
    <label>${t("ui.topmode")}</label>
    <select id="ui-topmode">
      ${["both", "icons", "labels"].map((m) => `<option value="${m}" ${ui.topMode === m ? "selected" : ""}>${t("ui.topmode." + m)}</option>`).join("")}
    </select>
    ${chk("ui-hidelogo", ui.hideLogo, t("ui.hidelogo"))}
    ${chk("ui-tophide", ui.topHidden, t("ui.tophide"))}
    <label>${t("ui.fab")}</label>
    <select id="ui-fab">
      ${["br", "bl", "tr", "tl"].map((c) => `<option value="${c}" ${ui.fabCorner === c ? "selected" : ""}>${t("ui.fab." + c)}</option>`).join("")}
    </select>
    ${chk("ui-swipe", ui.swipe, t("ui.swipe"))}
    <div class="actions" style="justify-content:flex-end">
      <button class="btn" data-action="ui-save"><ha-icon icon="mdi:content-save-outline"></ha-icon>${t("save")}</button>
    </div>
  </div>`;
}

/* Sklep autora: katalog pobierany automatycznie ze stałego adresu — bez konfiguracji. */
function shopCard(app) {
  const shop = app.data.shop || {};
  const cat = app._shopCatalog;
  const rows = (cat?.items || [])
    .map(
      (p) => `<div class="note-row" style="align-items:center">
        <span class="txt"><b>${esc(p.name)}</b>${p.price ? ` · ${esc(p.price)}` : ""}
          ${p.url ? ` · <a href="${esc(p.url)}" target="_blank" rel="noopener" style="color:var(--rl-green)">${t("shop.link")}</a>` : ""}</span>
      </div>`
    )
    .join("");
  return `<div class="card" style="max-width:780px;margin-top:16px">
    <div class="section-title" style="margin-top:0">${t("shop.title")}</div>
    <p style="font-size:13px;color:var(--secondary-text-color);margin-top:0">${t("shop.hint")}</p>
    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:14px">
      <input type="checkbox" id="shop-websearch" ${shop.websearch ? "checked" : ""}>${t("shop.websearch")}</label>
    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:14px;margin-top:8px">
      <input type="checkbox" id="shop-feedback" ${shop.feedback ? "checked" : ""}>${t("shop.feedback")}</label>
    <div class="actions" style="justify-content:flex-start;margin-top:10px">
      <button class="btn" data-action="shop-save"><ha-icon icon="mdi:content-save-outline"></ha-icon>${t("save")}</button>
      <button class="btn ghost" data-action="shop-catalog"><ha-icon icon="mdi:sync"></ha-icon>${t("shop.refresh")}</button>
    </div>
    ${
      cat
        ? `<div class="section-title">${t("shop.products")} (${cat.items.length})</div>
           <p style="font-size:12px;color:var(--secondary-text-color);margin-top:0;word-break:break-all">${esc(cat.url)}</p>
           ${rows || `<p style="font-size:13px;color:var(--secondary-text-color)">${t("shop.empty")}</p>`}`
        : ""
    }
  </div>`;
}

export function bind(app, root) {
  root.querySelectorAll("[data-prompt-reset]").forEach((el) =>
    el.addEventListener("click", () => {
      const key = el.dataset.promptReset;
      root.querySelector(`textarea[data-prompt="${key}"]`).value =
        (app.data.ai_prompt_defaults || {})[key] || "";
    })
  );
}

async function saveCats(app, cats) {
  try {
    app.data = await app.ws("inventory/categories", { categories: cats });
  } catch (e) {
    app.toast(`⚠ ${e.message || e}`, true);
    return;
  }
  app.render();
  app.toast(t("toast.saved"));
}

export const actions = {
  "inv-cat-add": (app) => {
    const el = app.shadowRoot.getElementById("inv-cat-new");
    const val = (el?.value || "").trim();
    if (!val) return;
    const cats = app.data.inventory_categories || [];
    if (cats.includes(val)) {
      app.toast("⚠ " + val, true);
      return;
    }
    saveCats(app, [...cats, val]);
  },
  "inv-cat-del": async (app, el) => {
    const cats = [...(app.data.inventory_categories || [])];
    const name = cats[parseInt(el.dataset.idx, 10)];
    if (await app.confirm(t("settings.cats.del.confirm", { name }))) {
      cats.splice(parseInt(el.dataset.idx, 10), 1);
      saveCats(app, cats);
    }
  },
  "ui-save": (app) => {
    const root = app.shadowRoot;
    const bottomTabs = [...root.querySelectorAll("#ui-bottom input:checked")].map((el) => el.value);
    saveUiPrefs({
      bottomTabs,
      bottomLabels: root.getElementById("ui-bottom-labels").checked,
      topHidden: root.getElementById("ui-tophide").checked,
      topMode: root.getElementById("ui-topmode").value,
      hideLogo: root.getElementById("ui-hidelogo").checked,
      fabCorner: root.getElementById("ui-fab").value,
      swipe: root.getElementById("ui-swipe").checked,
    });
    app.render();
    app.toast(t("toast.saved"));
  },
  "prompts-save": async (app) => {
    const prompts = {};
    app.shadowRoot
      .querySelectorAll("textarea[data-prompt]")
      .forEach((el) => (prompts[el.dataset.prompt] = el.value));
    try {
      app.data = await app.ws("prompts/save", { prompts });
    } catch (e) {
      app.toast(`⚠ ${e.message || e}`, true);
      return;
    }
    app.render();
    app.toast(t("toast.saved"));
  },
  "shop-save": async (app) => {
    try {
      app.data = await app.ws("shop/save", {
        config: {
          websearch: app.shadowRoot.getElementById("shop-websearch").checked,
          feedback: app.shadowRoot.getElementById("shop-feedback").checked,
        },
      });
    } catch (e) {
      app.toast(`⚠ ${e.message || e}`, true);
      return;
    }
    app.render();
    app.toast(t("toast.saved"));
  },
  "shop-catalog": async (app, el) => {
    el.disabled = true;
    try {
      app._shopCatalog = await app.ws("shop/catalog");
    } catch (e) {
      app.toast(`⚠ ${e.message || e}`, true);
      el.disabled = false;
      return;
    }
    app.render();
    app.toast(t("shop.synced", { n: app._shopCatalog.items.length }));
  },
};
