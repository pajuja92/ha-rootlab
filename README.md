# RootLab 🌱

Planer ogrodowy dla Home Assistant wspierany przez AI. Własna zakładka **RootLab** w pasku bocznym: rośliny i strefy, nawadnianie, pogoda IMGW, zadania układane przez AI, tryb kryzysowy ze zdjęciem i edytor 2D ogrodu.

## Funkcje

- **Pulpit** — status stref, pogoda IMGW, aktywne podlewanie, najbliższe zadania, ostrzeżenia (deszcz → propozycja pominięcia podlewania, przymrozek).
- **Rośliny** — katalog roślin/krzewów/drzew w strefach (szklarnia, grządki…). Do rośliny podpinasz encje czujników HA (wilgotność gleby, temperatura, wilgotność powietrza) — wartości na żywo na karcie, klik otwiera natywny dialog encji.
- **Woda** — sekcje nawadniania spięte z encjami `switch`/`valve`/`input_boolean`, harmonogram per sekcja (dni tygodnia, godziny, czas trwania), automatyczny scheduler, „podlej teraz" (5/10/15 min) z auto-stopem, globalne wstrzymanie, oś doby z blokami harmonogramu.
- **Zadania** — AI (Claude) układa zadania per roślina: Utrzymanie (przycinanie, pielenie, nawożenie) i Zabezpieczenie (opryski, przymrozki), z terminami. Odhaczanie, odkładanie, własne zadania. Automatyczne odświeżanie w poniedziałki o 5:00.
- **Tryb kryzysowy** — czerwony przycisk w rogu: zdjęcie + opis objawów → diagnoza AI z poziomem pewności i planem naprawczym, dodawanym jednym klikiem do zadań. Historia zgłoszeń per roślina.
- **Edytor** — plan 2D ogrodu: klik stawia roślinę/drzewo/krzew/obiekt, przeciąganie przesuwa, definiujesz średnicę korony i wysokość. Uproszczony model toru słońca (Twoja szerokość geograficzna + suwak miesiąca) rysuje cienie i oznacza zacienione rośliny (☁).

Interfejs po polsku i angielsku (wg języka HA), dark mode zgodny z motywem HA.

## Instalacja

### HACS (zalecane)

1. HACS → Integrations → ⋮ → *Custom repositories*
2. Dodaj `https://github.com/pajuja92/ha-rootlab` jako typ *Integration*
3. Zainstaluj **RootLab** (włącz „Show beta versions", dopóki nie ma wydania stabilnego) i zrestartuj Home Assistant

### Ręcznie

1. Skopiuj `custom_components/rootlab` do katalogu `config/custom_components/` w HA
2. Zrestartuj Home Assistant

Następnie: *Ustawienia → Urządzenia i usługi → Dodaj integrację → RootLab*. Zakładka pojawi się w pasku bocznym.

## Konfiguracja

*Ustawienia → Urządzenia i usługi → RootLab → Konfiguruj*:

| Opcja | Opis |
|---|---|
| **Stacja IMGW** | Nazwa stacji synoptycznej (małe litery, bez znaków diakrytycznych), np. `warszawa`, `krakow`, `poznan`, `wroclaw`. Lista: [danepubliczne.imgw.pl/api/data/synop](https://danepubliczne.imgw.pl/api/data/synop) |
| **Klucz API Claude** | Wymagany do Zadań AI i Trybu kryzysowego. Wygenerujesz go na [platform.claude.com](https://platform.claude.com). Bez klucza reszta aplikacji działa normalnie. |

## Jak zacząć

1. Dodaj strefy (Rośliny → **+ Strefa**), potem rośliny i podepnij ich czujniki.
2. W zakładce Woda dodaj sekcje nawadniania i ustaw harmonogram.
3. Podaj klucz API w opcjach i kliknij **✦ Wygeneruj zadania**.
4. W Edytorze rozstaw ogród i sprawdź zacienienie w różnych miesiącach.

## Dane i prywatność

- Wszystkie dane (rośliny, harmonogramy, zadania, historia) leżą lokalnie w storage HA (`.storage/rootlab.data`).
- Do API Claude wysyłane są tylko: lista roślin z odczytami czujników, bieżąca pogoda i — w trybie kryzysowym — zdjęcie z opisem. Klucz API trzymany jest w konfiguracji integracji.
- Pogoda pochodzi z publicznego API IMGW (bez klucza).

## Rozwój

- Mapa drogowa: [docs/ROADMAP.md](docs/ROADMAP.md) · Design system: [docs/DESIGN.md](docs/DESIGN.md)
- Testy logiki: `python3 tests/test_logic.py` oraz `node tests/test_shade.mjs`
- Frontend to vanilla Web Components (moduły ES) — zero zależności i bundlera.

## Status

Wersjonowanie semantyczne z pre-release. Aktualnie **release candidate** (`1.0.0-rc.1`) — stabilne `1.0.0` po testach na żywych instalacjach. Zgłoszenia: [Issues](https://github.com/pajuja92/ha-rootlab/issues).
