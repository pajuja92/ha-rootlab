"""Scheduler nawadniania — harmonogramy, zadania jednorazowe, pauza biegu, watchdog encji."""
from datetime import timedelta

from homeassistant.core import callback
from homeassistant.helpers.event import (
    async_call_later,
    async_track_state_change_event,
    async_track_time_change,
)
import homeassistant.util.dt as dt_util

from .const import DOMAIN
from .logic import due_sections

OFF_STATES = ("off", "closed", "unavailable", "unknown")


def _service(entity_id, on):
    domain = entity_id.split(".")[0]
    if domain == "valve":
        return "valve", "open_valve" if on else "close_valve"
    return domain, "turn_on" if on else "turn_off"


def async_setup_scheduler(hass):
    d = hass.data[DOMAIN]

    def _notify():
        hass.bus.async_fire("rootlab_updated")

    async def start(section, minutes):
        entity_id = section.get("entity_id")
        sid = section["id"]
        if not entity_id or sid in d["active"]:
            return
        domain, service = _service(entity_id, True)
        await hass.services.async_call(domain, service, {"entity_id": entity_id})

        async def _auto_off(_now):
            await stop(sid)

        @callback
        def _external_off(event):
            new_state = event.data.get("new_state")
            if new_state is None or new_state.state in OFF_STATES:
                # ktoś wyłączył encję poza RootLab (automatyzacja, ręcznie) — zamknij bieg
                run = d["active"].pop(sid, None)
                if run:
                    run["cancel"]()
                    run["unwatch"]()
                    _notify()

        d["active"][sid] = {
            "end": (dt_util.utcnow() + timedelta(minutes=minutes)).isoformat(),
            "entity_id": entity_id,
            "cancel": async_call_later(hass, minutes * 60, _auto_off),
            "unwatch": async_track_state_change_event(hass, [entity_id], _external_off),
        }
        _notify()

    async def stop(sid):
        """Stop — przerywa bieg (dalej scheduler przejdzie do następnego wg harmonogramu)."""
        run = d["active"].pop(sid, None)
        if not run:
            return
        run["cancel"]()
        run["unwatch"]()
        if not run.get("paused"):
            domain, service = _service(run["entity_id"], False)
            await hass.services.async_call(domain, service, {"entity_id": run["entity_id"]})
        _notify()

    async def pause_run(sid):
        """Pauza biegu — wyłącza zawór, zapamiętuje pozostały czas do dokończenia."""
        run = d["active"].get(sid)
        if not run or run.get("paused"):
            return
        remaining = max(
            30, (dt_util.parse_datetime(run["end"]) - dt_util.utcnow()).total_seconds()
        )
        run["cancel"]()
        run["unwatch"]()
        domain, service = _service(run["entity_id"], False)
        await hass.services.async_call(domain, service, {"entity_id": run["entity_id"]})
        d["active"][sid] = {"paused": True, "remaining_s": int(remaining), "entity_id": run["entity_id"], "end": None, "cancel": lambda: None, "unwatch": lambda: None}
        _notify()

    async def resume_run(sid):
        run = d["active"].pop(sid, None)
        if not run or not run.get("paused"):
            return
        section = next(
            (s for s in d["data"]["irrigation"]["sections"] if s["id"] == sid), None
        )
        if section:
            await start(section, max(1, round(run["remaining_s"] / 60)))

    @callback
    def _tick(now):
        irr = d["data"]["irrigation"]
        local = dt_util.as_local(now)
        for section in due_sections(
            irr["sections"], local, irr.get("paused_until"), irr.get("skip_date")
        ):
            minutes = (section.get("schedule") or {}).get("duration_min") or 10
            hass.async_create_task(start(section, minutes))
        # zadania jednorazowe
        hhmm = local.strftime("%H:%M")
        today = local.date().isoformat()
        fired = [
            o
            for o in irr.get("one_offs", [])
            if o.get("date") == today and o.get("time") == hhmm
        ]
        if fired:
            for one in fired:
                section = next(
                    (s for s in irr["sections"] if s["id"] == one.get("section_id")), None
                )
                if section:
                    hass.async_create_task(start(section, one.get("duration_min") or 10))
            irr["one_offs"] = [o for o in irr["one_offs"] if o not in fired]
            from .store import async_save

            hass.async_create_task(async_save(hass))
        # przeterminowane jednorazowe (np. HA było wyłączone) — sprzątamy
        stale = [o for o in irr.get("one_offs", []) if o.get("date") and o["date"] < today]
        if stale:
            irr["one_offs"] = [o for o in irr["one_offs"] if o not in stale]

    d["unsub"].append(async_track_time_change(hass, _tick, second=0))
    d["irrigation_ctl"] = {
        "start": start,
        "stop": stop,
        "pause_run": pause_run,
        "resume_run": resume_run,
    }


async def async_stop_all(hass):
    d = hass.data[DOMAIN]
    for sid in list(d["active"]):
        await d["irrigation_ctl"]["stop"](sid)
