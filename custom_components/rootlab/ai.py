"""Klient AI — wielu dostawców: Anthropic, endpointy zgodne z OpenAI, usługa ai_task z HA."""
import json
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

SYSTEM = (
    "Jesteś spokojnym ogrodnikiem-ekspertem w aplikacji RootLab (Home Assistant). "
    "Doradzasz, nie rozkazujesz; jesteś konkretny, ale ciepły; piszesz krótko, per Ty. "
    "Nie antropomorfizujesz siebie i nie używasz wykrzykników w ostrzeżeniach. "
    "Odpowiadasz po polsku."
)

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
                    "category": {"type": "string", "enum": ["maintenance", "protection"]},
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


async def _complete(hass, prompt, schema=None, image_b64=None, media_type=None):
    """Jedno zapytanie do skonfigurowanego dostawcy. schema=None → wolny tekst."""
    provider = _options(hass).get("ai_provider", "anthropic")
    if provider == "anthropic":
        return await _anthropic(hass, prompt, schema, image_b64, media_type)
    if provider == "ha_ai_task":
        return await _ha_ai_task(hass, prompt, schema)
    return await _openai_compat(hass, provider, prompt, schema, image_b64, media_type)


async def _anthropic(hass, prompt, schema, image_b64, media_type):
    import anthropic

    api_key = _options(hass).get("api_key")
    if not api_key:
        raise NoApiKeyError
    client = anthropic.AsyncAnthropic(api_key=api_key, timeout=180.0)
    content = []
    if image_b64:
        content.append(
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": media_type or "image/jpeg",
                    "data": image_b64,
                },
            }
        )
    content.append({"type": "text", "text": prompt})
    kwargs = {}
    if schema:
        kwargs["output_config"] = {"format": {"type": "json_schema", "schema": schema}}
    response = await client.messages.create(
        model=_options(hass).get("ai_model") or ANTHROPIC_MODEL,
        max_tokens=16000,
        thinking={"type": "adaptive"},
        system=SYSTEM,
        messages=[{"role": "user", "content": content}],
        **kwargs,
    )
    if response.stop_reason == "refusal":
        raise RuntimeError("Model odmówił odpowiedzi na to zapytanie.")
    text = next(b.text for b in response.content if b.type == "text")
    return _parse_json_loose(text) if schema else text.strip()


async def _openai_compat(hass, provider, prompt, schema, image_b64, media_type):
    options = _options(hass)
    default_base, default_model = OPENAI_COMPAT[provider]
    base = (options.get("ai_base_url") or default_base).rstrip("/")
    model = options.get("ai_model") or default_model
    api_key = options.get("api_key")
    if not base or not model or (not api_key and provider != "ollama"):
        raise NoApiKeyError
    user_content = [{"type": "text", "text": prompt}]
    if image_b64:
        user_content.insert(
            0,
            {
                "type": "image_url",
                "image_url": {"url": f"data:{media_type or 'image/jpeg'};base64,{image_b64}"},
            },
        )
    system = SYSTEM + (
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
    instructions = SYSTEM + "\n\n" + prompt
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


def _garden_context(hass, plant_ids=None):
    data = hass.data[DOMAIN]["data"]
    zones = {z["id"]: z["name"] for z in data["zones"]}
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
        pos = positions.get(p["id"])
        if pos and any(
            g["x"] <= pos["x"] <= g["x"] + g["w"] and g["y"] <= pos["y"] <= g["y"] + g["h"]
            for g in greenhouses
        ):
            # ponytail: stałe modyfikatory szklarni — ok. +5°C, +15 p.p. wilgotności, ~80% światła
            info["environment"] = "szklarnia (ok. +5°C, wyższa wilgotność, ~80% światła)"
        plants.append(info)
    location = data["layout"].get("location") or {}
    return {
        "date": date.today().isoformat(),
        "latitude": round(location.get("latitude") or hass.config.latitude, 2),
        "plants": plants,
    }


async def async_generate_tasks(hass, categories=None, plant_ids=None, include_general=True):
    """Generuje zadania AI dla zakresu — zwraca listę, NICZEGO nie zapisuje."""
    cats = [c for c in (categories or []) if c in ("maintenance", "protection")] or [
        "maintenance",
        "protection",
    ]
    cat_desc = {
        "maintenance": "maintenance (przycinanie, pielenie, nawożenie, podlewanie ręczne)",
        "protection": "protection (opryski, ochrona przed przymrozkami i szkodnikami)",
    }
    context = _garden_context(hass, plant_ids)
    weather = await hass.data[DOMAIN]["weather"].fetch(
        _options(hass).get("imgw_station", "warszawa")
    )
    if weather:
        context["weather_imgw"] = weather
    parsed = await _complete(
        hass,
        "Na podstawie danych ogrodu ułóż listę zadań na najbliższe 14 dni. "
        "Dozwolone kategorie: " + "; ".join(cat_desc[c] for c in cats) + ". "
        + ("" if include_general else "Każde zadanie musi dotyczyć konkretnej rośliny z danych (plant_id nie może być null). ")
        + "Uwzględnij porę roku, odczyty czujników, warunki (szklarnia) i pogodę. "
        "Maks. 3 zadania na roślinę, tylko naprawdę potrzebne. Dane ogrodu:\n"
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


async def async_diagnose(hass, plant, description, image_b64, media_type):
    """Diagnoza problemu z rośliną na podstawie zdjęcia i opisu."""
    parsed = await _complete(
        hass,
        "Zdiagnozuj problem z rośliną i podaj plan naprawczy (2-5 kroków, każdy z terminem "
        "w dniach od dziś, pole due_in_days). Jeśli pewność jest niska, powiedz to wprost.\n"
        f"Roślina: {plant.get('name')} ({plant.get('species') or 'gatunek nieznany'}).\n"
        f"Opis objawów od użytkownika: {description or 'brak opisu'}",
        schema=DIAGNOSIS_SCHEMA,
        image_b64=image_b64,
        media_type=media_type,
    )
    if parsed.get("confidence") not in ("high", "medium", "low"):
        parsed["confidence"] = "medium"
    parsed.setdefault("steps", [])
    return parsed


async def async_ask(hass, question, plant=None):
    """Wolne pytanie do AI (porada) — zwraca tekst."""
    prompt = ""
    if plant:
        prompt += (
            f"Pytanie dotyczy rośliny: {plant.get('name')} "
            f"({plant.get('species') or 'gatunek nieznany'}).\n"
        )
    prompt += f"Pytanie: {question}\nOdpowiedz zwięźle (do ok. 200 słów), praktycznie."
    return await _complete(hass, prompt)
