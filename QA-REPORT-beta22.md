# QA: raporty z testów w Home Assistant (od drugiego Claude'a)

Cześć! 👋 Tu Claude od wdrożeń — instaluję kolejne bety przez HACS i przeklikuję je w HA. Plik untracked, nie commituj go.

## v0.4.0-beta.27 — wdrożona i przetestowana ✅ (2026-08-17)

Uwaga: instalacja opóźniona przez awarię GitHuba (release'y chwilowo znikły z API — „major - Partial System Outage"); po jej ustąpieniu poszło normalnie.

- **Migracja na zone_id przeszła czysto** — wszystkie strefy (Szklarnia, Grządki, Sad, Krzewy) i rośliny na miejscu po restarcie, zero błędów w konsoli.
- **Pełne spięcie Rośliny↔Uprawy działa**: kalendarz Upraw pokazuje wszystkie rośliny — z terminami (Cebula, paski faz) i bez („bez terminów — kliknij, aby ustawić", tylko linia „dziś"); każda z przypisaną strefą.
- Klik wiersza bez terminów otwiera edycję rośliny ze zintegrowaną sekcją UPRAWY i podpowiedzią o ustawieniu terminów — OK.
- **Nienarysowane strefy w palecie planu**: „🪴 Sad (narysuj strefę)" i „🪴 Krzewy (narysuj strefę)" jako zone-draw — jest.
- Bonus: osierocona „Marchew" zniknęła z palety planu — refactor uporządkował stare wpisy. 👍

## v0.4.0-beta.26 — wdrożona i przetestowana ✅ (2026-08-17)

- HACS → beta.26 → restart HA, start czysty.
- **Zoom widoku planu działa** — kontrolki lupa−/100%/lupa+ w pasku, sprawdziłem 100%→156%→100%.
- Nie testowałem „nowej rośliny z widoku obszaru" (celowo — patrz aktualizacja buga niżej) ani blokady zaznaczania tekstu (trudna do automatycznej weryfikacji).
- Konsola bez błędów RootLaba.

### Aktualizacja buga persystencji usunięć (ważne!)

Dzisiejsze usunięcia (uprawa Marchwi + karta, usunięte ~30 min przed restartem) **przetrwały restart HA przy becie.26** — Marchew NIE wróciła. Czyli bug nie reprodukuje się zawsze. Nowa hipoteza: **race z opóźnionym zapisem storage** (`async_delay_save`?) — wczorajsze usunięcia mogły nie zdążyć się zapisać przed restartem/zamknięciem. Sprawdź, czy delete używa delay_save z długim oknem i czy nie ma ścieżki, gdzie restart gubi pending save. Reprodukcja: usuń coś i zrestartuj HA w ciągu kilku(nastu?) sekund.

⚠️ Przy okazji: dopóki to niepewne, nie tworzę danych testowych tuż przed restartami.

## v0.4.0-beta.25 — wdrożona i przetestowana ✅ (2026-08-17)

- HACS → beta.25 → restart HA, start czysty.
- **Sad (orchard) w palecie edytora** — jest ✅.
- **Jednorazowe dodawanie z palety** — działa: wybór „Drzewo", jeden klik dodaje obiekt, paleta sama się czyści ✅.
- **Klik obiektu otwiera dialog edycji** (etykieta, korona, przypisanie rośliny) ✅. Usunięcie obiektu z dialogu działa.
- Nie testowałem przesuwania z Shiftem (nie chciałem ruszać prawdziwego planu).

### 🐛 POWAŻNY BUG — usunięcia nie przeżywają restartu HA

Przebieg: wczoraj usunąłem testową uprawę Marchwi i jej kartę rośliny (oba przez panel, potwierdzone confirm). Zweryfikowałem — zniknęły. Po dzisiejszym restarcie HA (instalacja beta.25) **oba wróciły** — karta Marchwi z powrotem w Grządkach, uprawa z powrotem na osi. Tworzenie danych przeżywa restart, usuwanie nie → wygląda, jakby po delete brakowało zapisu storage (brak `async_save`/`async_delay_save` po operacji delete w WS handlerach?). Sprawdź wszystkie ścieżki delete (plants, plantings, obiekty planu, zadania…).

### Pozostałe uwagi (beta.25)

1. **Kolejny natywny `confirm()`**: usuwanie obiektu w edytorze planu — ten sam problem co w „Edytuj uprawę" i przy kaflu rośliny. Do wymiany na dialog HA w całej aplikacji.
2. Obserwowałem też niespójność listy upraw w obrębie jednej sesji (raz oś pokazywała tylko Pomidora, po odświeżeniu tylko Marchew) — pewnie ten sam problem świeżości/persystencji danych co wyżej.

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
