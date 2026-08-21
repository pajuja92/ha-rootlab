"""WebSocket API RootLab."""
import uuid
from datetime import date, timedelta

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import callback
import homeassistant.util.dt as dt_util

from . import ai
from .const import DOMAIN, SHOP_CATALOG_URL, SHOP_FEEDBACK_URL, VERSION
from .store import async_save
from .verification import OPEN_METEO_MODELS, fetch_openmeteo_forecast, stats_payload

KINDS = ["zones", "plants", "sections", "tasks", "knowledge", "one_offs", "devices", "chats", "plantings", "inventory"]
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
            {k: v for k, v in e.items() if k not in ("image", "images")}
            for e in data["crisis_history"]
        ],
        # zdjęcia w wiadomościach są ciężkie — pełna rozmowa przez rootlab/chat/get
        "chats": [
            {
                **c,
                "messages": [
                    {k: v for k, v in m.items() if k != "images"}
                    for m in c.get("messages", [])
                ],
            }
            for c in data["chats"]
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
        ws_chat_get,
        ws_image_convert,
        ws_grow_generate,
        ws_grow_apply,
        ws_shop_save,
        ws_shop_catalog,
        ws_verify_stats,
        ws_plant_photos,
        ws_photo_add,
        ws_photo_archive,
        ws_photo_delete,
        ws_inventory_scan,
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
        vol.Optional("images", default=None): vol.Any(None, [str]),
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
    images = (msg["images"] or ([msg["image"]] if msg["image"] else []))[:5]
    try:
        diagnosis = await ai.async_diagnose(
            hass, plant, msg["description"], images, msg["media_type"]
        )
    except Exception as err:  # noqa: BLE001
        _ai_error(connection, msg["id"], err)
        return
    entry = {
        "id": uuid.uuid4().hex,
        "plant_id": plant["id"],
        "description": msg["description"],
        "images": images,
        "diagnosis": diagnosis,
        "created": dt_util.now().strftime("%Y-%m-%d %H:%M"),
        # do historii trafia dopiero po „Zapisz w historii" (crisis/archive → archived=False)
        "archived": True,
    }
    data["crisis_history"] = (data["crisis_history"] + [entry])[-50:]
    await async_save(hass)
    connection.send_result(
        msg["id"], {k: v for k, v in entry.items() if k not in ("image", "images")}
    )


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
        vol.Optional("context", default=None): vol.Any(None, str),
        vol.Optional("images", default=None): vol.Any(None, [str]),
    }
)
@websocket_api.async_response
async def ws_chat_send(hass, connection, msg):
    data = hass.data[DOMAIN]["data"]
    chat = next((c for c in data["chats"] if c["id"] == msg["chat_id"]), None)
    # katalog produktów sklepu — AI poleca pasujące pozycje z linkami
    products = await _shop_catalog(hass)
    if products:
        lines = "\n".join(
            f"- {p.get('name', '')} — {p.get('price', '?')} — {p.get('url', '')}"
            + (f" ({p['desc']})" if p.get("desc") else "")
            for p in products[:40]
        )
        extra = (
            "Masz dostęp do katalogu produktów sklepu (niżej). Zasady — wiedza przede "
            "wszystkim: najpierw pełna, merytoryczna pomoc (diagnoza, przyczyny, co "
            "zrobić, także domowymi sposobami). Produkt wspomnij TYLKO wtedy, gdy wprost "
            "odpowiada na zdiagnozowany problem — krótko, najwyżej jedną pozycję, z "
            "linkiem, jako wtrącenie w stylu „pomocny może być…”. Nigdy: nie dopytuj o "
            "preferencje zakupowe, nie proponuj „doboru produktów z katalogu”, nie "
            "wracaj do tematu zakupów, jeśli użytkownik go nie podjął.\n" + lines
        )
        extra += (
            "\n\nJeśli z problemu użytkownika naturalnie wynika potrzeba produktu, "
            "którego NIE ma w katalogu, dopisz na samym końcu odpowiedzi osobną "
            "linię w formacie: [POTRZEBA: krótki opis produktu]. Nie pytaj o to "
            "użytkownika i nie wspominaj o tym w treści."
        )
        msg["context"] = f"{msg['context']}\n\n{extra}" if msg["context"] else extra
    if not chat:
        connection.send_error(msg["id"], "not_found", "Nie ma takiej rozmowy")
        return
    plant = next((p for p in data["plants"] if p["id"] == chat.get("plant_id")), None)
    images = (msg["images"] or [])[:5]
    try:
        reply = await ai.async_chat(
            hass, chat, plant, msg["message"], msg["context"], images or None
        )
    except Exception as err:  # noqa: BLE001
        _ai_error(connection, msg["id"], err)
        return
    # markery [POTRZEBA: …]: za zgodą — wysyłka + jawna informacja w czacie;
    # bez zgody — informacja, że zgodę można włączyć w Ustawieniach
    import re as _re

    needs = _re.findall(r"\[POTRZEBA:\s*(.*?)\]", reply)
    if needs:
        reply = _re.sub(r"\s*\[POTRZEBA:.*?\]", "", reply).strip()
        listed = "; ".join(n.strip() for n in needs)
        if (data.get("shop") or {}).get("feedback"):
            hass.async_create_task(_send_shop_feedback(hass, needs))
            reply += (
                f"\n\n📤 Zgłosiłem do sklepu zapotrzebowanie: {listed} "
                "(anonimowo — tylko ten opis, bez treści rozmowy)."
            )
        else:
            reply += (
                f"\n\nℹ️ Z rozmowy wynika zapotrzebowanie na produkt spoza katalogu: {listed}. "
                "Jeśli chcesz, mogę takie potrzeby anonimowo zgłaszać do sklepu (tylko krótki "
                "opis, bez treści rozmowy) — zgodę włączysz w Ustawienia → Sklep i produkty."
            )
    now = dt_util.now().strftime("%Y-%m-%d %H:%M")
    user_msg = {"role": "user", "content": msg["message"], "created": now}
    if images:
        user_msg["images"] = images
    chat.setdefault("messages", []).append(user_msg)
    chat["messages"].append({"role": "assistant", "content": reply, "created": now})
    chat["updated"] = now
    if not chat.get("title"):
        chat["title"] = msg["message"][:60]
    await async_save(hass)
    connection.send_result(msg["id"], chat)


@websocket_api.websocket_command(
    {vol.Required("type"): "rootlab/chat/get", vol.Required("chat_id"): str}
)
@callback
def ws_chat_get(hass, connection, msg):
    """Pełna rozmowa (ze zdjęciami w wiadomościach) — lista w rootlab/data jest odchudzona."""
    chat = next(
        (c for c in hass.data[DOMAIN]["data"]["chats"] if c["id"] == msg["chat_id"]), None
    )
    if not chat:
        connection.send_error(msg["id"], "not_found", "Nie ma takiej rozmowy")
        return
    connection.send_result(msg["id"], chat)


@websocket_api.websocket_command(
    {
        vol.Required("type"): "rootlab/image/convert",
        vol.Required("data"): str,
        vol.Optional("max", default=1024): int,
    }
)
@websocket_api.async_response
async def ws_image_convert(hass, connection, msg):
    """Konwersja zdjęć, których przeglądarka nie dekoduje (HEIC z iPhone'a) → JPEG.

    ponytail: limit wiadomości websocket ~4 MB — bardzo duże HEIC-i mogą się nie
    zmieścić; wtedy front pokaże błąd i zostaje ręczna konwersja.
    """
    import base64
    import io

    def _convert():
        from PIL import Image, ImageOps

        try:
            from pillow_heif import register_heif_opener

            register_heif_opener()
        except ImportError:
            pass
        img = Image.open(io.BytesIO(base64.b64decode(msg["data"])))
        img = ImageOps.exif_transpose(img).convert("RGB")
        scale = min(1.0, msg["max"] / max(img.size))
        if scale < 1:
            img = img.resize((round(img.width * scale), round(img.height * scale)))
        buf = io.BytesIO()
        img.save(buf, "JPEG", quality=85)
        return base64.b64encode(buf.getvalue()).decode()

    try:
        out = await hass.async_add_executor_job(_convert)
    except Exception as err:  # noqa: BLE001
        connection.send_error(
            msg["id"], "convert_error", f"Nie udało się przekonwertować zdjęcia: {err}"
        )
        return
    connection.send_result(msg["id"], {"data": out})


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


# --- Uprawy (plan sezonu) ---


@websocket_api.websocket_command(
    {
        vol.Required("type"): "rootlab/grow/generate",
        vol.Required("areas"): [dict],
        vol.Required("catalog"): [dict],
        vol.Optional("wishes", default=None): vol.Any(None, str),
    }
)
@websocket_api.async_response
async def ws_grow_generate(hass, connection, msg):
    """Propozycje obsadzeń od AI — NIE zapisuje, frontend wdraża wybrane przez grow/apply."""
    try:
        fresh = await ai.async_plan_season(hass, msg["areas"], msg["catalog"], msg["wishes"])
    except Exception as err:  # noqa: BLE001
        _ai_error(connection, msg["id"], err)
        return
    connection.send_result(msg["id"], {"plantings": fresh})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "rootlab/grow/apply",
        vol.Required("plantings"): [dict],
        vol.Optional("tasks", default=[]): [dict],
    }
)
@websocket_api.async_response
async def ws_grow_apply(hass, connection, msg):
    """Zapis zaakceptowanych obsadzeń (+ opcjonalnych zadań); każda uprawa dostaje kartę rośliny."""
    data = hass.data[DOMAIN]["data"]
    zone_ids = {z["id"] for z in data.get("zones", [])}
    made = {}  # (nazwa, strefa) -> plant_id; seria sukcesyjna = jedna karta
    for planting in msg["plantings"]:
        if not planting.get("id"):
            planting["id"] = uuid.uuid4().hex
        if not planting.get("plant_id"):
            key = (planting.get("name"), planting.get("zone_id"))
            if key not in made:
                plant = {
                    "id": uuid.uuid4().hex,
                    "name": planting.get("name", ""),
                    "species": planting.get("species", ""),
                    "emoji": planting.get("emoji", ""),
                    "zone_id": planting.get("zone_id") if planting.get("zone_id") in zone_ids else None,
                    "planting": None,
                    "sensors": {},
                }
                data["plants"].append(plant)
                made[key] = plant["id"]
            planting["plant_id"] = made[key]
        data["plantings"].append(planting)
    for task in msg["tasks"]:
        if not task.get("id"):
            task["id"] = uuid.uuid4().hex
        data["tasks"].append(task)
    await async_save(hass)
    connection.send_result(msg["id"], _public(hass))


# --- Zdjęcia roślin ---


CATALOG_TTL = 6 * 3600  # katalog sklepu autora — odświeżanie co 6 h


async def _shop_catalog(hass, force=False):
    """Publiczny katalog produktów (SHOP_CATALOG_URL) z cache w pamięci.

    Format: JSON-owa lista {name, price, url, desc}. Błąd sieci → ostatni cache
    albo pusta lista; rekomendacje po prostu znikają, nic się nie wywala.
    """
    from homeassistant.helpers.aiohttp_client import async_get_clientsession
    from homeassistant.util import dt as dt_util

    cache = hass.data[DOMAIN].setdefault("shop_catalog", {"at": 0, "items": []})
    now = dt_util.utcnow().timestamp()
    if not force and now - cache["at"] < CATALOG_TTL:
        return cache["items"]
    try:
        resp = await async_get_clientsession(hass).get(SHOP_CATALOG_URL, timeout=20)
        if resp.status == 200:
            items = await resp.json(content_type=None)
            if isinstance(items, list):
                cache["items"] = [
                    {
                        "name": str(it.get("name", "")),
                        "price": str(it.get("price", "")),
                        "url": str(it.get("url", "")),
                        "desc": str(it.get("desc", ""))[:200],
                    }
                    for it in items
                    if isinstance(it, dict) and it.get("name")
                ][:60]
        cache["at"] = now
    except Exception:  # noqa: BLE001 — katalog jest opcjonalny
        cache["at"] = now  # nie młóć endpointu przy każdej wiadomości
    return cache["items"]


async def _send_shop_feedback(hass, needs):
    """Anonimowy POST z potrzebami produktowymi; brak endpointu = cisza."""
    from homeassistant.helpers.aiohttp_client import async_get_clientsession
    from homeassistant.util import dt as dt_util_local

    try:
        await async_get_clientsession(hass).post(
            SHOP_FEEDBACK_URL,
            json={
                "needs": [n.strip()[:200] for n in needs],
                "date": dt_util_local.now().strftime("%Y-%m-%d"),
                "version": VERSION,
            },
            timeout=15,
        )
    except Exception:  # noqa: BLE001 — feedback jest best-effort
        pass


@websocket_api.websocket_command(
    {
        vol.Required("type"): "rootlab/shop/save",
        vol.Required("config"): dict,
    }
)
@websocket_api.async_response
async def ws_shop_save(hass, connection, msg):
    """Ustawienia sklepu: zgoda na wyszukiwanie produktów w internecie."""
    shop = hass.data[DOMAIN]["data"]["shop"]
    for key in ("websearch", "feedback"):
        if key in msg["config"]:
            shop[key] = bool(msg["config"][key])
    await async_save(hass)
    connection.send_result(msg["id"], _public(hass))


@websocket_api.websocket_command({vol.Required("type"): "rootlab/shop/catalog"})
@websocket_api.async_response
async def ws_shop_catalog(hass, connection, msg):
    """Podgląd/odświeżenie katalogu sklepu w Ustawieniach."""
    items = await _shop_catalog(hass, force=True)
    connection.send_result(msg["id"], {"url": SHOP_CATALOG_URL, "items": items})


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


@websocket_api.websocket_command(
    {
        vol.Required("type"): "rootlab/inventory/scan",
        vol.Required("images"): [str],
        vol.Optional("media_type", default="image/jpeg"): str,
    }
)
@websocket_api.async_response
async def ws_inventory_scan(hass, connection, msg):
    try:
        parsed = await ai.async_scan_inventory(hass, msg["images"][:5], msg["media_type"])
    except Exception as err:  # noqa: BLE001
        _ai_error(connection, msg["id"], err)
        return
    connection.send_result(msg["id"], parsed)
