# RootLab 🌱

Planer ogrodowy dla Home Assistant wspierany przez AI. Własna zakładka **RootLab** w pasku bocznym: rośliny i strefy, nawadnianie, pogoda IMGW, zadania układane przez AI, tryb kryzysowy ze zdjęciem i edytor 2D ogrodu.

## Funkcje

- **Pulpit** — strefy (z dodawaniem), pogoda IMGW teraz, **wykresy prognozy 24 h / 7 dni** (z dowolnej encji `weather` HA), aktywne podlewanie, najbliższe zadania, ostrzeżenia (deszcz → propozycja pominięcia podlewania, przymrozek).
- **Rośliny** — katalog w strefach, **25 predefiniowanych roślin** (prefill), czujniki HA (gleba/temperatura/wilgotność) na żywo. **Karta rośliny**: notatki, galeria zdjęć, historia diagnoz, pytania do AI (z zapisem do bazy wiedzy) i szybka diagnoza.
- **Woda** — sekcje spięte z `switch`/`valve`/`input_boolean`, harmonogram per sekcja, scheduler, „podlej teraz", **pauza biegu z dokończeniem pozostałego czasu**, stop, **jednorazowe podlewania** (data + godzina), globalne wstrzymanie, oś doby. Scheduler pilnuje też **zewnętrznego wyłączenia encji** (automatyzacja/ręcznie) i zamyka bieg.
- **Zadania** — AI układa zadania per roślina (Utrzymanie / Zabezpieczenie) na bazie gatunku, pory roku, czujników, pogody i warunków (szklarnia). Odhaczanie, odkładanie, własne zadania, auto-odświeżanie w poniedziałki.
- **Tryb kryzysowy** — zdjęcie + opis (można **podyktować** — STT z HA albo przeglądarki) → diagnoza z poziomem pewności i planem naprawczym → do zadań i/lub **do bazy wiedzy**.
- **Wiedza** — zakładka z bazą wiedzy: zatwierdzone odpowiedzi AI i własne wpisy, z wyszukiwarką.
- **Edytor** — tryby **Edycja/Podgląd**. Obszary rysowane przeciągnięciem (szklarnia, grządka, trawnik — z możliwością „zasadzenia" roślin), drzewa/krzewy/obiekty kołami, zmiana rozmiaru, **kierunek północy** (kompas), cienie wg toru słońca i miesiąca, **fizyka szklarni** (≈ +5°C, wyższa wilgotność, ~80% światła — znacznik 🏠 i kontekst dla AI). W podglądzie klik w roślinę otwiera jej kartę.
- **AI do wyboru** — 12 dostawców: Anthropic (Claude), OpenAI, Google Gemini, Groq, Mistral, DeepSeek, xAI, OpenRouter, Together, Perplexity, Ollama (lokalnie), własny endpoint zgodny z OpenAI — **albo usługa „Zadanie AI" z HA** (dowolna integracja AI zalogowana w HA, np. przez konto Google).

Interfejs po polsku i angielsku (wg języka HA), dark mode zgodny z motywem HA, selecty z wyszukiwaniem, odświeżanie na żywo między urządzeniami.

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
| **Stacja IMGW** | Wybór z listy stacji synoptycznych (pomiary bieżące). |
| **Encja pogody** | Dowolna encja `weather.*` (np. Met.no) — źródło wykresów prognozy 24 h / 7 dni. |
| **Dostawca AI** | Jeden z 12 dostawców albo „Zadanie AI z HA" (używa integracji AI skonfigurowanej w HA — logowanie przez konto obsługuje ta integracja). |
| **Klucz API / model / adres** | Dla dostawców z bezpośrednim API. Model pusty = rozsądny domyślny. Adres tylko dla Ollama/custom. |
| **Encja Zadania AI** | Dla dostawcy „Zadanie AI z HA" — wybierz encję `ai_task.*`. |
| **Lokalizacja ogrodu** | Punkt na mapie — używany do obliczeń nasłonecznienia w edytorze i kontekstu AI. |

Dyktowanie objawów (🎤) używa pipeline'u STT z HA (np. Google AI STT); gdy niedostępny — rozpoznawania mowy przeglądarki.

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
