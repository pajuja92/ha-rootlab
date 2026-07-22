# RootLab — Wytyczne UI/UX & Design System

Panel boczny Home Assistant. Ogród jako spokojne „laboratorium zbiorów" — technologia przejmuje pamiętanie, człowiek zbiera plony.

---

## 1. Branding & System kolorów

### 1.1 Logo / ikona

| Kontekst | Ikona | Uzasadnienie |
|---|---|---|
| Sidebar HA (główna) | `mdi:sprout` | Kiełek = wzrost, prostota, czytelny w 24 px |
| Wariant „lab" (splash, nagłówek panelu) | `mdi:sprout` wpisany w obrys `mdi:flask-round-bottom-empty` | Sygnał „laboratorium", bez geekowego przesterowania |
| Moduł Zadań | `mdi:clipboard-check-outline` | |
| Moduł AI / diagnoza | `mdi:creation` (iskra) | Delikatny sygnał „to mówi AI", spójny z konwencją rynkową |
| Nawadnianie | `mdi:water` / aktywne: `mdi:water-pump` | |
| Sytuacja kryzysowa | `mdi:leaf-off` | Czytelniejszy niż generyczny `mdi:alert` |
| Zbiory | `mdi:basket-outline` | |

**Konstrukcja logotypu:** napis `RootLab` — „Root" w wadze regular (uziemienie), „Lab" w semibold w kolorze akcentu. Bez osobnego fontu — dziedziczymy typografię HA (Roboto), zero ładowania webfontów.

### 1.2 Paleta kolorów

Zasada: **bazę bierzemy z natywnych zmiennych HA** (tło, tekst, karty — dzięki temu każdy motyw użytkownika działa od ręki), a RootLab dokłada tylko **5 tokenów akcentowych** z wariantami light/dark.

| Token | Light | Dark | Zastosowanie |
|---|---|---|---|
| `--rl-green` | `#3B7D3F` | `#8BC98F` | Marka, kondycja OK, aktywne taby, CTA |
| `--rl-soil` | `#7A5C43` | `#B99C82` | Akcent „ziemia": gleba, strefy, edytor ogrodu |
| `--rl-water` | `#0277BD` | `#5BC4F0` | Wszystko wokół nawadniania i wilgotności |
| `--rl-harvest` | `#A66300` | `#F0B860` | Zbiory, dojrzewanie, nagrody/satysfakcja |
| `--rl-ai` | `#6A4FA3` | `#B9A6E3` | Wypowiedzi i sugestie AI (zawsze z ikoną `mdi:creation`) |
| `--rl-crisis` | `#C62828` | `#EF8A80` | Tylko sytuacje kryzysowe — nigdzie indziej |

Do każdego akcentu istnieje wariant tła `--rl-*-bg` (akcent z alfą ~12%, np. `color-mix(in srgb, var(--rl-green) 12%, transparent)`) — używany na chipy, plakietki i pastelowe wypełnienia zamiast pełnych kolorów.

**Zmienne HA używane jako baza (nie nadpisujemy ich):**

| Zmienna HA | Rola w RootLab |
|---|---|
| `--card-background-color` | Tło wszystkich kart |
| `--primary-background-color` | Tło panelu |
| `--primary-text-color` / `--secondary-text-color` | Tekst / metadane |
| `--divider-color` | Separatory, obrysy kart |
| `--ha-card-border-radius` (fallback 12px) | Zaokrąglenia — spójne z resztą HA |
| `--primary-color` | Fallback, gdy motyw użytkownika ma wyłączone kolory RootLab |
| `--error-color`, `--warning-color`, `--success-color` | Stany encji (offline czujnik itp.) |

**Przełączanie trybów:** komponent root czyta `hass.themes.darkMode` i ustawia atrybut `dark` na sobie; tokeny są zdefiniowane w `:host` (light) i nadpisane w `:host([dark])`. Zero duplikacji logiki w komponentach potomnych — dziedziczą tokeny przez CSS custom properties.

### 1.3 Zasady użycia koloru

- Powierzchnie neutralne (karty = kolory HA), kolor tylko jako **akcent znaczeniowy**: pasek statusu na karcie, chip, ikona, wskaźnik.
- Jeden kolor = jedno znaczenie w całej aplikacji. Woda jest zawsze niebieska, AI zawsze fioletowe, kryzys zawsze czerwony.
- Kondycja rośliny: skala `--rl-green` → `--rl-harvest` → `--rl-crisis` (dobra → wymaga uwagi → kryzys). Nigdy sam kolor — zawsze towarzyszy mu ikona lub etykieta (dostępność dla daltonistów).

### 1.4 Micro-copy i ton AI

Ton: **spokojny ogrodnik-ekspert**. Doradza, nie rozkazuje; konkretny, ale ciepły; krótko. Zwroty per „Ty". Bez wykrzykników w alertach (spokój nawet w kryzysie), bez antropomorfizacji („myślę, że…" → „wygląda na…").

| Sytuacja | ❌ Nie tak | ✅ Tak |
|---|---|---|
| Sugestia zadania | „MUSISZ przyciąć pomidory!" | „Pomidory w szklarni są gotowe do przycięcia bocznych pędów. Zajmie to ok. 10 minut." |
| Diagnoza kryzysowa | „Wykryto poważną chorobę!!!" | „Wygląda to na zarazę ziemniaczaną (pewność: wysoka). Oto plan na najbliższe 3 dni." |
| Brak danych | „Błąd: czujnik niedostępny" | „Czujnik gleby przy malinach milczy od 2 h — sprawdź baterię." |
| Pochwała / zbiory | „Gratulacje!" | „Sezon ogórków otwarty 🌱 Pierwszy zbiór zwykle smakuje najlepiej." |
| Pusty stan listy zadań | „Brak zadań" | „Na dziś wszystko zrobione. Ogród pracuje za Ciebie." |

Każda wypowiedź AI jest wizualnie oznaczona: ikona `mdi:creation` + lewy border `--rl-ai`. Użytkownik zawsze wie, co jest danymi z czujnika, a co interpretacją.

---

## 2. Układ panelu (Sidebar Panel Layout)

### 2.1 Nawigacja

Wzorzec natywny HA (jak Ustawienia/Lovelace): **górny pasek z tabami**, poniżej scrollowana treść.

```
┌──────────────────────────────────────────────────────────┐
│ ☰  🌱 RootLab      [Pulpit] [Rośliny] [Zadania] [Woda]  ⋮│  ← app bar + taby
├──────────────────────────────────────────────────────────┤
│                                                          │
│   ┌────────────┐  ┌────────────┐  ┌────────────┐         │
│   │  karta     │  │  karta     │  │  karta     │         │  ← grid kart
│   └────────────┘  └────────────┘  └────────────┘         │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

| Tab | Ikona | Zawartość |
|---|---|---|
| **Pulpit** | `mdi:view-dashboard-outline` | Pogoda IMGW, status stref, nawadnianie live, top-3 zadania |
| **Rośliny** | `mdi:sprout` | Karty roślin pogrupowane po strefach, mapowanie encji |
| **Zadania** | `mdi:clipboard-check-outline` | 3 kategorie + wejście w tryb kryzysowy |
| **Woda** | `mdi:water` | Harmonogram nawadniania, sterowanie ręczne |
| **Edytor** (Etap II) | `mdi:vector-square` | Edytor 2D ogrodu |

- Mobile (<600 px): taby zwijają się do przewijanego paska (scrollable tabs), grid → 1 kolumna.
- Tryb kryzysowy to **nie tab**, tylko stały FAB w prawym dolnym rogu (`mdi:leaf-off`, kolor `--rl-crisis`) — dostępny z każdego widoku, bo kryzys nie czeka na nawigację.

### 2.2 Hierarchia i siatka

- Grid: `repeat(auto-fill, minmax(320px, 1fr))`, gap 16 px, padding kontenera 16 px (8 px mobile), max-width treści 1400 px, wyśrodkowana.
- Hierarchia pulpitu (kolejność = priorytet): ① alerty kryzysowe (jeśli są — pełna szerokość, na górze) → ② pogoda + nawadnianie live → ③ strefy → ④ zadania na dziś.
- Karty: tło `--card-background-color`, obrys `1px solid var(--divider-color)`, bez cieni w spoczynku (spokój), delikatny cień tylko na hover elementów interaktywnych.
- Nagłówki sekcji: `secondary-text-color`, uppercase, 12 px, letter-spacing 0.5 px — jak w natywnych panelach HA.

---

## 3. Projekt komponentów UI (LitElement)

### 3.1 `rootlab-plant-card` — Karta rośliny

```
┌─────────────────────────────────────────────┐
│▌ 🍅 Pomidor malinowy          [Szklarnia]   │  ▌ = pasek kondycji (3px)
│▌                                            │
│▌ ◔ Kondycja: dobra                          │  ← ring 0–100, kolor wg skali
│▌                                            │
│▌ 💧 42%      🌡 24.5°C      ☁ 61%           │  ← chipy encji (live)
│▌ gleba       temp.          wilg.           │
│▌ ─────────────────────────────────────────  │
│▌ ✦ Następne: podwiąż pędy (za 2 dni)        │  ← wiersz AI (--rl-ai)
│▌                       [Podlej] [Szczegóły] │
└─────────────────────────────────────────────┘
```

- **Pasek kondycji** (lewa krawędź, 3 px): `--rl-green` / `--rl-harvest` / `--rl-crisis`. Stan „kryzys" dodatkowo: chip `mdi:leaf-off` w nagłówku.
- **Chipy czujników**: klik → natywny dialog HA `more-info` danej encji (zero własnych wykresów — reużywamy HA). Czujnik offline → chip wyszarzony + `mdi:help-circle-outline`.
- **Ring kondycji**: SVG circle, wynik agregowany (wilgotność vs. widełki gatunku, temperatura, zaległe zadania). Obok zawsze etykieta słowna.
- Brak przypisanych encji → w miejscu chipów ghost-button „Połącz czujniki".

### 3.2 Crisis Mode View — tryb kryzysowy

Pełnoekranowy dialog (mobile) / dialog 560 px (desktop). Trzy kroki w jednym widoku, bez steppera-ceremonii:

```
┌──────────────────────────────────────┐
│  🍂 Coś jest nie tak?           ✕    │
├──────────────────────────────────────┤
│  ┌────────────────────────────────┐  │
│  │      📷  Dodaj zdjęcie         │  │  ← drag&drop / kamera / galeria
│  │   (przeciągnij lub kliknij)    │  │
│  └────────────────────────────────┘  │
│  Roślina:  [ Pomidor malinowy  ▾ ]   │
│  Opis:     [ liście żółkną od dołu ] │
│                                      │
│            [ ✦ Poproś o diagnozę ]   │  ← przycisk --rl-ai
├──────────────────────────────────────┤
│  ✦ DIAGNOZA                          │
│  ▌ Niedobór azotu (pewność: średnia) │  ← karta z borderem --rl-ai
│  ▌ Żółknięcie starszych liści przy   │
│  ▌ zdrowych młodych to typowy objaw. │
│  ▌                                   │
│  ▌ Plan naprawczy:                   │
│  ▌ ☐ 1. Nawóz azotowy, pół dawki     │
│  ▌ ☐ 2. Kontrola za 5 dni            │
│  ▌ [ + Dodaj plan do zadań ]         │
└──────────────────────────────────────┘
```

- W trakcie analizy: skeleton + rotujące spokojne komunikaty („Oglądam liście…", „Porównuję z objawami niedoborów…") — redukują niepokój oczekiwania.
- Diagnoza zawsze z **poziomem pewności** (wysoka/średnia/niska) — AI nie udaje nieomylnego; przy niskiej pewności dopisek „warto potwierdzić u ogrodnika".
- Plan naprawczy = checklista → jeden klik dodaje ją do Centrum Zadań (kategoria: Kryzysowe) z przypiętym zdjęciem.
- Historia zgłoszeń per roślina (co pomogło ostatnio) widoczna w szczegółach rośliny.

### 3.3 `rootlab-irrigation-card` — Kontroler nawadniania

```
┌──────────────────────────────────────────────┐
│ 💧 Nawadnianie                    [Wstrzymaj]│
│                                              │
│  0h    6h      12h     18h     24h           │
│  ──────▓▓──────────────▓▓▓─────────          │  ← oś doby, bloki = harmonogram
│                                              │
│  ● Szklarnia — kropelkowe        TERAZ  ≈4 m │  ← aktywna: pulsująca kropka
│    ▷ dziś 6:00 i 19:00 · 10 min   [▶] [✎]   │      --rl-water
│  ○ Grządki — zraszacz                        │
│    ▷ jutro 6:15 · 15 min          [▶] [✎]   │
│  ○ Trawnik                     wstrzymane ⏸  │
│                                              │
│  ✦ Prognoza IMGW: jutro 12 mm deszczu —      │
│    proponuję pominąć poranne podlewanie.     │
│    [Pomiń]  [Podlewaj mimo to]               │
└──────────────────────────────────────────────┘
```

- **Oś doby**: bloki harmonogramu w `--rl-water-bg`, aktualnie trwające podlewanie w pełnym `--rl-water` + delikatna animacja; znacznik „teraz" pionową kreską.
- `[▶]` = podlej teraz (wybór czasu: 5/10/15 min), `[✎]` = edycja harmonogramu strefy (dni tygodnia, godziny, czas trwania) w bocznym dialogu.
- Sugestie pogodowe AI zawsze jako **propozycja z dwoma przyciskami** — automat nie zmienia harmonogramu bez zgody (zaufanie > automagia).
- Globalny „Wstrzymaj" (urlop/deszcz) z wyborem: do odwołania / na X dni.

---

## 4. Przykładowy kod stylów (CSS)

Wzorcowy arkusz dla `rootlab-plant-card` — pokazuje tokeny, oba tryby i pracę na zmiennych HA:

```css
:host {
  /* === Tokeny RootLab (light) === */
  --rl-green:   #3B7D3F;
  --rl-soil:    #7A5C43;
  --rl-water:   #0277BD;
  --rl-harvest: #A66300;
  --rl-ai:      #6A4FA3;
  --rl-crisis:  #C62828;

  /* Pastelowe tła akcentów — jedna formuła dla wszystkich */
  --rl-green-bg:  color-mix(in srgb, var(--rl-green) 12%, transparent);
  --rl-water-bg:  color-mix(in srgb, var(--rl-water) 12%, transparent);
  --rl-ai-bg:     color-mix(in srgb, var(--rl-ai) 10%, transparent);
  --rl-crisis-bg: color-mix(in srgb, var(--rl-crisis) 12%, transparent);

  --rl-radius: var(--ha-card-border-radius, 12px);
  --rl-gap: 16px;

  display: block;
}

/* Root panelu ustawia atrybut na podstawie hass.themes.darkMode */
:host([dark]) {
  --rl-green:   #8BC98F;
  --rl-soil:    #B99C82;
  --rl-water:   #5BC4F0;
  --rl-harvest: #F0B860;
  --rl-ai:      #B9A6E3;
  --rl-crisis:  #EF8A80;
}

/* === Karta === */
.card {
  position: relative;
  background: var(--card-background-color);
  color: var(--primary-text-color);
  border: 1px solid var(--divider-color);
  border-radius: var(--rl-radius);
  padding: var(--rl-gap);
  overflow: hidden;
  transition: box-shadow 0.2s ease;
}
.card:focus-within,
.card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}

/* Pasek kondycji na lewej krawędzi */
.card::before {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  background: var(--rl-green);
}
.card[data-condition="warning"]::before { background: var(--rl-harvest); }
.card[data-condition="crisis"]::before  { background: var(--rl-crisis); }

.header {
  display: flex;
  align-items: center;
  gap: 8px;
}
.header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
  flex: 1;
}

/* Chip strefy */
.zone-chip {
  font-size: 12px;
  padding: 2px 10px;
  border-radius: 999px;
  background: var(--rl-green-bg);
  color: var(--rl-green);
}

/* Chipy czujników */
.sensors {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  flex-wrap: wrap;
}
.sensor-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--rl-water-bg);
  color: var(--primary-text-color);
  font-size: 13px;
  cursor: pointer;
  border: none;
}
.sensor-chip ha-icon {
  --mdc-icon-size: 16px;
  color: var(--rl-water);
}
.sensor-chip[data-unavailable] {
  background: transparent;
  border: 1px dashed var(--divider-color);
  color: var(--secondary-text-color);
}

/* Wiersz sugestii AI */
.ai-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 8px 12px;
  border-left: 3px solid var(--rl-ai);
  border-radius: 4px;
  background: var(--rl-ai-bg);
  color: var(--secondary-text-color);
  font-size: 13px;
}
.ai-hint ha-icon { color: var(--rl-ai); --mdc-icon-size: 16px; }

/* Akcje */
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}
.actions mwc-button { --mdc-theme-primary: var(--rl-green); }

@media (max-width: 600px) {
  :host { --rl-gap: 12px; }
}

@media (prefers-reduced-motion: reduce) {
  .card { transition: none; }
}
```

**Zasady kodu stylów:**
- Tokeny tylko w roocie panelu; komponenty potomne dziedziczą przez CSS custom properties — jedna definicja dark mode na całą aplikację.
- Zawsze fallback na zmienne HA (`var(--ha-card-border-radius, 12px)`) — panel wygląda natywnie w każdym motywie użytkownika.
- Stany przez `data-*`/atrybuty hosta, nie przez podmianę klas w JS.
- `prefers-reduced-motion` respektowane globalnie; animacje tylko tam, gdzie niosą informację (aktywne podlewanie, analiza AI).
