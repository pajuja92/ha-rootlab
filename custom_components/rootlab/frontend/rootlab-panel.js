/* RootLab — custom panel Home Assistant.
   ponytail: vanilla Web Components + moduły ES, bez bundlera. */
import { CSS } from "./styles.js";
import { t, setLang } from "./i18n.js";
import { wireCombos } from "./util.js";
import * as crisis from "./crisis.js";
import * as dashboard from "./views/dashboard.js";
import * as editor from "./views/editor.js";
import * as knowledge from "./views/knowledge.js";
import * as plants from "./views/plants.js";
import * as tasks from "./views/tasks.js";
import * as water from "./views/water.js";

const VIEWS = { dashboard, plants, tasks, water, knowledge, editor };
const ACTIONS = Object.assign(
  {},
  dashboard.actions,
  plants.actions,
  tasks.actions,
  water.actions,
  knowledge.actions,
  editor.actions,
  crisis.actions
);
const TABS = [
  { id: "dashboard", icon: "mdi:view-dashboard-outline" },
  { id: "plants", icon: "mdi:sprout" },
  { id: "tasks", icon: "mdi:clipboard-check-outline" },
  { id: "water", icon: "mdi:water" },
  { id: "knowledge", icon: "mdi:book-open-variant" },
  { id: "editor", icon: "mdi:vector-square" },
];

class RootlabPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.tab = "dashboard";
    this.data = null;
    this.weather = null;
    this.forecast = undefined;
    this._pendingReload = false;
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    setLang(hass.language);
    this.toggleAttribute("dark", Boolean(hass.themes?.darkMode));
    if (first) {
      this._load();
      this._subscribe();
    } else {
      this._live();
    }
    const menu = this.shadowRoot.querySelector("ha-menu-button");
    if (menu) menu.hass = hass;
  }
  get hass() {
    return this._hass;
  }
  set narrow(narrow) {
    this._narrow = narrow;
    const menu = this.shadowRoot.querySelector("ha-menu-button");
    if (menu) menu.narrow = narrow;
  }

  fire(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }

  async ws(type, payload = {}) {
    return this._hass.callWS({ type: `rootlab/${type}`, ...payload });
  }

  async _subscribe() {
    // backend emituje rootlab_updated po każdej zmianie danych (scheduler, inny klient…)
    try {
      this._unsubEvents = await this._hass.connection.subscribeEvents(() => {
        clearTimeout(this._reloadTimer);
        this._reloadTimer = setTimeout(() => this.reload(), 400);
      }, "rootlab_updated");
    } catch (e) {
      // brak subskrypcji = brak live-refresh, reszta działa
    }
  }

  async _load() {
    try {
      this.data = await this.ws("data");
    } catch (e) {
      this.data = {
        zones: [], plants: [], tasks: [], knowledge: [],
        irrigation: { sections: [], one_offs: [] },
        layout: { items: [] }, crisis_history: [], active: {}, settings: {},
        _error: e.message || String(e),
      };
    }
    this.render();
    try {
      this.weather = await this.ws("weather");
    } catch (e) {
      this.weather = null;
    }
    try {
      this.forecast = await this.ws("forecast");
    } catch (e) {
      this.forecast = null;
    }
    this.render();
  }

  async saveItem(kind, item) {
    this.data = await this.ws("item/save", { kind, item });
    this.render();
  }
  async deleteItem(kind, item_id) {
    this.data = await this.ws("item/delete", { kind, item_id });
    this.render();
  }
  async reload() {
    if (this._dialogOpen()) {
      this._pendingReload = true;
      return;
    }
    try {
      this.data = await this.ws("data");
    } catch (e) {
      return;
    }
    this.render();
  }

  _dialogOpen() {
    return Boolean(this.shadowRoot.querySelector("dialog[open]"));
  }

  render() {
    if (!this.data) return;
    if (this._dialogOpen()) {
      this._pendingReload = true;
      return; // nie wyrywaj formularza spod rąk
    }
    this.shadowRoot.innerHTML = `
      <style>${CSS}</style>
      <div class="appbar">
        <ha-menu-button></ha-menu-button>
        <h1 class="title">🌱 <b>Root</b><span>Lab</span></h1>
        <nav class="tabs">
          ${TABS.map(
            (tb) => `<button class="tab" data-tab="${tb.id}" ${tb.id === this.tab ? "data-active" : ""}>
              <ha-icon icon="${tb.icon}"></ha-icon>${t(`tab.${tb.id}`)}</button>`
          ).join("")}
        </nav>
      </div>
      <div class="content">${VIEWS[this.tab].render(this)}</div>
      ${crisis.renderFab(this)}
      <dialog id="form-dialog"></dialog>
    `;
    const menu = this.shadowRoot.querySelector("ha-menu-button");
    menu.hass = this._hass;
    menu.narrow = this._narrow;
    this.shadowRoot.querySelectorAll(".tab").forEach((el) =>
      el.addEventListener("click", () => {
        this.tab = el.dataset.tab;
        this.render();
      })
    );
    this.shadowRoot.querySelectorAll("[data-action]").forEach((el) =>
      el.addEventListener("click", (ev) => {
        const handler = ACTIONS[el.dataset.action];
        if (handler) {
          ev.stopPropagation();
          handler(this, el, ev);
        }
      })
    );
    const dlg = this.shadowRoot.getElementById("form-dialog");
    dlg.addEventListener("click", (ev) => {
      if (ev.target === dlg) dlg.close(); // klik w tło zamyka
    });
    dlg.addEventListener("close", () => {
      dlg.classList.remove("wide");
      crisis.onDialogClose?.(this);
      if (this._pendingReload) {
        this._pendingReload = false;
        this.reload();
      }
    });
    VIEWS[this.tab].bind?.(this, this.shadowRoot);
    this._tickCountdowns();
  }

  /* Dialog pomocniczy: html + onSubmit; zamykanie: backdrop / Escape / X / Anuluj. */
  dialog(html, onSubmit, { wide = false } = {}) {
    const dlg = this.shadowRoot.getElementById("form-dialog");
    dlg.classList.toggle("wide", wide);
    dlg.innerHTML = `<button class="dialog-x" title="${t("close")}"><ha-icon icon="mdi:close"></ha-icon></button>` + html;
    dlg.querySelector(".dialog-x").addEventListener("click", () => dlg.close());
    dlg.querySelector("form")?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      dlg.close();
      onSubmit(new FormData(ev.target));
    });
    dlg.querySelector("[data-cancel]")?.addEventListener("click", () => dlg.close());
    dlg.querySelectorAll("[data-action]").forEach((el) =>
      el.addEventListener("click", () => ACTIONS[el.dataset.action]?.(this, el))
    );
    wireCombos(dlg);
    if (!dlg.open) dlg.showModal();
    return dlg;
  }

  /* Odświeżanie wartości live bez pełnego re-renderu (hass przychodzi bardzo często). */
  _live() {
    this.shadowRoot.querySelectorAll(".sensor-chip[data-entity]").forEach((el) => {
      const st = this._hass.states[el.dataset.entity];
      const unavailable = !st || st.state === "unavailable" || st.state === "unknown";
      el.classList.toggle("unavailable", unavailable);
      const val = el.querySelector(".val");
      if (val)
        val.textContent = unavailable
          ? "—"
          : `${st.state}${st.attributes.unit_of_measurement ? " " + st.attributes.unit_of_measurement : ""}`;
    });
  }

  _tickCountdowns() {
    clearInterval(this._cdTimer);
    const nodes = this.shadowRoot.querySelectorAll(".countdown[data-end]");
    if (!nodes.length) return;
    const update = () => {
      let anyLeft = false;
      this.shadowRoot.querySelectorAll(".countdown[data-end]").forEach((el) => {
        const left = Math.max(0, Math.round((new Date(el.dataset.end) - Date.now()) / 1000));
        el.textContent = `≈ ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
        if (left > 0) anyLeft = true;
      });
      if (!anyLeft) {
        clearInterval(this._cdTimer);
        this.reload();
      }
    };
    update();
    this._cdTimer = setInterval(update, 1000);
  }

  disconnectedCallback() {
    clearInterval(this._cdTimer);
    clearTimeout(this._reloadTimer);
    this._unsubEvents?.();
  }
}

customElements.define("rootlab-panel", RootlabPanel);
