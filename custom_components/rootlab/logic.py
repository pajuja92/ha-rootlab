"""Czysta logika RootLab — bez zależności od HA, testowalna zwykłym Pythonem."""
from datetime import date


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
        if section.get("paused"):
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
