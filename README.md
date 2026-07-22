# RootLab 🌱

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
2. Dodaj `https://github.com/pajuja92/ha-rootlab` jako typ *Integration*
3. Zainstaluj **RootLab** i zrestartuj Home Assistant

### Ręcznie

1. Skopiuj `custom_components/rootlab` do katalogu `config/custom_components/` w HA
2. Zrestartuj Home Assistant

Następnie: *Ustawienia → Urządzenia i usługi → Dodaj integrację → RootLab*.

## Status

🚧 **Beta** — wersjonowanie semantyczne z sufiksem pre-release (`0.1.0-beta.1`, `0.1.0-beta.2`…), stabilne wydania od `1.0.0`.

Zrobione (etap 1): panel RootLab w pasku bocznym, strefy i rośliny (CRUD), mapowanie encji czujników (gleba, temperatura, wilgotność) z podglądem na żywo.
Następne: harmonogram nawadniania, pogoda IMGW, zadania AI, tryb kryzysowy, edytor 2D ogrodu.
