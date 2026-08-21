"""Ładowanie i zapis danych RootLab (jeden plik w storage HA)."""
import copy
import uuid

from homeassistant.helpers.storage import Store

from .const import DOMAIN

STORAGE_KEY = f"{DOMAIN}.data"

DEFAULTS = {
    "zones": [],
    "plants": [],
    "tasks": [],
    "knowledge": [],
    "devices": [],
    "irrigation": {"sections": [], "paused_until": None, "skip_date": None, "one_offs": []},
    "crisis_history": [],
    "ai_prompts": {},
    "chats": [],
    "plantings": [],
    "inventory": [],
    "inventory_lists": [],
    "inventory_categories": [
        "Nasiona", "Cebule i sadzonki", "Nawozy", "Środki ochrony roślin", "Repelenty",
        "Narzędzia", "Nawadnianie i złączki", "Podłoża i ziemia", "Doniczki i pojemniki",
        "Osłony i agrowłókniny", "Podpory i siatki", "Elektronika i czujniki", "Inne",
    ],
    "shop": {"websearch": False, "feedback": False},
    "verify": {"snapshot": None, "actuals": None, "stats": {}},
    "layout": {"width_m": 20.0, "height_m": 12.0, "north_deg": 0, "location": None, "items": []},
}


async def async_load_data(hass):
    store = Store(hass, 1, STORAGE_KEY)
    data = await store.async_load() or {}
    # ponytail: migracja addytywna — brakujące klucze dokładamy defaultami zamiast wersjonować storage
    for key, default in DEFAULTS.items():
        data.setdefault(key, copy.deepcopy(default))
    for key, default in DEFAULTS["irrigation"].items():
        data["irrigation"].setdefault(key, copy.deepcopy(default))
    for key, default in DEFAULTS["layout"].items():
        data["layout"].setdefault(key, copy.deepcopy(default))
    for key, default in DEFAULTS["shop"].items():
        data["shop"].setdefault(key, default)
    for item in data["layout"]["items"]:
        if item.get("kind") == "object":  # dawny „Obiekt" → „Krzew"
            item["kind"] = "shrub"
    _migrate_zone_places(data)
    _migrate_inventory(data)
    return store, data


AREA_EMOJI = {"greenhouse": "🏠", "bed": "🥬", "orchard": "🍎", "lawn": "🌿"}


def _migrate_zone_places(data):
    """Strefa = jedyna tożsamość miejsca; rysunek na planie to tylko jej kształt.

    Obszary bez strefy dostają autostrefę, typ obszaru przenosi się na strefę,
    a uprawy przechodzą z area_id na zone_id. Idempotentne.
    """
    zones = data["zones"]
    zone_by_id = {z["id"]: z for z in zones}
    areas = [i for i in data["layout"]["items"] if "w" in i]
    for a in areas:
        zone = zone_by_id.get(a.get("zone_id"))
        if zone is None:
            zone = {
                "id": uuid.uuid4().hex,
                "name": a.get("label") or a.get("kind", "?"),
                "emoji": AREA_EMOJI.get(a.get("kind"), "🪴"),
                "planting": None,
            }
            zones.append(zone)
            zone_by_id[zone["id"]] = zone
            a["zone_id"] = zone["id"]
        zone.setdefault("kind", a.get("kind"))
    area_zone = {a["id"]: a.get("zone_id") for a in areas}
    for p in data["plantings"]:
        aid = p.pop("area_id", None)
        if not p.get("zone_id"):
            p["zone_id"] = area_zone.get(aid) or (aid if aid in zone_by_id else None)


async def async_save(hass):
    d = hass.data[DOMAIN]
    await d["store"].async_save(d["data"])
    hass.bus.async_fire("rootlab_updated")


_INV_CAT_LABELS = {
    "seeds": "Nasiona", "fertilizer": "Nawozy", "protection": "Środki ochrony roślin",
    "tools": "Narzędzia", "irrigation": "Nawadnianie i złączki",
    "substrate": "Podłoża i ziemia", "other": "Inne",
}
_INV_LIST_NAMES = {
    "own": ("Inwentarz", "inventory"),
    "shopping": ("Lista zakupów", "shopping"),
    "wish": ("Wishlista", "wish"),
}


def _migrate_inventory(data):
    """beta.4 → listy użytkownika: pole list → memberships, qty tekstowe → liczba+jednostka."""
    import re

    lists = data["inventory_lists"]
    for item in data["inventory"]:
        legacy = item.pop("list", None)
        if "memberships" not in item:
            name, kind = _INV_LIST_NAMES.get(legacy or "own", _INV_LIST_NAMES["own"])
            lst = next((l for l in lists if l.get("kind") == kind and l.get("name") == name), None)
            if not lst:
                lst = {"id": uuid.uuid4().hex, "name": name, "kind": kind}
                lists.append(lst)
            item["memberships"] = {lst["id"]: {"note": "", "qty": None}}
        if "qty_val" not in item:
            raw = str(item.pop("qty", "") or "")
            m = re.match(r"^\s*(\d+[.,]?\d*)\s*(.*)$", raw)
            item["qty_val"] = float(m.group(1).replace(",", ".")) if m else None
            item["qty_unit"] = (m.group(2).strip() if m else raw.strip())
        if item.get("category") in _INV_CAT_LABELS:
            item["category"] = _INV_CAT_LABELS[item["category"]]
        item.setdefault("plant_id", None)
