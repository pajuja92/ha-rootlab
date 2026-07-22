# RootLab — Mapa drogowa do 1.0.0

Wersjonowanie: semver z pre-release (`0.1.0-beta.N`). Każdy etap = jedno wydanie beta z tagiem i release na GitHubie. Stabilne `1.0.0` po etapie stabilizacji.

## ✅ Etap 1 — Fundament (v0.1.0-beta.1, wydane)

- [x] Integracja HA z config flow (jedna instancja), HACS-ready
- [x] Panel w pasku bocznym (rejestracja przez integrację, `mdi:sprout`)
- [x] Storage (zony + rośliny) i WebSocket API (get/save/delete)
- [x] Taby: Pulpit / Rośliny / Zadania / Woda; design system (tokeny, dark mode, micro-copy)
- [x] Strefy i rośliny — CRUD w dialogach
- [x] Mapowanie encji czujników do roślin (gleba / temperatura / wilgotność) + wartości live, more-info, stan offline

## Etap 2 — Nawadnianie (v0.1.0-beta.2)

Cel: tab **Woda** w pełni funkcjonalny.

- [ ] Model danych: sekcje nawadniania (nazwa, strefa, encja `switch`/`valve`, typ: kropelkowe/zraszacz)
- [ ] Harmonogram per sekcja: dni tygodnia, godziny startu, czas trwania — edycja w dialogu
- [ ] Backend-scheduler: automatyczne włączanie/wyłączanie encji wg harmonogramu (time-tracking HA, przeżywa restart)
- [ ] „Podlej teraz" (5/10/15 min) z automatycznym wyłączeniem; przycisk stop
- [ ] Globalne „Wstrzymaj" (do odwołania / na X dni)
- [ ] UI wg design systemu: oś doby z blokami harmonogramu, znacznik „teraz", pulsująca aktywna sekcja
- [ ] Skrót stanu nawadniania na Pulpicie

## Etap 3 — Pogoda IMGW (v0.1.0-beta.3)

Cel: dane pogodowe w aplikacji i pierwsze sprzężenie z nawadnianiem.

- [ ] Klient API IMGW (danepubliczne.imgw.pl) — stacja synoptyczna wybierana w opcjach integracji (options flow)
- [ ] Karta pogody na Pulpicie: temperatura, opad, wiatr, wilgotność + prognoza
- [ ] Reguły proste (bez AI): opad > progu → propozycja pominięcia podlewania (przyciski „Pomiń / Podlewaj mimo to"), ostrzeżenie o przymrozku
- [ ] Cache i obsługa niedostępności API (spokojny komunikat, nie błąd)

## Etap 4 — AI: Centrum Zadań (v0.1.0-beta.4)

Cel: tab **Zadania** — AI układa listy prac.

- [ ] Konfiguracja klucza API (Claude) w options flow; test połączenia
- [ ] Generowanie zadań per roślina na bazie: gatunku, pory roku, danych z czujników i pogody
- [ ] Kategorie: Utrzymanie (przycinanie, pielenie, nawożenie) / Zabezpieczenie (opryski, przymrozki) — z terminami
- [ ] UI zadań: lista wg kategorii, odhaczanie, odkładanie („przypomnij za X dni"), własne zadania ręczne
- [ ] Odświeżanie cyklicznie (np. co tydzień) + na żądanie; oznaczanie wypowiedzi AI wg design systemu (ikona + border `--rl-ai`)
- [ ] Top-3 zadania na Pulpicie; opcjonalne powiadomienia HA (persistent notification / mobile)

## Etap 5 — Tryb kryzysowy (v0.1.0-beta.5)

Cel: zdjęcie + opis → diagnoza i plan naprawczy.

- [ ] FAB `mdi:leaf-off` dostępny z każdego widoku
- [ ] Upload zdjęcia (plik / aparat na mobile), wybór rośliny, opis objawów
- [ ] Diagnoza AI (vision): rozpoznanie problemu + poziom pewności (wysoka/średnia/niska)
- [ ] Plan naprawczy jako checklista → jeden klik dodaje do Zadań (kategoria: Kryzysowe) ze zdjęciem
- [ ] Historia zgłoszeń per roślina (co pomogło ostatnio)
- [ ] Komunikaty w trakcie analizy („Oglądam liście…") wg micro-copy

## Etap 6 — Visual Garden Editor (v0.2.0-beta.1)

Cel: edytor 2D rozmieszczenia ogrodu. Skok wersji minor — duża zmiana frontendu.

- [ ] Migracja frontendu na lit + lekki build (rollup) — edytor przekracza możliwości wygodnego vanilla JS
- [ ] Płótno 2D (SVG): przeciąganie roślin/krzewów/drzew z katalogu na pozycję x,y, definiowanie wymiarów (średnica korony, wysokość)
- [ ] Obrysy stref na planie; przypisanie rośliny do strefy przez położenie
- [ ] Wyliczanie zacienienia: uproszczony model toru słońca (szerokość geograficzna z konfiguracji HA, pora roku) → mapa nasłonecznienia
- [ ] Zacienienie jako kontekst dla AI (podpowiedzi „to stanowisko jest zbyt cieniste dla pomidora")

## Etap 7 — Stabilizacja (v1.0.0)

- [ ] Migracje wersji storage (dane użytkowników przeżywają aktualizacje)
- [ ] Testy backendu (pytest-homeassistant-custom-component): scheduler, WS API, klient IMGW
- [ ] Pełne tłumaczenia PL/EN całego panelu
- [ ] Dokumentacja użytkownika w README (zrzuty ekranu, konfiguracja krok po kroku)
- [ ] Zgłoszenie do domyślnego katalogu HACS (opcjonalnie)

## Zasady przekrojowe

- Każda beta ma działać samodzielnie — nie wydajemy połowy funkcji.
- AI nigdy nie działa automatycznie bez zgody (propozycja + dwa przyciski); dane czujników zawsze odróżnialne od interpretacji AI.
- Zero zależności frontendowych do etapu 5 włącznie; build pojawia się dopiero z edytorem 2D.
- Klucze API tylko w options flow (storage HA), nigdy w repo.
