"""WebSocket API RootLab."""
import uuid
from datetime import date, timedelta

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import callback
import homeassistant.util.dt as dt_util

from . import ai
from .const import DOMAIN
from .store import async_save
from .verification import OPEN_METEO_MODELS, fetch_openmeteo_forecast, stats_payload

KINDS = ["zones", "plants", "sections", "tasks", "knowledge", "one_offs", "devices", "chats"]
# pola pomijane w liście (duże base64) — dostępne przez dedykowane komendy
HEAVY_PLANT_FIELDS = ("photos",)


def _items(data, kind):
    if kind == "sections":
        return data["irrigation"]["sections"]
    if kind == "one_offs":
        return data["irrigation"]["one_offs"]
    return data[kind]


def _public(hass):
    d = hass.data[DOMAIN]
    data = d["data"]
    options = d["entry"].options
    # lokalizacja ogrodu jest definiowana w Edytorze (layout), nie w opcjach
    location = data["layout"].get("location") or {}
    return {
        **{k: v for k, v in data.items() if k != "verify"},
        "plants": [
            {k: v for k, v in p.items() if k not in HEAVY_PLANT_FIELDS} for p in data["plants"]
        ],
        "crisis_history": [
            {k: v for k, v in e.items() if k != "image"} for e in data["crisis_history"]
        ],
        "active": {
            sid: {
                "end": run.get("end"),
                "paused": bool(run.get("paused")),
                "remaining_s": run.get("remaining_s"),
            }
            for sid, run in d["active"].items()
        },
        "ai_prompt_defaults": ai.PROMPT_DEFAULTS,
        "settings": {
            "latitude": location.get("latitude", hass.config.latitude),
            "ai_provider": options.get("ai_provider", "anthropic"),
            "has_weather_entity": bool(options.get("weather_entity")),
            "weather_entity": options.get("weather_entity"),
        },
    }


def async_register(hass):
    for cmd in (
        ws_get_data,
        ws_save_item,
        ws_delete_item,
        ws_irrigation_run,
        ws_irrigation_stop,
        ws_irrigation_pause_run,
        ws_irrigation_resume_run,
        ws_irrigation_pause,
        ws_irrigation_skip,
        ws_layout_save,
        ws_weather,
        ws_forecast,
        ws_tasks_generate,
        ws_tasks_apply,
        ws_crisis_diagnose,
        ws_crisis_add_plan,
        ws_crisis_archive,
        ws_crisis_delete,
        ws_prompts_save,
        ws_ai_ask,
        ws_chat_send,
        ws_chat_tasks,
        ws_verify_stats,
        ws_plant_photos,
        ws_photo_add,
        ws_photo_archive,
        ws_photo_delete,
    ):
        websocket_api.async_register_command(hass, cmd)


@websocket_api.websocket_command({vol.Required("type"): "rootlab/data"})
@callback
def ws_get_data(hass, connection, msg):
    connection.send_result(msg["id"], _public(hass))


@websocket_api.websocket_command(
    {
        vol.Required("type"): "rootlab/item/save",
        vol.Required("kind"): vol.In(KINDS),
        vol.Required("item"): dict,
    }
)
@websocket_api.async_response
async def ws_save_item(hass, connection, msg):
    items = _items(hass.data[DOMAIN]["data"], msg["kind"])
    item = msg["item"]
    if not item.get("id"):
        item["id"] = uuid.uuid4().hex
        items.append(item)
    else:
        for i, existing in enumerate(items):
            if existing["id"] == item["id"]:
                # merge — pola nieznane frontendowi (zdjęcia, notatki) nie giną przy edycji
                items[i] = {**existing, **item}
                break
        else:
            items.append(item)
    await async_save(hass)
    connection.send_result(msg["id"], _public(hass))


@websocket_api.websocket_command(
    {
        vol.Required("type"): "rootlab/item/delete",
        vol.Required("kind"): vol.In(KINDS),
        vol.Required("item_id"): str,
    }
)
@websocket_api.async_response
async def ws_delete_item(hass, connection, msg):
    data = hass.data[DOMAIN]["data"]
    kind, item_id = msg["kind"], msg["item_id"]
    if kind == "sections":
        await hass.data[DOMAIN]["irrigation_ctl"]["stop"](item_id)
        data["irrigation"]["sections"] = [
            s for s in data["irrigation"]["sections"] if s["id"] != item_id
        ]
        data["irrigation"]["one_offs"] = [
            o for o in data["irrigation"]["one_offs"] if o.get("section_id") != item_id
        ]
    elif kind == "one_offs":
        data["irrigation"]["one_offs"] = [
            o for o in data["irrigation"]["one_offs"] if o["id"] != item_id
        ]
    else:
        data[kind] = [i for i in data[kind] if i["id"] != item_id]
    if kind == "zones":
        for plant in data["plants"]:
            if plant.get("zone_id") == item_id:
                plant["zone_id"] = None
        for area in data["layout"]["items"]:
            if area.get("zone_id") == item_id:
                area["zone_id"] = None
        for device in data["devices"]:
            if device.get("zone_id") == item_id:
                device["zone_id"] = None
    if kind == "plants":
        data["layout"]["items"] = [
            i for i in data["layout"]["items"] if i.get("plant_id") != item_id
        ]
    await async_save(hass)
    connection.send_result(msg["id"], _public(hass))


# --- Nawadnianie ---


@websocket_api.websocket_command(
    {
        vol.Required("type"): "rootlab/irrigation/run",
        vol.Required("section_id"): str,
        vol.Required("minutes"): vol.All(int, vol.Range(min=1, max=120)),
    }
)
@websocket_api.async_response
async def ws_irrigation_run(hass, connection, msg):
    sections = hass.data[DOMAIN]["data"]["irrigation"]["sections"]
    section = next((s for s in sections if s["id"] == msg["section_id"]), None)
    if not section:
        connection.send_error(msg["id"], "not_found", "Nie ma takiej sekcji")
        return
    await hass.data[DOMAIN]["irrigation_ctl"]["start"](section, msg["minutes"])
    connection.send_result(msg["id"], _public(hass))


@websocket_api.websocket_command(
    {vol.Required("type"): "rootlab/irrigation/stop", vol.Required("section_id"): str}
)
@websocket_api.async_response
async def ws_irrigation_stop(hass, connection, msg):
    await hass.data[DOMAIN]["irrigation_ctl"]["stop"](msg["section_id"])
    connection.send_result(msg["id"], _public(hass))


@websocket_api.websocket_command(
    {vol.Required("type"): "rootlab/irrigation/pause_run", vol.Required("section_id"): str}
)
@websocket_api.async_response
async def ws_irrigation_pause_run(hass, connection, msg):
    await hass.data[DOMAIN]["irrigation_ctl"]["pause_run"](msg["section_id"])
    connection.send_result(msg["id"], _public(hass))


@websocket_api.websocket_command(
    {vol.Required("type"): "rootlab/irrigation/resume_run", vol.Required("section_id"): str}
)
@websocket_api.async_response
async def ws_irrigation_resume_run(hass, connection, msg):
    await hass.data[DOMAIN]["irrigation_ctl"]["resume_run"](msg["section_id"])
    connection.send_result(msg["id"], _public(hass))


@websocket_api.websocket_command(
    {
        vol.Required("type"): "rootlab/irrigation/pause",
        vol.Required("until"): vol.Any(None, str),
    }
)
@websocket_api.async_response
async def ws_irrigation_pause(hass, connection, msg):
    hass.data[DOMAIN]["data"]["irrigation"]["paused_until"] = msg["until"]
    await async_save(hass)
    connection.send_result(msg["id"], _public(hass))


@websocket_api.websocket_command(
    {
        vol.Required("type"): "rootlab/irrigation/skip",
        vol.Required("date"): vol.Any(None, str),
    }
)
@websocket_api.async_response
async def ws_irrigation_skip(hass, connection, msg):
    hass.data[DOMAIN]["data"]["irrigation"]["skip_date"] = msg["date"]
    await async_save(hass)
    connection.send_result(msg["id"], _public(hass))


# --- Edytor / pogoda ---


@websocket_api.websocket_command(
    {vol.Required("type"): "rootlab/layout/save", vol.Required("layout"): dict}
)
@websocket_api.async_response
async def ws_layout_save(hass, connection, msg):
    hass.data[DOMAIN]["data"]["layout"] = msg["layout"]
    await async_save(hass)
    connection.send_result(msg["id"], _public(hass))


@websocket_api.websocket_command({vol.Required("type"): "rootlab/weather"})
@websocket_api.async_response
async def ws_weather(hass, connection, msg):
    d = hass.data[DOMAIN]
    station = d["entry"].options.get("imgw_station", "warszawa")
    connection.send_result(msg["id"], await d["weather"].fetch(station))


@websocket_api.websocket_command(
    {
        vol.Required("type"): "rootlab/forecast",
        vol.Optional("source", default="ha"): str,
    }
)
@websocket_api.async_response
async def ws_forecast(hass, connection, msg):
    if msg["source"] in OPEN_METEO_MODELS:
        try:
            connection.send_result(msg["id"], await fetch_openmeteo_forecast(hass, msg["source"]))
        except Exception as err:  # noqa: BLE001
            connection.send_error(msg["id"], "forecast_error", str(err))
        return
    entity_id = hass.data[DOMAIN]["entry"].options.get("weather_entity")
    if not entity_id:
        connection.send_result(msg["id"], None)
        return
    out = {}
    for ftype, limit in (("hourly", 24), ("daily", 7)):
        try:
            resp = await hass.services.async_call(
                "weather",
                "get_forecasts",
                {"entity_id": entity_id, "type": ftype},
                blocking=True,
                return_response=True,
            )
            out[ftype] = (resp.get(entity_id) or {}).get("forecast", [])[:limit]
        except Exception:  # noqa: BLE001 — encja może nie wspierać danego typu
            out[ftype] = None
    connection.send_result(msg["id"], out)


# --- AI ---


def _ai_error(connection, msg_id, err):
    if isinstance(err, ai.NoApiKeyError):
        connection.send_error(
            msg_id,
            "no_api_key",
            "Skonfiguruj dostawcę AI w opcjach integracji RootLab (Ustawienia → "
            "Urządzenia i usługi → RootLab → Konfiguruj).",
        )
    else:
        connection.send_error(msg_id, "ai_error", str(err))


@websocket_api.websocket_command(
    {
        vol.Required("type"): "rootlab/tasks/generate",
        vol.Optional("categories", default=None): vol.Any(None, [str]),
        vol.Optional("plant_ids", default=None): vol.Any(None, [str]),
        vol.Optional("include_general", default=True): bool,
        vol.Optional("extra_prompt", default=None): vol.Any(None, str),
    }
)
@websocket_api.async_response
async def ws_tasks_generate(hass, connection, msg):
    """Podgląd generowania: zwraca propozycje i zadania do zastąpienia, NIE zapisuje."""
    try:
        fresh = await ai.async_generate_tasks(
            hass, msg["categories"], msg["plant_ids"], msg["include_general"],
            msg["extra_prompt"],
        )
    except Exception as err:  # noqa: BLE001
        _ai_error(connection, msg["id"], err)
        return
    cats = set(msg["categories"] or ["maintenance", "protection"])
    plant_scope = set(msg["plant_ids"]) if msg["plant_ids"] is not None else None

    def replaced(task):
        if task.get("source") != "ai" or task.get("done"):
            return False
        if (task.get("category") or "manual") not in cats:
            return False
        if task.get("plant_id") is None:
            return msg["include_general"] and plant_scope is None
        return plant_scope is None or task["plant_id"] in plant_scope

    to_remove = [t for t in hass.data[DOMAIN]["data"]["tasks"] if replaced(t)]
    connection.send_result(msg["id"], {"generated": fresh, "to_remove": to_remove})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "rootlab/tasks/apply",
        vol.Required("add"): [dict],
        vol.Required("remove_ids"): [str],
    }
)
@websocket_api.async_response
async def ws_tasks_apply(hass, connection, msg):
    """Wdraża wybrane zmiany z podglądu generowania."""
    data = hass.data[DOMAIN]["data"]
    remove = set(msg["remove_ids"])
    data["tasks"] = [t for t in data["tasks"] if t["id"] not in remove]
    for task in msg["add"]:
        if not task.get("id"):
            task["id"] = uuid.uuid4().hex
        data["tasks"].append(task)
    await async_save(hass)
    connection.send_result(msg["id"], _public(hass))


@websocket_api.websocket_command(
    {
        vol.Required("type"): "rootlab/crisis/diagnose",
        vol.Required("plant_id"): str,
        vol.Required("description"): str,
        vol.Optional("image", default=None): vol.Any(None, str),
        vol.Optional("media_type", default=None): vol.Any(None, str),
    }
)
@websocket_api.async_response
async def ws_crisis_diagnose(hass, connection, msg):
    data = hass.data[DOMAIN]["data"]
    plant = next((p for p in data["plants"] if p["id"] == msg["plant_id"]), None)
    if not plant:
        connection.send_error(msg["id"], "not_found", "Nie ma takiej rośliny")
        return
    try:
        diagnosis = await ai.async_diagnose(
            hass, plant, msg["description"], msg["image"], msg["media_type"]
        )
    except Exception as err:  # noqa: BLE001
        _ai_error(connection, msg["id"], err)
        return
    entry = {
        "id": uuid.uuid4().hex,
        "plant_id": plant["id"],
        "description": msg["description"],
        "image": msg["image"],
        "diagnosis": diagnosis,
        "created": dt_util.now().strftime("%Y-%m-%d %H:%M"),
        # do historii trafia dopiero po „Zapisz w historii" (crisis/archive → archived=False)
        "archived": True,
    }
    data["crisis_history"] = (data["crisis_history"] + [entry])[-50:]
    await async_save(hass)
    connection.send_result(msg["id"], {k: v for k, v in entry.items() if k != "image"})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "rootlab/crisis/add_plan",
        vol.Required("history_id"): str,
    }
)
@websocket_api.async_response
async def ws_crisis_add_plan(hass, connection, msg):
    data = hass.data[DOMAIN]["data"]
    entry = next((e for e in data["crisis_history"] if e["id"] == msg["history_id"]), None)
    if not entry:
        connection.send_error(msg["id"], "not_found", "Nie ma takiego zgłoszenia")
        return
    for step in entry["diagnosis"].get("steps", []):
        data["tasks"].append(
            {
                "id": uuid.uuid4().hex,
                "plant_id": entry["plant_id"],
                "category": "crisis",
                "title": step["title"],
                "details": entry["diagnosis"].get("problem", ""),
                "due": (date.today() + timedelta(days=step.get("due_in_days", 0))).isoformat(),
                "done": False,
                "source": "crisis",
                "created": date.today().isoformat(),
            }
        )
    await async_save(hass)
    connection.send_result(msg["id"], _public(hass))


@websocket_api.websocket_command(
    {
        vol.Required("type"): "rootlab/crisis/archive",
        vol.Required("history_id"): str,
        vol.Required("archived"): bool,
    }
)
@websocket_api.async_response
async def ws_crisis_archive(hass, connection, msg):
    """Archiwizacja diagnozy — pomijana w historii (UI i kontekst AI), do przywrócenia."""
    entry = next(
        (e for e in hass.data[DOMAIN]["data"]["crisis_history"] if e["id"] == msg["history_id"]),
        None,
    )
    if not entry:
        connection.send_error(msg["id"], "not_found", "Nie ma takiego zgłoszenia")
        return
    entry["archived"] = msg["archived"]
    await async_save(hass)
    connection.send_result(msg["id"], _public(hass))


@websocket_api.websocket_command(
    {vol.Required("type"): "rootlab/crisis/delete", vol.Required("history_id"): str}
)
@websocket_api.async_response
async def ws_crisis_delete(hass, connection, msg):
    data = hass.data[DOMAIN]["data"]
    data["crisis_history"] = [e for e in data["crisis_history"] if e["id"] != msg["history_id"]]
    await async_save(hass)
    connection.send_result(msg["id"], _public(hass))


@websocket_api.websocket_command(
    {vol.Required("type"): "rootlab/prompts/save", vol.Required("prompts"): dict}
)
@websocket_api.async_response
async def ws_prompts_save(hass, connection, msg):
    """Nadpisania promptów AI z zakładki Ustawienia — zapisywane tylko różnice od domyślnych."""
    clean = {}
    for key, default in ai.PROMPT_DEFAULTS.items():
        val = str(msg["prompts"].get(key) or "").strip()
        if val and val != default.strip():
            clean[key] = val
    hass.data[DOMAIN]["data"]["ai_prompts"] = clean
    await async_save(hass)
    connection.send_result(msg["id"], _public(hass))


@websocket_api.websocket_command(
    {
        vol.Required("type"): "rootlab/ai/ask",
        vol.Required("question"): str,
        vol.Optional("plant_id", default=None): vol.Any(None, str),
    }
)
@websocket_api.async_response
async def ws_ai_ask(hass, connection, msg):
    data = hass.data[DOMAIN]["data"]
    plant = next((p for p in data["plants"] if p["id"] == msg["plant_id"]), None)
    try:
        answer = await ai.async_ask(hass, msg["question"], plant)
    except Exception as err:  # noqa: BLE001
        _ai_error(connection, msg["id"], err)
        return
    if plant:
        # pytania do AI lądują w historii rośliny (karta rośliny → Historia)
        asks = plant.setdefault("asks", [])
        asks.append(
            {
                "id": uuid.uuid4().hex,
                "question": msg["question"],
                "answer": answer,
                "created": dt_util.now().strftime("%Y-%m-%d %H:%M"),
            }
        )
        plant["asks"] = asks[-30:]
        await async_save(hass)
    connection.send_result(msg["id"], {"answer": answer})


# --- Rozmowy diagnostyczne (zakładka Diagnoza AI) ---


@websocket_api.websocket_command(
    {
        vol.Required("type"): "rootlab/chat/send",
        vol.Required("chat_id"): str,
        vol.Required("message"): str,
    }
)
@websocket_api.async_response
async def ws_chat_send(hass, connection, msg):
    data = hass.data[DOMAIN]["data"]
    chat = next((c for c in data["chats"] if c["id"] == msg["chat_id"]), None)
    if not chat:
        connection.send_error(msg["id"], "not_found", "Nie ma takiej rozmowy")
        return
    plant = next((p for p in data["plants"] if p["id"] == chat.get("plant_id")), None)
    try:
        reply = await ai.async_chat(hass, chat, plant, msg["message"])
    except Exception as err:  # noqa: BLE001
        _ai_error(connection, msg["id"], err)
        return
    now = dt_util.now().strftime("%Y-%m-%d %H:%M")
    chat.setdefault("messages", []).append(
        {"role": "user", "content": msg["message"], "created": now}
    )
    chat["messages"].append({"role": "assistant", "content": reply, "created": now})
    chat["updated"] = now
    if not chat.get("title"):
        chat["title"] = msg["message"][:60]
    await async_save(hass)
    connection.send_result(msg["id"], chat)


@websocket_api.websocket_command(
    {vol.Required("type"): "rootlab/chat/tasks", vol.Required("chat_id"): str}
)
@websocket_api.async_response
async def ws_chat_tasks(hass, connection, msg):
    """Propozycje zadań z rozmowy — NIE zapisuje, frontend wdraża wybrane przez tasks/apply."""
    data = hass.data[DOMAIN]["data"]
    chat = next((c for c in data["chats"] if c["id"] == msg["chat_id"]), None)
    if not chat:
        connection.send_error(msg["id"], "not_found", "Nie ma takiej rozmowy")
        return
    plant = next((p for p in data["plants"] if p["id"] == chat.get("plant_id")), None)
    try:
        fresh = await ai.async_chat_tasks(hass, chat, plant)
    except Exception as err:  # noqa: BLE001
        _ai_error(connection, msg["id"], err)
        return
    connection.send_result(msg["id"], {"tasks": fresh})


# --- Zdjęcia roślin ---


@websocket_api.websocket_command({vol.Required("type"): "rootlab/verify/stats"})
@callback
def ws_verify_stats(hass, connection, msg):
    connection.send_result(msg["id"], stats_payload(hass))


@websocket_api.websocket_command(
    {vol.Required("type"): "rootlab/plant/photos", vol.Required("plant_id"): str}
)
@callback
def ws_plant_photos(hass, connection, msg):
    plant = next(
        (p for p in hass.data[DOMAIN]["data"]["plants"] if p["id"] == msg["plant_id"]), None
    )
    connection.send_result(msg["id"], (plant or {}).get("photos", []))


@websocket_api.websocket_command(
    {
        vol.Required("type"): "rootlab/plant/photo/add",
        vol.Required("plant_id"): str,
        vol.Required("image"): str,
        vol.Optional("caption", default=""): str,
        vol.Optional("condition", default=None): vol.Any(None, str),
    }
)
@websocket_api.async_response
async def ws_photo_add(hass, connection, msg):
    plant = next(
        (p for p in hass.data[DOMAIN]["data"]["plants"] if p["id"] == msg["plant_id"]), None
    )
    if not plant:
        connection.send_error(msg["id"], "not_found", "Nie ma takiej rośliny")
        return
    # snapshot odczytów w chwili dodania zdjęcia: czujniki rośliny + encje urządzeń jej strefy
    def _reading(entity_id):
        state = hass.states.get(entity_id)
        if not state or state.state in ("unavailable", "unknown"):
            return None
        unit = state.attributes.get("unit_of_measurement", "")
        return f"{state.state} {unit}".strip(), state

    readings, seen = {}, set()
    for key, entity_id in (plant.get("sensors") or {}).items():
        if entity_id and (got := _reading(entity_id)):
            readings[key] = got[0]
            seen.add(entity_id)
    for device in hass.data[DOMAIN]["data"]["devices"]:
        if not plant.get("zone_id") or device.get("zone_id") != plant["zone_id"]:
            continue
        for entity_id in (device.get("entities") or {}).values():
            if not entity_id or entity_id in seen:
                continue
            got = _reading(entity_id)
            if got:
                label = got[1].attributes.get("friendly_name") or entity_id
                readings[label] = got[0]
                seen.add(entity_id)
    photos = plant.setdefault("photos", [])
    photos.append(
        {
            "id": uuid.uuid4().hex,
            "image": msg["image"],
            "caption": msg["caption"],
            "condition": msg["condition"],
            "readings": readings,
            "created": dt_util.now().strftime("%Y-%m-%d %H:%M"),
        }
    )
    plant["photos"] = photos[-15:]  # limit rozmiaru storage
    await async_save(hass)
    connection.send_result(msg["id"], plant["photos"])


@websocket_api.websocket_command(
    {
        vol.Required("type"): "rootlab/plant/photo/archive",
        vol.Required("plant_id"): str,
        vol.Required("photo_id"): str,
        vol.Required("archived"): bool,
    }
)
@websocket_api.async_response
async def ws_photo_archive(hass, connection, msg):
    plant = next(
        (p for p in hass.data[DOMAIN]["data"]["plants"] if p["id"] == msg["plant_id"]), None
    )
    if not plant:
        connection.send_error(msg["id"], "not_found", "Nie ma takiej rośliny")
        return
    for photo in plant.get("photos", []):
        if photo["id"] == msg["photo_id"]:
            photo["archived"] = msg["archived"]
    await async_save(hass)
    connection.send_result(msg["id"], plant.get("photos", []))


@websocket_api.websocket_command(
    {
        vol.Required("type"): "rootlab/plant/photo/delete",
        vol.Required("plant_id"): str,
        vol.Required("photo_id"): str,
    }
)
@websocket_api.async_response
async def ws_photo_delete(hass, connection, msg):
    plant = next(
        (p for p in hass.data[DOMAIN]["data"]["plants"] if p["id"] == msg["plant_id"]), None
    )
    if not plant:
        connection.send_error(msg["id"], "not_found", "Nie ma takiej rośliny")
        return
    plant["photos"] = [f for f in plant.get("photos", []) if f["id"] != msg["photo_id"]]
    await async_save(hass)
    connection.send_result(msg["id"], plant["photos"])
