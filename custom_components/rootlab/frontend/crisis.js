import { t } from "./i18n.js";
import { combo, esc, nowStamp, resizeImage } from "./util.js";
import { attachMic } from "./stt.js";
import { startChat } from "./views/chat.js";

let state = null;
let loadTimer = null;

export function renderFab() {
  return `<button class="fab" data-action="crisis-open" title="${t("crisis.fab")}"><ha-icon icon="mdi:leaf-off"></ha-icon></button>`;
}

export function openCrisis(app, plantId = null) {
  state = {
    imgs: [],
    plantId: plantId || app.data.plants[0]?.id || "",
    desc: "",
    busy: false,
    result: null,
    error: null,
    added: false,
    savedKn: false,
    savedHist: false,
  };
  render(app);
}

export function onDialogClose(app) {
  if (state) {
    clearInterval(loadTimer);
    state = null;
    app.reload();
  }
}

export const actions = {
  "crisis-open": (app) => openCrisis(app),
};

const CONF_COLOR = { high: "var(--rl-green)", medium: "var(--rl-harvest)", low: "var(--rl-crisis)" };

function render(app) {
  const plants = app.data.plants;
  const history = (app.data.crisis_history || []).filter((h) => h.plant_id === state.plantId && !h.archived).slice(-3).reverse();
  const plantOpts = plants.map((p) => ({ value: p.id, label: p.name, secondary: p.species, icon: p.emoji || "🌱" }));
  const el = app.dialog(
    `<h2>🍂 ${t("crisis.title")}</h2>
    <div class="dropzone ${state.imgs.length ? "hasimg" : ""}" id="cz-drop">
      ${
        state.imgs.length
          ? `<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center">
              ${state.imgs
                .map(
                  (im, i) => `<span style="position:relative;display:inline-block">
                    <img src="${im.preview}" alt="" style="width:84px;height:84px;object-fit:cover;border-radius:8px;display:block">
                    <button type="button" data-img-del="${i}" title="${t("delete")}" style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,.6);color:#fff;border:none;border-radius:50%;width:20px;height:20px;cursor:pointer;font-size:11px;line-height:1">✕</button>
                  </span>`
                )
                .join("")}
              ${state.imgs.length < 5 ? `<span style="width:84px;height:84px;display:flex;align-items:center;justify-content:center;border:1px dashed var(--divider-color);border-radius:8px;font-size:24px;color:var(--secondary-text-color)">+</span>` : ""}
            </div>`
          : `<ha-icon icon="mdi:camera-outline"></ha-icon><div>${t("crisis.photo")}</div>
             <small>${t("crisis.photo.hint")}</small>`
      }
    </div>
    <input type="file" id="cz-file" accept="image/*" multiple hidden>
    <label>${t("crisis.plant")}</label>
    ${combo({ name: "cz_plant", value: state.plantId, options: plantOpts, allowEmpty: false })}
    <label>${t("crisis.desc")}</label>
    <div class="mic-wrap">
      <textarea id="cz-desc" placeholder="${t("crisis.desc.ph")}" style="padding-right:40px">${esc(state.desc)}</textarea>
    </div>
    ${state.error ? `<div class="warn-hint"><ha-icon icon="mdi:alert-circle-outline"></ha-icon>${esc(state.error)}</div>` : ""}
    <div class="dialog-actions">
      <button type="button" class="btn plain" data-cancel>${t("cancel")}</button>
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
    }`,
    () => {}
  );
  wire(app, el);
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
    <div class="actions" style="justify-content:flex-start">
      ${
        state.added
          ? `<span class="chip ai">✓ ${t("crisis.plan.added")}</span>`
          : `<button type="button" class="btn ai small" id="cz-add"><ha-icon icon="mdi:plus"></ha-icon>${t("crisis.addplan")}</button>`
      }
      ${
        state.savedKn
          ? `<span class="chip ai">✓ ${t("knowledge.saved")}</span>`
          : `<button type="button" class="btn ai small" id="cz-kn"><ha-icon icon="mdi:book-plus-outline"></ha-icon>${t("knowledge.save")}</button>`
      }
      ${
        state.savedHist
          ? `<span class="chip ai">✓ ${t("crisis.savedhist")}</span>`
          : `<button type="button" class="btn small ghost" id="cz-hist"><ha-icon icon="mdi:archive-arrow-up-outline"></ha-icon>${t("crisis.savehist")}</button>`
      }
      <button type="button" class="btn small ghost" id="cz-chat"><ha-icon icon="mdi:chat-outline"></ha-icon>${t("crisis.chat")}</button>
    </div>
  </div>`;
}

function wire(app, el) {
  const q = (sel) => el.querySelector(sel);
  const snapshot = () => {
    state.plantId = q('input[name="cz_plant"]').value;
    state.desc = q("#cz-desc").value;
  };
  attachMic(app, q("#cz-desc"));
  const addFiles = async (files) => {
    if (!files?.length || !state) return;
    snapshot();
    const list = [...files].slice(0, Math.max(0, 5 - state.imgs.length));
    if (list.length < files.length) app.toast(t("crisis.photo.max"), true);
    for (const file of list) {
      try {
        const img = await resizeImage(file, 1024, app);
        if (!state) return; // dialog zamknięty w międzyczasie
        state.imgs.push(img);
      } catch (e) {
        app.toast(`⚠ ${t("photo.unreadable")}`, true);
      }
    }
    if (state) render(app);
  };
  q("#cz-drop").addEventListener("click", (ev) => {
    const del = ev.target.closest("[data-img-del]");
    if (del) {
      snapshot();
      state.imgs.splice(parseInt(del.dataset.imgDel, 10), 1);
      render(app);
      return;
    }
    q("#cz-file").click();
  });
  q("#cz-drop").addEventListener("dragover", (ev) => ev.preventDefault());
  q("#cz-drop").addEventListener("drop", (ev) => {
    ev.preventDefault();
    addFiles(ev.dataTransfer.files);
  });
  q("#cz-file").addEventListener("change", (ev) => {
    addFiles(ev.target.files);
    ev.target.value = ""; // ten sam plik można wybrać ponownie
  });
  q('input[name="cz_plant"]').addEventListener("change", () => {
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
  q("#cz-hist")?.addEventListener("click", async () => {
    try {
      // diagnozy zapisują się jako zarchiwizowane — ten przycisk „utrwala" wpis w historii
      app.data = await app.ws("crisis/archive", { history_id: state.result.id, archived: false });
    } catch (e) {
      app.toast(`⚠ ${e.message || e}`, true);
      return;
    }
    state.savedHist = true;
    render(app);
  });
  q("#cz-chat")?.addEventListener("click", async () => {
    const d = state.result.diagnosis;
    const stamp = nowStamp();
    try {
      await startChat(app, {
        id: null,
        plant_id: state.plantId,
        title: (d.problem || "").slice(0, 60),
        created: stamp,
        updated: stamp,
        messages: [
          {
            role: "user",
            content: state.desc || t("crisis.chat.nophoto"),
            created: stamp,
            ...(state.imgs.length ? { images: state.imgs.map((im) => im.data) } : {}),
          },
          {
            role: "assistant",
            content: `${d.problem}\n\n${d.summary}\n\n${d.steps.map((s, i) => `${i + 1}. ${s.title} (${t("tasks.in", { n: s.due_in_days })})`).join("\n")}`,
            created: stamp,
          },
        ],
      });
    } catch (e) {
      app.toast(`⚠ ${e.message || e}`, true);
      return;
    }
    el.close(); // onDialogClose sprząta stan i przeładowuje — wyląduje na zakładce czatu
  });
  q("#cz-kn")?.addEventListener("click", async () => {
    const d = state.result.diagnosis;
    const plant = app.data.plants.find((p) => p.id === state.plantId);
    await app.ws("item/save", {
      kind: "knowledge",
      item: {
        id: null,
        title: `${d.problem}${plant ? ` (${plant.name})` : ""}`,
        content: `${d.summary}\n\n${d.steps.map((s, i) => `${i + 1}. ${s.title}`).join("\n")}`,
        source: "ai",
        plant_id: state.plantId,
        created: new Date().toISOString().slice(0, 10),
      },
    });
    state.savedKn = true;
    render(app);
  });
}

async function submit(app, snapshot) {
  snapshot();
  state.busy = true;
  state.error = null;
  state.result = null;
  state.added = false;
  state.savedKn = false;
  render(app);
  const msgs = [t("crisis.loading.1"), t("crisis.loading.2"), t("crisis.loading.3")];
  let i = 0;
  clearInterval(loadTimer);
  loadTimer = setInterval(() => {
    const label = app.shadowRoot.querySelector("#cz-go-label");
    if (label) label.textContent = msgs[++i % msgs.length];
  }, 4000);
  try {
    state.result = await app.ws("crisis/diagnose", {
      plant_id: state.plantId,
      description: state.desc,
      images: state.imgs.map((im) => im.data),
      media_type: state.imgs[0]?.media ?? null,
    });
  } catch (e) {
    state.error = t("crisis.error") + (e.message || String(e));
  }
  clearInterval(loadTimer);
  state.busy = false;
  if (state) render(app);
}
