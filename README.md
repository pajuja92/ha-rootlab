# Garden Planner AI 🌱

Planer ogrodowy dla Home Assistant wspierany przez AI. Własna zakładka w pasku bocznym.

## Funkcje (docelowo)

- **Rośliny i strefy** — katalog roślin, krzewów i drzew z podziałem na strefy (szklarnia, grządki, ogród…)
- **Urządzenia** — podpięcie encji HA: nawadnianie, czujniki temperatury / wilgotności powietrza i gleby, sterowniki szklarni
- **Zadania od AI** — utrzymanie (przycinanie, pielenie), zabezpieczenie (opryski), sytuacje kryzysowe (zdjęcie + opis problemu → diagnoza i rozwiązanie)
- **Panel nawadniania** — podgląd i edycja harmonogramu podlewania
- **Pogoda** — prognoza z API IMGW (meteo.imgw.pl)
- **Edytor ogrodu** — wizualne rozmieszczanie roślin na planie (x, y, wymiary), analiza zacienienia

## Instalacja

### HACS (zalecane)

1. HACS → Integrations → ⋮ → *Custom repositories*
2. Dodaj `https://github.com/pajuja92/ha-garden-planner` jako typ *Integration*
3. Zainstaluj **Garden Planner AI** i zrestartuj Home Assistant

### Ręcznie

1. Skopiuj `custom_components/garden_planner` do katalogu `config/custom_components/` w HA
2. Zrestartuj Home Assistant

Następnie: *Ustawienia → Urządzenia i usługi → Dodaj integrację → Garden Planner AI*.

## Status

🚧 Wczesny etap rozwoju — na razie szkielet integracji.
