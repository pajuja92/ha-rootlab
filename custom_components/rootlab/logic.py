"""Czysta logika RootLab — bez zależności od HA, testowalna zwykłym Pythonem."""
import math
from datetime import date, datetime, timedelta


def _section_paused(section, today):
    until = section.get("paused_until")
    if until == "indef":
        return True
    if until:
        try:
            if today <= date.fromisoformat(until):
                return True
        except ValueError:
            pass
    return bool(section.get("paused"))


def due_sections(sections, now, paused_until=None, skip_date=None):
    """Sekcje, które powinny wystartować w tej minucie (now = lokalny datetime)."""
    if paused_until == "indef":
        return []
    if paused_until:
        try:
            if now.date() <= date.fromisoformat(paused_until):
                return []
        except ValueError:
            pass
    if skip_date == now.date().isoformat():
        return []
    hhmm = now.strftime("%H:%M")
    out = []
    for section in sections:
        schedule = section.get("schedule") or {}
        if _section_paused(section, now.date()):
            continue
        if now.weekday() not in (schedule.get("days") or []):
            continue
        if hhmm in (schedule.get("times") or []):
            out.append(section)
    return out


def merge_ai_tasks(tasks, fresh):
    """Nowe zadania AI zastępują niezrobione zadania AI; ręczne, kryzysowe i zrobione zostają."""
    kept = [t for t in tasks if t.get("done") or t.get("source") != "ai"]
    return kept + fresh


def _num(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _local(iso, tz):
    """ISO → czas lokalny tz; czas bez strefy (Open-Meteo z timezone=auto) już jest lokalny."""
    ts = datetime.fromisoformat(iso)
    return ts.replace(tzinfo=tz) if ts.tzinfo is None else ts.astimezone(tz)


def imgw_hourly(payload):
    """Godzinowa prognoza meteo.imgw.pl → wiersze w formacie encji weather HA.

    IMGW podaje liczby jako tekst, temperaturę w K, ciśnienie w Pa; brak prawdopodobieństwa opadu."""
    rows = []
    for r in (payload.get("data") or {}).get("Data") or []:
        if r.get("Type") != "Type_Hour":
            continue  # pomijamy nowcast co 10 min — wykresy i reguły są godzinowe
        temp, press = _num(r.get("Temperature")), _num(r.get("PressureMSL"))
        rows.append(
            {
                "datetime": r["Date"],
                "temperature": round(temp - 273.15, 1) if temp is not None else None,
                "precipitation": _num(r.get("Precipitation")),
                "precipitation_probability": None,
                "humidity": _num(r.get("Humidity")),
                "pressure": round(press / 100, 1) if press is not None else None,
                "wind_speed": _num(r.get("Wind_Speed")),  # m/s
                "wind_bearing": _num(r.get("Wind_Dir")),
            }
        )
    return rows


# 1 mm błędu opadów/dobę waży w rankingu tyle co 2 °C błędu temperatury —
# dla ogrodu pomyłka w deszczu (podlać czy nie) kosztuje więcej niż w stopniach
RAIN_WEIGHT = 2.0


def rank_score(mae_temp, rain_err):
    """Wynik rankingu trafności (niżej = lepiej); None, gdy brak którejś miary."""
    if mae_temp is None or rain_err is None:
        return None
    return round(mae_temp + RAIN_WEIGHT * rain_err, 2)


def bias_summary(daily, threshold=0.5):
    """Kierunek pomyłek z dziennych błędów [{d, t, r}] (+ zawyża, − zaniża):
    średni błąd ze znakiem i liczba dni z pomyłką ≥ threshold w górę / w dół."""
    out = {"bias_days": len(daily), "bias_since": daily[0]["d"] if daily else None}
    for key, name in (("t", "temp"), ("r", "rain")):
        xs = [x[key] for x in daily if x.get(key) is not None]
        out[f"{name}_bias"] = round(sum(xs) / len(xs), 2) if xs else None
        out[f"{name}_up"] = sum(x >= threshold for x in xs)
        out[f"{name}_down"] = sum(x <= -threshold for x in xs)
    return out


def wind_mean(rows):
    """Średni wiatr z wierszy: (prędkość m/s, kierunek °) — kierunek jako średnia wektorowa
    (z 350° i 10° wychodzi 0°, nie 180°). (None, None) gdy brak danych."""
    pts = [(r["wind_speed"], r.get("wind_bearing")) for r in rows if r.get("wind_speed") is not None]
    if not pts:
        return None, None
    speed = round(sum(v for v, _ in pts) / len(pts), 1)
    dirs = [(v or 0.1, b) for v, b in pts if b is not None]
    if not dirs:
        return speed, None
    east = sum(v * math.sin(math.radians(b)) for v, b in dirs)
    north = sum(v * math.cos(math.radians(b)) for v, b in dirs)
    return speed, round(math.degrees(math.atan2(east, north)) % 360)


def daily_from_hourly(rows, tz):
    """Doby (czas lokalny tz) z wierszy godzinowych: max/min temperatury, suma opadu, średnie.

    Ostatnia doba z < 12 godzinami (ogon prognozy) odpada — jej max/min/suma by kłamały."""
    days = {}
    for row in rows:
        day = _local(row["datetime"], tz).date().isoformat()
        days.setdefault(day, []).append(row)
    if len(days) > 1 and len(days[list(days)[-1]]) < 12:
        days.pop(list(days)[-1])
    mean = lambda xs: round(sum(xs) / len(xs), 1) if xs else None
    out = []
    for day, items in days.items():
        col = lambda key: [r[key] for r in items if r.get(key) is not None]
        temps = col("temperature")
        speed, bearing = wind_mean(items)
        out.append(
            {
                "datetime": day,
                "temperature": max(temps) if temps else None,
                "templow": min(temps) if temps else None,
                "precipitation": round(sum(col("precipitation")), 1),
                "precipitation_probability": None,
                "humidity": mean(col("humidity")),
                "pressure": mean(col("pressure")),
                "wind_speed": speed,
                "wind_bearing": bearing,
            }
        )
    return out


def rain_sum(rows, start, end):
    """Suma opadu [mm] z wierszy godzinowych, których czas mieści się w (start, end]."""
    total = 0.0
    for row in rows:
        ts = datetime.fromisoformat(row["datetime"])
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=start.tzinfo)
        if start < ts <= end and row.get("precipitation") is not None:
            total += row["precipitation"]
    return round(total, 1)


def imgw_now(payload):
    """Analiza INCA dla punktu (najświeższy wiersz 10-min „ANALIZA…”) → pola jak w pomiarze stacji
    synop IMGW (temperatura, wilgotnosc_wzgledna, predkosc_wiatru, cisnienie) + opad_10min i czas."""
    for r in (payload.get("data") or {}).get("Data") or []:
        if r.get("Type") == "Type_Ten_Minutes" and str(r.get("MODEL", "")).startswith("ANALIZA"):
            temp, press = _num(r.get("Temperature")), _num(r.get("PressureMSL"))
            return {
                "temperatura": round(temp - 273.15, 1) if temp is not None else None,
                "wilgotnosc_wzgledna": _num(r.get("Humidity")),
                "predkosc_wiatru": _num(r.get("Wind_Speed")),
                "cisnienie": round(press / 100, 1) if press is not None else None,
                "opad_10min": _num(r.get("Precipitation10m")),
                "czas": r["Date"],
            }
    return None


def three_hourly(rows, tz):
    """Wiersze godzinowe (albo już 3-godzinne) → równe kroki co 3 h czasu lokalnego (0:00, 3:00…).

    Temperatura z początku kroku (chwilowa, jak na wykresie godzinowym), opad = suma kroku,
    szansa opadu = max, wilgotność/ciśnienie = średnia. Równy krok = oś X liczona po indeksie."""
    buckets = {}
    for row in rows:
        ts = _local(row["datetime"], tz)
        start = ts.replace(hour=ts.hour - ts.hour % 3, minute=0, second=0, microsecond=0)
        buckets.setdefault(start, []).append((ts == start, row))
    mean = lambda xs: round(sum(xs) / len(xs), 1) if xs else None
    out = []
    for start, items in sorted(buckets.items()):
        col = lambda key: [r[key] for _, r in items if r.get(key) is not None]
        first = next((r for exact, r in items if exact), None)
        temps = col("temperature")
        probs = col("precipitation_probability")
        speed, bearing = wind_mean([r for _, r in items])
        out.append(
            {
                "datetime": start.isoformat(),
                "temperature": first["temperature"] if first and first.get("temperature") is not None else mean(temps),
                "precipitation": round(sum(col("precipitation")), 1),
                "precipitation_probability": max(probs) if probs else None,
                "humidity": mean(col("humidity")),
                "pressure": mean(col("pressure")),
                "wind_speed": speed,
                "wind_bearing": bearing,
            }
        )
    return out


def week_grid(week, now):
    """Seria co 3 h (z three_hourly) na stałej siatce: od bieżącego kroku do końca 7. doby
    kalendarzowej (now — aware, czas lokalny). Brak danych = wiersz bez wartości (pusta część
    wykresu), więc wykresy różnych źródeł mają tę samą oś X — dzień pod dniem w pionie."""
    if not week:
        return []
    by_time = {datetime.fromisoformat(r["datetime"]): r for r in week}
    slot = now.replace(hour=now.hour - now.hour % 3, minute=0, second=0, microsecond=0)
    end = now.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=7)
    out = []
    while slot < end:
        out.append(by_time.get(slot) or {"datetime": slot.isoformat()})
        slot += timedelta(hours=3)  # czas ścienny (ZoneInfo), jak kroki w three_hourly
    return out
