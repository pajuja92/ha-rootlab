"""Klient IMGW z prostym cache w pamięci: pomiary stacji (danepubliczne.imgw.pl)
i prognoza punktowa (meteo.imgw.pl)."""
import time

import aiohttp

from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .logic import imgw_hourly, imgw_now

API = "https://danepubliczne.imgw.pl/api/data/synop/station/{station}"
TTL = 900  # 15 min — IMGW aktualizuje pomiary co godzinę
FORECAST_API = "https://meteo.imgw.pl/api/v1/forecast/fcapi"
LONG_TERM_API = "https://meteo.imgw.pl/api/v1/forecast/forecastapi"  # GFS liczony przez IMGW, ~16 dni
# ponytail: nieoficjalne API strony meteo.imgw.pl, token z jej aplikacji webowej (ten sam
# dostaje każda przeglądarka). Gdy IMGW go zmieni, użytkownik wpisuje nowy w Ustawienia → Pogoda.
DEFAULT_FORECAST_TOKEN = "p4DXKjsYadfBV21TYrDk"

_PL = str.maketrans("ąćęłńóśźż", "acelnoszz")


class ImgwClient:
    def __init__(self, hass):
        self._hass = hass
        self._cache = {}

    async def fetch(self, station):
        station = (station or "warszawa").strip().lower().translate(_PL).replace(" ", "")
        cached = self._cache.get(station)
        if cached and time.monotonic() - cached[0] < TTL:
            return cached[1]
        try:
            session = async_get_clientsession(self._hass)
            async with session.get(
                API.format(station=station), timeout=aiohttp.ClientTimeout(total=15)
            ) as resp:
                resp.raise_for_status()
                data = await resp.json()
        except Exception:
            # ponytail: przy błędzie oddajemy ostatni znany pomiar albo None — front pokaże spokojny komunikat
            return cached[1] if cached else None
        self._cache[station] = (time.monotonic(), data)
        return data

    async def forecast(self, lat, lon, token=None):
        """Prognoza IMGW dla punktu: {"hourly": [...], "gfs": [...], "now": analiza INCA albo None}.
        Wyjątek przy braku danych.

        hourly — hybrid (INCA + AROME + ALARO, ~2,5 doby; gdy brak — sam ALARO), dokładniejszy;
        gfs — długoterminowy GFS liczony przez IMGW (co 1 h, od 5. doby co 3 h), [] gdy niedostępny."""
        token = token or DEFAULT_FORECAST_TOKEN
        key = ("_fc", round(lat, 3), round(lon, 3), token)
        cached = self._cache.get(key)
        # krócej niż pomiary — analiza INCA odświeża się co 10 min
        if cached and time.monotonic() - cached[0] < 300:
            if cached[1] is None:  # poza Polską nie pytamy IMGW co 10 min na próżno
                raise ValueError("IMGW: brak prognozy dla tej lokalizacji (tylko Polska)")
            return cached[1]
        session = async_get_clientsession(self._hass)
        rows = []
        for model in ("hybrid", "alaro"):
            async with session.get(
                FORECAST_API,
                params={"token": token, "lat": lat, "lon": lon, "m": model},
                timeout=aiohttp.ClientTimeout(total=20),
            ) as resp:
                resp.raise_for_status()
                payload = await resp.json()
            rows = imgw_hourly(payload)
            if rows:
                break
        if not rows:
            self._cache[key] = (time.monotonic(), None)
            raise ValueError("IMGW: brak prognozy dla tej lokalizacji (tylko Polska)")
        gfs = []
        try:
            async with session.get(
                LONG_TERM_API,
                params={"token": token, "lat": lat, "lon": lon},
                timeout=aiohttp.ClientTimeout(total=20),
            ) as resp:
                resp.raise_for_status()
                # przebieg GFS zaczyna się przed teraz — od tej samej godziny co krótki model
                gfs = [r for r in imgw_hourly(await resp.json()) if r["datetime"] >= rows[0]["datetime"]]
        except Exception:  # noqa: BLE001 — bez GFS zostaje krótki model, nie błąd
            pass
        out = {"hourly": rows, "gfs": gfs, "now": imgw_now(payload)}
        self._cache[key] = (time.monotonic(), out)
        return out

    async def stations(self):
        """Lista nazw stacji synoptycznych IMGW (znormalizowane, do selecta w opcjach)."""
        cached = self._cache.get("_stations")
        if cached and time.monotonic() - cached[0] < 24 * 3600:
            return cached[1]
        try:
            session = async_get_clientsession(self._hass)
            async with session.get(
                "https://danepubliczne.imgw.pl/api/data/synop",
                timeout=aiohttp.ClientTimeout(total=15),
            ) as resp:
                resp.raise_for_status()
                data = await resp.json()
            names = sorted(
                {s["stacja"].strip().lower().translate(_PL).replace(" ", "") for s in data}
            )
        except Exception:
            return cached[1] if cached else []
        self._cache["_stations"] = (time.monotonic(), names)
        return names


# Stacje synoptyczne IMGW: nazwa do wyświetlenia + przybliżone współrzędne (środek miasta
# wystarcza do wyboru najbliższej stacji z mapy).
STATIONS = {
    "bialystok": ("Białystok", 53.13, 23.16),
    "bielskobiala": ("Bielsko Biała", 49.82, 19.05),
    "chojnice": ("Chojnice", 53.70, 17.56),
    "czestochowa": ("Częstochowa", 50.81, 19.12),
    "elblag": ("Elbląg", 54.16, 19.40),
    "gdansk": ("Gdańsk", 54.35, 18.65),
    "gorzow": ("Gorzów", 52.74, 15.24),
    "hel": ("Hel", 54.60, 18.81),
    "jeleniagora": ("Jelenia Góra", 50.90, 15.73),
    "kalisz": ("Kalisz", 51.76, 18.09),
    "kasprowywierch": ("Kasprowy Wierch", 49.23, 19.98),
    "katowice": ("Katowice", 50.26, 19.02),
    "ketrzyn": ("Kętrzyn", 54.08, 21.37),
    "kielce": ("Kielce", 50.87, 20.63),
    "klodzko": ("Kłodzko", 50.44, 16.65),
    "kolo": ("Koło", 52.20, 18.64),
    "kolobrzeg": ("Kołobrzeg", 54.18, 15.58),
    "koszalin": ("Koszalin", 54.19, 16.18),
    "krakow": ("Kraków", 50.06, 19.94),
    "krosno": ("Krosno", 49.69, 21.77),
    "legnica": ("Legnica", 51.21, 16.16),
    "lesko": ("Lesko", 49.47, 22.33),
    "leszno": ("Leszno", 51.84, 16.57),
    "lebork": ("Lębork", 54.54, 17.75),
    "lodz": ("Łódź", 51.76, 19.46),
    "lublin": ("Lublin", 51.25, 22.57),
    "mikolajki": ("Mikołajki", 53.80, 21.57),
    "mlawa": ("Mława", 53.11, 20.38),
    "nowysacz": ("Nowy Sącz", 49.62, 20.72),
    "olsztyn": ("Olsztyn", 53.78, 20.49),
    "opole": ("Opole", 50.67, 17.93),
    "ostroleka": ("Ostrołęka", 53.08, 21.57),
    "pila": ("Piła", 53.15, 16.74),
    "plock": ("Płock", 52.55, 19.70),
    "poznan": ("Poznań", 52.41, 16.93),
    "przemysl": ("Przemyśl", 49.78, 22.77),
    "raciborz": ("Racibórz", 50.09, 18.22),
    "resko": ("Resko", 53.77, 15.41),
    "rzeszow": ("Rzeszów", 50.04, 22.00),
    "sandomierz": ("Sandomierz", 50.68, 21.75),
    "siedlce": ("Siedlce", 52.17, 22.29),
    "slubice": ("Słubice", 52.35, 14.56),
    "sniezka": ("Śnieżka", 50.74, 15.74),
    "suwalki": ("Suwałki", 54.10, 22.93),
    "swinoujscie": ("Świnoujście", 53.91, 14.25),
    "szczecin": ("Szczecin", 53.43, 14.55),
    "szczecinek": ("Szczecinek", 53.71, 16.70),
    "tarnow": ("Tarnów", 50.01, 20.99),
    "terespol": ("Terespol", 52.07, 23.62),
    "torun": ("Toruń", 53.01, 18.60),
    "ustka": ("Ustka", 54.58, 16.86),
    "warszawa": ("Warszawa", 52.23, 21.01),
    "wielun": ("Wieluń", 51.22, 18.57),
    "wlodawa": ("Włodawa", 51.55, 23.55),
    "wroclaw": ("Wrocław", 51.11, 17.04),
    "zakopane": ("Zakopane", 49.30, 19.95),
    "zamosc": ("Zamość", 50.72, 23.25),
    "zielonagora": ("Zielona Góra", 51.94, 15.50),
}


def nearest_station(latitude, longitude):
    """Najbliższa stacja synoptyczna IMGW dla punktu z mapy."""
    return min(STATIONS, key=lambda key: station_km(key, latitude, longitude))


def station_km(key, latitude, longitude):
    """Przybliżona odległość [km] stacji od punktu (równoleżnikowe przybliżenie, wystarcza w PL)."""
    import math

    _, lat, lon = STATIONS[key]
    dlat = (lat - latitude) * 111.2
    dlon = (lon - longitude) * 111.2 * math.cos(math.radians(latitude))
    return math.hypot(dlat, dlon)
