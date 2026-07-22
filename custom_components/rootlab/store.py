"""Ładowanie i zapis danych RootLab (jeden plik w storage HA)."""
import copy

from homeassistant.helpers.storage import Store

from .const import DOMAIN

STORAGE_KEY = f"{DOMAIN}.data"

DEFAULTS = {
    "zones": [],
    "plants": [],
    "tasks": [],
    "knowledge": [],
    "irrigation": {"sections": [], "paused_until": None, "skip_date": None, "one_offs": []},
    "crisis_history": [],
    "layout": {"width_m": 20.0, "height_m": 12.0, "north_deg": 0, "items": []},
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
    return store, data


async def async_save(hass):
    d = hass.data[DOMAIN]
    await d["store"].async_save(d["data"])
    hass.bus.async_fire("rootlab_updated")
