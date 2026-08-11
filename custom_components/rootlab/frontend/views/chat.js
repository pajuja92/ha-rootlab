import { t } from "../i18n.js";
import { combo, esc, nowStamp } from "../util.js";

/* Zakładka „Diagnoza AI" — rozmowy diagnostyczne per roślina.
   Rozmowa startuje z dialogu kryzysowego („Doprecyzuj w czacie") albo od zera. */

const st = (app) => (app._chat ??= { openId: null, busy: false, pending: null });

export function render(app) {
  const s = st(app);
  const chats = (app.data.chats || [])
    .slice()
    .sort((a, b) => (b.updated || "").localeCompare(a.updated || ""));
  const chat = chats.find((c) => c.id === s.openId);
  return chat ? renderChat(app, chat) : renderList(app, chats);
}

function renderList(app, chats) {
  const toolbar = `<div class="toolbar">
    <button class="btn" data-action="chat-new"><ha-icon icon="mdi:plus"></ha-icon>${t("chat.new")}</button>
  </div>`;
  if (!chats.length) {
    return `${toolbar}<div class="empty"><ha-icon icon="mdi:stethoscope"></ha-icon><p>${t("chat.empty")}</p></div>`;
  }
  return (
    toolbar +
    chats
      .map((c) => {
        const plant = app.data.plants.find((p) => p.id === c.plant_id);
        const last = (c.messages || [])[c.messages.length - 1];
        return `<div class="card" style="margin-bottom:8px;display:flex;align-items:center;gap:10px;cursor:pointer" data-action="chat-open" data-id="${c.id}">
          <span class="emoji" style="flex:none">${esc(plant?.emoji || "💬")}</span>
          <div style="min-width:0;flex:1">
            <b>${esc(c.title || t("chat.untitled"))}</b>
            <div style="font-size:12px;color:var(--secondary-text-color);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
              ${plant ? esc(plant.name) + " · " : ""}${esc(c.updated || "")}${last ? " · " + esc(last.content.slice(0, 80)) : ""}
            </div>
          </div>
          <button class="icon-btn" data-action="chat-del" data-id="${c.id}" title="${t("delete")}"><ha-icon icon="mdi:trash-can-outline"></ha-icon></button>
        </div>`;
      })
      .join("")
  );
}

function renderChat(app, chat) {
  const s = st(app);
  const plant = app.data.plants.find((p) => p.id === chat.plant_id);
  const bubbles = (chat.messages || [])
    .map(
      (m) => `<div class="chat-msg ${m.role === "user" ? "user" : "ai"}">${esc(m.content)}<span class="when">${esc(m.created || "")}</span></div>`
    )
    .join("");
  const pending = s.pending
    ? `<div class="chat-msg user">${esc(s.pending)}</div><div class="chat-msg ai">${t("chat.typing")}</div>`
    : "";
  return `<div class="toolbar">
      <button class="btn ghost" data-action="chat-back"><ha-icon icon="mdi:arrow-left"></ha-icon>${t("chat.back")}</button>
      ${plant ? `<button class="btn small ghost" data-action="plant-card" data-id="${plant.id}"><span class="emoji">${esc(plant.emoji || "🌱")}</span>${esc(plant.name)}</button>` : ""}
      <span style="flex:1"></span>
      <button class="btn small ai" data-action="chat-tasks"><ha-icon icon="mdi:clipboard-plus-outline"></ha-icon>${t("chat.tasks")}</button>
      <button class="btn small ghost" data-action="chat-kn"><ha-icon icon="mdi:book-plus-outline"></ha-icon>${t("knowledge.save")}</button>
    </div>
    <div class="card">
      <h3 style="margin:0 0 8px">${esc(chat.title || t("chat.untitled"))}</h3>
      <div class="chat-msgs" id="chat-msgs">
        ${bubbles + pending || `<div class="chat-msg ai">${t("chat.nomsgs")}</div>`}
      </div>
      <div style="display:flex;gap:8px;align-items:flex-end;margin-top:10px">
        <div class="mic-wrap" style="flex:1">
          <textarea id="chat-input" placeholder="${t("chat.input.ph")}" style="width:100%;box-sizing:border-box;padding:10px 40px 10px 12px;border:1px solid var(--divider-color);border-radius:8px;background:var(--primary-background-color);color:var(--primary-text-color);font:inherit;min-height:48px"></textarea>
        </div>
        <button class="btn ai" id="chat-send" ${s.busy ? "disabled" : ""}><ha-icon icon="mdi:send"></ha-icon></button>
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
  try {
    const updated = await app.ws("chat/send", { chat_id: s.openId, message: text });
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
  st(app).openId = app.data.chats[app.data.chats.length - 1].id;
  app.tab = "chat";
}

export const actions = {
  "chat-open": (app, el) => {
    st(app).openId = el.dataset.id;
    app.render();
  },
  "chat-back": (app) => {
    st(app).openId = null;
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
  "chat-tasks": async (app, el) => {
    el.disabled = true;
    try {
      const res = await app.ws("chat/tasks", { chat_id: st(app).openId });
      app.data = res.data;
      app.toast(t("chat.tasks.added", { n: res.added }));
    } catch (e) {
      app.toast(`⚠ ${e.message || e}`, true);
    }
    app.render();
  },
  "chat-kn": async (app) => {
    const chat = (app.data.chats || []).find((c) => c.id === st(app).openId);
    const last = (chat?.messages || []).slice().reverse().find((m) => m.role === "assistant");
    if (!last) return;
    try {
      await app.ws("item/save", {
        kind: "knowledge",
        item: {
          id: null,
          title: chat.title || t("tab.chat"),
          content: last.content,
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
};
