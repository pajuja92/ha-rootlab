import { t } from "../i18n.js";
import { esc } from "../util.js";

const PROMPT_KEYS = ["system", "tasks", "diagnose", "ask", "season"];
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
  ${shopCard(app)}`;
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

export const actions = {
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
        config: { websearch: app.shadowRoot.getElementById("shop-websearch").checked },
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
