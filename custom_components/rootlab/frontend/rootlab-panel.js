/* RootLab — custom panel Home Assistant.
   ponytail: vanilla Web Component bez bundlera; gdy dojdzie edytor 2D, przejdziemy na lit + rollup. */

const TABS = [
  { id: "dashboard", label: "Pulpit", icon: "mdi:view-dashboard-outline" },
  { id: "plants", label: "Rośliny", icon: "mdi:sprout" },
  { id: "tasks", label: "Zadania", icon: "mdi:clipboard-check-outline" },
  { id: "water", label: "Woda", icon: "mdi:water" },
];

const SENSOR_FIELDS = [
  { key: "soil", label: "Wilgotność gleby", icon: "mdi:water-percent" },
  { key: "temp", label: "Temperatura", icon: "mdi:thermometer" },
  { key: "hum", label: "Wilgotność powietrza", icon: "mdi:cloud-percent-outline" },
];

const CSS = `
:host {
  --rl-green:   #3B7D3F;
  --rl-soil:    #7A5C43;
  --rl-water:   #0277BD;
  --rl-harvest: #A66300;
  --rl-ai:      #6A4FA3;
  --rl-crisis:  #C62828;
  --rl-green-bg:  color-mix(in srgb, var(--rl-green) 12%, transparent);
  --rl-water-bg:  color-mix(in srgb, var(--rl-water) 12%, transparent);
  --rl-ai-bg:     color-mix(in srgb, var(--rl-ai) 10%, transparent);
  --rl-crisis-bg: color-mix(in srgb, var(--rl-crisis) 12%, transparent);
  --rl-radius: var(--ha-card-border-radius, 12px);
  --rl-gap: 16px;
  display: block;
  height: 100%;
  overflow-y: auto;
  background: var(--primary-background-color);
  color: var(--primary-text-color);
  font-family: var(--paper-font-body1_-_font-family, Roboto, sans-serif);
}
:host([dark]) {
  --rl-green:   #8BC98F;
  --rl-soil:    #B99C82;
  --rl-water:   #5BC4F0;
  --rl-harvest: #F0B860;
  --rl-ai:      #B9A6E3;
  --rl-crisis:  #EF8A80;
}
.appbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
  height: 56px;
  background: var(--app-header-background-color, var(--primary-color));
  color: var(--app-header-text-color, #fff);
  position: sticky;
  top: 0;
  z-index: 10;
}
.appbar .title { font-size: 20px; margin: 0 12px 0 4px; white-space: nowrap; }
.appbar .title b { font-weight: 600; }
.tabs { display: flex; gap: 2px; overflow-x: auto; scrollbar-width: none; }
.tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: inherit;
  opacity: 0.75;
  font: inherit;
  font-size: 14px;
  cursor: pointer;
  white-space: nowrap;
}
.tab[data-active] {
  opacity: 1;
  background: color-mix(in srgb, currentColor 15%, transparent);
  font-weight: 500;
}
.tab ha-icon { --mdc-icon-size: 18px; }
.content { max-width: 1400px; margin: 0 auto; padding: var(--rl-gap); }
.section-title {
  font-size: 12px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: var(--secondary-text-color);
  margin: 24px 0 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.section-title:first-child { margin-top: 0; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: var(--rl-gap); }
.card {
  position: relative;
  background: var(--card-background-color);
  border: 1px solid var(--divider-color);
  border-radius: var(--rl-radius);
  padding: var(--rl-gap);
  overflow: hidden;
}
.card.plant::before {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  background: var(--rl-green);
}
.card .header { display: flex; align-items: center; gap: 8px; }
.card .header h3 { margin: 0; font-size: 16px; font-weight: 500; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.card .species { font-size: 13px; color: var(--secondary-text-color); margin: 2px 0 0 32px; }
.emoji { font-size: 22px; line-height: 1; }
.chip {
  font-size: 12px;
  padding: 2px 10px;
  border-radius: 999px;
  background: var(--rl-green-bg);
  color: var(--rl-green);
  white-space: nowrap;
}
.sensors { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
.sensor-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--rl-water-bg);
  color: var(--primary-text-color);
  font-size: 13px;
  cursor: pointer;
  border: none;
  font-family: inherit;
}
.sensor-chip ha-icon { --mdc-icon-size: 16px; color: var(--rl-water); }
.sensor-chip.unavailable {
  background: transparent;
  border: 1px dashed var(--divider-color);
  color: var(--secondary-text-color);
}
.sensor-chip.unavailable ha-icon { color: var(--secondary-text-color); }
.ai-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 8px 12px;
  border-left: 3px solid var(--rl-ai);
  border-radius: 4px;
  background: var(--rl-ai-bg);
  color: var(--secondary-text-color);
  font-size: 13px;
}
.ai-hint ha-icon { color: var(--rl-ai); --mdc-icon-size: 16px; flex-shrink: 0; }
.actions { display: flex; justify-content: flex-end; gap: 4px; margin-top: 12px; }
.icon-btn {
  border: none;
  background: transparent;
  color: var(--secondary-text-color);
  cursor: pointer;
  padding: 6px;
  border-radius: 50%;
  display: inline-flex;
}
.icon-btn:hover { background: color-mix(in srgb, currentColor 10%, transparent); }
.icon-btn ha-icon { --mdc-icon-size: 18px; }
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 999px;
  border: none;
  background: var(--rl-green);
  color: #fff;
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}
:host([dark]) .btn { color: #1A1A1A; }
.btn.ghost { background: transparent; border: 1px dashed var(--divider-color); color: var(--secondary-text-color); font-weight: 400; }
.btn ha-icon { --mdc-icon-size: 18px; }
.toolbar { display: flex; gap: 8px; justify-content: flex-end; margin-bottom: var(--rl-gap); flex-wrap: wrap; }
.empty {
  text-align: center;
  padding: 48px 16px;
  color: var(--secondary-text-color);
}
.empty ha-icon { --mdc-icon-size: 48px; color: var(--rl-green); }
.empty p { max-width: 420px; margin: 12px auto 20px; }
.zone-stat { display: flex; align-items: baseline; gap: 8px; margin-top: 8px; }
.zone-stat .num { font-size: 28px; font-weight: 300; color: var(--rl-green); }
.zone-stat .lbl { font-size: 13px; color: var(--secondary-text-color); }
dialog {
  border: none;
  border-radius: var(--rl-radius);
  background: var(--card-background-color);
  color: var(--primary-text-color);
  padding: 24px;
  width: min(440px, calc(100vw - 32px));
  box-sizing: border-box;
}
dialog::backdrop { background: rgba(0, 0, 0, 0.4); }
dialog h2 { margin: 0 0 16px; font-size: 18px; font-weight: 500; }
dialog label { display: block; font-size: 13px; color: var(--secondary-text-color); margin: 12px 0 4px; }
dialog input, dialog select {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid var(--divider-color);
  border-radius: 8px;
  background: var(--primary-background-color);
  color: var(--primary-text-color);
  font: inherit;
  font-size: 14px;
}
dialog input:focus, dialog select:focus { outline: 2px solid var(--rl-green); border-color: transparent; }
dialog .dialog-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 24px; }
dialog .btn.plain { background: transparent; color: var(--primary-text-color); font-weight: 400; }
@media (max-width: 600px) {
  :host { --rl-gap: 12px; }
  .appbar .title span { display: none; }
}
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
`;

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

class RootlabPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._tab = "dashboard";
    this._data = null;
    this._loading = false;
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    this.toggleAttribute("dark", Boolean(hass.themes?.darkMode));
    if (first) this._load();
    else this._refreshSensorChips();
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

  async _load() {
    if (this._loading) return;
    this._loading = true;
    try {
      this._data = await this._hass.callWS({ type: "rootlab/data" });
    } catch (e) {
      this._data = { zones: [], plants: [], _error: e.message || String(e) };
    }
    this._loading = false;
    this._render();
  }

  async _save(kind, item) {
    this._data = await this._hass.callWS({ type: "rootlab/item/save", kind, item });
    this._render();
  }

  async _delete(kind, itemId) {
    this._data = await this._hass.callWS({ type: "rootlab/item/delete", kind, item_id: itemId });
    this._render();
  }

  /* ---------- rendering ---------- */

  _render() {
    if (!this._data) return;
    const views = {
      dashboard: () => this._viewDashboard(),
      plants: () => this._viewPlants(),
      tasks: () => this._viewComingSoon("mdi:clipboard-check-outline", "Centrum zadań pojawi się wkrótce", "AI ułoży tu listę prac: utrzymanie, zabezpieczenie i sytuacje kryzysowe. Na razie skataloguj rośliny — to na ich podstawie powstaną zadania."),
      water: () => this._viewComingSoon("mdi:water", "Panel nawadniania pojawi się wkrótce", "Zobaczysz tu harmonogram podlewania wszystkich stref i zmienisz go jednym dotknięciem."),
    };
    this.shadowRoot.innerHTML = `
      <style>${CSS}</style>
      <div class="appbar">
        <ha-menu-button></ha-menu-button>
        <h1 class="title">🌱 <b>Root</b><span>Lab</span></h1>
        <nav class="tabs">
          ${TABS.map(
            (t) => `<button class="tab" data-tab="${t.id}" ${t.id === this._tab ? "data-active" : ""}>
                      <ha-icon icon="${t.icon}"></ha-icon>${t.label}</button>`
          ).join("")}
        </nav>
      </div>
      <div class="content">${views[this._tab]()}</div>
      <dialog id="form-dialog"></dialog>
    `;
    const menu = this.shadowRoot.querySelector("ha-menu-button");
    menu.hass = this._hass;
    menu.narrow = this._narrow;
    this.shadowRoot.querySelectorAll(".tab").forEach((el) =>
      el.addEventListener("click", () => {
        this._tab = el.dataset.tab;
        this._render();
      })
    );
    this.shadowRoot.querySelectorAll("[data-action]").forEach((el) => el.addEventListener("click", (ev) => this._onAction(ev)));
    this.shadowRoot.querySelectorAll(".sensor-chip[data-entity]").forEach((el) =>
      el.addEventListener("click", () => {
        this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: el.dataset.entity }, bubbles: true, composed: true }));
      })
    );
  }

  _viewDashboard() {
    const { zones, plants, _error } = this._data;
    if (_error) return `<div class="empty"><ha-icon icon="mdi:leaf-off"></ha-icon><p>Nie udało się wczytać danych: ${esc(_error)}</p></div>`;
    if (!zones.length && !plants.length) {
      return `<div class="empty">
        <ha-icon icon="mdi:sprout"></ha-icon>
        <p>Witaj w RootLab. Zacznij od dodania pierwszej strefy — szklarni, grządek albo ogrodu — a potem zasiedl ją roślinami.</p>
        <button class="btn" data-action="add-zone"><ha-icon icon="mdi:plus"></ha-icon>Dodaj strefę</button>
      </div>`;
    }
    return `
      <div class="section-title"><ha-icon icon="mdi:map-outline"></ha-icon>Strefy</div>
      <div class="grid">
        ${zones
          .map((z) => {
            const count = plants.filter((p) => p.zone_id === z.id).length;
            return `<div class="card">
              <div class="header"><span class="emoji">${esc(z.emoji || "🪴")}</span><h3>${esc(z.name)}</h3></div>
              <div class="zone-stat"><span class="num">${count}</span><span class="lbl">${count === 1 ? "roślina" : "roślin(y)"}</span></div>
            </div>`;
          })
          .join("")}
      </div>
      <div class="section-title"><ha-icon icon="mdi:weather-partly-cloudy"></ha-icon>Pogoda</div>
      <div class="card">
        <div class="ai-hint"><ha-icon icon="mdi:creation"></ha-icon>Prognoza IMGW dołączy w jednym z kolejnych wydań beta — wtedy podpowiem, kiedy odpuścić podlewanie.</div>
      </div>`;
  }

  _viewPlants() {
    const { zones, plants } = this._data;
    const toolbar = `<div class="toolbar">
      <button class="btn ghost" data-action="add-zone"><ha-icon icon="mdi:plus"></ha-icon>Strefa</button>
      <button class="btn" data-action="add-plant"><ha-icon icon="mdi:plus"></ha-icon>Roślina</button>
    </div>`;
    if (!plants.length) {
      return `${toolbar}<div class="empty">
        <ha-icon icon="mdi:sprout"></ha-icon>
        <p>${zones.length ? "Strefy czekają na pierwsze rośliny. Dodaj pomidora, bazylię albo jabłonkę — od czegoś trzeba zacząć." : "Najpierw dodaj strefę, potem zasiedl ją roślinami."}</p>
      </div>`;
    }
    const groups = [...zones.map((z) => ({ zone: z, plants: plants.filter((p) => p.zone_id === z.id) }))];
    const orphans = plants.filter((p) => !p.zone_id || !zones.some((z) => z.id === p.zone_id));
    if (orphans.length) groups.push({ zone: { id: null, name: "Bez strefy", emoji: "🏷️" }, plants: orphans });
    return (
      toolbar +
      groups
        .filter((g) => g.plants.length)
        .map(
          (g) => `
        <div class="section-title"><span class="emoji">${esc(g.zone.emoji || "🪴")}</span>${esc(g.zone.name)}
          ${g.zone.id ? `<button class="icon-btn" data-action="edit-zone" data-id="${g.zone.id}" title="Edytuj strefę"><ha-icon icon="mdi:pencil-outline"></ha-icon></button>
          <button class="icon-btn" data-action="delete-zone" data-id="${g.zone.id}" title="Usuń strefę"><ha-icon icon="mdi:trash-can-outline"></ha-icon></button>` : ""}
        </div>
        <div class="grid">${g.plants.map((p) => this._plantCard(p)).join("")}</div>`
        )
        .join("")
    );
  }

  _plantCard(p) {
    const sensors = SENSOR_FIELDS.filter((f) => p.sensors?.[f.key]).map((f) => {
      const entityId = p.sensors[f.key];
      const st = this._hass.states[entityId];
      const unavailable = !st || st.state === "unavailable" || st.state === "unknown";
      const val = unavailable ? "—" : `${st.state}${st.attributes.unit_of_measurement ? " " + st.attributes.unit_of_measurement : ""}`;
      return `<button class="sensor-chip ${unavailable ? "unavailable" : ""}" data-entity="${esc(entityId)}" title="${esc(f.label)}">
        <ha-icon icon="${f.icon}"></ha-icon><span class="val">${esc(val)}</span></button>`;
    });
    return `<div class="card plant">
      <div class="header"><span class="emoji">${esc(p.emoji || "🌱")}</span><h3>${esc(p.name)}</h3></div>
      ${p.species ? `<div class="species">${esc(p.species)}</div>` : ""}
      ${sensors.length ? `<div class="sensors">${sensors.join("")}</div>` : `<div class="sensors"><button class="btn ghost" data-action="edit-plant" data-id="${p.id}"><ha-icon icon="mdi:link-variant"></ha-icon>Połącz czujniki</button></div>`}
      <div class="actions">
        <button class="icon-btn" data-action="edit-plant" data-id="${p.id}" title="Edytuj"><ha-icon icon="mdi:pencil-outline"></ha-icon></button>
        <button class="icon-btn" data-action="delete-plant" data-id="${p.id}" title="Usuń"><ha-icon icon="mdi:trash-can-outline"></ha-icon></button>
      </div>
    </div>`;
  }

  _viewComingSoon(icon, title, text) {
    return `<div class="empty"><ha-icon icon="${icon}"></ha-icon><h3>${esc(title)}</h3><p>${esc(text)}</p></div>`;
  }

  /* Aktualizacja wartości czujników bez pełnego re-renderu (hass przychodzi często). */
  _refreshSensorChips() {
    this.shadowRoot.querySelectorAll(".sensor-chip[data-entity]").forEach((el) => {
      const st = this._hass.states[el.dataset.entity];
      const unavailable = !st || st.state === "unavailable" || st.state === "unknown";
      el.classList.toggle("unavailable", unavailable);
      el.querySelector(".val").textContent = unavailable
        ? "—"
        : `${st.state}${st.attributes.unit_of_measurement ? " " + st.attributes.unit_of_measurement : ""}`;
    });
  }

  /* ---------- akcje i formularze ---------- */

  _onAction(ev) {
    const el = ev.currentTarget;
    const { action, id } = el.dataset;
    const zone = id ? this._data.zones.find((z) => z.id === id) : null;
    const plant = id ? this._data.plants.find((p) => p.id === id) : null;
    if (action === "add-zone") this._zoneDialog();
    else if (action === "edit-zone") this._zoneDialog(zone);
    else if (action === "delete-zone") {
      if (confirm(`Usunąć strefę „${zone.name}"? Rośliny zostaną, trafią do „Bez strefy".`)) this._delete("zones", id);
    } else if (action === "add-plant") this._plantDialog();
    else if (action === "edit-plant") this._plantDialog(plant);
    else if (action === "delete-plant") {
      if (confirm(`Usunąć roślinę „${plant.name}"?`)) this._delete("plants", id);
    }
  }

  _openDialog(html, onSubmit) {
    const dlg = this.shadowRoot.getElementById("form-dialog");
    dlg.innerHTML = html;
    dlg.querySelector("form").addEventListener("submit", (ev) => {
      ev.preventDefault();
      onSubmit(new FormData(ev.target));
      dlg.close();
    });
    dlg.querySelector("[data-cancel]").addEventListener("click", () => dlg.close());
    dlg.showModal();
  }

  _zoneDialog(zone) {
    this._openDialog(
      `<h2>${zone ? "Edytuj strefę" : "Nowa strefa"}</h2>
      <form>
        <label>Nazwa</label>
        <input name="name" required maxlength="60" value="${esc(zone?.name)}" placeholder="np. Szklarnia" autofocus>
        <label>Emoji (opcjonalnie)</label>
        <input name="emoji" maxlength="4" value="${esc(zone?.emoji)}" placeholder="🏡">
        <div class="dialog-actions">
          <button type="button" class="btn plain" data-cancel>Anuluj</button>
          <button type="submit" class="btn">Zapisz</button>
        </div>
      </form>`,
      (fd) =>
        this._save("zones", {
          id: zone?.id ?? null,
          name: fd.get("name").trim(),
          emoji: fd.get("emoji").trim(),
        })
    );
  }

  _sensorOptions(selected) {
    const opts = Object.values(this._hass.states)
      .filter((s) => s.entity_id.startsWith("sensor."))
      .sort((a, b) => (a.attributes.friendly_name || a.entity_id).localeCompare(b.attributes.friendly_name || b.entity_id))
      .map(
        (s) =>
          `<option value="${esc(s.entity_id)}" ${s.entity_id === selected ? "selected" : ""}>${esc(s.attributes.friendly_name || s.entity_id)}</option>`
      );
    return `<option value="">— brak —</option>${opts.join("")}`;
  }

  _plantDialog(plant) {
    const zoneOpts = this._data.zones
      .map((z) => `<option value="${z.id}" ${plant?.zone_id === z.id ? "selected" : ""}>${esc(z.name)}</option>`)
      .join("");
    this._openDialog(
      `<h2>${plant ? "Edytuj roślinę" : "Nowa roślina"}</h2>
      <form>
        <label>Nazwa</label>
        <input name="name" required maxlength="60" value="${esc(plant?.name)}" placeholder="np. Pomidor malinowy" autofocus>
        <label>Gatunek / odmiana (opcjonalnie)</label>
        <input name="species" maxlength="80" value="${esc(plant?.species)}" placeholder="np. Solanum lycopersicum">
        <label>Emoji (opcjonalnie)</label>
        <input name="emoji" maxlength="4" value="${esc(plant?.emoji)}" placeholder="🍅">
        <label>Strefa</label>
        <select name="zone_id"><option value="">— bez strefy —</option>${zoneOpts}</select>
        ${SENSOR_FIELDS.map(
          (f) => `<label>${f.label} (encja)</label><select name="sensor_${f.key}">${this._sensorOptions(plant?.sensors?.[f.key])}</select>`
        ).join("")}
        <div class="dialog-actions">
          <button type="button" class="btn plain" data-cancel>Anuluj</button>
          <button type="submit" class="btn">Zapisz</button>
        </div>
      </form>`,
      (fd) =>
        this._save("plants", {
          id: plant?.id ?? null,
          name: fd.get("name").trim(),
          species: fd.get("species").trim(),
          emoji: fd.get("emoji").trim(),
          zone_id: fd.get("zone_id") || null,
          sensors: Object.fromEntries(SENSOR_FIELDS.map((f) => [f.key, fd.get(`sensor_${f.key}`) || null])),
        })
    );
  }
}

customElements.define("rootlab-panel", RootlabPanel);
