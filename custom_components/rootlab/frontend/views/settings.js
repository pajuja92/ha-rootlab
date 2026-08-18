import { t } from "../i18n.js";
import { esc } from "../util.js";

const IN_STYLE =
  "width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid var(--divider-color);border-radius:8px;background:var(--primary-background-color);color:var(--primary-text-color);font:inherit";

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

/* Sklep: katalog produktów polecanych przez AI + synchronizacja z WooCommerce. */
function shopCard(app) {
  const shop = app.data.shop || {};
  const products = app.data.products || [];
  const rows = products
    .map(
      (p) => `<div class="note-row" style="align-items:center">
        <span class="txt"><b>${esc(p.name)}</b>${p.price ? ` · ${esc(p.price)}` : ""}
          ${p.url ? ` · <a href="${esc(p.url)}" target="_blank" rel="noopener" style="color:var(--rl-green)">${t("shop.link")}</a>` : ""}
          ${p.source === "woo" ? ` <span class="chip" style="font-size:11px;padding:1px 8px">WooCommerce</span>` : ""}</span>
        <button class="icon-btn" data-prod-del="${p.id}" title="${t("delete")}"><ha-icon icon="mdi:trash-can-outline" style="--mdc-icon-size:16px"></ha-icon></button>
      </div>`
    )
    .join("");
  return `<div class="card" style="max-width:780px;margin-top:16px">
    <div class="section-title" style="margin-top:0">${t("shop.title")}</div>
    <p style="font-size:13px;color:var(--secondary-text-color);margin-top:0">${t("shop.hint")}</p>
    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:14px">
      <input type="checkbox" id="shop-websearch" ${shop.websearch ? "checked" : ""}>${t("shop.websearch")}</label>
    <label>${t("shop.woo.url")}</label>
    <input id="shop-url" placeholder="https://mojsklep.pl" value="${esc(shop.woo_url)}" style="${IN_STYLE}">
    <div style="display:flex;gap:10px;margin-top:8px">
      <span style="flex:1"><label>${t("shop.woo.key")}</label>
      <input id="shop-key" placeholder="ck_…" value="${esc(shop.woo_key)}" style="${IN_STYLE}"></span>
      <span style="flex:1"><label>${t("shop.woo.secret")}</label>
      <input id="shop-secret" type="password" placeholder="cs_…" value="${esc(shop.woo_secret)}" style="${IN_STYLE}"></span>
    </div>
    <div class="actions" style="justify-content:flex-start;margin-top:10px">
      <button class="btn" data-action="shop-save"><ha-icon icon="mdi:content-save-outline"></ha-icon>${t("save")}</button>
      <button class="btn ghost" data-action="shop-sync"><ha-icon icon="mdi:sync"></ha-icon>${t("shop.sync")}</button>
    </div>
    <div class="section-title">${t("shop.products")} (${products.length})</div>
    ${rows || `<p style="font-size:13px;color:var(--secondary-text-color)">${t("shop.empty")}</p>`}
    <div style="display:flex;gap:8px;margin-top:10px;align-items:flex-end;flex-wrap:wrap">
      <span style="flex:2;min-width:140px"><label>${t("name")}</label><input id="prod-name" style="${IN_STYLE}"></span>
      <span style="flex:1;min-width:80px"><label>${t("shop.price")}</label><input id="prod-price" placeholder="29 zł" style="${IN_STYLE}"></span>
      <span style="flex:3;min-width:180px"><label>URL</label><input id="prod-url" placeholder="https://…" style="${IN_STYLE}"></span>
      <button class="btn small" data-action="prod-add"><ha-icon icon="mdi:plus"></ha-icon>${t("add")}</button>
    </div>
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
  root.querySelectorAll("[data-prod-del]").forEach((el) =>
    el.addEventListener("click", () => {
      if (confirm(t("hist.delete.confirm"))) app.deleteItem("products", el.dataset.prodDel);
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
    const $ = (id) => app.shadowRoot.getElementById(id);
    try {
      app.data = await app.ws("shop/save", {
        config: {
          websearch: $("shop-websearch").checked,
          woo_url: $("shop-url").value.trim(),
          woo_key: $("shop-key").value.trim(),
          woo_secret: $("shop-secret").value.trim(),
        },
      });
    } catch (e) {
      app.toast(`⚠ ${e.message || e}`, true);
      return;
    }
    app.render();
    app.toast(t("toast.saved"));
  },
  "shop-sync": async (app, el) => {
    el.disabled = true;
    try {
      const res = await app.ws("shop/sync");
      app.data = res.data;
      app.render();
      app.toast(t("shop.synced", { n: res.count }));
    } catch (e) {
      app.toast(`⚠ ${e.message || e}`, true);
      el.disabled = false;
    }
  },
  "prod-add": async (app) => {
    const $ = (id) => app.shadowRoot.getElementById(id);
    const name = $("prod-name").value.trim();
    if (!name) return;
    await app.saveItem("products", {
      id: null,
      name,
      price: $("prod-price").value.trim(),
      url: $("prod-url").value.trim(),
      source: "manual",
    });
  },
};
