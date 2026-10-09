"""Testy czystej logiki — uruchamialne bez HA: python3 tests/test_logic.py"""
import sys
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).parent.parent / "custom_components" / "rootlab"))

from logic import daily_from_hourly, due_sections, imgw_hourly, imgw_now, merge_ai_tasks, rain_sum, three_hourly, week_grid  # noqa: E402

MONDAY_6 = datetime(2026, 7, 20, 6, 0)  # poniedziałek 06:00
SECTION = {"id": "a", "schedule": {"days": [0, 2], "times": ["06:00", "19:00"], "duration_min": 10}}


def test_due():
    assert due_sections([SECTION], MONDAY_6) == [SECTION]
    assert due_sections([SECTION], datetime(2026, 7, 20, 6, 1)) == []  # zła minuta
    assert due_sections([SECTION], datetime(2026, 7, 21, 6, 0)) == []  # wtorek — poza days
    assert due_sections([SECTION], datetime(2026, 7, 22, 19, 0)) == [SECTION]  # środa 19:00


def test_paused_and_skipped():
    assert due_sections([SECTION], MONDAY_6, paused_until="indef") == []
    assert due_sections([SECTION], MONDAY_6, paused_until="2026-07-25") == []  # pauza trwa
    assert due_sections([SECTION], MONDAY_6, paused_until="2026-07-19") == [SECTION]  # pauza minęła
    assert due_sections([SECTION], MONDAY_6, skip_date="2026-07-20") == []
    assert due_sections([SECTION], MONDAY_6, skip_date="2026-07-19") == [SECTION]
    assert due_sections([{**SECTION, "paused": True}], MONDAY_6) == []
    assert due_sections([{**SECTION, "paused_until": "indef"}], MONDAY_6) == []
    assert due_sections([{**SECTION, "paused_until": "2026-07-25"}], MONDAY_6) == []
    assert due_sections([{**SECTION, "paused_until": "2026-07-19"}], MONDAY_6) == [{**SECTION, "paused_until": "2026-07-19"}]
    assert due_sections([SECTION], MONDAY_6, paused_until="zepsuta-data") == [SECTION]


def test_no_schedule():
    assert due_sections([{"id": "b"}], MONDAY_6) == []
    assert due_sections([{"id": "b", "schedule": {}}], MONDAY_6) == []


def test_merge_ai_tasks():
    old = [
        {"id": "1", "source": "ai", "done": False},
        {"id": "2", "source": "ai", "done": True},
        {"id": "3", "source": "user", "done": False},
        {"id": "4", "source": "crisis", "done": False},
    ]
    fresh = [{"id": "5", "source": "ai", "done": False}]
    merged = merge_ai_tasks(old, fresh)
    ids = [t["id"] for t in merged]
    assert "1" not in ids  # niezrobione AI zastąpione
    assert set(ids) == {"2", "3", "4", "5"}


def _imgw_row(date, temp_k, rain="0.0", kind="Type_Hour", model="ALARO"):
    return {"Type": kind, "MODEL": model, "Date": date, "Temperature": temp_k, "Precipitation": rain,
            "Precipitation10m": rain, "Humidity": "80", "PressureMSL": "101300", "Wind_Speed": "2.5"}


IMGW_PAYLOAD = {"data": {"Data": [
    _imgw_row("2026-10-07T08:20:00Z", "283.15", "0.2", "Type_Ten_Minutes", "ANALIZA INCA  + MERGE"),
    _imgw_row("2026-10-07T08:30:00Z", "284.15", "0.0", "Type_Ten_Minutes", "INCA"),
    _imgw_row("2026-10-07T09:00:00Z", "288.15", "1.5"),
    _imgw_row("2026-10-07T10:00:00Z", "", "0.5"),  # brak temperatury nie może wywrócić przeliczenia
]}}


def test_imgw_conversion():
    rows = imgw_hourly(IMGW_PAYLOAD)
    assert [r["datetime"] for r in rows] == ["2026-10-07T09:00:00Z", "2026-10-07T10:00:00Z"]  # bez 10-min
    assert rows[0]["temperature"] == 15.0 and rows[0]["pressure"] == 1013.0  # K → °C, Pa → hPa
    assert rows[1]["temperature"] is None and rows[1]["precipitation"] == 0.5
    now = imgw_now(IMGW_PAYLOAD)
    assert now["temperatura"] == 10.0 and now["opad_10min"] == 0.2 and now["czas"] == "2026-10-07T08:20:00Z"
    assert imgw_now({"data": {"Data": [_imgw_row("2026-10-07T09:00:00Z", "280")]}}) is None
    assert imgw_hourly({}) == [] and imgw_now({}) is None


def test_daily_and_rain_sum():
    warsaw = ZoneInfo("Europe/Warsaw")
    # 22:00Z = północ w Warszawie: 23 h jednej doby + 13 h następnej, ogon 1 h odpada
    hours = [{"datetime": f"2026-10-07T{h:02d}:00:00Z", "temperature": float(h), "precipitation": 1.0,
              "humidity": 80.0, "pressure": 1000.0} for h in range(1, 24)]
    hours += [{**r, "datetime": r["datetime"].replace("10-07", "10-08")} for r in hours[:13]]
    hours.append({**hours[0], "datetime": "2026-10-09T23:00:00Z"})
    days = daily_from_hourly(hours, warsaw)
    assert [d["datetime"] for d in days] == ["2026-10-07", "2026-10-08"]
    assert days[0]["temperature"] == 21.0 and days[0]["templow"] == 1.0 and days[0]["precipitation"] == 21.0
    start = datetime(2026, 10, 7, 12, 0, tzinfo=warsaw)  # 10:00Z
    assert rain_sum(hours, start, start + timedelta(hours=3)) == 3.0  # (11Z, 12Z, 13Z]
    # Open-Meteo: czas lokalny bez strefy
    assert rain_sum([{"datetime": "2026-10-07T13:00", "precipitation": 2.0}], start, start + timedelta(hours=1)) == 2.0


def test_three_hourly():
    warsaw = ZoneInfo("Europe/Warsaw")
    # 22:00Z..03:00Z = 0:00..5:00 lokalnie → kroki 0:00 i 3:00
    rows = [{"datetime": f"2026-10-0{7 if h >= 22 else 8}T{h:02d}:00:00Z", "temperature": float(i),
             "precipitation": 0.5, "precipitation_probability": 10.0 * i, "humidity": 80.0, "pressure": None}
            for i, h in enumerate([22, 23, 0, 1, 2, 3])]
    out = three_hourly(rows, warsaw)
    assert [r["datetime"] for r in out] == ["2026-10-08T00:00:00+02:00", "2026-10-08T03:00:00+02:00"]
    assert out[0]["temperature"] == 0.0 and out[1]["temperature"] == 3.0  # wartość z początku kroku
    assert out[0]["precipitation"] == 1.5 and out[0]["precipitation_probability"] == 20.0
    assert out[0]["pressure"] is None
    # krok 3-godzinny na wejściu (GFS) zostaje 1:1
    gfs = [{"datetime": "2026-10-12T01:00:00Z", "temperature": 5.0, "precipitation": 2.0}]
    assert three_hourly(gfs, warsaw)[0]["precipitation"] == 2.0


def test_week_grid():
    warsaw = ZoneInfo("Europe/Warsaw")
    now = datetime(2026, 10, 7, 10, 40, tzinfo=warsaw)
    short = three_hourly([{"datetime": "2026-10-07T07:00:00Z", "temperature": 12.0}], warsaw)  # 9:00 lokalnie
    grid = week_grid(short, now)
    # krótki model: ta sama siatka co 7-dniowy (9:00 dziś → 21:00 7. doby), puste kroki bez wartości
    assert grid[0] == short[0] and grid[0]["datetime"] == "2026-10-07T09:00:00+02:00"
    assert grid[-1] == {"datetime": "2026-10-13T21:00:00+02:00"}
    assert len(grid) == 5 + 6 * 8
    assert week_grid([], now) == []


if __name__ == "__main__":
    for name, fn in sorted(globals().items()):
        if name.startswith("test_"):
            fn()
            print(f"OK {name}")
    print("Wszystkie testy logiki przeszły.")
