export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const sensorState = (hass, entityId) => {
  const st = hass.states[entityId];
  const unavailable = !st || st.state === "unavailable" || st.state === "unknown";
  return {
    unavailable,
    text: unavailable ? "—" : `${st.state}${st.attributes.unit_of_measurement ? " " + st.attributes.unit_of_measurement : ""}`,
  };
};

export const entityOptions = (hass, domains, selected, noneLabel) => {
  const opts = Object.values(hass.states)
    .filter((s) => domains.some((d) => s.entity_id.startsWith(d + ".")))
    .sort((a, b) => (a.attributes.friendly_name || a.entity_id).localeCompare(b.attributes.friendly_name || b.entity_id))
    .map(
      (s) =>
        `<option value="${esc(s.entity_id)}" ${s.entity_id === selected ? "selected" : ""}>${esc(s.attributes.friendly_name || s.entity_id)}</option>`
    );
  return `<option value="">${noneLabel}</option>${opts.join("")}`;
};

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const uid = () => (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "") : String(Math.random()).slice(2));
