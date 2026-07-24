"""Weryfikacja prognoz: codziennie zapisuje prognozy z kilku modeli (Open-Meteo,
per-model, bez klucza) + encji weather z HA, a następnego dnia porównuje je
z prawdą gruntową (czujniki użytkownika albo pomiary stacji IMGW) i aktualizuje
ranking trafności (MAE temperatury, błąd sumy opadów)."""
import aiohttp

from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.event import async_track_time_change
import homeassistant.util.dt as dt_util

from .const import DOMAIN
from .store import async_save

# Modele Open-Meteo istotne dla Polski (klucze wg dokumentacji /v1/forecast?models=)
OPEN_METEO_MODELS = {
    "best_match": "Open-Meteo (auto)",
    "icon_seamless": "ICON (DWD)",
    "ecmwf_ifs025": "ECMWF IFS",
    "gfs_seamless": "GFS (NOAA)",
    "ukmo_seamless": "UKMO (Met Office)",
}
HA_SOURCE = "ha_entity"


def _location(hass):
    layout = hass.data[DOMAIN]["data"]["layout"]
    loc = layout.get("location") or {}
    return (
        loc.get("latitude") or hass.config.latitude,
        loc.get("longitude") or hass.config.longitude,
    )


def _verify(hass):
    return hass.data[DOMAIN]["data"].setdefault(
        "verify", {"snapshot": None, "actuals": None, "stats": {}}
    )


async def _fetch_openmeteo(hass):
    lat, lon = _location(hass)
    session = async_get_clientsession(hass)
    models = ",".join(k for k in OPEN_METEO_MODELS if k != "best_match")
    url = (
        "https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}"
        "&hourly=temperature_2m,precipitation"
        f"&models=best_match,{models}&forecast_days=1&timezone=auto"
    )
    async with session.get(url, timeout=aiohttp.ClientTimeout(total=30)) as resp:
        resp.raise_for_status()
        payload = await resp.json()
    hourly = payload.get("hourly", {})
    out = {}
    for key in OPEN_METEO_MODELS:
        suffix = "" if key == "best_match" else f"_{key}"
        temps = hourly.get(f"temperature_2m{suffix}")
        rain = hourly.get(f"precipitation{suffix}")
        if temps:
            out[key] = {"temps": temps[:24], "rain": rain[:24] if rain else []}
    return out


async def _fetch_ha_entity(hass):
    entity_id = hass.data[DOMAIN]["entry"].options.get("weather_entity")
    if not entity_id:
        return None
    try:
        resp = await hass.services.async_call(
            "weather",
            "get_forecasts",
            {"entity_id": entity_id, "type": "hourly"},
            blocking=True,
            return_response=True,
        )
        rows = (resp.get(entity_id) or {}).get("forecast", [])[:24]
    except Exception:  # noqa: BLE001
        return None
    if not rows:
        return None
    temps, rain = [None] * 24, [0.0] * 24
    for row in rows:
        try:
            hour = dt_util.parse_datetime(row["datetime"])
            hour = dt_util.as_local(hour).hour
        except Exception:  # noqa: BLE001
            continue
        temps[hour] = row.get("temperature")
        rain[hour] = row.get("precipitation") or 0.0
    return {"temps": temps, "rain": rain}


async def _truth_temp(hass):
    options = hass.data[DOMAIN]["entry"].options
    entity_id = options.get("truth_temp_entity")
    if entity_id:
        state = hass.states.get(entity_id)
        if state and state.state not in ("unknown", "unavailable"):
            try:
                return float(state.state)
            except ValueError:
                pass
    weather = await hass.data[DOMAIN]["weather"].fetch(
        options.get("imgw_station", "warszawa")
    )
    try:
        return float(weather["temperatura"]) if weather else None
    except (KeyError, TypeError, ValueError):
        return None


async def _truth_rain(hass):
    options = hass.data[DOMAIN]["entry"].options
    entity_id = options.get("truth_rain_entity")
    if entity_id:
        state = hass.states.get(entity_id)
        if state and state.state not in ("unknown", "unavailable"):
            try:
                return float(state.state)
            except ValueError:
                pass
    weather = await hass.data[DOMAIN]["weather"].fetch(
        options.get("imgw_station", "warszawa")
    )
    try:
        return float(weather["suma_opadu"]) if weather else None
    except (KeyError, TypeError, ValueError):
        return None


def _finalize_day(verify):
    """Porównuje wczorajszy snapshot z wczorajszymi pomiarami → aktualizuje statystyki."""
    snapshot = verify.get("snapshot")
    actuals = verify.get("actuals")
    if not snapshot or not actuals or snapshot.get("date") != actuals.get("date"):
        return
    temps = actuals.get("temps", {})
    rain_actual = actuals.get("rain_mm")
    for source, forecast in snapshot.get("sources", {}).items():
        errs = [
            abs(forecast["temps"][int(h)] - temp)
            for h, temp in temps.items()
            if int(h) < len(forecast.get("temps", []))
            and forecast["temps"][int(h)] is not None
        ]
        stat = verify["stats"].setdefault(
            source, {"days": 0, "mae_sum": 0.0, "rain_err_sum": 0.0, "rain_days": 0}
        )
        if errs:
            stat["days"] += 1
            stat["mae_sum"] += sum(errs) / len(errs)
        if rain_actual is not None and forecast.get("rain"):
            forecast_sum = sum(v or 0 for v in forecast["rain"])
            stat["rain_days"] += 1
            stat["rain_err_sum"] += abs(forecast_sum - rain_actual)
    verify["stats"]["_since"] = verify["stats"].get("_since") or snapshot["date"]


def async_setup_verification(hass):
    d = hass.data[DOMAIN]

    async def _sample_hour(now):
        """Co godzinę: zapisz prawdę gruntową (temperatura) dla bieżącej godziny."""
        verify = _verify(hass)
        local = dt_util.as_local(now)
        today = local.date().isoformat()
        temp = await _truth_temp(hass)
        if temp is None:
            return
        actuals = verify.get("actuals")
        if not actuals or actuals.get("date") != today:
            verify["actuals"] = actuals = {"date": today, "temps": {}, "rain_mm": None}
        actuals["temps"][str(local.hour)] = temp
        # bez async_save co godzinę nie ma dramatu, ale chcemy przeżyć restart
        await async_save(hass)

    async def _sample_rain(now):
        """Późnym wieczorem: dobowa suma opadów jako prawda gruntowa."""
        verify = _verify(hass)
        today = dt_util.as_local(now).date().isoformat()
        if verify.get("actuals", {}).get("date") == today:
            verify["actuals"]["rain_mm"] = await _truth_rain(hass)
            await async_save(hass)

    async def _daily(now):
        """Po północy: rozlicz wczoraj i zapisz dzisiejsze prognozy wszystkich źródeł."""
        verify = _verify(hass)
        _finalize_day(verify)
        today = dt_util.as_local(now).date().isoformat()
        sources = {}
        try:
            sources.update(await _fetch_openmeteo(hass))
        except Exception:  # noqa: BLE001 — brak internetu itp.; spróbujemy jutro
            pass
        ha_forecast = await _fetch_ha_entity(hass)
        if ha_forecast:
            sources[HA_SOURCE] = ha_forecast
        verify["snapshot"] = {"date": today, "sources": sources} if sources else None
        verify["actuals"] = {"date": today, "temps": {}, "rain_mm": None}
        await async_save(hass)

    d["unsub"].append(async_track_time_change(hass, _sample_hour, minute=57, second=30))
    d["unsub"].append(async_track_time_change(hass, _sample_rain, hour=23, minute=58, second=0))
    d["unsub"].append(async_track_time_change(hass, _daily, hour=0, minute=10, second=0))


def _source_label(hass, source):
    if source == HA_SOURCE:
        entity_id = hass.data[DOMAIN]["entry"].options.get("weather_entity")
        state = hass.states.get(entity_id) if entity_id else None
        return (state and state.attributes.get("friendly_name")) or entity_id or "HA"
    return OPEN_METEO_MODELS.get(source, source)


def stats_payload(hass):
    """Ranking + dzisiejsze prognozy vs pomiary (dla zakładki Statystyki)."""
    verify = _verify(hass)
    out = []
    for source, stat in verify.get("stats", {}).items():
        if source == "_since" or not isinstance(stat, dict):
            continue
        label = _source_label(hass, source)
        out.append(
            {
                "source": source,
                "label": label,
                "days": stat["days"],
                "mae_temp": round(stat["mae_sum"] / stat["days"], 2) if stat["days"] else None,
                "rain_err": round(stat["rain_err_sum"] / stat["rain_days"], 2)
                if stat["rain_days"]
                else None,
            }
        )
    out.sort(key=lambda x: (x["mae_temp"] is None, x["mae_temp"] or 0))
    snapshot = verify.get("snapshot") or {}
    actuals = verify.get("actuals") or {}
    today = None
    if snapshot.get("sources"):
        today = {
            "date": snapshot.get("date"),
            "sources": [
                {"source": key, "label": _source_label(hass, key), "temps": val.get("temps")}
                for key, val in snapshot["sources"].items()
            ],
            "actual_temps": actuals.get("temps", {})
            if actuals.get("date") == snapshot.get("date")
            else {},
        }
    return {"since": verify.get("stats", {}).get("_since"), "sources": out, "today": today}
