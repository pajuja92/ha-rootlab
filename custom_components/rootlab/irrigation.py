"""Scheduler nawadniania — co minutę porównuje harmonogram z zegarem i steruje encjami."""
from datetime import timedelta

from homeassistant.core import callback
from homeassistant.helpers.event import async_call_later, async_track_time_change
import homeassistant.util.dt as dt_util

from .const import DOMAIN
from .logic import due_sections


def _service(entity_id, on):
    domain = entity_id.split(".")[0]
    if domain == "valve":
        return "valve", "open_valve" if on else "close_valve"
    return domain, "turn_on" if on else "turn_off"


def async_setup_scheduler(hass):
    d = hass.data[DOMAIN]

    async def start(section, minutes):
        entity_id = section.get("entity_id")
        sid = section["id"]
        if not entity_id or sid in d["active"]:
            return
        domain, service = _service(entity_id, True)
        await hass.services.async_call(domain, service, {"entity_id": entity_id})

        async def _auto_off(_now):
            await stop(sid)

        d["active"][sid] = {
            "end": (dt_util.utcnow() + timedelta(minutes=minutes)).isoformat(),
            "entity_id": entity_id,
            "cancel": async_call_later(hass, minutes * 60, _auto_off),
        }

    async def stop(sid):
        run = d["active"].pop(sid, None)
        if not run:
            return
        run["cancel"]()
        domain, service = _service(run["entity_id"], False)
        await hass.services.async_call(domain, service, {"entity_id": run["entity_id"]})

    @callback
    def _tick(now):
        irr = d["data"]["irrigation"]
        local = dt_util.as_local(now)
        for section in due_sections(
            irr["sections"], local, irr.get("paused_until"), irr.get("skip_date")
        ):
            minutes = (section.get("schedule") or {}).get("duration_min") or 10
            hass.async_create_task(start(section, minutes))

    d["unsub"].append(async_track_time_change(hass, _tick, second=0))
    d["irrigation_ctl"] = {"start": start, "stop": stop}


async def async_stop_all(hass):
    d = hass.data[DOMAIN]
    for sid in list(d["active"]):
        await d["irrigation_ctl"]["stop"](sid)
