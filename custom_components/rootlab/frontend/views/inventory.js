import { t } from "../i18n.js";
import { esc, resizeImage, todayISO } from "../util.js";

const LISTS = ["own", "shopping", "wish"];
const CATEGORIES = ["seeds", "fertilizer", "protection", "tools", "irrigation", "substrate", "other"];
const CAT_ICONS = {
  seeds: "mdi:seed-outline",
  fertilizer: "mdi:bottle-tonic-outline",
  protection: "mdi:bug-outline",
  tools: "mdi:tools",
  irrigation: "mdi:pipe",
  substrate: "mdi:shovel",
  other: "mdi:package-variant",
};
const USAGE_LEVELS = [100, 75, 50, 25, 10, 0];

const listOf = (app) => app._invList || "own";
const items = (app) => (app.data.inventory || []).filter((i) => (i.list || "own") === listOf(app));

export function render(app) {
  const list = listOf(app);
  const filter = (app._invFilter || "").toLowerCase();
  const all = items(app)
    .filter(
      (i) =>
        !filter ||
        (i.name || "").toLowerCase().includes(filter) ||
        (i.desc || "").toLowerCase().includes(filter) ||
        (i.notes || "").toLowerCase().includes(filter) ||
        (i.ean || "").includes(filter)
    )
    .slice()
    .reverse();
  const toolbar = `<div class="toolbar">
    <div class="seg">
      ${LISTS.map(
        (l) => `<button class="btn small ${list === l ? "" : "ghost"}" data-action="inv-list" data-list="${l}">
          ${t("inv.list." + l)}${countBadge(app, l)}</button>`
      ).join("")}
    </div>
    <div class="spacer"></div>
    <button class="btn ghost" data-action="inv-scan"><ha-icon icon="mdi:camera-outline"></ha-icon>${t("inv.scan")}</button>
    <button class="btn" data-action="inv-add"><ha-icon icon="mdi:plus"></ha-icon>${t("inv.add")}</button>
  </div>
  <input class="kn-search" id="inv-search" placeholder="${t("inv.search.ph")}" value="${esc(app._invFilter || "")}">`;
  if (!all.length) {
    return `${toolbar}<div class="empty"><ha-icon icon="mdi:package-variant"></ha-icon><p>${t("inv.empty." + list)}</p></div>`;
  }
  return `${toolbar}<div class="grid">${all.map((i) => card(app, i)).join("")}</div>`;
}

function countBadge(app, list) {
  const n = (app.data.inventory || []).filter((i) => (i.list || "own") === list).length;
  return n ? ` <span class="chip" style="font-size:11px;padding:0 6px">${n}</span>` : "";
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
  return `<div class="inv-usage" title="${t("inv.usage")}: ${pct}%">
    <div class="fill" style="width:${pct}%;background:${color}"></div></div>`;
}

function card(app, i) {
  const list = i.list || "own";
  const move =
    list === "own"
      ? `<button class="icon-btn" data-action="inv-move" data-id="${i.id}" data-to="shopping" title="${t("inv.rebuy")}"><ha-icon icon="mdi:cart-plus"></ha-icon></button>`
      : list === "shopping"
        ? `<button class="btn small" data-action="inv-move" data-id="${i.id}" data-to="own"><ha-icon icon="mdi:check"></ha-icon>${t("inv.bought")}</button>`
        : `<button class="btn small ghost" data-action="inv-move" data-id="${i.id}" data-to="shopping"><ha-icon icon="mdi:cart-arrow-down"></ha-icon>${t("inv.tocart")}</button>`;
  return `<div class="card inv-item">
    <div class="header">
      ${i.photo
        ? `<img class="inv-photo" src="data:image/jpeg;base64,${i.photo}" data-action="inv-photo-view" data-id="${i.id}" alt="">`
        : `<span class="inv-photo ph"><ha-icon icon="${CAT_ICONS[i.category] || CAT_ICONS.other}"></ha-icon></span>`}
      <div style="min-width:0;flex:1">
        <h3 style="margin:0">${esc(i.name)}</h3>
        <div class="meta" style="margin-top:4px">
          <span class="chip"><ha-icon icon="${CAT_ICONS[i.category] || CAT_ICONS.other}" style="--mdc-icon-size:12px"></ha-icon> ${t("inv.cat." + (i.category || "other"))}</span>
          ${i.qty ? `<span class="chip">${esc(i.qty)}</span>` : ""}
          ${expiryChip(i)}
          ${i.location ? `<span class="chip">📍 ${esc(i.location)}</span>` : ""}
        </div>
      </div>
    </div>
    ${usageBar(i)}
    ${i.desc ? `<div class="body" style="font-size:13px;color:var(--secondary-text-color)">${esc(i.desc)}</div>` : ""}
    ${i.notes ? `<div class="body" style="font-size:13px">${esc(i.notes)}</div>` : ""}
    ${i.ean ? `<div style="font-size:12px;color:var(--secondary-text-color)">EAN: ${esc(i.ean)}</div>` : ""}
    <div class="actions">
      ${move}
      <button class="icon-btn" data-action="inv-edit" data-id="${i.id}" title="${t("edit")}"><ha-icon icon="mdi:pencil-outline"></ha-icon></button>
      <button class="icon-btn" data-action="inv-delete" data-id="${i.id}" title="${t("delete")}"><ha-icon icon="mdi:trash-can-outline"></ha-icon></button>
    </div>
  </div>`;
}

/* ---------- dialog dodawania / edycji ---------- */

function itemDialog(app, item) {
  const draft = { photo: item?.photo || null };
  const dlg = app.dialog(
    `<h2>${item ? t("inv.edit") : t("inv.new")}</h2>
    <form>
      <label>${t("name")}</label>
      <input name="name" required maxlength="120" value="${esc(item?.name)}">
      <label>${t("inv.category")}</label>
      <select name="category">${CATEGORIES.map((c) => `<option value="${c}" ${item?.category === c ? "selected" : ""}>${t("inv.cat." + c)}</option>`).join("")}</select>
      <label>${t("inv.desc")}</label>
      <input name="desc" maxlength="300" value="${esc(item?.desc)}">
      <div style="display:flex;gap:12px">
        <div style="flex:1"><label>${t("inv.qty")}</label>
          <input name="qty" maxlength="40" value="${esc(item?.qty)}" placeholder="np. 500 ml"></div>
        <div style="flex:1"><label>${t("inv.location")}</label>
          <input name="location" maxlength="60" value="${esc(item?.location)}" placeholder="${t("inv.location.ph")}"></div>
      </div>
      <div style="display:flex;gap:12px">
        <div style="flex:1"><label>${t("inv.usage")}</label>
          <select name="usage_pct">
            <option value="">—</option>
            ${USAGE_LEVELS.map((u) => `<option value="${u}" ${String(item?.usage_pct) === String(u) ? "selected" : ""}>${u}%</option>`).join("")}
          </select></div>
        <div style="flex:1"><label>${t("inv.expiry")}</label>
          <input name="expiry" type="date" value="${esc(item?.expiry)}"></div>
      </div>
      <label>${t("inv.ean")}</label>
      <input name="ean" maxlength="20" inputmode="numeric" value="${esc(item?.ean)}">
      <label>${t("inv.notes")}</label>
      <input name="notes" maxlength="400" value="${esc(item?.notes)}">
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
    (fd) =>
      app.saveItem("inventory", {
        id: item?.id ?? null,
        list: item?.list || listOf(app),
        name: fd.get("name").trim(),
        category: fd.get("category"),
        desc: fd.get("desc").trim(),
        qty: fd.get("qty").trim(),
        location: fd.get("location").trim(),
        usage_pct: fd.get("usage_pct") === "" ? null : parseInt(fd.get("usage_pct"), 10),
        expiry: fd.get("expiry") || null,
        ean: fd.get("ean").trim(),
        notes: fd.get("notes").trim(),
        photo: draft.photo,
        added: item?.added || todayISO(),
      })
  );
  const file = dlg.querySelector("#inv-photo-file");
  dlg.querySelector("#inv-photo-btn").addEventListener("click", () => file.click());
  file.addEventListener("change", async () => {
    if (!file.files[0]) return;
    const img = await resizeImage(file.files[0], 512, app);
    draft.photo = img.data; // ponytail: miniatura inline w storage; osobne komendy zdjęć gdy urośnie
    dlg.querySelector("#inv-photo-preview").innerHTML = `<img class="inv-photo" src="${img.preview}" alt="">`;
  });
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
            <span style="min-width:0"><b>${esc(f.name)}</b> <span class="chip">${t("inv.cat." + (f.category || "other"))}</span>
            ${f.qty ? `<span class="chip">${esc(f.qty)}</span>` : ""}${f.expiry ? `<span class="chip">${esc(f.expiry)}</span>` : ""}
            ${f.ean ? `<span class="chip">EAN ${esc(f.ean)}</span>` : ""}
            ${f.desc ? `<div style="font-size:12px;color:var(--secondary-text-color)">${esc(f.desc)}</div>` : ""}</span></label>`
        )
        .join("")}
    </div>
    <label>${t("inv.scan.target")}</label>
    <select name="target">${LISTS.map((l) => `<option value="${l}" ${listOf(app) === l ? "selected" : ""}>${t("inv.list." + l)}</option>`).join("")}</select>
    <form><div class="dialog-actions">
      <button type="button" class="btn plain" data-cancel>${t("cancel")}</button>
      <button type="submit" class="btn">${t("inv.scan.addsel")}</button>
    </div></form>`,
    async () => {
      // dialog jest już zamknięty, ale jego DOM zostaje do następnego otwarcia
      const target = dlg.querySelector('select[name="target"]').value;
      let added = 0;
      for (let idx = 0; idx < found.length; idx++) {
        if (!dlg.querySelector(`input[name="pick${idx}"]`)?.checked) continue;
        const f = found[idx];
        await app.saveItem("inventory", {
          id: null,
          list: target,
          name: f.name,
          category: f.category || "other",
          desc: f.desc || "",
          qty: f.qty || "",
          ean: f.ean || "",
          expiry: f.expiry || null,
          usage_pct: target === "own" ? 100 : null,
          location: "",
          notes: "",
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
  "inv-list": (app, el) => {
    app._invList = el.dataset.list;
    app.render();
  },
  "inv-add": (app) => itemDialog(app),
  "inv-edit": (app, el) => itemDialog(app, app.data.inventory.find((i) => i.id === el.dataset.id)),
  "inv-delete": async (app, el) => {
    const i = app.data.inventory.find((x) => x.id === el.dataset.id);
    if (await app.confirm(t("inv.delete.confirm", { name: i.name }))) app.deleteItem("inventory", i.id);
  },
  "inv-move": (app, el) => {
    const i = app.data.inventory.find((x) => x.id === el.dataset.id);
    const to = el.dataset.to;
    const patch = { ...i, list: to };
    if (to === "own") {
      patch.added = todayISO();
      patch.usage_pct = 100;
    }
    if (to === "shopping" && (i.list || "own") === "own") {
      // dokupienie: kopia na listę zakupów, oryginał zostaje w inwentarzu
      app.saveItem("inventory", { ...patch, id: null, photo: i.photo, notes: i.notes });
      app.toast(t("inv.rebuy.done"));
      return;
    }
    app.saveItem("inventory", patch);
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
