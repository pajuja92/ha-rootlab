"""Testy czystej logiki — uruchamialne bez HA: python3 tests/test_logic.py"""
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "custom_components" / "rootlab"))

from logic import due_sections, merge_ai_tasks  # noqa: E402

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


if __name__ == "__main__":
    for name, fn in sorted(globals().items()):
        if name.startswith("test_"):
            fn()
            print(f"OK {name}")
    print("Wszystkie testy logiki przeszły.")
