"""Klient IMGW (danepubliczne.imgw.pl) z prostym cache w pamięci."""
import time

import aiohttp

from homeassistant.helpers.aiohttp_client import async_get_clientsession

API = "https://danepubliczne.imgw.pl/api/data/synop/station/{station}"
TTL = 900  # 15 min — IMGW aktualizuje pomiary co godzinę

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


# Przybliżone współrzędne stacji synoptycznych IMGW (środek miasta wystarcza
# do wyboru najbliższej stacji z mapy).
STATION_COORDS = {
    "bialystok": (53.13, 23.16), "bielskobiala": (49.82, 19.05), "chojnice": (53.70, 17.56),
    "czestochowa": (50.81, 19.12), "elblag": (54.16, 19.40), "gdansk": (54.35, 18.65),
    "gorzow": (52.74, 15.24), "hel": (54.60, 18.81), "jeleniagora": (50.90, 15.73),
    "kalisz": (51.76, 18.09), "kasprowywierch": (49.23, 19.98), "katowice": (50.26, 19.02),
    "ketrzyn": (54.08, 21.37), "kielce": (50.87, 20.63), "klodzko": (50.44, 16.65),
    "kolo": (52.20, 18.64), "kolobrzeg": (54.18, 15.58), "koszalin": (54.19, 16.18),
    "krakow": (50.06, 19.94), "krosno": (49.69, 21.77), "legnica": (51.21, 16.16),
    "lesko": (49.47, 22.33), "leszno": (51.84, 16.57), "lebork": (54.54, 17.75),
    "lodz": (51.76, 19.46), "lublin": (51.25, 22.57), "mikolajki": (53.80, 21.57),
    "mlawa": (53.11, 20.38), "nowysacz": (49.62, 20.72), "olsztyn": (53.78, 20.49),
    "opole": (50.67, 17.93), "ostroleka": (53.08, 21.57), "pila": (53.15, 16.74),
    "plock": (52.55, 19.70), "poznan": (52.41, 16.93), "przemysl": (49.78, 22.77),
    "raciborz": (50.09, 18.22), "resko": (53.77, 15.41), "rzeszow": (50.04, 22.00),
    "sandomierz": (50.68, 21.75), "siedlce": (52.17, 22.29), "slubice": (52.35, 14.56),
    "sniezka": (50.74, 15.74), "suwalki": (54.10, 22.93), "swinoujscie": (53.91, 14.25),
    "szczecin": (53.43, 14.55), "szczecinek": (53.71, 16.70), "tarnow": (50.01, 20.99),
    "terespol": (52.07, 23.62), "torun": (53.01, 18.60), "ustka": (54.58, 16.86),
    "warszawa": (52.23, 21.01), "wielun": (51.22, 18.57), "wlodawa": (51.55, 23.55),
    "wroclaw": (51.11, 17.04), "zakopane": (49.30, 19.95), "zamosc": (50.72, 23.25),
    "zielonagora": (51.94, 15.50),
}


def nearest_station(latitude, longitude):
    """Najbliższa stacja synoptyczna IMGW dla punktu z mapy."""
    import math

    def dist(coords):
        dlat = coords[0] - latitude
        dlon = (coords[1] - longitude) * math.cos(math.radians(latitude))
        return dlat * dlat + dlon * dlon

    return min(STATION_COORDS, key=lambda name: dist(STATION_COORDS[name]))
