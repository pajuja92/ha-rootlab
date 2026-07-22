"""Klient Claude — generowanie zadań ogrodowych i diagnoza kryzysowa."""
import json
import uuid
from datetime import date

import anthropic

from .const import DOMAIN
from .logic import merge_ai_tasks

MODEL = "claude-opus-4-8"

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
    """Brak klucza API w opcjach integracji."""


def _client(hass):
    api_key = hass.data[DOMAIN]["entry"].options.get("api_key")
    if not api_key:
        raise NoApiKeyError
    return anthropic.AsyncAnthropic(api_key=api_key, timeout=180.0)


def _garden_context(hass):
    data = hass.data[DOMAIN]["data"]
    zones = {z["id"]: z["name"] for z in data["zones"]}
    plants = []
    for p in data["plants"]:
        readings = {}
        for key, entity_id in (p.get("sensors") or {}).items():
            if not entity_id:
                continue
            state = hass.states.get(entity_id)
            if state and state.state not in ("unavailable", "unknown"):
                unit = state.attributes.get("unit_of_measurement", "")
                readings[key] = f"{state.state} {unit}".strip()
        plants.append(
            {
                "id": p["id"],
                "name": p["name"],
                "species": p.get("species"),
                "zone": zones.get(p.get("zone_id")),
                "readings": readings,
            }
        )
    return {
        "date": date.today().isoformat(),
        "latitude": round(hass.config.latitude, 1),
        "plants": plants,
    }


def _parse_structured(response):
    if response.stop_reason == "refusal":
        raise RuntimeError("Model odmówił odpowiedzi na to zapytanie.")
    text = next(b.text for b in response.content if b.type == "text")
    return json.loads(text)


async def async_generate_tasks(hass):
    """Generuje zadania AI i scala je z listą (zastępuje niezrobione zadania AI)."""
    client = _client(hass)
    context = _garden_context(hass)
    weather = await hass.data[DOMAIN]["weather"].fetch(
        hass.data[DOMAIN]["entry"].options.get("imgw_station", "warszawa")
    )
    if weather:
        context["weather_imgw"] = weather
    response = await client.messages.create(
        model=MODEL,
        max_tokens=16000,
        thinking={"type": "adaptive"},
        system=SYSTEM,
        output_config={"format": {"type": "json_schema", "schema": TASKS_SCHEMA}},
        messages=[
            {
                "role": "user",
                "content": (
                    "Na podstawie danych ogrodu ułóż listę zadań na najbliższe 14 dni. "
                    "Kategorie: maintenance (przycinanie, pielenie, nawożenie, podlewanie ręczne) "
                    "i protection (opryski, ochrona przed przymrozkami i szkodnikami). "
                    "Uwzględnij porę roku, odczyty czujników i pogodę. Maks. 3 zadania na roślinę, "
                    "tylko naprawdę potrzebne. Dane ogrodu:\n"
                    + json.dumps(context, ensure_ascii=False)
                ),
            }
        ],
    )
    parsed = _parse_structured(response)
    plant_ids = {p["id"] for p in hass.data[DOMAIN]["data"]["plants"]}
    fresh = [
        {
            "id": uuid.uuid4().hex,
            "plant_id": t["plant_id"] if t["plant_id"] in plant_ids else None,
            "category": t["category"],
            "title": t["title"],
            "details": t["details"],
            "due": t["due"],
            "done": False,
            "source": "ai",
            "created": date.today().isoformat(),
        }
        for t in parsed["tasks"]
    ]
    data = hass.data[DOMAIN]["data"]
    data["tasks"] = merge_ai_tasks(data["tasks"], fresh)
    return len(fresh)


async def async_diagnose(hass, plant, description, image_b64, media_type):
    """Diagnoza problemu z rośliną na podstawie zdjęcia i opisu."""
    client = _client(hass)
    content = []
    if image_b64:
        content.append(
            {
                "type": "image",
                "source": {"type": "base64", "media_type": media_type or "image/jpeg", "data": image_b64},
            }
        )
    content.append(
        {
            "type": "text",
            "text": (
                "Zdiagnozuj problem z rośliną i podaj plan naprawczy (2-5 kroków, każdy z terminem "
                "w dniach od dziś). Jeśli pewność jest niska, powiedz to wprost.\n"
                f"Roślina: {plant.get('name')} ({plant.get('species') or 'gatunek nieznany'}).\n"
                f"Opis objawów od użytkownika: {description or 'brak opisu'}"
            ),
        }
    )
    response = await client.messages.create(
        model=MODEL,
        max_tokens=16000,
        thinking={"type": "adaptive"},
        system=SYSTEM,
        output_config={"format": {"type": "json_schema", "schema": DIAGNOSIS_SCHEMA}},
        messages=[{"role": "user", "content": content}],
    )
    return _parse_structured(response)
