# RootLab — Mapa drogowa do 1.0.0

Wersjonowanie: semver z pre-release (`0.1.0-beta.N`). Każdy etap = jedno wydanie beta z tagiem i release na GitHubie. Stabilne `1.0.0` po etapie stabilizacji.

## ✅ Etap 1 — Fundament (v0.1.0-beta.1, wydane)

- [x] Integracja HA z config flow (jedna instancja), HACS-ready
- [x] Panel w pasku bocznym (rejestracja przez integrację, `mdi:sprout`)
- [x] Storage (zony + rośliny) i WebSocket API (get/save/delete)
- [x] Taby: Pulpit / Rośliny / Zadania / Woda; design system (tokeny, dark mode, micro-copy)
- [x] Strefy i rośliny — CRUD w dialogach
- [x] Mapowanie encji czujników do roślin (gleba / temperatura / wilgotność) + wartości live, more-info, stan offline

## ✅ Etap 2 — Nawadnianie (v0.1.0-beta.2)

Cel: tab **Woda** w pełni funkcjonalny.

- [x] Model danych: sekcje nawadniania (nazwa, strefa, encja `switch`/`valve`, typ: kropelkowe/zraszacz)
- [x] Harmonogram per sekcja: dni tygodnia, godziny startu, czas trwania — edycja w dialogu
- [x] Backend-scheduler: automatyczne włączanie/wyłączanie encji wg harmonogramu (time-tracking HA, przeżywa restart)
- [x] „Podlej teraz" (5/10/15 min) z automatycznym wyłączeniem; przycisk stop
- [x] Globalne „Wstrzymaj" (do odwołania / na X dni)
- [x] UI wg design systemu: oś doby z blokami harmonogramu, znacznik „teraz", pulsująca aktywna sekcja
- [x] Skrót stanu nawadniania na Pulpicie

## ✅ Etap 3 — Pogoda IMGW (v0.1.0-beta.3)

Cel: dane pogodowe w aplikacji i pierwsze sprzężenie z nawadnianiem.

- [x] Klient API IMGW (danepubliczne.imgw.pl) — stacja synoptyczna wybierana w opcjach integracji (options flow)
- [x] Karta pogody na Pulpicie: temperatura, opad, wiatr, wilgotność, ciśnienie *(odstępstwo: publiczne API IMGW daje pomiary bieżące, nie prognozę — reguły działają na danych bieżących)*
- [x] Reguły proste (bez AI): opad > progu → propozycja pominięcia podlewania (przyciski „Pomiń / Podlewaj mimo to"), ostrzeżenie o przymrozku
- [x] Cache i obsługa niedostępności API (spokojny komunikat, nie błąd)

## ✅ Etap 4 — AI: Centrum Zadań (v0.1.0-beta.4)

Cel: tab **Zadania** — AI układa listy prac.

- [x] Konfiguracja klucza API (Claude) w options flow *(bez testu połączenia — błąd klucza widać przy pierwszym generowaniu)*
- [x] Generowanie zadań per roślina na bazie: gatunku, pory roku, danych z czujników i pogody
- [x] Kategorie: Utrzymanie (przycinanie, pielenie, nawożenie) / Zabezpieczenie (opryski, przymrozki) — z terminami
- [x] UI zadań: lista wg kategorii, odhaczanie, odkładanie („przypomnij za X dni"), własne zadania ręczne
- [x] Odświeżanie cyklicznie (np. co tydzień) + na żądanie; oznaczanie wypowiedzi AI wg design systemu (ikona + border `--rl-ai`)
- [x] Top-3 zadania na Pulpicie · powiadomienia HA odłożone (opcjonalne)

## ✅ Etap 5 — Tryb kryzysowy (v0.1.0-beta.5)

Cel: zdjęcie + opis → diagnoza i plan naprawczy.

- [x] FAB `mdi:leaf-off` dostępny z każdego widoku
- [x] Upload zdjęcia (plik / aparat na mobile), wybór rośliny, opis objawów
- [x] Diagnoza AI (vision): rozpoznanie problemu + poziom pewności (wysoka/średnia/niska)
- [x] Plan naprawczy jako checklista → jeden klik dodaje do Zadań (kategoria: Kryzysowe); zdjęcie zostaje w historii zgłoszenia
- [x] Historia zgłoszeń per roślina (co pomogło ostatnio)
- [x] Komunikaty w trakcie analizy („Oglądam liście…") wg micro-copy

## ✅ Etap 6 — Visual Garden Editor (v0.2.0-beta.1)

Cel: edytor 2D rozmieszczenia ogrodu. Skok wersji minor — duża zmiana frontendu.

- [x] *(odstępstwo)* Edytor powstał w vanilla JS + SVG — bez lit i bundlera; instalacja z HACS to nadal czysty klon repo. Migracja na lit tylko, jeśli edytor urośnie
- [x] Płótno 2D (SVG): przeciąganie roślin/krzewów/drzew z katalogu na pozycję x,y, definiowanie wymiarów (średnica korony, wysokość)
- [ ] Obrysy stref na planie; przypisanie rośliny do strefy przez położenie — odłożone do 0.2.x
- [x] Wyliczanie zacienienia: uproszczony model toru słońca (szerokość geograficzna z konfiguracji HA, pora roku) → mapa nasłonecznienia
- [ ] Zacienienie jako kontekst dla AI — odłożone do 0.2.x

## ✅ Etap 7 — Stabilizacja (v1.0.0-rc.1)

- [x] Migracje wersji storage (dane użytkowników przeżywają aktualizacje)
- [x] Testy czystej logiki bez zależności (harmonogram: `tests/test_logic.py`, cień: `tests/test_shade.mjs`) *(odstępstwo: pełny harness pytest-homeassistant odłożony)*
- [x] Pełne tłumaczenia PL/EN całego panelu
- [x] Dokumentacja użytkownika w README (konfiguracja krok po kroku; zrzuty ekranu po testach na żywo)
- [ ] Zgłoszenie do domyślnego katalogu HACS — po stabilnym 1.0.0

## Zasady przekrojowe

- Każda beta ma działać samodzielnie — nie wydajemy połowy funkcji.
- AI nigdy nie działa automatycznie bez zgody (propozycja + dwa przyciski); dane czujników zawsze odróżnialne od interpretacji AI.
- Zero zależności frontendowych do etapu 5 włącznie; build pojawia się dopiero z edytorem 2D.
- Klucze API tylko w options flow (storage HA), nigdy w repo.
