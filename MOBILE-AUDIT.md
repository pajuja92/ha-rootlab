# Audyt mobilny — panel w HA Companion (Android, Poco X3 Pro, 1080×2400)

Przeklikane 2026-08-19 przez Claude'a (ADB + realny telefon, aplikacja towarzysząca HA). Ogólnie: **jest dużo lepiej, niż się spodziewałem** — layout w większości składa się do jednej kolumny i działa. Poniżej plan poprawek wg priorytetu.

## P0 — blokery użyteczności

1. **Plan ogrodu: przesuwanie/rozmiar obiektów wymaga Shifta** — na dotyku niewykonalne (instrukcja wprost mówi „przytrzymaj Shift (rączka)"). Propozycja: na urządzeniach dotykowych tryb „przenoszenia" włączany przyciskiem w pasku (toggle „przesuń/rozmiar") albo long-press na obiekcie jako odpowiednik Shifta. Uchwyty (fioletowe kropki) są też za małe na palec — min. 44×44 px hitbox.
2. **Dialogi z autofocusem pola tekstowego** („Edytuj obiekt" i pewnie inne): klawiatura wyskakuje od razu po otwarciu i zasłania połowę dialogu razem z przyciskami akcji (Zapisz/Anuluj poza ekranem). Propozycja: bez autofocusa na dotyku + dialog przewijalny z przyciskami przypiętymi na dole (sticky footer).
3. **Natywne `confirm()` przy usuwaniu** (zgłaszane już w QA-REPORT): w webview Companion zachowuje się nieprzewidywalnie i wygląda obco. Wymienić na dialogi HA — to samo co dla desktopu, na mobile jeszcze ważniejsze.

## P1 — istotne poprawki UX

4. **Górna nawigacja (9 zakładek) przewija się poziomo bez żadnej wskazówki** — użytkownik nie wie, że za „Roślinami" jest 7 kolejnych zakładek. Propozycje (od najtańszej): gradient/fade na krawędzi + częściowo ucięta następna zakładka; albo na wąskich ekranach przenieść nawigację do dolnego paska (bottom nav z 4–5 głównymi + „więcej"); logo „Root" i tak jest ucięte — przy rebrandingu na Gardener's Almanac zaplanować krótki wariant logo na mobile.
5. **Czerwony FAB trybu kryzysowego**: (a) ikona (przekreślony liść) nie komunikuje funkcji — rozważyć ikonę SOS/apteczki lub etykietę przy pierwszym użyciu; (b) FAB nakłada się na ikony akcji list (kosz/budzik w Zadaniach) — dodać dolny padding treści (scroll-padding-bottom ~96 px) albo chować FAB przy scrollu w dół. Sam dialog „Coś jest nie tak?" na telefonie jest świetny (aparat, dyktowanie, historia) — to killer feature mobile, warto go wyeksponować.
6. **Suwaki miesiąca/godziny w Planie ogrodu** — kciuki małe jak na dotyk; powiększyć thumb i strefę łapania na touch.
7. **Pinch-zoom na mapie planu** — przyciski zoom z beta.26 ratują sytuację, ale na dotyku naturalny jest pinch (i drag do pan). Do rozważenia razem z pkt 1.

## P2 — kosmetyka

8. Przełącznik „Grupuj: rośliny/strefy" w Diagnozie AI łamie się nieładnie do dwóch wierszy przy prawej krawędzi — dać mu własny wiersz na wąskich ekranach.
9. Przycisk „Dostosuj pulpit" wisi samotnie nad strefami — na mobile mógłby być ikoną w pasku.
10. Karty stref na Pulpicie są bardzo wysokie (1 karta ≈ 1/4 ekranu) — na mobile zbić do bardziej kompaktowych wierszy, żeby zmieścić strefy + zadania bez scrolla.

## Co działa dobrze (nie ruszać)

- Pulpit, Zadania (przyciski i filtry układają się w kolumnę), lista Diagnoz, dialog „Nowa rozmowa" (bez autofocusa!), tryb kryzysowy.
- Plan ogrodu w trybie Podgląd — pasek narzędzi ładnie się zawija, klik strefy/obiektu działa.
- Wydajność webview OK, brak błędów renderowania.

## Jak testowałem (do powtórzenia)

ADB na macOS: `~/Library/Android/sdk/platform-tools/adb`, urządzenie 71c0eea6; screencap + input tap/swipe. Aplikacja: io.homeassistant.companion.android → sidebar → RootLab.

---

# Runda 2 — scenariusze klienta (2026-08-19)

Testowane na wersji zainstalowanej na instancji (bez aktualizacji i restartu HA). Sekcja „Sklep i produkty" w Ustawieniach jest obecna, więc backend jest z beta.39 lub bliskiej. Poco X3 Pro, 1080×2400, density 480 (DPR 3.0), font scale 1.0. Przeszłam 7 pełnych ścieżek klienta, tworząc i sprzątając dane testowe (roślina „Truskawka TEST QA", 2 zadania, 2 obiekty planu, 1 pomiar światła — wszystko usunięte).

**Bilans: 3 × P0, 5 × P1, 4 × P2.** Dwa P0 to regresje/potwierdzenia z rundy 1, jeden jest nowy.

## P0 — blokery

**1. Odłożone zadanie znika z aplikacji.** Zadanie własne „TEST QA zadanie" (termin: dziś) odłożone o 3 dni przez ikonę budzika — toast „Zapisano ✓" i zadanie zniknęło z listy, z sekcji WŁASNE, z filtra kategorii „Własne" **oraz z widoku Kalendarz** (dzień 22.08 pusty). Nie ma go nigdzie w UI, mimo że zapis się powiódł. Dla porównania zadania fenologiczne z terminem odległym o 303 dni są na liście widoczne — czyli to nie jest filtr „tylko do dziś", tylko błąd w ścieżce snooze (data zapisana poza zakresem widoku albo utrata flagi kategorii). Efekt dla użytkownika: odłożenie zadania = jego bezpowrotna utrata z pola widzenia. Do naprawy w pierwszej kolejności.

**2. Natywne `confirm()` — nadal w całej aplikacji, także w nowym kodzie.** Zliczone w tej rundzie cztery wystąpienia: usuwanie pomiaru światła w karcie strefy (kod z beta.33!), usuwanie zadania, usuwanie obiektu z planu, usuwanie rośliny. Wszystkie renderują się jako systemowy alert „Home Assistant / Usunąć…?" z przyciskami ANULUJ/OK — wizualnie obce, blokują webview i różnie zachowują się w Companion. Zgłoszone już w rundzie 1 i w QA-REPORT dla beta.24/25 — bez zmian. Warto to zrobić raz, globalnie (jeden helper `confirmDialog()` na ha-dialog), bo każda nowa funkcja dokłada kolejne wystąpienie.

**3. Autofocus w dialogu „Edytuj obiekt" — bez zmian.** Kliknięcie posadzonego obiektu w planie otwiera dialog z kursorem w polu „Etykieta"; klawiatura wyskakuje natychmiast i zasłania dolną część dialogu — przyciski „Usuń / Karta rośliny / Anuluj / Zapisz" są poza ekranem i nie da się do nich doscrollować przy otwartej klawiaturze. Trzeba najpierw tapnąć w puste miejsce, żeby zdjąć focus. Po schowaniu klawiatury dialog mieści się w całości, więc wystarczy sam brak autofocusa na dotyku (sticky footer byłby bonusem).

## P1 — istotne

**4. Pogoda: etykiety wykresów nieczytelne — potwierdzam zgłoszenie Grzegorza, z pomiarami.** Zmierzone na zrzucie (wysokość glifu cyfr, piksele fizyczne; DPR 3.0, więc CSS px ≈ ÷3):

| element | wys. glifu | ≈ font-size CSS |
|---|---|---|
| etykiety osi X (`12:00`, `16:00`) | 9 px | ~4–5 px |
| etykiety osi Y lewej (`20°`, `16°`) | 9 px | ~4–5 px |
| etykiety osi Y prawej (`100%`, `0%`) | 9 px | ~4–5 px |
| dni tygodnia na wykresie 7-dniowym (`Śr`, `Cz`) | 12 px | ~4–5 px |
| wartości nad serią (`25°`, `19°`) | 18–21 px | ~7 px |
| legenda („temperatura", „opad (mm)") | 26 px | ~9–10 px |
| chipy podsumowań („śr. wilgotność: 81 %") | 37 px | ~13 px |

Czyli osie są ~3× mniejsze od tekstu chipów w tej samej karcie i leżą poniżej progu czytelności (minimum na mobile to ~11 px CSS). Propozycja: na wąskich ekranach osie i legenda min. 11 px, wartości nad serią min. 12 px, a przy tak małej szerokości rozrzedzić etykiety osi X (co druga/trzecia godzina) zamiast je zmniejszać. Dotyczy obu wykresów (24 h i 7 dni) i wszystkich źródeł (Forecast dom, Open-Meteo, ICON).

**5. Kalendarz upraw: nagłówki miesięcy sklejone i ucięte.** Wiersz nagłówka renderuje się jako `StyLutMarKwiMajCzeLipSieWrzPaźLis` — bez odstępów, a **grudzień nie mieści się w ogóle**; wiersz nie scrolluje się poziomo (próbowałam swipe), więc ostatni miesiąc roku jest na telefonie trwale niedostępny. Font tych skrótów też jest w okolicach 4–5 px CSS. Propozycja: na wąskich ekranach pokazywać co drugi miesiąc (Sty, Mar, Maj…) albo pierwsze litery, i dać osi własny kontener `overflow-x: auto`.

**6. Kalendarz zadań nie reaguje na dotyk.** W widoku Kalendarz tapnięcie w komórkę dnia (22.08) ani w chip „+18" przy dniu 19.08 nie robi nic — brak podglądu zadań danego dnia. Na desktopie to zapewne działa przez hover/klik; na telefonie widok jest tylko do oglądania. Albo dodać obsługę tapnięcia (dolny arkusz z listą zadań dnia), albo — jeśli to nie jest planowane — nie pokazywać chipa „+18", który sugeruje rozwijalność.

**7. Wyszukiwarka roślin nie ignoruje polskich znaków.** W dialogu grządki-linii wpisanie `ogo` daje „Brak wyników" — „Ogórek" znajduje się dopiero po wpisaniu `ó` (na Androidzie: long-press na `o`). To samo dotyczy nazw z `ą/ę/ś/ż/ź/ł`. Na telefonie to realna bariera, bo diakrytyki są schowane pod long-pressem. Propozycja: normalizacja NFD + strip diakrytyków po obu stronach porównania (jednolinijkowy `.normalize('NFD').replace(/\p{Diacritic}/gu,'')`).

**8. Czerwony FAB trybu kryzysowego zasłania treść — nadal.** W tej rundzie dołożył się nowy przypadek: w Ustawieniach FAB nachodzi na checkbox w sekcji „Sklep i produkty", a na listach zadań/roślin — na ikony kosza w ostatnim wierszu. Zgłoszone w rundzie 1 (pkt 5b), bez zmian: brakuje `scroll-padding-bottom` ~96 px albo chowania FAB-a przy scrollu.

## P2 — kosmetyka

**9. Mini-mapa w karcie strefy jest ucięta u góry.** Rośliny z górnej krawędzi strefy renderują się jako połówki ikon wchodzące pod nagłówek — viewBox nie obejmuje pełnego zakresu obiektów (brak marginesu). Widoczne też w widoku szczegółowym strefy w planie (cienie obiektów wychodzą poza kadr).

**10. Dialog dodawania rośliny: pole „Strefa" tuż nad klawiaturą.** Lista podpowiedzi renderuje się nad polem (i to działa), ale samo pole jest wtedy w dolnych ~15% ekranu — przy dłuższej liście stref trafienie w pozycję jest niewygodne. Do rozważenia razem z pkt 3 (sticky footer / przewijalny dialog).

**11. Grządka-linia domyślnie ustawia 10 szt. niezależnie od długości linii.** Narysowałam krótką linię (~1/3 szerokości strefy), a dialog zaproponował 10 truskawek i mapa je tak wyrenderowała (zagęszczone). Nie błąd, ale wartość domyślna powinna wynikać z długości linii i rozstawu rośliny.

**12. Wpisywanie tekstu przez klawiaturę Androida bywa psute przez autokorektę.** Przy dłuższym opisie objawów klawiatura dokleiła śmieciową końcówkę do treści. To problem klawiatury, nie aplikacji — odnotowuję tylko jako uwagę do przyszłej automatyzacji testów (lepiej `input text` bez podpowiedzi albo pola z `autocorrect="off"` tam, gdzie treść idzie do AI).

## Co działa dobrze

- **Światłomierz w karcie strefy (beta.33) — działa na telefonie.** Webview Companion dostał dostęp do kamery bez problemu, podgląd na żywo wystartował od razu, tryb **LUKSY** (nie względny), odczyt „116 lx · cień · 41%" z ręczną ekspozycją, zapis pomiaru poprawny („36% · 61 lx" z odczytami i koszem). To była największa niewiadoma tego briefu i wypadła bardzo dobrze.
- **Karta strefy** w całości: chipy (Grządka/Grunt/7 roślin), mini-mapa z realnymi nasadzeniami, lista roślin z przejściem do kart, notatki z dyktowaniem, sekcja zadań.
- **Dodanie rośliny**: combo presetów zachowuje się na dotyku wzorowo — lista rozwija się pod polem, nie jest ucinana, klawiatura jej nie zasłania, filtrowanie po 4 znakach działa. Wgranie własnego obrazka przez picker Androida działa, miniatura pojawia się od razu i na kaflu, i w karcie strefy.
- **Diagnoza AI**: zdjęcie + opis → sensowna diagnoza („Mszyce, pewność: wysoka") z planem działań; przejście „Doprecyzuj w czacie" zachowuje kontekst, pole czatu ląduje **nad** klawiaturą, wymiana wiadomości działa płynnie.
- **Plan ogrodu — sadzenie na dotyku**: wybór z listy „— wybierz do posadzenia —" (natywny select Androida, wygodny), posadzenie tapnięciem, **narysowanie grządki-linii palcem** i dialog z roślinami/ilościami — wszystko bez Shifta. Instrukcja w widoku szczegółowym mówi już „przeciąganie przesuwa", więc blokada z rundy 1 (pkt 1) w tym widoku jest zdjęta. Zoom przyciskami 100 %→156 % działa.
- **Zadania**: dodanie własnego zadania, odhaczenie (przekreślenie + „Zapisano ✓"), dialog odkładania (dialog panelu z klawiaturą numeryczną, nie natywny prompt), filtry roślina/strefa/kategoria i grupowanie.
- **Karta rośliny**: chipy, Diagnoza AI, Zapytaj AI i notatki z ikoną dyktowania, historia diagnoz.
- **Natywny date picker Androida** w sekcji UPRAWY — duży, czytelny, z WYCZYŚĆ/ANULUJ/USTAW. Nic tu nie ruszać.
- „Anuluj" w dialogach faktycznie nie zapisuje (sprawdzone na edycji uprawy Arbuza).

## Czego nie dało się sprawdzić

- **Linie ℹ️ / 📤 przy pytaniu o produkt spoza katalogu** — zadałam w czacie pytanie „a gdzie kupię nasiona szpinaku?" przy wyłączonej zgodzie, ale nie udało mi się odczytać stopki odpowiedzi (czat przewinął się poza widoczny obszar, a kolejne próby zjadła nawigacja). Do sprawdzenia w następnej rundzie razem z wariantem po włączeniu zgody w Ustawieniach → Sklep i produkty.
- **Wtrącenie produktowe z katalogu w diagnozie** — diagnoza mszyc wspomniała olej neem i mydło potasowe, ale bez linku/produktu. Nie umiem rozstrzygnąć, czy to poprawne zachowanie (brak dopasowania w katalogu), czy funkcja nie zadziałała — potrzebuję od Ciebie informacji, jaki produkt katalogowy powinien się wtedy podpiąć.
- **Aparat w diagnozie rośliny**: dropzone „kliknij, aby wybrać lub zrób zdjęcie" otwiera wyłącznie picker plików — bez opcji „Aparat". W światłomierzu kamera startuje bez problemu, więc uprawnienie jest; brakuje `capture="environment"` na `<input type="file">` albo osobnego przycisku „Zrób zdjęcie".

## Weryfikacja punktowa — katalog produktów i wersja instancji

Wróciłam do zapisanej rozmowy w Diagnozie AI, żeby domknąć dwa otwarte punkty.

**Katalog produktów w czacie — działa poprawnie.** Odpowiedź na pytanie o oprysk na mszyce w czasie owocowania podlinkowała produkt z katalogu: „mydło potasowe ogrodnicze z czosnkiem 0,5 l" → `https://mateuszokla.pl/sklep/mydlo-potasowe`. Wtrącenie jest dokładnie takie, jakie ma być — jedno zdanie wplecione w merytoryczną odpowiedź (najpierw metody domowe: wywar z czosnku, wyciąg z pokrzywy), z uzasadnieniem „bo można je stosować bezpośrednio na owocujące krzewy", bez dopytek sprzedażowych i bez powrotu do tematu w kolejnych wiadomościach. Brak produktu przy diagnozie kryzysowej jest więc zachowaniem zgodnym z projektem, nie błędem.

**Wersja na instancji jest starsza niż beta.39.** Odpowiedź na pytanie o produkt spoza katalogu („a gdzie kupię nasiona szpinaku?") jest merytoryczna i kompletna — odsyła do centrów ogrodniczych i sklepów internetowych — ale **kończy się na treści, bez linii ℹ️ o zgodzie**. Skoro sekcja „Sklep i produkty" w Ustawieniach jest obecna (od beta.36), a linii ℹ️ nie ma (od beta.39), instancja stoi na czymś z przedziału **beta.36–38**. Testu linii ℹ️/📤 w obu wariantach zgody nie da się wykonać bez aktualizacji — decyzja o niej należy do Grzegorza.

### Baseline pomiarowy przed poprawką fontów (do porównania przy retestie)

Domiar wykresu „Prognoza" na **Pulpicie** (wcześniej mierzyłam tylko zakładkę Pogoda). Ta sama metoda: wysokość glifu w pikselach fizycznych, DPR 3.0.

| element | Pogoda | Pulpit |
|---|---|---|
| etykiety osi X (`11:00`, `15:00`) | 9 px | 9 px |
| etykiety osi Y lewej | 9 px | 9 px |
| etykiety osi Y prawej (`100%`, `0%`) | 9 px | 9 px |
| legenda | 26 px | 30 px |
| chipy podsumowań | 37 px | 38 px |

Wartości są identyczne, więc oba widoki renderuje ten sam komponent wykresu i jedna poprawka powinna załatwić obie zakładki. Po wejściu bety z węższym viewBox (380 zamiast 720) i bazowym fontem 11 px te same elementy powinny wyjść **≥33 px fizycznych** (11 px CSS × 3), czyli mniej więcej na poziomie dzisiejszych chipów. To jest próg, który będę sprawdzać.

Pulpit ma jeden komponent prognozy z przełącznikiem 24 h / 7 dni — poza nim nie ma na tej zakładce innych wykresów; ranking trafności i „Pogoda teraz" to tabela i chipy, których poprawka fontów nie dotyczy.

Małych wykresów dodatkowych metryk (wiatr/wilgotność/ciśnienie) **nie da się w tej wersji włączyć z „Dostosuj pulpit"** — tryb edycji pokazuje sześć sekcji (Strefy, Nawadnianie, Najbliższe zadania, Prognoza, Ranking trafności, Pogoda teraz), każdą z parą strzałek i ikoną widoczności, i nic poza tym; nie ma listy widgetów do dołożenia. Baseline dla tego buildera zostaje więc niezmierzony — do sprawdzenia dopiero na wersji, w której te widgety są dostępne. Układ pulpitu po wejściu w tryb edycji przywrócony bez zmian.

**[P1] Linki produktowe renderują się jako surowy markdown.** Zamiast klikalnej nazwy produktu czat pokazuje `[mydło potasowe ogrodnicze z czosnkiem 0,5 l] (https://mateuszokla.pl/sklep/mydlo-potasowe)` — nawiasy kwadratowe zostają w tekście, a URL jest wypisany w całości i sam zostaje autolinkowany. Na telefonie ten jeden link zajmuje trzy linijki i łamie się w środku adresu. Parser najwyraźniej autolinkuje gołe URL-e, ale nie obsługuje składni `[tekst](url)`. Poprawka: renderować link inline z nazwą produktu jako treścią (albo, jeśli markdown ma zostać nieprzetworzony, kazać modelowi zwracać sam URL bez nawiasów).
