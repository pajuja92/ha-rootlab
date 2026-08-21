import { t } from "../i18n.js";
import { combo, esc, resizeImage, todayISO } from "../util.js";

const KINDS = ["inventory", "shopping", "wish"];
const KIND_ICONS = { inventory: "mdi:package-variant", shopping: "mdi:cart-outline", wish: "mdi:star-outline" };
const UNITS = ["ml", "l", "g", "kg", "szt.", "opak.", "m", "cm"];

const lists = (app) => app.data.inventory_lists || [];
const activeList = (app) => lists(app).find((l) => l.id === app._invListId) || lists(app)[0];
const cats = (app) => (app.data.inventory_categories?.length ? app.data.inventory_categories : ["Inne"]);
const fmtNum = (v) => String(Math.round(v * 10) / 10).replace(".", ",");
const remaining = (i) =>
  i.qty_val != null && i.usage_pct != null
    ? `${fmtNum((i.qty_val * i.usage_pct) / 100)} ${i.qty_unit || ""}`.trim()
    : null;

export function render(app) {
  const ls = lists(app);
  const addListBtn = `<button class="btn small ghost" data-action="inv-list-add"><ha-icon icon="mdi:playlist-plus"></ha-icon>${t("inv.list.add")}</button>`;
  if (!ls.length) {
    return `<div class="toolbar"><div class="spacer"></div>${addListBtn}</div>
      <div class="empty"><ha-icon icon="mdi:package-variant"></ha-icon><p>${t("inv.lists.empty")}</p>
      <button class="btn" data-action="inv-list-add"><ha-icon icon="mdi:playlist-plus"></ha-icon>${t("inv.list.add")}</button></div>`;
  }
  const list = activeList(app);
  const filter = (app._invFilter || "").toLowerCase();
  const rows = (app.data.inventory || [])
    .filter((i) => i.memberships?.[list.id])
    .filter(
      (i) =>
        !filter ||
        (i.name || "").toLowerCase().includes(filter) ||
        (i.desc || "").toLowerCase().includes(filter) ||
        (i.notes || "").toLowerCase().includes(filter) ||
        (i.memberships[list.id].note || "").toLowerCase().includes(filter) ||
        (i.ean || "").includes(filter)
    )
    .slice()
    .reverse();
  const tabs = ls
    .map((l) => {
      const n = (app.data.inventory || []).filter((i) => i.memberships?.[l.id]).length;
      return `<button class="subtab" data-action="inv-tab" data-id="${l.id}" ${l.id === list.id ? "data-active" : ""}>
        <ha-icon icon="${KIND_ICONS[l.kind] || KIND_ICONS.inventory}"></ha-icon>${esc(l.name)}${n ? ` (${n})` : ""}</button>`;
    })
    .join("");
  return `<div class="toolbar" style="flex-wrap:wrap">
    <div class="subtabs" style="margin:0;flex-wrap:wrap">${tabs}</div>
    <button class="icon-btn" data-action="inv-list-edit" data-id="${list.id}" title="${t("inv.list.edit")}"><ha-icon icon="mdi:pencil-outline"></ha-icon></button>
    <button class="icon-btn" data-action="inv-list-del" data-id="${list.id}" title="${t("delete")}"><ha-icon icon="mdi:trash-can-outline"></ha-icon></button>
    <div class="spacer"></div>
    ${addListBtn}
    <button class="btn ghost" data-action="inv-scan"><ha-icon icon="mdi:camera-outline"></ha-icon>${t("inv.scan")}</button>
    <button class="btn" data-action="inv-add"><ha-icon icon="mdi:plus"></ha-icon>${t("inv.add")}</button>
  </div>
  <input class="kn-search" id="inv-search" placeholder="${t("inv.search.ph")}" value="${esc(app._invFilter || "")}">
  ${rows.length ? `<div class="grid">${rows.map((i) => card(app, i, list)).join("")}</div>` : `<div class="empty"><ha-icon icon="mdi:package-variant"></ha-icon><p>${t("inv.empty")}</p></div>`}`;
}

function expiryChip(i) {
  if (!i.expiry) return "";
  const today = todayISO();
  const soon = new Date(today + "T12:00:00");
  soon.setDate(soon.getDate() + 60);
  const cls = i.expiry < today ? "crisis" : i.expiry <= soon.toISOString().slice(0, 10) ? "harvest" : "";
  return `<span class="chip ${cls}"><ha-icon icon="mdi:calendar-alert" style="--mdc-icon-size:12px"></ha-icon> ${esc(i.expiry)}</span>`;
}

function usageBar(i) {
  if (i.usage_pct == null || i.usage_pct === "") return "";
  const pct = Math.max(0, Math.min(100, Number(i.usage_pct)));
  const color = pct <= 25 ? "var(--rl-crisis)" : pct <= 50 ? "var(--rl-harvest)" : "var(--rl-green)";
  const left = remaining(i);
  return `<div class="inv-usage" title="${pct}%"><div class="fill" style="width:${pct}%;background:${color}"></div></div>
    <div style="font-size:12.5px;color:var(--secondary-text-color)">${pct}%${left ? ` · ${t("inv.left", { v: `${left} / ${fmtNum(i.qty_val)} ${esc(i.qty_unit || "")}` })}` : ""}</div>`;
}

function card(app, i, list) {
  const m = i.memberships[list.id] || {};
  const plant = i.plant_id ? app.data.plants.find((p) => p.id === i.plant_id) : null;
  const qtyChip =
    i.qty_val != null ? `<span class="chip">${fmtNum(i.qty_val)} ${esc(i.qty_unit || "")}</span>` : "";
  const buyLine =
    list.kind === "shopping" && m.qty != null
      ? `<div style="font-size:13.5px"><b>${t("inv.buyqty")}:</b> ${fmtNum(m.qty)} ${esc(i.qty_unit || "")}</div>`
      : "";
  const bought =
    list.kind === "shopping"
      ? `<button class="btn small" data-action="inv-bought" data-id="${i.id}"><ha-icon icon="mdi:check"></ha-icon>${t("inv.bought")}</button>`
      : "";
  return `<div class="card inv-item">
    <div class="header">
      ${i.photo
        ? `<img class="inv-photo" src="data:image/jpeg;base64,${i.photo}" data-action="inv-photo-view" data-id="${i.id}" alt="">`
        : `<span class="inv-photo ph"><ha-icon icon="mdi:package-variant"></ha-icon></span>`}
      <div style="min-width:0;flex:1">
        <h3 style="margin:0">${esc(i.name)}</h3>
        <div class="meta" style="margin-top:4px">
          ${i.category ? `<span class="chip">${esc(i.category)}</span>` : ""}
          ${qtyChip}
          ${expiryChip(i)}
          ${i.location ? `<span class="chip">📍 ${esc(i.location)}</span>` : ""}
          ${plant ? `<span class="chip">${esc(plant.emoji || "🪴")} ${esc(plant.name)}</span>` : ""}
        </div>
      </div>
    </div>
    ${list.kind === "inventory" ? usageBar(i) : ""}
    ${buyLine}
    ${i.desc ? `<div class="body" style="font-size:13px;color:var(--secondary-text-color)">${esc(i.desc)}</div>` : ""}
    <div class="inv-note" data-action="inv-note" data-id="${i.id}" title="${t("inv.note.edit")}">
      <ha-icon icon="mdi:note-edit-outline" style="--mdc-icon-size:14px"></ha-icon>
      ${m.note ? esc(m.note) : `<span style="color:var(--secondary-text-color)">${t("inv.note.add")}</span>`}
    </div>
    ${i.ean ? `<div style="font-size:12px;color:var(--secondary-text-color)">EAN: ${esc(i.ean)}</div>` : ""}
    <div class="actions">
      ${bought}
      <button class="icon-btn" data-action="inv-unlist" data-id="${i.id}" title="${t("inv.unlist")}"><ha-icon icon="mdi:playlist-remove"></ha-icon></button>
      <button class="icon-btn" data-action="inv-edit" data-id="${i.id}" title="${t("edit")}"><ha-icon icon="mdi:pencil-outline"></ha-icon></button>
      <button class="icon-btn" data-action="inv-delete" data-id="${i.id}" title="${t("delete")}"><ha-icon icon="mdi:trash-can-outline"></ha-icon></button>
    </div>
  </div>`;
}

/* ---------- dialogi list ---------- */

function listDialog(app, list) {
  app.dialog(
    `<h2>${list ? t("inv.list.edit") : t("inv.list.new")}</h2>
    <form>
      <label>${t("name")}</label>
      <input name="name" required maxlength="60" value="${esc(list?.name)}">
      <label>${t("inv.list.kind")}</label>
      <select name="kind">${KINDS.map((k) => `<option value="${k}" ${list?.kind === k ? "selected" : ""}>${t("inv.kind." + k)}</option>`).join("")}</select>
      <p style="font-size:13px;color:var(--secondary-text-color)">${t("inv.list.kind.hint")}</p>
      <div class="dialog-actions">
        <button type="button" class="btn plain" data-cancel>${t("cancel")}</button>
        <button type="submit" class="btn">${t("save")}</button>
      </div>
    </form>`,
    async (fd) => {
      await app.saveItem("inventory_lists", {
        id: list?.id ?? null,
        name: fd.get("name").trim(),
        kind: fd.get("kind"),
      });
      if (!list) app._invListId = lists(app)[lists(app).length - 1]?.id;
      app.render();
    }
  );
}

/* ---------- dialog produktu ---------- */

function itemDialog(app, item, prefill = null) {
  const draft = { photo: item?.photo || prefill?.photo || null };
  const src = item || prefill || {};
  const list = activeList(app);
  const memberRow = (l) => {
    const m = item?.memberships?.[l.id] || (!item && l.id === list?.id ? {} : null);
    return `<div class="inv-mrow">
      <label style="margin:0"><input type="checkbox" name="on_${l.id}" ${m ? "checked" : ""} style="width:auto">
        <ha-icon icon="${KIND_ICONS[l.kind]}" style="--mdc-icon-size:16px"></ha-icon>${esc(l.name)}</label>
      <input name="note_${l.id}" maxlength="200" placeholder="${t("inv.note")}" value="${esc(m?.note)}">
      ${l.kind === "shopping" ? `<input name="mqty_${l.id}" type="number" step="any" min="0" placeholder="${t("inv.buyqty")}" value="${m?.qty ?? ""}" style="width:110px">` : ""}
    </div>`;
  };
  const plantOpts = app.data.plants.map((p) => ({ value: p.id, label: p.name, icon: p.emoji || "🪴" }));
  const dlg = app.dialog(
    `<h2>${item ? t("inv.edit") : t("inv.new")}</h2>
    <form>
      <label>${t("name")}</label>
      <input name="name" required maxlength="120" value="${esc(src.name)}">
      <label>${t("inv.category")}</label>
      <select name="category">${cats(app).map((c) => `<option value="${esc(c)}" ${src.category === c ? "selected" : ""}>${esc(c)}</option>`).join("")}</select>
      <label>${t("inv.desc")}</label>
      <input name="desc" maxlength="300" value="${esc(src.desc)}">
      <label>${t("inv.location")}</label>
      <input name="location" maxlength="60" value="${esc(src.location)}" placeholder="${t("inv.location.ph")}">
      <div style="display:flex;gap:12px">
        <div style="flex:1"><label>${t("inv.qty")}</label>
          <input name="qty_val" type="number" step="any" min="0" value="${src.qty_val ?? ""}"></div>
        <div style="flex:1"><label>${t("inv.unit")}</label>
          <input name="qty_unit" list="inv-units" maxlength="16" value="${esc(src.qty_unit)}">
          <datalist id="inv-units">${UNITS.map((u) => `<option value="${u}">`).join("")}</datalist></div>
        <div style="flex:1"><label>${t("inv.usage")} (%)</label>
          <input name="usage_pct" type="number" min="0" max="100" step="1" value="${src.usage_pct ?? ""}"></div>
      </div>
      <div style="display:flex;gap:12px">
        <div style="flex:1"><label>${t("inv.expiry")}</label>
          <input name="expiry" type="date" value="${esc(src.expiry)}"></div>
        <div style="flex:1"><label>${t("inv.ean")}</label>
          <input name="ean" maxlength="20" inputmode="numeric" value="${esc(src.ean)}"></div>
      </div>
      <label>${t("inv.plant")}</label>
      ${combo({ name: "plant_id", value: src.plant_id || "", options: plantOpts })}
      <label>${t("inv.notes")}</label>
      <input name="notes" maxlength="400" value="${esc(src.notes)}">
      <label>${t("inv.lists")}</label>
      <div class="check-list">${lists(app).map(memberRow).join("")}</div>
      <label>${t("inv.photo")}</label>
      <div style="display:flex;align-items:center;gap:12px">
        <span id="inv-photo-preview">${draft.photo ? `<img class="inv-photo" src="data:image/jpeg;base64,${draft.photo}" alt="">` : ""}</span>
        <button type="button" class="btn small ghost" id="inv-photo-btn"><ha-icon icon="mdi:camera-outline"></ha-icon>${t("inv.photo.pick")}</button>
        <input type="file" id="inv-photo-file" accept="image/*" hidden>
      </div>
      <div class="dialog-actions">
        <button type="button" class="btn plain" data-cancel>${t("cancel")}</button>
        <button type="submit" class="btn">${t("save")}</button>
      </div>
    </form>`,
    (fd) => {
      const memberships = {};
      for (const l of lists(app)) {
        if (!fd.get(`on_${l.id}`)) continue;
        const q = fd.get(`mqty_${l.id}`);
        memberships[l.id] = {
          note: (fd.get(`note_${l.id}`) || "").trim(),
          qty: q === null || q === "" ? null : parseFloat(q),
        };
      }
      return app.saveItem("inventory", {
        id: item?.id ?? null,
        name: fd.get("name").trim(),
        category: fd.get("category"),
        desc: fd.get("desc").trim(),
        location: fd.get("location").trim(),
        qty_val: fd.get("qty_val") === "" ? null : parseFloat(fd.get("qty_val")),
        qty_unit: fd.get("qty_unit").trim(),
        usage_pct: fd.get("usage_pct") === "" ? null : Math.max(0, Math.min(100, parseInt(fd.get("usage_pct"), 10))),
        expiry: fd.get("expiry") || null,
        ean: fd.get("ean").trim(),
        plant_id: fd.get("plant_id") || null,
        notes: fd.get("notes").trim(),
        memberships,
        photo: draft.photo,
        added: item?.added || todayISO(),
      });
    },
    { wide: true }
  );
  const file = dlg.querySelector("#inv-photo-file");
  dlg.querySelector("#inv-photo-btn").addEventListener("click", () => file.click());
  file.addEventListener("change", async () => {
    if (!file.files[0]) return;
    const img = await resizeImage(file.files[0], 512, app);
    draft.photo = img.data; // ponytail: miniatura inline w storage
    dlg.querySelector("#inv-photo-preview").innerHTML = `<img class="inv-photo" src="${img.preview}" alt="">`;
  });
}

/* Notatka (i ilość do kupienia) na aktywnej liście — szybki dialog z karty. */
function noteDialog(app, item) {
  const list = activeList(app);
  const m = item.memberships[list.id] || {};
  app.dialog(
    `<h2>${esc(item.name)} — ${esc(list.name)}</h2>
    <form>
      <label>${t("inv.note.on")}</label>
      <input name="note" maxlength="200" value="${esc(m.note)}">
      ${list.kind === "shopping" ? `<label>${t("inv.buyqty")}${item.qty_unit ? ` (${esc(item.qty_unit)})` : ""}</label>
        <input name="qty" type="number" step="any" min="0" value="${m.qty ?? ""}">` : ""}
      <div class="dialog-actions">
        <button type="button" class="btn plain" data-cancel>${t("cancel")}</button>
        <button type="submit" class="btn">${t("save")}</button>
      </div>
    </form>`,
    (fd) => {
      const q = fd.get("qty");
      const memberships = {
        ...item.memberships,
        [list.id]: { note: (fd.get("note") || "").trim(), qty: q === null || q === "" ? null : parseFloat(q) },
      };
      return app.saveItem("inventory", { ...item, memberships });
    }
  );
}

/* ---------- skan AI ---------- */

function scanDialog(app) {
  const dlg = app.dialog(
    `<h2>${t("inv.scan")}</h2>
    <p style="font-size:14px;color:var(--secondary-text-color)">${t("inv.scan.hint")}</p>
    <div class="dropzone" id="inv-scan-drop"><ha-icon icon="mdi:camera-plus-outline"></ha-icon>${t("inv.scan.pick")}</div>
    <input type="file" id="inv-scan-file" accept="image/*" capture="environment" multiple hidden>
    <div id="inv-scan-state" style="font-size:14px;margin-top:8px"></div>
    <div class="dialog-actions"><button type="button" class="btn plain" data-cancel>${t("cancel")}</button></div>`,
    () => {}
  );
  const file = dlg.querySelector("#inv-scan-file");
  dlg.querySelector("#inv-scan-drop").addEventListener("click", () => file.click());
  file.addEventListener("change", async () => {
    const files = [...file.files].slice(0, 5);
    if (!files.length) return;
    const state = dlg.querySelector("#inv-scan-state");
    state.textContent = t("inv.scan.working");
    try {
      const images = [];
      for (const f of files) images.push((await resizeImage(f, 1024, app)).data);
      const out = await app.ws("inventory/scan", { images });
      dlg.close();
      if (!(out.items || []).length) {
        app.toast(t("inv.scan.none"), true);
        return;
      }
      resultsDialog(app, out.items, images[0]);
    } catch (e) {
      state.textContent = `⚠ ${e.message || e}`;
    }
  });
}

function resultsDialog(app, found, photo) {
  const dlg = app.dialog(
    `<h2>${t("inv.scan.found", { n: found.length })}</h2>
    <div class="check-list">
      ${found
        .map(
          (f, idx) => `<label><input type="checkbox" name="pick${idx}" checked>
            <span style="min-width:0"><b>${esc(f.name)}</b> ${f.category ? `<span class="chip">${esc(f.category)}</span>` : ""}
            ${f.qty ? `<span class="chip">${esc(f.qty)}</span>` : ""}${f.expiry ? `<span class="chip">${esc(f.expiry)}</span>` : ""}
            ${f.ean ? `<span class="chip">EAN ${esc(f.ean)}</span>` : ""}
            ${f.desc ? `<div style="font-size:12px;color:var(--secondary-text-color)">${esc(f.desc)}</div>` : ""}</span></label>`
        )
        .join("")}
    </div>
    <label>${t("inv.scan.target")}</label>
    <select name="target">${lists(app).map((l) => `<option value="${l.id}" ${activeList(app)?.id === l.id ? "selected" : ""}>${esc(l.name)}</option>`).join("")}</select>
    <form><div class="dialog-actions">
      <button type="button" class="btn plain" data-cancel>${t("cancel")}</button>
      <button type="submit" class="btn">${t("inv.scan.addsel")}</button>
    </div></form>`,
    async () => {
      const target = dlg.querySelector('select[name="target"]').value;
      const targetList = lists(app).find((l) => l.id === target);
      let added = 0;
      for (let idx = 0; idx < found.length; idx++) {
        if (!dlg.querySelector(`input[name="pick${idx}"]`)?.checked) continue;
        const f = found[idx];
        const m = String(f.qty || "").match(/^\s*(\d+[.,]?\d*)\s*(.*)$/);
        await app.saveItem("inventory", {
          id: null,
          name: f.name,
          category: f.category || "",
          desc: f.desc || "",
          qty_val: m ? parseFloat(m[1].replace(",", ".")) : null,
          qty_unit: m ? m[2].trim() : String(f.qty || "").trim(),
          ean: f.ean || "",
          expiry: f.expiry || null,
          usage_pct: targetList?.kind === "inventory" ? 100 : null,
          location: "",
          notes: "",
          plant_id: null,
          memberships: { [target]: { note: "", qty: null } },
          photo: photo || null,
          added: todayISO(),
        });
        added++;
      }
      app.toast(t("inv.scan.added", { n: added }));
    }
  );
}

export function bind(app, root) {
  const search = root.getElementById("inv-search");
  if (search) {
    search.addEventListener("input", () => {
      app._invFilter = search.value;
      clearTimeout(app._invFilterT);
      app._invFilterT = setTimeout(() => {
        app.render();
        const el = app.shadowRoot.getElementById("inv-search");
        el?.focus();
        el?.setSelectionRange(el.value.length, el.value.length);
      }, 250);
    });
  }
}

export const actions = {
  "inv-tab": (app, el) => {
    app._invListId = el.dataset.id;
    app.render();
  },
  "inv-list-add": (app) => listDialog(app),
  "inv-list-edit": (app, el) => listDialog(app, lists(app).find((l) => l.id === el.dataset.id)),
  "inv-list-del": async (app, el) => {
    const l = lists(app).find((x) => x.id === el.dataset.id);
    if (await app.confirm(t("inv.list.delete.confirm", { name: l.name }))) {
      await app.deleteItem("inventory_lists", l.id);
      app._invListId = lists(app)[0]?.id;
      app.render();
    }
  },
  "inv-add": (app) => itemDialog(app),
  "inv-edit": (app, el) => itemDialog(app, app.data.inventory.find((i) => i.id === el.dataset.id)),
  "inv-delete": async (app, el) => {
    const i = app.data.inventory.find((x) => x.id === el.dataset.id);
    if (await app.confirm(t("inv.delete.confirm", { name: i.name }))) app.deleteItem("inventory", i.id);
  },
  "inv-unlist": async (app, el) => {
    const i = app.data.inventory.find((x) => x.id === el.dataset.id);
    const list = activeList(app);
    const memberships = { ...i.memberships };
    delete memberships[list.id];
    if (!Object.keys(memberships).length) {
      if (await app.confirm(t("inv.unlist.last.confirm", { name: i.name }))) app.deleteItem("inventory", i.id);
      return;
    }
    app.saveItem("inventory", { ...i, memberships });
  },
  "inv-note": (app, el) => noteDialog(app, app.data.inventory.find((i) => i.id === el.dataset.id)),
  "inv-bought": (app, el) => {
    const i = app.data.inventory.find((x) => x.id === el.dataset.id);
    const list = activeList(app);
    const invList = lists(app).find((l) => l.kind === "inventory");
    const memberships = { ...i.memberships };
    delete memberships[list.id];
    if (invList) memberships[invList.id] = memberships[invList.id] || { note: "", qty: null };
    app.saveItem("inventory", { ...i, memberships, usage_pct: 100, added: todayISO() });
    app.toast(invList ? t("inv.bought.done", { name: invList.name }) : t("inv.bought.gone"));
  },
  "inv-scan": (app) => scanDialog(app),
  "inv-photo-view": (app, el) => {
    const i = app.data.inventory.find((x) => x.id === el.dataset.id);
    if (i?.photo)
      app.dialog(
        `<img src="data:image/jpeg;base64,${i.photo}" style="max-width:100%;border-radius:12px" alt="">
         <div class="dialog-actions"><button type="button" class="btn plain" data-cancel>${t("close")}</button></div>`,
        () => {},
        { wide: true }
      );
  },
};
