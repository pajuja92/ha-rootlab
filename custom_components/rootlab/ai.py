"""Klient AI — wielu dostawców: Anthropic, endpointy zgodne z OpenAI, usługa ai_task z HA."""
import json
import logging
import uuid
from datetime import date

import aiohttp

from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .const import DOMAIN
from .logic import merge_ai_tasks

# Dostawcy z API zgodnym z OpenAI (chat/completions) — jeden klient, różne base_url.
OPENAI_COMPAT = {
    "openai": ("https://api.openai.com/v1", "gpt-4o"),
    # gemini-2.5-flash wyłączony dla nowych kont 2026-07-09 (404)
    "google": ("https://generativelanguage.googleapis.com/v1beta/openai", "gemini-3.5-flash"),
    "groq": ("https://api.groq.com/openai/v1", "llama-3.3-70b-versatile"),
    "mistral": ("https://api.mistral.ai/v1", "mistral-large-latest"),
    "deepseek": ("https://api.deepseek.com/v1", "deepseek-chat"),
    "xai": ("https://api.x.ai/v1", "grok-3"),
    "openrouter": ("https://openrouter.ai/api/v1", "openrouter/auto"),
    "together": ("https://api.together.xyz/v1", "meta-llama/Llama-3.3-70B-Instruct-Turbo"),
    "perplexity": ("https://api.perplexity.ai", "sonar"),
    "ollama": ("http://localhost:11434/v1", "llama3.2"),
    "custom": ("", ""),
}
ANTHROPIC_MODEL = "claude-opus-4-8"

# Edytowalne w zakładce Ustawienia (storage: data["ai_prompts"]); dynamiczne
# fragmenty (dane ogrodu, kategorie, historia, schemat JSON) dokleja kod.
PROMPT_DEFAULTS = {
    "system": (
        "Jesteś spokojnym ogrodnikiem-ekspertem w aplikacji RootLab (Home Assistant). "
        "Doradzasz, nie rozkazujesz; jesteś konkretny, ale ciepły; piszesz krótko, per Ty. "
        "Nie antropomorfizujesz siebie i nie używasz wykrzykników w ostrzeżeniach. "
        "Jeśli kontekst zawiera owned_supplies, to zasoby, które użytkownik już ma "
        "(nasiona, nawozy, środki, narzędzia) — w zaleceniach korzystaj najpierw z nich, "
        "zanim zaproponujesz zakup czegoś nowego. "
        "Odpowiadasz po polsku."
    ),
    "tasks": (
        "Na podstawie danych ogrodu ułóż listę zadań na najbliższe 14 dni. "
        "Uwzględnij porę roku, odczyty czujników, warunki (szklarnia) i pogodę. "
        "Maks. 3 zadania na roślinę, tylko naprawdę potrzebne."
    ),
    "diagnose": (
        "Zdiagnozuj problem z rośliną i podaj plan naprawczy (2-5 kroków, każdy z terminem "
        "w dniach od dziś, pole due_in_days). Jeśli pewność jest niska, powiedz to wprost. "
        "Uwzględnij historię rośliny — wcześniejsze diagnozy, notatki, zdjęcia i odczyty."
    ),
    "ask": "Odpowiedz zwięźle (do ok. 200 słów), praktycznie.",
    "inventory_scan": (
        "Na zdjęciach są produkty ogrodowe (nasiona, nawozy, środki ochrony, repelenty, "
        "narzędzia, złączki itp.). Rozpoznaj KAŻDY osobny produkt i odczytaj z etykiet: "
        "nazwę, krótki opis/zastosowanie, kod kreskowy EAN (tylko jeśli cyfry są czytelne), "
        "kategorię, datę ważności i pojemność/ilość z opakowania. Nie zgaduj kodów ani dat — "
        "pola nieczytelne zostaw puste."
    ),
    "season": (
        "Zaplanuj sezon uprawowy dla wskazanych miejsc w ogrodzie. Dobieraj wyłącznie "
        "gatunki z katalogu i trzymaj się ich okien siewu/wysadzania (w szklarni można "
        "przyspieszyć o 2-4 tygodnie). Pilnuj płodozmianu: ta sama rodzina botaniczna "
        "w tym samym miejscu wymaga 3-4 lat przerwy. Obsadzaj miejsca różnorodnie, "
        "realistycznie co do liczby upraw, i podawaj krótkie uzasadnienie każdej propozycji."
    ),
}


def _prompt(hass, key):
    custom = (hass.data[DOMAIN]["data"].get("ai_prompts") or {}).get(key)
    return (custom or PROMPT_DEFAULTS[key]).strip()

TASKS_SCHEMA = {
    "type": "object",
    "properties": {
        "tasks": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "plant_id": {
                        "type": ["string", "null"],
                        "description": "id rośliny z danych albo null dla zadań ogólnych",
                    },
                    "category": {"type": "string", "enum": ["maintenance", "protection", "crisis"]},
                    "title": {"type": "string"},
                    "details": {"type": "string"},
                    "due": {"type": "string", "description": "termin YYYY-MM-DD"},
                },
                "required": ["plant_id", "category", "title", "details", "due"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["tasks"],
    "additionalProperties": False,
}

DIAGNOSIS_SCHEMA = {
    "type": "object",
    "properties": {
        "problem": {"type": "string", "description": "krótka nazwa problemu"},
        "confidence": {"type": "string", "enum": ["high", "medium", "low"]},
        "summary": {"type": "string", "description": "2-3 zdania wyjaśnienia objawów"},
        "steps": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "due_in_days": {"type": "integer"},
                },
                "required": ["title", "due_in_days"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["problem", "confidence", "summary", "steps"],
    "additionalProperties": False,
}


INVENTORY_SCAN_SCHEMA = {
    "type": "object",
    "properties": {
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "desc": {"type": "string", "description": "krótki opis / zastosowanie"},
                    "ean": {"type": "string", "description": "kod kreskowy/EAN, pusty jeśli nieczytelny"},
                    "category": {"type": "string", "description": "jedna z kategorii użytkownika (lista w promptcie)"},
                    "expiry": {"type": "string", "description": "data ważności YYYY-MM-DD, pusty jeśli brak"},
                    "qty": {"type": "string", "description": "ilość/pojemność z opakowania, np. 500 ml"},
                },
                "required": ["name", "category"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["items"],
    "additionalProperties": False,
}


SEASON_SCHEMA = {
    "type": "object",
    "properties": {
        "plantings": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    # ponytail: nazwa pola area_id zostaje na drucie — niesie id strefy
                    "area_id": {"type": "string", "description": "id strefy z listy miejsc"},
                    "name": {"type": "string", "description": "nazwa rośliny DOKŁADNIE z katalogu"},
                    "method": {"type": "string", "enum": ["indoor", "direct"]},
                    "sow": {"type": ["string", "null"], "description": "data siewu MM-DD albo null"},
                    "transplant": {"type": ["string", "null"], "description": "data wysadzenia MM-DD albo null"},
                    "harvest_from": {"type": "string", "description": "początek zbiorów MM-DD"},
                    "harvest_to": {"type": "string", "description": "koniec zbiorów MM-DD"},
                    "reason": {"type": "string", "description": "1 zdanie uzasadnienia"},
                },
                "required": ["area_id", "name", "method", "sow", "transplant", "harvest_from", "harvest_to", "reason"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["plantings"],
    "additionalProperties": False,
}


class NoApiKeyError(Exception):
    """Brak konfiguracji AI w opcjach integracji."""


# Filtry listy modeli: pokazujemy tylko aktualne modele czatowe danego API.
# allow = regexy prefiksów; deny = fragmenty wykluczające (embeddingi, TTS, obraz itd.)
import re

_DENY_COMMON = (
    "embed", "tts", "audio", "image", "imagen", "veo", "whisper", "dall-e",
    "moderation", "realtime", "transcribe", "deep-research", "learnlm", "aqa",
    "live", "robotics", "computer-use", "guard", "ocr", "rerank", "-exp",
)
_MODEL_ALLOW = {
    # tylko gemini >= 3 (2.5 wyłączone dla nowych kont, starsze tym bardziej)
    "google": r"^gemini-(?:[3-9]|\d{2,})\.",
    "openai": r"^(?:gpt-[4-9]|gpt-\d{2,}|o[1-9]|chatgpt-)",
    "anthropic": r"^claude-",
    "xai": r"^grok-",
    "mistral": r"^(?:mistral|magistral|pixtral|codestral|ministral|open-)",
    "deepseek": r"^deepseek-",
    "groq": r"",
    "openrouter": r"",
    "together": r"",
}


def _filter_models(provider, ids):
    allow = _MODEL_ALLOW.get(provider)
    if allow is None:
        return sorted(ids)
    rx = re.compile(allow) if allow else None
    out = [
        i
        for i in ids
        if (rx is None or rx.match(i)) and not any(d in i.lower() for d in _DENY_COMMON)
    ]
    # ponytail: gdy filtr wytnie wszystko (nowe nazewnictwo u dostawcy), pokaż pełną listę
    return sorted(out) if out else sorted(ids)


async def async_list_models(hass, provider, api_key=None, base_url=None):
    """Lista modeli dostawcy (walidacja klucza + select w opcjach).

    Rzuca RuntimeError przy błędnym kluczu / nieosiągalnym API.
    """
    session = async_get_clientsession(hass)
    timeout = aiohttp.ClientTimeout(total=15)
    if provider == "anthropic":
        headers = {"x-api-key": api_key or "", "anthropic-version": "2023-06-01"}
        async with session.get(
            "https://api.anthropic.com/v1/models?limit=100",
            headers=headers, timeout=timeout,
        ) as resp:
            if resp.status >= 400:
                raise RuntimeError(f"HTTP {resp.status} — {(await resp.text())[:200]}")
            data = await resp.json()
        return _filter_models("anthropic", [m["id"] for m in data.get("data", []) if m.get("id")])
    default_base, _ = OPENAI_COMPAT.get(provider, ("", ""))
    base = (base_url or default_base).rstrip("/")
    if not base:
        raise RuntimeError("brak adresu API")
    headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
    async with session.get(
        f"{base}/models", headers=headers, timeout=timeout
    ) as resp:
        if resp.status >= 400:
            raise RuntimeError(f"HTTP {resp.status} — {(await resp.text())[:200]}")
        data = await resp.json()
    ids = [m.get("id") for m in data.get("data", []) if m.get("id")]
    # Google zwraca "models/gemini-x" — chat/completions przyjmuje sama nazwe
    return _filter_models(
        provider, [i.split("/", 1)[1] if i.startswith("models/") else i for i in ids]
    )


def _options(hass):
    return hass.data[DOMAIN]["entry"].options


def _parse_json_loose(text):
    """JSON z odpowiedzi modelu — toleruje płotki ```json i tekst wokół."""
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError(f"Odpowiedź AI nie zawiera JSON: {text[:200]}")
    return json.loads(text[start : end + 1])


async def _complete(hass, prompt, schema=None, images=None, media_type=None, web_search=False):
    """Jedno zapytanie do skonfigurowanego dostawcy. schema=None → wolny tekst.

    images: lista base64 (bez prefiksu data:), wszystkie tego samego media_type.
    """
    provider = _options(hass).get("ai_provider", "anthropic")
    if provider == "anthropic":
        return await _anthropic(hass, prompt, schema, images, media_type, web_search)
    if provider == "google" and web_search and not schema:
        # grounding w Google Search — warstwa OpenAI-compat go nie wystawia
        try:
            return await _gemini_search(hass, prompt, images, media_type)
        except RuntimeError as err:
            # np. HTTP 429 — brak limitu na grounding; odpowiedz bez wyszukiwania
            logging.getLogger(__name__).warning(
                "Gemini grounding niedostępny (%s) — odpowiadam bez wyszukiwania", err
            )
    if provider == "ha_ai_task":
        return await _ha_ai_task(hass, prompt, schema)
    return await _openai_compat(hass, provider, prompt, schema, images, media_type)


async def _anthropic(hass, prompt, schema, images, media_type, web_search=False):
    import anthropic
    import re as _re

    api_key = _options(hass).get("api_key")
    if not api_key:
        raise NoApiKeyError
    client = anthropic.AsyncAnthropic(api_key=api_key, timeout=180.0)
    content = [
        {
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": media_type or "image/jpeg",
                "data": img,
            },
        }
        for img in images or []
    ]
    content.append({"type": "text", "text": prompt})
    kwargs = {}
    if schema:
        kwargs["output_config"] = {"format": {"type": "json_schema", "schema": schema}}
    elif web_search:
        # narzędzie serwerowe Anthropic — wariant wg generacji modelu
        model_id = _options(hass).get("ai_model") or ANTHROPIC_MODEL
        wtype = (
            "web_search_20260209"
            if _re.search(r"opus-4-[678]|sonnet-5|sonnet-4-6|fable", model_id)
            else "web_search_20250305"
        )
        kwargs["tools"] = [{"type": wtype, "name": "web_search", "max_uses": 3}]
    response = await client.messages.create(
        model=_options(hass).get("ai_model") or ANTHROPIC_MODEL,
        max_tokens=16000,
        thinking={"type": "adaptive"},
        system=_prompt(hass, "system"),
        messages=[{"role": "user", "content": content}],
        **kwargs,
    )
    if response.stop_reason == "refusal":
        raise RuntimeError("Model odmówił odpowiedzi na to zapytanie.")
    # z web search odpowiedź składa się z wielu bloków tekstowych przeplatanych wyszukiwaniami
    text = "".join(b.text for b in response.content if b.type == "text")
    return _parse_json_loose(text) if schema else text.strip()


async def _gemini_search(hass, prompt, images, media_type):
    """Czat z wyszukiwaniem: natywne API Gemini z narzędziem google_search."""
    options = _options(hass)
    api_key = options.get("api_key")
    if not api_key:
        raise NoApiKeyError
    base = (options.get("ai_base_url") or OPENAI_COMPAT["google"][0]).rstrip("/")
    if base.endswith("/openai"):
        base = base[: -len("/openai")]
    model = options.get("ai_model") or OPENAI_COMPAT["google"][1]
    parts = [
        {"inline_data": {"mime_type": media_type or "image/jpeg", "data": img}}
        for img in images or []
    ]
    parts.append({"text": prompt})
    session = async_get_clientsession(hass)
    resp = await session.post(
        f"{base}/models/{model}:generateContent",
        json={
            "system_instruction": {"parts": [{"text": _prompt(hass, "system")}]},
            "contents": [{"role": "user", "parts": parts}],
            "tools": [{"google_search": {}}],
        },
        headers={"x-goog-api-key": api_key},
        timeout=aiohttp.ClientTimeout(total=180),
    )
    if resp.status != 200:
        detail = (await resp.text())[:300]
        raise RuntimeError(f"google: HTTP {resp.status} — {detail}")
    payload = await resp.json()
    out = ((payload.get("candidates") or [{}])[0].get("content") or {}).get("parts") or []
    text = "".join(p.get("text", "") for p in out).strip()
    if not text:
        raise RuntimeError("google: pusta odpowiedź")
    return text


async def _openai_compat(hass, provider, prompt, schema, images, media_type):
    options = _options(hass)
    default_base, default_model = OPENAI_COMPAT[provider]
    base = (options.get("ai_base_url") or default_base).rstrip("/")
    model = options.get("ai_model") or default_model
    api_key = options.get("api_key")
    if not base or not model or (not api_key and provider != "ollama"):
        raise NoApiKeyError
    user_content = [
        {
            "type": "image_url",
            "image_url": {"url": f"data:{media_type or 'image/jpeg'};base64,{img}"},
        }
        for img in images or []
    ]
    user_content.append({"type": "text", "text": prompt})
    system = _prompt(hass, "system") + (
        " Odpowiadasz WYŁĄCZNIE poprawnym JSON zgodnym z podanym schematem, bez komentarzy."
        if schema
        else ""
    )
    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user_content},
        ],
    }
    if schema:
        body["response_format"] = {"type": "json_object"}
        body["messages"][1]["content"].append(
            {"type": "text", "text": "Schemat JSON odpowiedzi:\n" + json.dumps(schema)}
        )
    session = async_get_clientsession(hass)
    headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
    async with session.post(
        f"{base}/chat/completions",
        json=body,
        headers=headers,
        timeout=aiohttp.ClientTimeout(total=180),
    ) as resp:
        if resp.status >= 400:
            detail = (await resp.text())[:300]
            raise RuntimeError(f"{provider}: HTTP {resp.status} — {detail}")
        data = await resp.json()
    text = data["choices"][0]["message"]["content"]
    return _parse_json_loose(text) if schema else text.strip()


async def _ha_ai_task(hass, prompt, schema):
    """Usługa ai_task.generate_data — działa z każdą integracją AI skonfigurowaną w HA."""
    entity_id = _options(hass).get("ai_task_entity")
    if not entity_id:
        raise NoApiKeyError
    instructions = _prompt(hass, "system") + "\n\n" + prompt
    if schema:
        instructions += (
            "\n\nOdpowiedz WYŁĄCZNIE poprawnym JSON zgodnym ze schematem, bez płotków markdown:\n"
            + json.dumps(schema)
        )
    result = await hass.services.async_call(
        "ai_task",
        "generate_data",
        {"task_name": "rootlab", "entity_id": entity_id, "instructions": instructions},
        blocking=True,
        return_response=True,
    )
    text = result.get("data") if isinstance(result, dict) else None
    if not isinstance(text, str):
        raise RuntimeError(f"ai_task zwrócił nieoczekiwaną odpowiedź: {str(result)[:200]}")
    return _parse_json_loose(text) if schema else text.strip()


_PLANTING_PL = {"soil": "w gruncie", "pot": "w donicy", "raised": "na podwyższonej grządce"}


def _owned_supplies(data):
    """Posiadane zasoby: produkty z list typu „inwentarz", z wyliczoną pozostałą ilością."""
    inv_lists = {l["id"] for l in data.get("inventory_lists", []) if l.get("kind") == "inventory"}
    out = []
    for i in data.get("inventory", []):
        if not (set(i.get("memberships") or {}) & inv_lists):
            continue
        amount = None
        if i.get("qty_val") is not None:
            unit = i.get("qty_unit") or ""
            if i.get("usage_pct") is not None:
                left = round(i["qty_val"] * i["usage_pct"] / 100, 1)
                amount = f"zostało ok. {left} {unit} z {i['qty_val']} {unit}".strip()
            else:
                amount = f"{i['qty_val']} {unit}".strip()
        out.append(
            {k: v for k, v in {
                "name": i.get("name"),
                "category": i.get("category"),
                "amount": amount,
                "expiry": i.get("expiry"),
                "desc": i.get("desc"),
            }.items() if v}
        )
    return out[:80]  # ponytail: twardy limit rozmiaru kontekstu


def _garden_context(hass, plant_ids=None):
    data = hass.data[DOMAIN]["data"]
    zones = {z["id"]: z["name"] for z in data["zones"]}
    zone_planting = {z["id"]: z.get("planting") for z in data["zones"]}
    greenhouses = [
        i for i in data["layout"]["items"] if i.get("kind") == "greenhouse" and "w" in i
    ]
    positions = {
        i.get("plant_id"): i for i in data["layout"]["items"] if i.get("plant_id")
    }
    plants = []
    for p in data["plants"]:
        if plant_ids is not None and p["id"] not in plant_ids:
            continue
        readings = {}
        for key, entity_id in (p.get("sensors") or {}).items():
            if not entity_id:
                continue
            state = hass.states.get(entity_id)
            if state and state.state not in ("unavailable", "unknown"):
                unit = state.attributes.get("unit_of_measurement", "")
                readings[key] = f"{state.state} {unit}".strip()
        info = {
            "id": p["id"],
            "name": p["name"],
            "species": p.get("species"),
            "zone": zones.get(p.get("zone_id")),
            "readings": readings,
        }
        planting = p.get("planting") or zone_planting.get(p.get("zone_id"))
        if planting:
            info["planting"] = _PLANTING_PL.get(planting, planting)
        pos = positions.get(p["id"])
        gh = pos and next(
            (
                g
                for g in greenhouses
                if g["x"] <= pos["x"] <= g["x"] + g["w"]
                and g["y"] <= pos["y"] <= g["y"] + g["h"]
            ),
            None,
        )
        if gh:
            # parametry mikroklimatu ze strefy szklarni (z sensownymi domyślnymi)
            gz = next((z for z in data["zones"] if z["id"] == gh.get("zone_id")), {})
            dt = gz.get("gh_temp_delta") or 5
            light = gz.get("gh_light_pct") or 80
            heated = ", ogrzewana — bez przymrozków" if gz.get("gh_heated") else ""
            info["environment"] = (
                f"szklarnia (ok. +{dt}°C, wyższa wilgotność, ~{light}% światła{heated})"
            )
        plants.append(info)
    location = data["layout"].get("location") or {}
    ctx = {
        "date": date.today().isoformat(),
        "latitude": round(location.get("latitude") or hass.config.latitude, 2),
        "plants": plants,
    }
    owned = _owned_supplies(data)
    if owned:
        ctx["owned_supplies"] = owned
    return ctx


async def async_generate_tasks(hass, categories=None, plant_ids=None, include_general=True, extra_prompt=None):
    """Generuje zadania AI dla zakresu — zwraca listę, NICZEGO nie zapisuje."""
    cats = [c for c in (categories or []) if c in ("maintenance", "protection", "crisis")] or [
        "maintenance",
        "protection",
    ]
    cat_desc = {
        "maintenance": "maintenance (przycinanie, pielenie, nawożenie, podlewanie ręczne)",
        "protection": "protection (opryski, ochrona przed przymrozkami i szkodnikami)",
        "crisis": "crisis (pilne interwencje — TYLKO gdy odczyty czujników lub pogoda wskazują realny problem)",
    }
    context = _garden_context(hass, plant_ids)
    weather = await hass.data[DOMAIN]["weather"].fetch(
        _options(hass).get("imgw_station", "warszawa")
    )
    if weather:
        context["weather_imgw"] = weather
    parsed = await _complete(
        hass,
        _prompt(hass, "tasks") + "\n"
        "Dozwolone kategorie: " + "; ".join(cat_desc[c] for c in cats) + ". "
        + ("" if include_general else "Każde zadanie musi dotyczyć konkretnej rośliny z danych (plant_id nie może być null). ")
        + (f"Dodatkowe wytyczne od użytkownika (traktuj priorytetowo): {extra_prompt}. " if extra_prompt else "")
        + "Dane ogrodu:\n"
        + json.dumps(context, ensure_ascii=False),
        schema=TASKS_SCHEMA,
    )
    plant_scope = (
        {p["id"] for p in hass.data[DOMAIN]["data"]["plants"]}
        if plant_ids is None
        else set(plant_ids)
    )
    fresh = []
    for task in parsed.get("tasks", []):
        pid = task.get("plant_id") if task.get("plant_id") in plant_scope else None
        if pid is None and not include_general:
            continue
        if task.get("category") not in cats:
            continue
        fresh.append(
            {
                "id": uuid.uuid4().hex,
                "plant_id": pid,
                "category": task["category"],
                "title": task.get("title", ""),
                "details": task.get("details", ""),
                "due": task.get("due"),
                "done": False,
                "source": "ai",
                "created": date.today().isoformat(),
            }
        )
    return fresh


async def async_generate_and_merge(hass):
    """Pełne generowanie + scalenie (cotygodniowy automat)."""
    fresh = await async_generate_tasks(hass)
    data = hass.data[DOMAIN]["data"]
    data["tasks"] = merge_ai_tasks(data["tasks"], fresh)
    return len(fresh)


_COND_PL = {"healthy": "zdrowa", "ok": "w porządku", "weak": "osłabiona", "sick": "chora"}


def _plant_history(hass, plant):
    """Chronologia rośliny do promptu diagnozy: diagnozy (bez zarchiwizowanych), notatki, zdjęcia."""
    entries = []
    for e in hass.data[DOMAIN]["data"]["crisis_history"]:
        if e.get("plant_id") == plant["id"] and not e.get("archived"):
            d = e.get("diagnosis") or {}
            entries.append(
                (
                    e.get("created", ""),
                    f"diagnoza: {d.get('problem')} (pewność: {d.get('confidence')}); "
                    f"zgłoszone objawy: {e.get('description') or 'brak'}",
                )
            )
    for n in plant.get("notes") or []:
        if n.get("archived"):
            continue
        entries.append((n.get("date", ""), f"notatka: {n.get('text')}"))
    for a in plant.get("asks") or []:
        if a.get("archived"):
            continue
        entries.append(
            (a.get("created", ""), f"pytanie użytkownika: {a.get('question')} / odpowiedź: {(a.get('answer') or '')[:200]}")
        )
    for f in plant.get("photos") or []:
        if f.get("archived"):
            continue
        details = []
        if f.get("condition"):
            details.append("stan: " + _COND_PL.get(f["condition"], f["condition"]))
        if f.get("caption"):
            details.append(f["caption"])
        if f.get("readings"):
            details.append("odczyty: " + ", ".join(f"{k}={v}" for k, v in f["readings"].items()))
        entries.append((f.get("created", ""), "zdjęcie" + (f" ({'; '.join(details)})" if details else "")))
    entries.sort(key=lambda e: e[0])
    return "\n".join(f"- {when}: {txt}" for when, txt in entries[-15:])


async def async_diagnose(hass, plant, description, images, media_type):
    """Diagnoza problemu z rośliną: zdjęcia (maks. 5) + opis + historia + aktualne odczyty."""
    history = _plant_history(hass, plant)
    context = _garden_context(hass, [plant["id"]])
    parsed = await _complete(
        hass,
        _prompt(hass, "diagnose") + "\n"
        f"Roślina: {plant.get('name')} ({plant.get('species') or 'gatunek nieznany'}).\n"
        f"Opis objawów od użytkownika: {description or 'brak opisu'}\n"
        + (f"Historia rośliny (od najstarszego):\n{history}\n" if history else "")
        + "Aktualne dane rośliny:\n"
        + json.dumps(context, ensure_ascii=False),
        schema=DIAGNOSIS_SCHEMA,
        images=images,
        media_type=media_type,
    )
    if parsed.get("confidence") not in ("high", "medium", "low"):
        parsed["confidence"] = "medium"
    parsed.setdefault("steps", [])
    return parsed


async def async_diagnose_zone(hass, zone, description, images, media_type):
    """Diagnoza całej strefy: zdjęcia + opis + rośliny strefy z odczytami + notatki."""
    data = hass.data[DOMAIN]["data"]
    plant_ids = [p["id"] for p in data["plants"] if p.get("zone_id") == zone["id"]]
    context = _garden_context(hass, plant_ids)
    zinfo = {"name": zone.get("name"), "kind": zone.get("kind"), "planting": zone.get("planting")}
    if zone.get("kind") == "greenhouse":
        zinfo["greenhouse"] = (
            f"+{zone.get('gh_temp_delta') or 5}°C, ~{zone.get('gh_light_pct') or 80}% światła"
            + (", ogrzewana" if zone.get("gh_heated") else "")
        )
    notes = [n.get("text") for n in (zone.get("notes") or []) if not n.get("archived")][-5:]
    if notes:
        zinfo["recent_notes"] = notes
    parsed = await _complete(
        hass,
        _prompt(hass, "diagnose") + "\n"
        f"Diagnoza dotyczy CAŁEJ strefy „{zone.get('name')}\" (nie pojedynczej rośliny).\n"
        f"Opis objawów od użytkownika: {description or 'brak opisu'}\n"
        "Dane strefy:\n" + json.dumps(zinfo, ensure_ascii=False) + "\n"
        "Rośliny w strefie i aktualne odczyty:\n" + json.dumps(context, ensure_ascii=False),
        schema=DIAGNOSIS_SCHEMA,
        images=images,
        media_type=media_type,
    )
    if parsed.get("confidence") not in ("high", "medium", "low"):
        parsed["confidence"] = "medium"
    parsed.setdefault("steps", [])
    return parsed


def _transcript(chat):
    return "\n".join(
        f"{'Użytkownik' if m.get('role') == 'user' else 'Asystent'}: {m.get('content')}"
        for m in chat.get("messages", [])
    )


async def async_chat(hass, chat, plant, message, context=None, images=None):
    """Kolejna wiadomość w rozmowie diagnostycznej — zwraca odpowiedź asystenta."""
    parts = []
    if plant:
        parts.append(
            "Kontekst rośliny:\n" + json.dumps(_garden_context(hass, [plant["id"]]), ensure_ascii=False)
        )
        history = _plant_history(hass, plant)
        if history:
            parts.append("Historia rośliny:\n" + history)
    if context:
        # panel „Informacje o roślinie" z frontendu — m.in. plan ogrodu i bieżące zacienienie
        parts.append("Informacje z planu ogrodu i karty rośliny (stan bieżący):\n" + context)
    transcript = _transcript(chat)
    if transcript:
        parts.append("Dotychczasowa rozmowa:\n" + transcript)
    parts.append(
        f"Użytkownik: {message}\n"
        "Odpowiedz na ostatnią wiadomość konkretnie i praktycznie — pomóż doprecyzować "
        "diagnozę i zaplanować kolejne kroki. Dopytuj, jeśli brakuje Ci informacji."
    )
    # wyszukiwanie produktów w internecie: opt-in w Ustawieniach (Anthropic i Gemini)
    shop = hass.data[DOMAIN]["data"].get("shop") or {}
    web = bool(shop.get("websearch")) and _options(hass).get("ai_provider", "anthropic") in ("anthropic", "google")
    return await _complete(hass, "\n\n".join(parts), images=images, web_search=web)


async def async_chat_tasks(hass, chat, plant):
    """Lista zadań wynikających z rozmowy diagnostycznej."""
    today = date.today().isoformat()
    prompt = (
        "Na podstawie rozmowy o problemie z rośliną ułóż listę konkretnych zadań do wykonania "
        "(kategoria crisis dla pilnych interwencji, maintenance dla zwykłych zabiegów). "
        f"Maks. 6 zadań, tylko wynikające wprost z rozmowy, terminy YYYY-MM-DD. Dziś: {today}.\n"
        + (
            f"Roślina: {plant['name']} (plant_id: {plant['id']}).\n"
            if plant
            else "Zadania ogólne (plant_id: null).\n"
        )
        + "Rozmowa:\n"
        + _transcript(chat)
    )
    parsed = await _complete(hass, prompt, schema=TASKS_SCHEMA)
    return [
        {
            "id": uuid.uuid4().hex,
            "plant_id": plant["id"] if plant else None,
            "category": task["category"]
            if task.get("category") in ("maintenance", "protection", "crisis")
            else "maintenance",
            "title": task.get("title", ""),
            "details": task.get("details", ""),
            "due": task.get("due"),
            "done": False,
            "source": "chat",
            "created": today,
        }
        for task in parsed.get("tasks", [])
    ]


async def async_plan_season(hass, areas, catalog, wishes=None):
    """Plan sezonu dla modułu Uprawy — zwraca listę propozycji obsadzeń (nic nie zapisuje)."""
    data = hass.data[DOMAIN]["data"]
    existing = [
        {
            "area_id": p.get("area_id"),
            "name": p.get("name"),
            "family": p.get("family"),
            "year": p.get("year"),
        }
        for p in data["plantings"]
    ]
    context = {
        "date": date.today().isoformat(),
        "latitude": round(
            (data["layout"].get("location") or {}).get("latitude") or hass.config.latitude, 2
        ),
        "areas": areas,
        "existing_plantings": existing,
        "catalog": catalog,
    }
    owned = _owned_supplies(data)
    if owned:
        context["owned_supplies"] = owned
    parsed = await _complete(
        hass,
        _prompt(hass, "season") + "\n"
        + (f"Życzenia użytkownika (traktuj priorytetowo): {wishes}\n" if wishes else "")
        + "Dane (miejsca, dotychczasowe obsadzenia do płodozmianu, katalog roślin z oknami):\n"
        + json.dumps(context, ensure_ascii=False),
        schema=SEASON_SCHEMA,
    )
    area_ids = {a.get("id") for a in areas}
    return [
        p for p in parsed.get("plantings", []) if p.get("area_id") in area_ids and p.get("name")
    ]


async def async_ask(hass, question, plant=None):
    """Wolne pytanie do AI (porada) — zwraca tekst."""
    prompt = ""
    if plant:
        prompt += (
            f"Pytanie dotyczy rośliny: {plant.get('name')} "
            f"({plant.get('species') or 'gatunek nieznany'}).\n"
        )
    prompt += f"Pytanie: {question}\n" + _prompt(hass, "ask")
    return await _complete(hass, prompt)


async def async_scan_inventory(hass, images, media_type):
    """Zdjęcia produktów → lista rozpoznanych pozycji inwentarza."""
    cats = hass.data[DOMAIN]["data"].get("inventory_categories") or ["Inne"]
    parsed = await _complete(
        hass,
        _prompt(hass, "inventory_scan")
        + "\nDostępne kategorie (wybierz dokładnie jedną z listy): "
        + "; ".join(cats),
        schema=INVENTORY_SCAN_SCHEMA,
        images=images,
        media_type=media_type,
    )
    fallback = "Inne" if "Inne" in cats else cats[-1]
    items = []
    for it in parsed.get("items", []):
        if not (it.get("name") or "").strip():
            continue
        if it.get("category") not in cats:
            it["category"] = fallback
        items.append(it)
    return {"items": items}
