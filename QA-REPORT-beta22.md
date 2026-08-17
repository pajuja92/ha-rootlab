# QA: raporty z testów w Home Assistant (od drugiego Claude'a)

Cześć! 👋 Tu Claude od wdrożeń — instaluję kolejne bety przez HACS i przeklikuję je w HA. Plik untracked, nie commituj go.

## v0.4.0-beta.24 — wdrożona i przetestowana ✅ (2026-08-17)

- HACS → beta.24 → restart HA, start czysty.
- **Uprawa tworzy kartę rośliny — działa**: nowa uprawa Marchew (preset, Grządki, siew wprost, bez zadań) automatycznie utworzyła kartę „Marchew (Daucus carota)" w strefie Grządki; kafelek dostał pomarańczową obwódkę powiązania z aktywną uprawą.
- Karta rośliny: tryb podglądu (chipy strefy/nasadzenia, sekcja UPRAWY z badge fazy „Zbiór", Zapytaj AI, notatki, historia) i tryb edycji (pełny formularz + zintegrowana sekcja uprawy) — OK.
- Prefill presetu Marchwi: „Siew wprost / sadzenie", siew 20.03, zbiór 15.06–31.10 — OK.

### Uwagi dla Ciebie (beta.24)

1. **„Usuń" w dialogu „Edytuj uprawę" używa natywnego `confirm()`** — blokuje automatyzację (CDP), odstaje od reszty UI (wszystko inne to dialogi HA) i w HA companion app potrafi się różnie zachowywać. Zamień na ha-dialog / mwc-dialog z potwierdzeniem.
2. Na kafelku rośliny nie widzę belki fazy wegetacji z changelogu („kafelek z belką fazy") — jest tylko pomarańczowa obwódka; belka jest w karcie (sekcja UPRAWY). Jeśli belka na kafelku miała być widoczna — sprawdź.
3. Sekcja „UPRAWY 2026" pod strefą pokazuje się dla Szklarni (uprawa Pomidor bez karty), ale uprawa Marchwi z kartą nie jest już listowana pod Grządkami — zakładam, że celowo (wisi na karcie). Potwierdź.

## v0.4.0-beta.23 — wdrożona i przetestowana ✅ (2026-08-17)

- HACS → beta.23 → restart HA. Uwaga operacyjna: tuż po publikacji release'u dialog „Pobierz ponownie" przez kilka minut pokazywał „Commit v0.3.0" bez listy wydań — pomogło „Uaktualnij dane" + twardy refresh przeglądarki.
- Scalenie zakładek działa: Rośliny mają podwidoki „Rośliny / Uprawy", „Uprawy" zniknęły z górnego paska.
- W podwidoku Rośliny pod strefą Szklarnia renderuje się sekcja „UPRAWY 2026" z paskiem fazy (aktualna faza „Zbiór" podświetlona).
- Podwidok Uprawy: oś roku z pasami rozsada (fiolet) / wzrost (zieleń) / zbiór (żółty) + czerwona linia „dziś" — poprawnie.
- Klik wiersza otwiera „Edytuj uprawę" z przyciskami dziennika: Posiane / Wysadzone / Zakończ uprawę + Usuń. OK.
- Konsola bez błędów RootLaba.

### Uwagi dla Ciebie

1. **Płodozmian nie ostrzega przy uprawie z tego samego roku**: w Szklarni jest uprawa Pomidor (psiankowate, 2026); nowa uprawa Pomidor + Szklarnia nie pokazała ostrzeżenia. Jeśli sprawdzasz tylko lata poprzednie — OK, ale rozważ też bieżący rok.
2. **Tajemnicze dane testowe**: w storage jest uprawa Pomidor (Szklarnia, Z rozsady, 20.02/15.05/15.07–10.10 — dokładnie daty prefillu presetu) + 3 zaległe zadania grow, w tym dwa „miejsce usunięte z planu". Ja przy testach beta.22 klikałem „Anuluj" w dialogu Nowa uprawa (z wybranym presetem Pomidor). Dziś w beta.23 Anuluj poprawnie nie zapisuje. Sprawdź, czy w beta.22 Anuluj nie zapisywał uprawy — albo to Twoje dane testowe; w każdym razie warto je posprzątać (zostawiłem, żeby nie niszczyć śladów).
3. Nadal aktualne z beta.22: 6 zduplikowanych wpisów w Wiedzy („Liście pomidora zaczęły się robić żółte", 2026-07-31) — przydałaby się deduplikacja.

## v0.4.0-beta.22 — wdrożona i przetestowana ✅ (2026-08-17)

- Zakładka Uprawy (wtedy osobna), dialog Nowa uprawa z prefillm z fenologii (Pomidor → psiankowate, Z rozsady, 20.02/15.05/15.07–10.10), Zaplanuj sezon z AI (7 propozycji z uzasadnieniami płodozmianowymi — podgląd OK, nie akceptowałem).
- Konsola bez błędów RootLaba.

Powodzenia z kolejną betą! 🌱
