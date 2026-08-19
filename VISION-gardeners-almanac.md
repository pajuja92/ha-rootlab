# Gardener's Almanac — wizja produktu (notatki z 2026-08-19)

Notatki z rozmowy Grzegorza z Claude'em o kierunku rozwoju aplikacji (dziś: RootLab, integracja HA; po rebrandingu: **Gardener's Almanac**). Plik roboczy, untracked.

## 1. Rebranding (zdecydowane)

**RootLab → Gardener's Almanac.** „Lab" kłóci się z ciepłym, opiekuńczym charakterem aplikacji (spokojny ogrodnik-ekspert, IMGW, fenologia PL); „almanach" oddaje istotę: kalendarz + pogoda + wiedza + doradca. Plan etapów w `QA-REPORT-beta22.md` (najpierw warstwa wizualna; domena `rootlab` zostaje).

## 2. Architektura docelowa: web jako rdzeń, HA jako „smart tier"

Dziś backendem jest Home Assistant. Docelowo: wydzielić rdzeń (model danych strefy/rośliny/uprawy/zadania, presety fenologiczne, prompty AI, baza wiedzy) do samodzielnej aplikacji webowej z kontami, a HA staje się **jedną z integracji** — dla użytkowników z czujnikami i podlewaniem.

Pozycjonowanie: „planer ogrodowy z AI; a jeśli masz smart home — steruje też podlewaniem". Konkurencja (Planta, PictureThis, Blossom) nie ma nogi smart-home — to naturalny wyróżnik.

Refactor z beta.27 (strefa = jedyna tożsamość miejsca) jest fundamentem pod tę generalizację.

## 3. Aplikacja mobilna = „narzędzie polowe", nie duplikat

Mobilka robi to, co robi się z telefonem w ręku, w rękawicach:
- odhaczanie zadań na dziś,
- dziennik jednym tapnięciem (posiane / wysadzone / zebrane),
- **diagnoza z aparatu** (killer feature na mobile),
- dyktowanie notatek,
- podgląd pogody/ostrzeżeń.

Planowanie sezonu, edytor 2D, baza wiedzy → zostają w webie (duży ekran). Dzięki temu edytora planu w ogóle nie przenosimy na dotyk (Shift+drag nie istnieje na telefonie).

Już teraz tani zysk: audyt obecnego panelu w HA Companion App (responsywność, cele dotykowe, wymiana natywnych `confirm()` na dialogi HA — zgłoszone w QA).

## 4. Rozszerzenie: kwiatki domowe i uprawy domowe

Większy rynek niż „ogród + smart home". Model danych już to udźwignie:

| Istniejący mechanizm | Zastosowanie domowe |
|---|---|
| Strefa (zone_id) | „parapet południowy", „łazienka", „półka z lampą" |
| Karta rośliny (notatki, zdjęcia, diagnozy, AI) | przenosi się 1:1 — to już apka do opieki nad roślinami |
| Fizyka szklarni (temp., wilgotność, ~80% światła) | szkielet pod „warunki w mieszkaniu" (czujnik HA lub ręcznie) |
| Sukcesja siewu (co N dni × k powtórzeń) | microgreens, zioła — cykle 7–21 dni, prawie gotowy „tryb parapetowy" |

Do dodania: presety roślin doniczkowych (podlewanie/nawożenie/przesadzanie/światło zamiast okien siewu), przypomnienia cykliczne zamiast kalendarza sezonowego, ew. rozpoznawanie gatunku ze zdjęcia.
Do wymiany: pogoda IMGW w domu traci sens — rolę przejmują czujniki albo nic.

## 5. Trudne rzeczy (uczciwie)

1. **Multi-tenant backend**: konta, autoryzacja, RODO, backupy — dziś załatwia to HA.
2. **Koszty AI**: dziś użytkownik przynosi własny klucz; w SaaS płaci właściciel → freemium z limitem diagnoz/mies. praktycznie obowiązkowy.
3. **Offline/sync** dla mobilki (słaby zasięg w ogrodzie) — wykonalne przy wąskim zakresie (zadania + dziennik), trudne przy pełnej edycji.
4. **Rozdwojenie kodu** HA vs web — wymaga wspólnej paczki logiki i dwóch cienkich adapterów.

## 6. Rekomendowana kolejność

1. **Audyt mobilny panelu w HA Companion** (tani, natychmiastowy zysk; confirm() → dialogi HA).
2. **Wydzielenie rdzenia logiki** z integracji do osobnej paczki (procentuje też w HA).
3. **Web MVP** na tym rdzeniu, pierwszy target: **rośliny domowe** (najprostszy funkcjonalnie, największy rynek).
4. **Mobilne „narzędzie polowe"** we Flutterze (Grzegorz siedzi w Dart/Flutter) — na końcu.
