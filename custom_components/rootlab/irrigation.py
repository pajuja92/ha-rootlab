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
from .verification import fetch_rain_last24

OFF_STATES = ("off", "closed", "unavailable", "unknown")


def _service(entity_id, on):
    domain = entity_id.split(".")[0]
    if domain == "valve":
        return "valve", "open_valve" if on else "close_valve"
    return domain, "turn_on" if on else "turn_off"


def _entities(section):
    """Encje zaworów sekcji — nowe entity_ids albo stare pojedyncze entity_id."""
    ids = section.get("entity_ids") or ([section["entity_id"]] if section.get("entity_id") else [])
    return [e for e in ids if e]


async def _switch(hass, entity_ids, on):
    for entity_id in entity_ids:
        domain, service = _service(entity_id, on)
        await hass.services.async_call(domain, service, {"entity_id": entity_id})


def async_setup_scheduler(hass):
    d = hass.data[DOMAIN]

    def _notify():
        hass.bus.async_fire("rootlab_updated")

    async def _rain24():
        """Suma opadu 24 h z cache (30 min) — jedno zapytanie na fale startów."""
        cache = d.get("rain24")
        if cache and (dt_util.utcnow() - cache["at"]).total_seconds() < 1800:
            return cache["mm"]
        mm = await fetch_rain_last24(hass)
        d["rain24"] = {"at": dt_util.utcnow(), "mm": mm}
        return mm

    async def start(section, minutes, scheduled=False):
        entity_ids = _entities(section)
        sid = section["id"]
        if not entity_ids or sid in d["active"]:
            return
        # reguła deszczowa: harmonogram pomija sekcję po opadach; ręczne starty
        # i jednorazowe działają zawsze
        threshold = section.get("rain_skip_mm")
        if scheduled and threshold is not None:
            mm = await _rain24()
            if mm is not None and mm >= float(threshold):
                return
        await _switch(hass, entity_ids, True)

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
                    # domknij pozostałe zawory sekcji (idempotentne)
                    hass.async_create_task(_switch(hass, run["entity_ids"], False))
                    _notify()

        d["active"][sid] = {
            "end": (dt_util.utcnow() + timedelta(minutes=minutes)).isoformat(),
            "entity_ids": entity_ids,
            "cancel": async_call_later(hass, minutes * 60, _auto_off),
            "unwatch": async_track_state_change_event(hass, entity_ids, _external_off),
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
            await _switch(hass, run["entity_ids"], False)
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
        await _switch(hass, run["entity_ids"], False)
        d["active"][sid] = {"paused": True, "remaining_s": int(remaining), "entity_ids": run["entity_ids"], "end": None, "cancel": lambda: None, "unwatch": lambda: None}
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
            hass.async_create_task(start(section, minutes, scheduled=True))
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
