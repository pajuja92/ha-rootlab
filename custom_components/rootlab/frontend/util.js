import { t } from "./i18n.js";

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const uid = () => (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "") : String(Math.random()).slice(2));

/* Opcje encji dla comboboxa: [{value, label, secondary}] */
export const entityOptions = (hass, domains) =>
  Object.values(hass.states)
    .filter((s) => domains.some((d) => s.entity_id.startsWith(d + ".")))
    .map((s) => ({
      value: s.entity_id,
      label: s.attributes.friendly_name || s.entity_id,
      secondary: s.entity_id,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

/* Combobox z wyszukiwaniem — zamiennik <select>, opcje z drugą linią jak natywnie w HA.
   Użycie: combo({name, value, options, allowEmpty}) w html dialogu + wireCombos(dialogEl). */
export function combo({ name, value = "", options, allowEmpty = true, placeholder }) {
  const selected = options.find((o) => o.value === value);
  return `<div class="combo" data-combo="${esc(name)}" data-allow-empty="${allowEmpty ? "1" : ""}">
    <input type="hidden" name="${esc(name)}" value="${esc(value)}">
    <input type="text" class="combo-input" autocomplete="off" spellcheck="false"
      placeholder="${esc(placeholder || t("combo.ph"))}" value="${esc(selected?.label ?? "")}">
    <ha-icon class="combo-caret" icon="mdi:menu-down"></ha-icon>
    <div class="combo-list" hidden></div>
    <script type="application/json" class="combo-data">${JSON.stringify(options).replace(/</g, "\\u003c")}</script>
  </div>`;
}

export function wireCombos(root) {
  root.querySelectorAll(".combo").forEach((el) => {
    const hidden = el.querySelector("input[type=hidden]");
    const input = el.querySelector(".combo-input");
    const list = el.querySelector(".combo-list");
    const options = JSON.parse(el.querySelector(".combo-data").textContent);
    const allowEmpty = !!el.dataset.allowEmpty;

    const renderList = (filter) => {
      const f = (filter || "").toLowerCase();
      const matched = options.filter(
        (o) => !f || o.label.toLowerCase().includes(f) || (o.secondary || "").toLowerCase().includes(f)
      );
      list.innerHTML =
        (allowEmpty ? `<div class="combo-opt" data-value=""><span>${t("none")}</span></div>` : "") +
        (matched.length
          ? matched
              .slice(0, 60)
              .map(
                (o) => `<div class="combo-opt ${o.value === hidden.value ? "selected" : ""}" data-value="${esc(o.value)}">
                  <span>${esc(o.label)}</span>${o.secondary ? `<small>${esc(o.secondary)}</small>` : ""}</div>`
              )
              .join("")
          : `<div class="combo-empty">${t("combo.noresults")}</div>`);
      list.hidden = false;
    };

    input.addEventListener("focus", () => {
      input.select();
      renderList("");
    });
    input.addEventListener("input", () => renderList(input.value));
    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") {
        list.hidden = true;
        ev.stopPropagation();
      }
      if (ev.key === "Enter") {
        ev.preventDefault();
        const first = list.querySelector(".combo-opt[data-value]:not([data-value=''])") || list.querySelector(".combo-opt");
        if (first && !list.hidden) first.dispatchEvent(new Event("mousedown"));
      }
    });
    input.addEventListener("blur", () => {
      setTimeout(() => {
        list.hidden = true;
        const selected = options.find((o) => o.value === hidden.value);
        input.value = selected?.label ?? "";
      }, 150);
    });
    list.addEventListener("mousedown", (ev) => {
      const opt = ev.target.closest(".combo-opt");
      if (!opt) return;
      ev.preventDefault();
      hidden.value = opt.dataset.value;
      const selected = options.find((o) => o.value === opt.dataset.value);
      input.value = selected?.label ?? "";
      list.hidden = true;
      hidden.dispatchEvent(new Event("change", { bubbles: true }));
    });
  });
}

/* Zdjęcie → miniatura JPEG (base64) — wspólne dla kryzysu i galerii roślin. */
export async function resizeImage(file, max = 1024) {
  const url = URL.createObjectURL(file);
  const image = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = url;
  });
  const scale = Math.min(1, max / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(url);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return { preview: dataUrl, media: "image/jpeg", data: dataUrl.split(",")[1] };
}

/* --- Urządzenia: rejestr HA + sugestie encji per strefa --- */

export const haDeviceOptions = (hass) =>
  Object.values(hass.devices || {})
    .map((d) => ({
      value: d.id,
      label: d.name_by_user || d.name || "",
      secondary: [d.manufacturer, d.model].filter(Boolean).join(" · "),
    }))
    .filter((o) => o.label)
    .sort((a, b) => a.label.localeCompare(b.label));

export const haDeviceEntityIds = (hass, deviceId) =>
  Object.values(hass.entities || {})
    .filter((e) => e.device_id === deviceId)
    .map((e) => e.entity_id);

/* Automatyczne rozpoznanie ról encji urządzenia (zawór, przepływ, czujniki, bateria). */
export function autoDetectRoles(hass, entityIds) {
  const dc = (id) => hass.states[id]?.attributes?.device_class || "";
  const unit = (id) => hass.states[id]?.attributes?.unit_of_measurement || "";
  const sensors = entityIds.filter((id) => id.startsWith("sensor."));
  return {
    valve:
      entityIds.find((id) => id.startsWith("valve.")) ||
      entityIds.find((id) => id.startsWith("switch.")) ||
      null,
    flow:
      sensors.find((id) => dc(id) === "volume_flow_rate" || unit(id).includes("m³/h")) || null,
    soil:
      sensors.find((id) => dc(id) === "moisture" || /soil|gleb/i.test(id)) || null,
    temp: sensors.find((id) => dc(id) === "temperature") || null,
    hum:
      sensors.find((id) => dc(id) === "humidity" && !/soil|gleb/i.test(id)) || null,
    battery: sensors.find((id) => dc(id) === "battery") || null,
  };
}

/* Encje danej roli z urządzeń przypisanych do strefy: [{entity, device}] */
export const zoneSuggestions = (app, zoneId, role) =>
  (app.data.devices || [])
    .filter((d) => zoneId && d.zone_id === zoneId && d.entities?.[role])
    .map((d) => ({ entity: d.entities[role], device: d.name }));

/* Opcje comboboxa z sugestiami strefy na górze (⭐) — sugerowane + reszta. */
export function optionsWithSuggestions(hass, baseOptions, suggestions) {
  const suggested = suggestions.map((s) => {
    const friendly = hass.states[s.entity]?.attributes?.friendly_name || s.entity;
    return { value: s.entity, label: `⭐ ${friendly}`, secondary: s.device };
  });
  const seen = new Set(suggested.map((s) => s.value));
  return [...suggested, ...baseOptions.filter((o) => !seen.has(o.value))];
}

export const sensorState = (hass, entityId) => {
  const st = hass.states[entityId];
  const unavailable = !st || st.state === "unavailable" || st.state === "unknown";
  return {
    unavailable,
    text: unavailable ? "—" : `${st.state}${st.attributes.unit_of_measurement ? " " + st.attributes.unit_of_measurement : ""}`,
  };
};
