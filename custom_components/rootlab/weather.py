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
