import { t } from "./i18n.js";
import { esc } from "./util.js";

export const ENABLED = true;

let state = null;
let loadTimer = null;

export function renderFab() {
  return `<button class="fab" data-action="crisis-open" title="${t("crisis.fab")}"><ha-icon icon="mdi:leaf-off"></ha-icon></button>`;
}

export const actions = {
  "crisis-open": (app) => {
    state = { img: null, plantId: app.data.plants[0]?.id || "", desc: "", busy: false, result: null, error: null, added: false };
    render(app);
    dlg(app).showModal();
  },
};

const dlg = (app) => app.shadowRoot.getElementById("form-dialog");

const CONF_COLOR = { high: "var(--rl-green)", medium: "var(--rl-harvest)", low: "var(--rl-crisis)" };

function render(app) {
  const el = dlg(app);
  const plants = app.data.plants;
  const history = (app.data.crisis_history || []).filter((h) => h.plant_id === state.plantId).slice(-3).reverse();
  el.innerHTML = `
    <h2>🍂 ${t("crisis.title")}</h2>
    <div class="dropzone ${state.img ? "hasimg" : ""}" id="cz-drop">
      ${
        state.img
          ? `<img src="${state.img.preview}" alt="">`
          : `<ha-icon icon="mdi:camera-outline"></ha-icon><div>${t("crisis.photo")}</div>
             <small>${t("crisis.photo.hint")}</small>`
      }
    </div>
    <input type="file" id="cz-file" accept="image/*" hidden>
    <label>${t("crisis.plant")}</label>
    <select id="cz-plant">${plants.map((p) => `<option value="${p.id}" ${p.id === state.plantId ? "selected" : ""}>${esc(p.emoji || "🌱")} ${esc(p.name)}</option>`).join("")}</select>
    <label>${t("crisis.desc")}</label>
    <textarea id="cz-desc" placeholder="${t("crisis.desc.ph")}">${esc(state.desc)}</textarea>
    ${state.error ? `<div class="warn-hint"><ha-icon icon="mdi:alert-circle-outline"></ha-icon>${esc(state.error)}</div>` : ""}
    <div class="dialog-actions">
      <button type="button" class="btn plain" id="cz-close">${t("cancel")}</button>
      <button type="button" class="btn ai" id="cz-go" ${state.busy || !plants.length ? "disabled" : ""}>
        <ha-icon icon="mdi:creation"></ha-icon><span id="cz-go-label">${state.busy ? t("crisis.loading.1") : t("crisis.submit")}</span>
      </button>
    </div>
    ${state.result ? diagnosisHtml() : ""}
    ${
      history.length && !state.result
        ? `<div class="section-title" style="margin-top:20px">${t("crisis.history")}</div>
           ${history.map((h) => `<div class="history-item">${esc(h.created)} — <b>${esc(h.diagnosis.problem)}</b> (${t("crisis.confidence")}: ${t("crisis.confidence." + h.diagnosis.confidence)})</div>`).join("")}`
        : ""
    }
  `;
  wire(app);
}

function diagnosisHtml() {
  const d = state.result.diagnosis;
  return `<div class="diagnosis">
    <h3><ha-icon icon="mdi:creation" style="--mdc-icon-size:16px;color:var(--rl-ai)"></ha-icon>
      ${t("crisis.diagnosis")}: ${esc(d.problem)}
      <span class="chip" style="background:transparent;color:${CONF_COLOR[d.confidence] || "inherit"}">${t("crisis.confidence")}: ${t("crisis.confidence." + d.confidence)}</span></h3>
    <div class="desc">${esc(d.summary)}</div>
    ${d.confidence === "low" ? `<div class="desc" style="margin-top:6px;color:var(--secondary-text-color)">${t("crisis.lowconf")}</div>` : ""}
    <ol>${d.steps.map((s) => `<li>${esc(s.title)} <span style="color:var(--secondary-text-color)">(${t("tasks.in", { n: s.due_in_days })})</span></li>`).join("")}</ol>
    ${
      state.added
        ? `<div class="desc" style="margin-top:10px;color:var(--rl-green)">✓ ${t("crisis.plan.added")}</div>`
        : `<button type="button" class="btn ai small" id="cz-add" style="margin-top:10px"><ha-icon icon="mdi:plus"></ha-icon>${t("crisis.addplan")}</button>`
    }
  </div>`;
}

function wire(app) {
  const el = dlg(app);
  const q = (id) => el.querySelector(id);
  const snapshot = () => {
    state.plantId = q("#cz-plant").value;
    state.desc = q("#cz-desc").value;
  };
  q("#cz-close").addEventListener("click", () => {
    clearInterval(loadTimer);
    el.close();
    app.reload(); // odśwież zadania/historię po zamknięciu
  });
  q("#cz-drop").addEventListener("click", () => q("#cz-file").click());
  q("#cz-drop").addEventListener("dragover", (ev) => ev.preventDefault());
  q("#cz-drop").addEventListener("drop", (ev) => {
    ev.preventDefault();
    if (ev.dataTransfer.files[0]) addImage(app, ev.dataTransfer.files[0], snapshot);
  });
  q("#cz-file").addEventListener("change", (ev) => {
    if (ev.target.files[0]) addImage(app, ev.target.files[0], snapshot);
  });
  q("#cz-plant").addEventListener("change", () => {
    snapshot();
    state.result = null;
    render(app);
  });
  q("#cz-go").addEventListener("click", () => submit(app, snapshot));
  q("#cz-add")?.addEventListener("click", async () => {
    app.data = await app.ws("crisis/add_plan", { history_id: state.result.id });
    state.added = true;
    render(app);
  });
}

async function addImage(app, file, snapshot) {
  snapshot();
  const url = URL.createObjectURL(file);
  const image = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = url;
  });
  const MAX = 1024;
  const scale = Math.min(1, MAX / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(url);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  state.img = { preview: dataUrl, media: "image/jpeg", data: dataUrl.split(",")[1] };
  render(app);
}

async function submit(app, snapshot) {
  snapshot();
  state.busy = true;
  state.error = null;
  state.result = null;
  state.added = false;
  render(app);
  const msgs = [t("crisis.loading.1"), t("crisis.loading.2"), t("crisis.loading.3")];
  let i = 0;
  clearInterval(loadTimer);
  loadTimer = setInterval(() => {
    const label = dlg(app).querySelector("#cz-go-label");
    if (label) label.textContent = msgs[++i % msgs.length];
  }, 4000);
  try {
    state.result = await app.ws("crisis/diagnose", {
      plant_id: state.plantId,
      description: state.desc,
      image: state.img?.data ?? null,
      media_type: state.img?.media ?? null,
    });
  } catch (e) {
    state.error = t("crisis.error") + (e.message || String(e));
  }
  clearInterval(loadTimer);
  state.busy = false;
  render(app);
}
