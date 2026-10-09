"""Weryfikacja prognoz: codziennie zapisuje prognozy z kilku modeli (Open-Meteo,
per-model, bez klucza; IMGW dla punktu ogrodu) + encji weather z HA, a następnego
dnia porównuje je z prawdą gruntową (czujniki użytkownika, analiza IMGW INCA
w punkcie ogrodu albo pomiary stacji IMGW) i aktualizuje ranking trafności
(MAE temperatury, błąd sumy opadów)."""
from datetime import datetime, timedelta

import aiohttp

from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.event import async_track_time_change
import homeassistant.util.dt as dt_util

from .const import DOMAIN
from .logic import daily_from_hourly, rain_sum, three_hourly, week_grid
from .store import async_save
from .weather import STATIONS, nearest_station

# Modele Open-Meteo istotne dla Polski (klucze wg dokumentacji /v1/forecast?models=)
OPEN_METEO_MODELS = {
    "best_match": "Open-Meteo (auto)",
    "icon_seamless": "ICON (DWD)",
    "ecmwf_ifs025": "ECMWF IFS",
    "gfs_seamless": "GFS (NOAA)",
    "ukmo_seamless": "UKMO (Met Office)",
}
IMGW = "imgw"
IMGW_GFS = "imgw_gfs"
# wszystkie źródła prognoz poza encją HA (karty, reguła deszczowa, ranking)
FORECAST_SOURCES = {**OPEN_METEO_MODELS, IMGW: "IMGW ALARO/AROME (2,5 doby)", IMGW_GFS: "IMGW GFS"}
HA_SOURCE = "ha_entity"
SLOTS_24H = 144  # analiza INCA co 10 min
GARDEN = "garden"  # opcja imgw_station: analiza INCA w punkcie ogrodu zamiast stacji synop


def garden_location(hass):
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


async def imgw_point(hass):
    """Prognoza + analiza INCA IMGW dla pinezki ogrodu (Plan Ogrodu). Wyjątek przy błędzie."""
    lat, lon = garden_location(hass)
    d = hass.data[DOMAIN]
    return await d["weather"].forecast(lat, lon, d["entry"].options.get("imgw_token"))


def _point_rain(hass, start, end):
    """Opad z próbek analizy INCA w punkcie ogrodu w (start, end] → (mm, liczba próbek)."""
    slots = _verify(hass).get("point_rain") or {}
    picked = [mm for iso, mm in slots.items() if start < datetime.fromisoformat(iso) <= end]
    return round(sum(picked), 1), len(picked)


def imgw_choice(hass):
    """Punkt pomiaru IMGW z ustawień: GARDEN (domyślnie) albo klucz stacji synop."""
    return hass.data[DOMAIN]["entry"].options.get("imgw_station") or GARDEN


def _station(hass):
    """Stacja synop: wybrana albo — przy lokalizacji ogrodu — najbliższa pinezce (zapas)."""
    choice = imgw_choice(hass)
    return nearest_station(*garden_location(hass)) if choice == GARDEN else choice


async def current_weather(hass):
    """Pogoda teraz: analiza INCA w punkcie ogrodu, a przy wybranej stacji (albo gdy INCA
    niedostępna, np. poza Polską) — ostatni pomiar stacji synop. None gdy nic nie odpowiada."""
    if imgw_choice(hass) == GARDEN:
        try:
            now = (await imgw_point(hass))["now"]
        except Exception:  # noqa: BLE001
            now = None
        if now:
            return {**now, "punkt": True, "suma_opadu": point_rain_24h(hass)}
    return await hass.data[DOMAIN]["weather"].fetch(_station(hass))


def point_rain_24h(hass):
    """Suma z ostatnich 24 h albo None, gdy brakuje >10% próbek (np. HA było wyłączone)."""
    now = dt_util.utcnow()
    mm, count = _point_rain(hass, now - timedelta(hours=24), now)
    return mm if count >= SLOTS_24H * 0.9 else None


def _by_local_hour(rows, day):
    """Wiersze godzinowe → 24 temperatury i opady wg lokalnej godziny wskazanej doby."""
    temps, rain = [None] * 24, [0.0] * 24
    for row in rows:
        try:
            ts = dt_util.as_local(dt_util.parse_datetime(row["datetime"]))
        except Exception:  # noqa: BLE001
            continue
        if ts.date().isoformat() != day:
            continue
        temps[ts.hour] = row.get("temperature")
        rain[ts.hour] = row.get("precipitation") or 0.0
    return {"temps": temps, "rain": rain}


async def _fetch_openmeteo(hass):
    lat, lon = garden_location(hass)
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


async def _fetch_ha_entity(hass, day):
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
    return _by_local_hour(rows, day) if rows else None


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
    weather = await current_weather(hass)
    try:
        return float(weather["temperatura"]) if weather else None
    except (KeyError, TypeError, ValueError):
        return None


async def _truth_rain(hass, day_start):
    options = hass.data[DOMAIN]["entry"].options
    entity_id = options.get("truth_rain_entity")
    if entity_id:
        state = hass.states.get(entity_id)
        if state and state.state not in ("unknown", "unavailable"):
            try:
                return float(state.state)
            except ValueError:
                pass
    if imgw_choice(hass) == GARDEN:
        now = dt_util.utcnow()
        mm, count = _point_rain(hass, day_start, now)
        if count and count >= (now - day_start).total_seconds() / 600 * 0.9:
            return mm
    weather = await hass.data[DOMAIN]["weather"].fetch(_station(hass))
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
        local = dt_util.as_local(now)
        if verify.get("actuals", {}).get("date") == local.date().isoformat():
            day_start = dt_util.start_of_local_day(local)
            verify["actuals"]["rain_mm"] = await _truth_rain(hass, day_start)
            await async_save(hass)

    async def _sample_point(now):
        """Co 10 min: opad z analizy INCA w punkcie ogrodu (próbki 48 h, klucz = czas analizy).

        ponytail: próbkujemy tylko najświeższą analizę — luka (restart HA, cache) to brakująca
        próbka; sumy z <90% próbek odrzucamy. Gdyby luk było dużo: dociągać historię z IMGW."""
        try:
            point = (await imgw_point(hass))["now"]
        except Exception:  # noqa: BLE001
            return
        if not point or point["opad_10min"] is None:
            return
        slots = _verify(hass).setdefault("point_rain", {})
        slots[point["czas"]] = point["opad_10min"]
        cutoff = dt_util.utcnow() - timedelta(hours=48)
        for iso in [k for k in slots if datetime.fromisoformat(k) < cutoff]:
            del slots[iso]
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
        try:
            point = await imgw_point(hass)
            sources[IMGW] = _by_local_hour(point["hourly"], today)
            if point["gfs"]:
                sources[IMGW_GFS] = _by_local_hour(point["gfs"], today)
        except Exception:  # noqa: BLE001
            pass
        ha_forecast = await _fetch_ha_entity(hass, today)
        if ha_forecast:
            sources[HA_SOURCE] = ha_forecast
        verify["snapshot"] = {"date": today, "sources": sources} if sources else None
        verify["actuals"] = {"date": today, "temps": {}, "rain_mm": None}
        await async_save(hass)

    d["unsub"].append(async_track_time_change(hass, _sample_hour, minute=57, second=30))
    d["unsub"].append(async_track_time_change(hass, _sample_rain, hour=23, minute=58, second=0))
    d["unsub"].append(async_track_time_change(hass, _daily, hour=0, minute=10, second=0))
    d["unsub"].append(
        async_track_time_change(hass, _sample_point, minute=list(range(5, 60, 10)), second=0)
    )


def _source_label(hass, source):
    if source == HA_SOURCE:
        entity_id = hass.data[DOMAIN]["entry"].options.get("weather_entity")
        state = hass.states.get(entity_id) if entity_id else None
        return (state and state.attributes.get("friendly_name")) or entity_id or "HA"
    return FORECAST_SOURCES.get(source, source)


def _truth_desc(hass, entity_key):
    options = hass.data[DOMAIN]["entry"].options
    entity_id = options.get(entity_key)
    if entity_id:
        state = hass.states.get(entity_id)
        label = (state and state.attributes.get("friendly_name")) or entity_id
        return {"kind": "sensor", "label": label, "entity_id": entity_id}
    garden = imgw_choice(hass) == GARDEN
    if garden and _verify(hass).get("point_rain"):
        return {"kind": "imgw_point", "label": "IMGW INCA · lokalizacja ogrodu"}
    station = _station(hass)
    name = STATIONS[station][0] if station in STATIONS else station
    return {"kind": "imgw", "label": f"IMGW · {name}" + (" (zapas)" if garden else "")}


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
    # źródła bez wyników: zapisane w dzisiejszym snapshocie → wynik jutro po północy,
    # nowe IMGW spoza snapshotu → snapshot dziś w nocy, wynik dzień później
    ranked = {row["source"] for row in out}
    today_local = dt_util.now().date()
    for source in [*snapshot.get("sources", {}), IMGW, IMGW_GFS]:
        if source in ranked:
            continue
        ranked.add(source)
        in_snapshot = source in snapshot.get("sources", {}) and snapshot.get("date") == today_local.isoformat()
        out.append(
            {
                "source": source,
                "label": _source_label(hass, source),
                "days": 0,
                "mae_temp": None,
                "rain_err": None,
                "first_result": (today_local + timedelta(days=1 if in_snapshot else 2)).isoformat(),
            }
        )
    actuals = verify.get("actuals") or {}
    today = None
    if snapshot.get("sources"):
        today = {
            "date": snapshot.get("date"),
            "sources": [
                {
                    "source": key,
                    "label": _source_label(hass, key),
                    "temps": val.get("temps"),
                    "rain": val.get("rain"),
                }
                for key, val in snapshot["sources"].items()
            ],
            "actual_temps": actuals.get("temps", {})
            if actuals.get("date") == snapshot.get("date")
            else {},
            "actual_rain_mm": actuals.get("rain_mm")
            if actuals.get("date") == snapshot.get("date")
            else None,
        }
    return {
        "since": verify.get("stats", {}).get("_since"),
        "sources": out,
        "today": today,
        "truth": {
            "temp": _truth_desc(hass, "truth_temp_entity"),
            "rain": _truth_desc(hass, "truth_rain_entity"),
            "imgw_station": imgw_choice(hass),
        },
    }


async def fetch_rain24(hass):
    """Opad [mm] wokół teraz: suma z ostatnich 24 h i prognoza na następne 24 h.

    Model z ustawień (data["rain_model"]). Dla IMGW: prognoza z IMGW, przeszłość z próbek
    analizy INCA w punkcie ogrodu (a gdy ich brakuje — Open-Meteo auto). None gdy błąd sieci."""
    model = hass.data[DOMAIN]["data"].get("rain_model") or "best_match"
    if model not in FORECAST_SOURCES:
        model = "best_match"
    now = dt_util.now()
    window = lambda rows: (
        rain_sum(rows, now - timedelta(hours=24), now),
        rain_sum(rows, now, now + timedelta(hours=24)),
    )
    try:
        if model in (IMGW, IMGW_GFS):
            rows = (await imgw_point(hass))["gfs" if model == IMGW_GFS else "hourly"]
            nxt = rain_sum(rows, now, now + timedelta(hours=24))
            past = point_rain_24h(hass)
            if past is None:
                past = window(await _openmeteo_rain(hass, "best_match"))[0]
        else:
            past, nxt = window(await _openmeteo_rain(hass, model))
    except Exception:  # noqa: BLE001
        return None
    return {"past": past, "next": nxt, "model": model}


async def _openmeteo_rain(hass, model):
    """Godzinowy opad Open-Meteo (doba wstecz + 2 doby) jako wiersze {datetime, precipitation}."""
    lat, lon = garden_location(hass)
    session = async_get_clientsession(hass)
    url = (
        "https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}"
        f"&hourly=precipitation&past_days=1&forecast_days=2&timezone=auto&models={model}"
    )
    async with session.get(url, timeout=aiohttp.ClientTimeout(total=30)) as resp:
        resp.raise_for_status()
        payload = await resp.json()
    hourly = payload.get("hourly", {})
    suffix = "" if model == "best_match" else f"_{model}"
    rain = hourly.get(f"precipitation{suffix}") or hourly.get("precipitation") or []
    return [{"datetime": iso, "precipitation": mm} for iso, mm in zip(hourly.get("time", []), rain)]


async def fetch_imgw_forecast(hass, gfs=False):
    """Prognoza IMGW dla punktu ogrodu w formacie encji weather HA (hourly 24 h, doby, week co 3 h).
    gfs=False — krótki model ALARO/AROME (~2,5 doby), True — GFS z IMGW (7 dni)."""
    rows = (await imgw_point(hass))["gfs" if gfs else "hourly"]
    if not rows:
        raise ValueError("IMGW: prognoza GFS chwilowo niedostępna")
    return week_payload(rows[:24], rows)


def week_payload(hourly24, rows, daily=None):
    """Wspólny kształt prognozy: 24 h godzinowo, 7 dób (z wierszy albo podane), 7 dni co 3 h."""
    tz = dt_util.get_default_time_zone()
    return {
        "hourly": hourly24,
        "daily": (daily if daily is not None else daily_from_hourly(rows, tz))[:7],
        "week": week_grid(three_hourly(rows, tz), dt_util.now()),
    }


async def fetch_openmeteo_forecast(hass, model):
    """Prognoza z konkretnego modelu Open-Meteo w formacie encji weather HA
    (hourly 24h + daily 7 dni; wilgotność/ciśnienie dobowe = średnie z godzinowych)."""
    lat, lon = garden_location(hass)
    session = async_get_clientsession(hass)
    suffix = "" if model == "best_match" else f"_{model}"
    url = (
        "https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}"
        "&hourly=temperature_2m,precipitation,precipitation_probability,"
        "relative_humidity_2m,surface_pressure"
        "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,"
        "precipitation_probability_max"
        f"&models={model}&forecast_days=7&timezone=auto"
    )
    async with session.get(url, timeout=aiohttp.ClientTimeout(total=30)) as resp:
        resp.raise_for_status()
        payload = await resp.json()
    hourly = payload.get("hourly", {})
    daily = payload.get("daily", {})
    get = lambda src, key: src.get(f"{key}{suffix}") or src.get(key) or []
    times = hourly.get("time", [])
    h_temp = get(hourly, "temperature_2m")
    h_rain = get(hourly, "precipitation")
    h_prob = get(hourly, "precipitation_probability")
    h_hum = get(hourly, "relative_humidity_2m")
    h_press = get(hourly, "surface_pressure")
    hourly_rows, all_rows = [], []
    day_agg = {}
    for i, iso in enumerate(times):
        row = {
            "datetime": iso,
            "temperature": h_temp[i] if i < len(h_temp) else None,
            "precipitation": h_rain[i] if i < len(h_rain) else None,
            "precipitation_probability": h_prob[i] if i < len(h_prob) else None,
            "humidity": h_hum[i] if i < len(h_hum) else None,
            "pressure": h_press[i] if i < len(h_press) else None,
        }
        all_rows.append(row)
        if len(hourly_rows) < 24:
            hourly_rows.append(row)
        day = iso[:10]
        agg = day_agg.setdefault(day, {"hum": [], "press": []})
        if row["humidity"] is not None:
            agg["hum"].append(row["humidity"])
        if row["pressure"] is not None:
            agg["press"].append(row["pressure"])
    d_times = daily.get("time", [])
    d_tmax = get(daily, "temperature_2m_max")
    d_tmin = get(daily, "temperature_2m_min")
    d_rain = get(daily, "precipitation_sum")
    d_prob = get(daily, "precipitation_probability_max")
    mean = lambda xs: round(sum(xs) / len(xs), 1) if xs else None
    daily_rows = []
    for i, iso in enumerate(d_times[:7]):
        agg = day_agg.get(iso, {"hum": [], "press": []})
        daily_rows.append(
            {
                "datetime": iso,
                "temperature": d_tmax[i] if i < len(d_tmax) else None,
                "templow": d_tmin[i] if i < len(d_tmin) else None,
                "precipitation": d_rain[i] if i < len(d_rain) else None,
                "precipitation_probability": d_prob[i] if i < len(d_prob) else None,
                "humidity": mean(agg["hum"]),
                "pressure": mean(agg["press"]),
            }
        )
    return week_payload(hourly_rows, all_rows, daily_rows)
