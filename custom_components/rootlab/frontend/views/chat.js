import { t } from "../i18n.js";
import { combo, emo, esc, nowStamp, resizeImage, sensorState } from "../util.js";
import { insideRect, isShaded, lineElements, shadowCapsule, solarPosition } from "../shade.js";
import { SENSOR_FIELDS } from "./plants.js";

/* Zakładka „Diagnoza AI" — rozmowy diagnostyczne per roślina.
   Rozmowa startuje z dialogu kryzysowego („Doprecyzuj w czacie") albo od zera. */

const st = (app) => (app._chat ??= { openId: null, busy: false, pending: null, att: [], full: null });

export function render(app) {
  const s = st(app);
  const chats = (app.data.chats || [])
    .slice()
    .sort((a, b) => (b.updated || "").localeCompare(a.updated || ""));
  // pełna rozmowa (ze zdjęciami) z chat/get; kopia z listy jako fallback na czas ładowania
  const chat = (s.full?.id === s.openId && s.full) || chats.find((c) => c.id === s.openId);
  return chat ? renderChat(app, chat) : renderList(app, chats);
}

function chatRow(app, c) {
  const plant = app.data.plants.find((p) => p.id === c.plant_id);
  const last = (c.messages || [])[c.messages.length - 1];
  return `<div class="card" style="margin-bottom:8px;display:flex;align-items:center;gap:10px;cursor:pointer" data-action="chat-open" data-id="${c.id}">
    <span style="flex:none">${emo(plant?.emoji || "💬", 22)}</span>
    <div style="min-width:0;flex:1">
      <b>${esc(c.title || t("chat.untitled"))}</b>
      <div style="font-size:12px;color:var(--secondary-text-color);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
        ${plant ? esc(plant.name) + " · " : ""}${esc(c.updated || "")}${last ? " · " + esc(last.content.slice(0, 80)) : ""}
      </div>
    </div>
    <button class="icon-btn" data-action="chat-del" data-id="${c.id}" title="${t("delete")}"><ha-icon icon="mdi:trash-can-outline"></ha-icon></button>
  </div>`;
}

function renderList(app, chats) {
  const group = localStorage.getItem("rootlab_chat_group") || "plant";
  const toolbar = `<div class="toolbar">
    <button class="btn" data-action="chat-new"><ha-icon icon="mdi:plus"></ha-icon>${t("chat.new")}</button>
    <div class="spacer"></div>
    <span style="font-size:13px;color:var(--secondary-text-color)">${t("tasks.group")}:</span>
    <button class="btn small ${group === "plant" ? "" : "plain"}" data-action="chat-group" data-g="plant">${t("tasks.group.plant")}</button>
    <button class="btn small ${group === "zone" ? "" : "plain"}" data-action="chat-group" data-g="zone">${t("tasks.group.zone")}</button>
  </div>`;
  if (!chats.length) {
    return `${toolbar}<div class="empty"><ha-icon icon="mdi:stethoscope"></ha-icon><p>${t("chat.empty")}</p></div>`;
  }
  // chats posortowane malejąco po updated → Map trzyma grupy w kolejności najświeższej rozmowy
  const keyOf = (c) => {
    const plant = app.data.plants.find((p) => p.id === c.plant_id);
    if (group === "plant") return plant ? plant.id : null;
    return plant?.zone_id && app.data.zones.some((z) => z.id === plant.zone_id) ? plant.zone_id : null;
  };
  const labelOf = (key) => {
    if (key === null) return group === "plant" ? `💬 ${t("chat.noplant")}` : `🏷️ ${t("zone.none")}`;
    if (group === "plant") {
      const p = app.data.plants.find((pp) => pp.id === key);
      return `${esc(p.emoji || "🌱")} ${esc(p.name)}`;
    }
    const z = app.data.zones.find((zz) => zz.id === key);
    return `${esc(z.emoji || "🪴")} ${esc(z.name)}`;
  };
  const groups = new Map();
  for (const c of chats) {
    const k = keyOf(c);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(c);
  }
  return (
    toolbar +
    [...groups.entries()]
      .map(([k, list]) => `<div class="section-title">${labelOf(k)}</div>` + list.map((c) => chatRow(app, c)).join(""))
      .join("")
  );
}

/* Fakty o roślinie (strefa, nasadzenie, plan, cień, czujniki, diagnozy) — wspólne dla
   panelu w UI i kontekstu wysyłanego AI przy każdej wiadomości. */
function plantFacts(app, plant) {
  const zone = app.data.zones.find((z) => z.id === plant.zone_id);
  const own = plant.planting;
  const inherited = zone?.planting;
  const plantingLabel = own
    ? t("planting." + own)
    : inherited
      ? `${t("planting." + inherited)} (${t("planting.parent").toLowerCase()})`
      : t("planting.none");
  const sensorPairs = SENSOR_FIELDS.filter((f) => plant.sensors?.[f.key]).map((f) => ({
    icon: f.icon,
    label: t(f.labelKey),
    ...sensorState(app.hass, plant.sensors[f.key]),
  }));
  const layout = app.data.layout || {};
  const items = layout.items || [];
  const isArea = (i) => "w" in i;
  const isCircle = (i) => !("w" in i) && !Array.isArray(i.path) && !(i.kind === "irrigation" && i.mode === "sprinkler");
  const me = items.find((i) => isCircle(i) && i.plant_id === plant.id);
  let planLine = t("chat.info.noplan");
  let shadeLine = "";
  if (me) {
    const areas = items.filter(isArea).filter((a) => insideRect(me, a));
    planLine = areas.length
      ? areas
          .map((a) => {
            const az = app.data.zones.find((z) => z.id === a.zone_id);
            return `${a.label || t("editor.palette." + a.kind)}${az ? ` (${az.name})` : ""}`;
          })
          .join(", ")
      : t("chat.info.outside");
    const lat = layout.location?.latitude || app.hass.config.latitude || 52;
    const lon = layout.location?.longitude || app.hass.config.longitude || 21;
    const sun = solarPosition(lat, lon, new Date());
    if (sun.elevation <= 0) {
      shadeLine = `🌙 ${t("chat.info.night")}`;
    } else {
      const north = layout.north_deg || 0;
      // źródła cienia: pojedyncze rośliny/drzewa + elementy nasadzeń liniowych (żywopłot, rządek)
      const lineEls = items.filter((c) => c.kind === "hedge" || c.kind === "row").flatMap((c) => lineElements(c));
      const shadedBy = [...items.filter((c) => isCircle(c) && c.id !== me.id), ...lineEls]
        .filter((c) => isShaded(me, c, shadowCapsule(c, sun, north)))
        .map((c) => {
          const p = c.plant_id ? app.data.plants.find((pp) => pp.id === c.plant_id) : null;
          return p ? `${p.emoji || "🌱"} ${p.name}` : c.name || c.label || t("editor.palette." + c.kind);
        });
      const uniq = [...new Set(shadedBy)]; // żywopłot = wiele elementów o tej samej nazwie
      shadeLine = uniq.length
        ? `☁ ${t("chat.info.shadedby")}: ${uniq.join(", ")}`
        : `☀ ${t("chat.info.sunny")}`;
    }
  }
  const diags = (app.data.crisis_history || []).filter((h) => h.plant_id === plant.id && !h.archived);
  const lastDiags = diags
    .slice(-3)
    .reverse()
    .map((h) => `${h.created} — ${h.diagnosis.problem} (${t("crisis.confidence." + h.diagnosis.confidence)})`);
  return {
    zoneLabel: zone ? `${zone.emoji || "🪴"} ${zone.name}` : t("zone.none"),
    plantingLabel,
    planLine,
    shadeLine,
    sensorPairs,
    diagsCount: diags.length,
    lastDiags,
  };
}

function plantInfo(app, plant) {
  const f = plantFacts(app, plant);
  const sensors = f.sensorPairs
    .map(
      (s) =>
        `<span class="sensor-chip ${s.unavailable ? "unavailable" : ""}" style="padding:2px 8px;font-size:12px" title="${esc(s.label)}"><ha-icon icon="${s.icon}" style="--mdc-icon-size:14px"></ha-icon>${esc(s.text)}</span>`
    )
    .join(" ");
  return `<div class="section-title" style="margin-top:0">ℹ️ ${t("chat.info")}</div>
    <div style="font-size:13px;display:grid;gap:6px">
      <div><b>${t("plant.zone")}:</b> ${esc(f.zoneLabel)}</div>
      <div><b>${t("plant.planting")}:</b> ${esc(f.plantingLabel)}</div>
      <div><b>${t("chat.info.plan")}:</b> ${esc(f.planLine)}</div>
      ${f.shadeLine ? `<div>${esc(f.shadeLine)}</div>` : ""}
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"><b>${t("chat.info.sensors")}:</b> ${sensors || t("chat.info.nosensors")}</div>
      <div><b>${t("chat.info.diags")}:</b> ${f.diagsCount || t("chat.info.nodiags")}</div>
      ${f.lastDiags.map((d) => `<div style="font-size:12px;color:var(--secondary-text-color)">· ${esc(d)}</div>`).join("")}
    </div>`;
}

/* Tekstowa wersja panelu — dokładnie to, co widzi użytkownik, trafia do AI. */
export function plantInfoText(app, plant) {
  const f = plantFacts(app, plant);
  return [
    `Strefa: ${f.zoneLabel}`,
    `Nasadzenie: ${f.plantingLabel}`,
    `Na planie ogrodu: ${f.planLine}`,
    f.shadeLine,
    `Czujniki: ${f.sensorPairs.map((s) => `${s.label}: ${s.text}`).join(", ") || "brak podłączonych"}`,
    `Diagnozy w historii: ${f.diagsCount}`,
    ...f.lastDiags.map((d) => `- ${d}`),
  ]
    .filter(Boolean)
    .join("\n");
}

function renderChat(app, chat) {
  const s = st(app);
  const plant = app.data.plants.find((p) => p.id === chat.plant_id);
  const bubbles = (chat.messages || [])
    .map((m) => {
      const imgs = (m.images || [])
        .map(
          (b) =>
            `<img src="data:image/jpeg;base64,${b}" alt="" data-msg-zoom style="max-width:150px;border-radius:8px;display:block;margin-top:6px;cursor:pointer">`
        )
        .join("");
      return `<div class="chat-msg ${m.role === "user" ? "user" : "ai"}">${esc(m.content)}${imgs}<span class="when">${esc(m.created || "")}</span></div>`;
    })
    .join("");
  const pending = s.pending
    ? `<div class="chat-msg user">${esc(s.pending)}</div><div class="chat-msg ai">${t("chat.typing")}</div>`
    : "";
  return `<div class="toolbar">
      <button class="btn ghost" data-action="chat-back"><ha-icon icon="mdi:arrow-left"></ha-icon>${t("chat.back")}</button>
      ${plant ? `<button class="btn small ghost" data-action="plant-card" data-id="${plant.id}">${emo(plant.emoji || "🌱", 16)}${esc(plant.name)}</button>` : ""}
      <span style="flex:1"></span>
      <button class="btn small ai" data-action="chat-tasks"><ha-icon icon="mdi:clipboard-plus-outline"></ha-icon>${t("chat.tasks")}</button>
      <button class="btn small ghost" data-action="chat-kn"><ha-icon icon="mdi:book-plus-outline"></ha-icon>${t("knowledge.save")}</button>
    </div>
    <div class="chat-layout ${plant ? "" : "solo"}">
      ${plant ? `<div class="card chat-side">${plantInfo(app, plant)}</div>` : ""}
      <div class="card">
        <h3 style="margin:0 0 8px">${esc(chat.title || t("chat.untitled"))}</h3>
        <div class="chat-msgs" id="chat-msgs">
          ${bubbles + pending || `<div class="chat-msg ai">${t("chat.nomsgs")}</div>`}
        </div>
        ${
          s.att.length
            ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">${s.att
                .map(
                  (a, i) => `<span style="position:relative;display:inline-block">
                    <img src="${a.preview}" alt="" style="width:56px;height:56px;object-fit:cover;border-radius:8px;display:block">
                    <button type="button" data-att-del="${i}" title="${t("delete")}" style="position:absolute;top:-6px;right:-6px;background:rgba(0,0,0,.7);color:#fff;border:none;border-radius:50%;width:18px;height:18px;cursor:pointer;font-size:10px;line-height:1">✕</button>
                  </span>`
                )
                .join("")}</div>`
            : ""
        }
        <div style="display:flex;gap:8px;align-items:flex-end;margin-top:10px">
          <input type="file" id="chat-file" accept="image/*" multiple hidden>
          <button class="btn ghost" id="chat-att" title="${t("plant.photo.add")}"><ha-icon icon="mdi:camera-plus-outline"></ha-icon></button>
          <div class="mic-wrap" style="flex:1">
            <textarea id="chat-input" placeholder="${t("chat.input.ph")}" style="width:100%;box-sizing:border-box;padding:10px 40px 10px 12px;border:1px solid var(--divider-color);border-radius:8px;background:var(--primary-background-color);color:var(--primary-text-color);font:inherit;min-height:48px"></textarea>
          </div>
          <button class="btn ai" id="chat-send" ${s.busy ? "disabled" : ""}><ha-icon icon="mdi:send"></ha-icon></button>
        </div>
      </div>
    </div>`;
}

export function bind(app, root) {
  const box = root.getElementById("chat-msgs");
  if (box) box.scrollTop = box.scrollHeight;
  const ta = root.getElementById("chat-input");
  if (!ta) return;
  import("../stt.js").then((stt) => stt.attachMic(app, ta));
  root.getElementById("chat-send").addEventListener("click", () => send(app));
  ta.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" && !ev.shiftKey) {
      ev.preventDefault();
      send(app);
    }
  });
  const fileInput = root.getElementById("chat-file");
  root.getElementById("chat-att").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async (ev) => {
    const s = st(app);
    const files = [...ev.target.files].slice(0, Math.max(0, 5 - s.att.length));
    ev.target.value = "";
    for (const file of files) {
      try {
        s.att.push(await resizeImage(file, 900, app));
      } catch (e) {
        app.toast(`⚠ ${t("photo.unreadable")}`, true);
      }
    }
    app.render();
  });
  root.querySelectorAll("[data-att-del]").forEach((el) =>
    el.addEventListener("click", () => {
      st(app).att.splice(parseInt(el.dataset.attDel, 10), 1);
      app.render();
    })
  );
  root.querySelectorAll("[data-msg-zoom]").forEach((img) =>
    img.addEventListener("click", () => {
      const small = img.style.maxWidth === "150px";
      img.style.maxWidth = small ? "100%" : "150px";
    })
  );
  ta.focus();
}

async function send(app) {
  const s = st(app);
  const ta = app.shadowRoot.getElementById("chat-input");
  const text = ta?.value.trim();
  if (!text || s.busy) return;
  s.busy = true;
  s.pending = text;
  app.render();
  const chat = (app.data.chats || []).find((c) => c.id === s.openId);
  const plant = app.data.plants.find((p) => p.id === chat?.plant_id);
  const images = s.att.map((a) => a.data);
  try {
    const updated = await app.ws("chat/send", {
      chat_id: s.openId,
      message: text,
      // AI dostaje dokładnie to, co pokazuje panel „Informacje o roślinie" (plan, cień, czujniki)
      context: plant ? plantInfoText(app, plant) : null,
      images: images.length ? images : null,
    });
    s.full = updated;
    s.att = [];
    const i = app.data.chats.findIndex((c) => c.id === s.openId);
    if (i >= 0) app.data.chats[i] = updated;
  } catch (e) {
    app.toast(`⚠ ${e.message || e}`, true);
  }
  s.busy = false;
  s.pending = null;
  app.render();
}

/* Utworzenie rozmowy z gotowymi wiadomościami (dialog kryzysowy) — otwiera zakładkę. */
export async function startChat(app, seed) {
  app.data = await app.ws("item/save", { kind: "chats", item: seed });
  const s = st(app);
  s.openId = app.data.chats[app.data.chats.length - 1].id;
  s.full = null;
  s.att = [];
  app.tab = "chat";
}

async function openChat(app, chatId) {
  const s = st(app);
  s.openId = chatId;
  s.full = null;
  s.att = [];
  app.render();
  try {
    s.full = await app.ws("chat/get", { chat_id: chatId });
  } catch (e) {
    return; // kopia z listy (bez zdjęć) już się renderuje
  }
  app.render();
}

export const actions = {
  "chat-open": (app, el) => openChat(app, el.dataset.id),
  "chat-back": (app) => {
    const s = st(app);
    s.openId = null;
    s.full = null;
    s.att = [];
    app.render();
  },
  "chat-del": (app, el) => {
    if (!confirm(t("chat.delete.confirm"))) return;
    if (st(app).openId === el.dataset.id) st(app).openId = null;
    app.deleteItem("chats", el.dataset.id);
  },
  "chat-new": (app) => {
    const plantOpts = app.data.plants.map((p) => ({ value: p.id, label: `${p.emoji || "🌱"} ${p.name}`, secondary: p.species }));
    app.dialog(
      `<h2>${t("chat.new")}</h2>
      <form>
        <label>${t("crisis.plant")}</label>
        ${combo({ name: "plant_id", options: plantOpts })}
        <div class="dialog-actions">
          <button type="button" class="btn plain" data-cancel>${t("cancel")}</button>
          <button type="submit" class="btn">${t("add")}</button>
        </div>
      </form>`,
      async (fd) => {
        const stamp = nowStamp();
        try {
          await startChat(app, {
            id: null,
            plant_id: fd.get("plant_id") || null,
            title: "",
            created: stamp,
            updated: stamp,
            messages: [],
          });
        } catch (e) {
          app.toast(`⚠ ${e.message || e}`, true);
          return;
        }
        app.render();
      }
    );
  },
  "chat-group": (app, el) => {
    localStorage.setItem("rootlab_chat_group", el.dataset.g);
    app.render();
  },
  "chat-tasks": async (app, el) => {
    el.disabled = true;
    let res;
    try {
      res = await app.ws("chat/tasks", { chat_id: st(app).openId });
    } catch (e) {
      app.toast(`⚠ ${e.message || e}`, true);
      app.render();
      return;
    }
    app.render();
    const tasks = res.tasks || [];
    if (!tasks.length) {
      app.toast(t("gen.none"));
      return;
    }
    // podgląd: odznacz, czego nie chcesz — zapis dopiero po akceptacji
    app.dialog(
      `<h2>${t("chat.tasks")}</h2>
      <form>
        <p style="font-size:13px;color:var(--secondary-text-color)">${t("gen.diff.new", { n: tasks.length })}</p>
        ${tasks
          .map(
            (task, i) => `<label style="display:flex;gap:8px;align-items:flex-start;cursor:pointer;padding:6px 0;border-bottom:1px solid var(--divider-color)">
          <input type="checkbox" name="t${i}" checked style="margin-top:3px">
          <span style="min-width:0"><b>${esc(task.title)}</b> <span class="chip">${t("tasks.cat." + task.category)}</span>
            <span style="color:var(--secondary-text-color);font-size:12px">${esc(task.due || "")}</span><br>
            <small>${esc(task.details || "")}</small></span></label>`
          )
          .join("")}
        <div class="dialog-actions">
          <button type="button" class="btn plain" data-cancel>${t("cancel")}</button>
          <button type="submit" class="btn">${t("chat.accept")}</button>
        </div>
      </form>`,
      async (fd) => {
        const add = tasks.filter((_, i) => fd.get(`t${i}`));
        if (!add.length) return;
        try {
          app.data = await app.ws("tasks/apply", { add, remove_ids: [] });
        } catch (e) {
          app.toast(`⚠ ${e.message || e}`, true);
          return;
        }
        app.render();
        app.toast(t("chat.tasks.added", { n: add.length }));
      },
      { wide: true }
    );
  },
  "chat-kn": (app) => {
    const chat = (app.data.chats || []).find((c) => c.id === st(app).openId);
    const last = (chat?.messages || []).slice().reverse().find((m) => m.role === "assistant");
    if (!last) {
      app.toast(t("chat.kn.empty"), true);
      return;
    }
    // podgląd wpisu (tytuł i treść do edycji) — zapis dopiero po akceptacji
    app.dialog(
      `<h2>${t("knowledge.save")}</h2>
      <form>
        <label>${t("kn.title")}</label>
        <input name="title" required maxlength="120" value="${esc(chat.title || t("tab.chat"))}">
        <label>${t("kn.content")}</label>
        <textarea name="content" style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid var(--divider-color);border-radius:8px;background:var(--primary-background-color);color:var(--primary-text-color);font:inherit;min-height:180px">${esc(last.content)}</textarea>
        <div class="dialog-actions">
          <button type="button" class="btn plain" data-cancel>${t("cancel")}</button>
          <button type="submit" class="btn">${t("chat.accept")}</button>
        </div>
      </form>`,
      async (fd) => {
        try {
          await app.ws("item/save", {
            kind: "knowledge",
            item: {
              id: null,
              title: fd.get("title").trim(),
              content: fd.get("content"),
              source: "ai",
              plant_id: chat.plant_id || null,
              created: new Date().toISOString().slice(0, 10),
            },
          });
        } catch (e) {
          app.toast(`⚠ ${e.message || e}`, true);
          return;
        }
        app.toast(t("knowledge.saved"));
      },
      { wide: true }
    );
  },
};
