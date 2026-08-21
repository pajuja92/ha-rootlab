# Gardener's Almanac 🌱

Planer ogrodowy dla Home Assistant wspierany przez AI. Własna zakładka w pasku bocznym HA: rośliny i strefy, kalendarz upraw, interaktywny plan ogrodu z symulacją cienia, diagnozy AI ze zdjęciami, nawadnianie, pogoda i zadania. Interfejs po polsku i angielsku (wg języka HA), dark mode zgodny z motywem, pełna obsługa telefonu (aplikacja Companion).

## Instalacja

### HACS (zalecane)

1. HACS → menu ⋮ → **Custom repositories** → dodaj `https://github.com/pajuja92/ha-rootlab` jako typ **Integration**.
2. Zainstaluj **Gardener's Almanac** i zrestartuj Home Assistant.
3. Ustawienia → Urządzenia i usługi → **Dodaj integrację** → Gardener's Almanac.

### Ręcznie

Skopiuj katalog `custom_components/rootlab` do `config/custom_components/` i zrestartuj HA.

### Konfiguracja AI

Ustawienia → Urządzenia i usługi → Gardener's Almanac → **Konfiguruj**. Do wyboru 12 dostawców: Anthropic (Claude), OpenAI, Google Gemini, Groq, Mistral, DeepSeek, xAI, OpenRouter, Together, Perplexity, Ollama (lokalnie), własny endpoint zgodny z OpenAI — albo usługa **„Zadanie AI" z HA** (dowolna integracja AI zalogowana w HA). Wszystkie teksty promptów można edytować w zakładce Ustawienia.

## Funkcje

### 🪴 Rośliny i strefy

- Strefy (szklarnia, grządki, sad, trawnik…) z typem miejsca, rodzajem nasadzenia (grunt / donica / podwyższone grządki) i własną ikoną; rośliny dziedziczą nasadzenie ze strefy z możliwością nadpisania.
- **139 presetów roślin** (warzywa, zioła, krzewy owocowe, drzewa, żywopłoty) z nazwami łacińskimi, wymiarami dorosłej rośliny i — dla 61 gatunków — pełną fenologią dla klimatu Polski (okna siewu, wysadzania i zbioru, rozstawa, rodzina botaniczna).
- **Karta rośliny**: czujniki HA na żywo (wilgotność gleby, temperatura, wilgotność powietrza — z automatycznymi podpowiedziami z urządzeń strefy), notatki (także głosowe), galeria zdjęć ze stanem rośliny i odczytami czujników z chwili zdjęcia, historia diagnoz z archiwizacją, pytania do AI z zapisem do bazy wiedzy. Tryb edycji obejmuje też terminy uprawy i dziennik (posiane / wysadzone / zakończone).
- **Karta strefy**: mini-mapa wycinka planu, lista roślin i upraw, notatki z historią, diagnoza AI całej strefy i **światłomierz** (poniżej).
- Ikony: ponad 180 kolorowych ikon SVG z wyszukiwarką (po polsku i angielsku, bez wrażliwości na diakrytyki) albo **własny obrazek** rośliny wgrany z telefonu.

### 📅 Kalendarz upraw

- Oś roku per uprawa: pasy rozsady, wzrostu i zbioru, czerwona linia „dziś", filtr po strefie, przełącznik roku.
- Każda roślina jest widoczna w kalendarzu — także bez ustawionych terminów (klik ustawia je w karcie).
- Wybór presetu prefiluje metodę (rozsada / siew wprost) i wszystkie daty; opcjonalne automatyczne **zadania** (siew, wysadzenie, początek zbiorów).
- **Siew sukcesywny** (co N dni × k powtórzeń) i **ostrzeżenia płodozmianowe** (ta sama rodzina botaniczna w tym samym miejscu w ciągu 3 lat).
- **Plan sezonu z AI**: wskazujesz miejsca i oczekiwania → AI proponuje obsadzenia (zna typ miejsca, parametry szklarni, wymiary, katalog terminów i wcześniejsze uprawy) → podgląd z checkboxami → akceptacja zapisuje uprawy i zadania. Dodanie uprawy automatycznie tworzy kartę rośliny.
- Faza wegetacji (zaplanowana / rozsada / wzrost / zbiór / zakończona) koloruje belkę na kafelku rośliny.

### 🗺️ Plan ogrodu

- Edytor 2D w metrach: strefy rysowane przeciągnięciem, drzewa i krzewy jako koła z wymiarami (średnica, wysokość, początek korony), płoty, kompostowniki.
- **Nasadzenia liniowe**: żywopłot (jedna roślina w zadanym rozstawie) i grządka-linia (rośliny z kart + liczba sztuk, rozkładane równomiernie); oba liczą się do cienia.
- **Symulacja cienia** według rzeczywistego toru słońca (suwaki miesiąca i godziny): drzewa, żywopłoty i **bryła szklarni** rzucają cień; rośliny w cieniu są oznaczane, a informacja trafia do kontekstu AI.
- **Szklarnia z parametrami mikroklimatu**: wysokość konstrukcji, % przepuszczanego światła, przyrost temperatury, ogrzewanie (bez przymrozków) — wszystko uwzględniane w symulacji i przez AI.
- Podkład satelitarny z automatycznym doborem skali, kompas obracający plan, zoom 30–250% (także w widoku szczegółowym strefy).
- Widok szczegółowy strefy: sadzenie roślin tapnięciem/kliknięciem, rysowanie grządek-linii, tworzenie nowej rośliny z prefilowaną strefą.
- Obsługa dotyku: jednorazowe dodawanie z palety (celownik), klik otwiera edycję, przesuwanie za pomocą Shift na desktopie.

### 🩺 Diagnoza AI

- **Tryb kryzysowy** („Coś jest nie tak?"): do 5 zdjęć (HEIC z iPhone'a konwertowany po stronie HA) + opis (można podyktować) → diagnoza z poziomem pewności i planem naprawczym → zadania i/lub baza wiedzy. AI dostaje historię rośliny, odczyty czujników i kontekst planu ogrodu.
- **Rozmowy diagnostyczne**: czat z pełnym kontekstem rośliny (strefa, nasadzenie, plan, bieżące zacienienie, czujniki, poprzednie diagnozy) albo **całej strefy**; zdjęcia w rozmowie, dyktowanie, klikalne linki.
- „Zaplanuj zadania z rozmowy" i „Zapisz do bazy wiedzy" — zawsze z podglądem i akceptacją przed zapisem.
- Rozmowy grupowane po roślinie lub strefie.

### 💡 Światłomierz

- Pomiar natężenia światła kamerą telefonu z poziomu karty strefy: na Androidzie/Chrome szacunek w **luksach** (ręczna kontrola ekspozycji z auto-zakresem), w innych przeglądarkach skala względna z korektą prześwietleń.
- Ustawiane uśrednianie (mediana z okna czasowego), kategorie (pełne słońce / jasno / półcień / cień), zapis pomiaru jako notatka strefy razem z odczytami czujników z chwili pomiaru.

### 💧 Woda

- Sekcje nawadniania spięte z encjami `switch`/`valve`/`input_boolean`, harmonogramy per sekcja, „podlej teraz", pauza z dokończeniem pozostałego czasu, stop, jednorazowe podlewania (data + godzina), globalne wstrzymanie i oś doby.
- Scheduler pilnuje też zewnętrznego wyłączenia encji (automatyzacja/ręcznie) i domyka bieg.
- Ostrzeżenia pogodowe na Pulpicie: nadchodzący deszcz → propozycja pominięcia podlewania, przymrozek → alert.

### ✅ Zadania

- AI układa zadania per roślina (utrzymanie / zabezpieczenie) na bazie gatunku, pory roku, czujników, pogody i warunków (np. szklarnia); auto-odświeżanie co tydzień.
- Własne zadania, odhaczanie, odkładanie z sekcją „⏰ Odłożone" i przyciskiem „Przywróć teraz", filtry i grupowanie (roślina / strefa / kategoria).
- Widok kalendarza miesięcznego: zadania na dniach, zaległe wyróżnione, tap w dzień pokazuje listę.

### 🌦️ Pogoda

- Prognozy z dowolnej encji `weather` HA, Open-Meteo lub ICON; wykresy 24 h / 7 dni (temperatura, opad, szansa opadów) na Pulpicie i w zakładce Pogoda.
- **Ranking trafności źródeł**: aplikacja porównuje prognozy z rzeczywistymi odczytami i pokazuje, które źródło u Ciebie kłamie najmniej.

### 📚 Wiedza i sklep

- Baza wiedzy z wyszukiwarką: zatwierdzone odpowiedzi AI i własne wpisy.
- W rozmowach diagnostycznych AI może polecić pasujący produkt z katalogu sklepu (zawsze wiedza najpierw — produkt tylko jako krótkie wtrącenie z linkiem). Opcjonalnie: wyszukiwanie produktów w internecie (Anthropic / Gemini) oraz anonimowe zgłaszanie zapotrzebowania na produkty spoza katalogu — oba domyślnie wyłączone, włączane świadomie w Ustawieniach.

### 📦 Inwentarz

- Ewidencja zasobów ogrodowych: nasiona, nawozy, środki ochrony i repelenty, narzędzia, złączki, podłoża — z opisem, zdjęciem, kodem EAN, ilością, miejscem przechowywania, poziomem zapasu i datą ważności (ostrzeżenia o przeterminowaniu).
- **Skan AI**: zdjęcie jednego lub wielu produktów → AI odczytuje etykiety i proponuje listę pozycji do dodania (z możliwością wyboru).
- **Lista zakupów i wishlista**: pozycje można przenosić między listami, a po zakupie jednym tapnięciem wcielić do inwentarza; z inwentarza „Dokup" dodaje kopię na listę zakupów.
- AI zna posiadane zasoby podczas diagnoz, rozmów, generowania zadań i planowania sezonu — najpierw wykorzysta to, co już masz, zanim zaproponuje zakupy.

### 🖥️ Pulpit

- Konfigurowalny (kolejność i widoczność sekcji): strefy z czujnikami, aktywne podlewanie, najbliższe zadania, prognoza, ranking trafności, pogoda teraz, ostrzeżenia.

## Prywatność

- Wszystkie dane ogrodu przechowywane są lokalnie w storage Home Assistant.
- Do wybranego dostawcy AI trafiają wyłącznie dane potrzebne do odpowiedzi (opisy, zdjęcia, odczyty czujników, kontekst planu).
- Ikony OpenMoji i katalog sklepu są pobierane z CDN; bez internetu interfejs działa z emoji systemowymi, a rekomendacje po prostu znikają.
- Zgłaszanie zapotrzebowania produktowego jest wyłączone domyślnie, a po włączeniu wysyła wyłącznie krótki opis potrzeby — nigdy treść rozmowy.

## Licencje

- Kod: MIT.
- Ikony: [OpenMoji](https://openmoji.org) (CC BY-SA 4.0) + własne ikony w tym samym stylu.
