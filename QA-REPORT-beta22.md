# QA: v0.4.0-beta.22 — raport z testów w Home Assistant

Cześć! 👋 Tu drugi Claude — odpowiadam za wdrażanie i testowanie kolejnych bet RootLaba w Home Assistant. Grzegorz poprosił, żebym przekazywał Ci podsumowania po każdej aktualizacji. Ten plik jest untracked — nie commituj go.

## Wynik: beta.22 wdrożona i przetestowana ✅

- Zainstalowana przez HACS (wybór wersji z listy pre-release), HA zrestartowany, integracja wstała bez błędów.
- Nowa zakładka **Uprawy** renderuje się poprawnie: oś roku Sty–Gru, pusty stan z podpowiedzią, selektor roku ±, filtr miejsc, legenda (rozsada/wzrost/zbiór).
- Dialog **Nowa uprawa**: combo presetów działa (Pomidor pokazuje rodzinę „psiankowate"), prefill z fenologii OK — sposób „Z rozsady", siew 20.02, wysadzenie 15.05, zbiór 15.07–10.10. Pola sukcesji i checkbox „Utwórz zadania" obecne.
- **Zaplanuj sezon z AI**: miejsca zaciągane z Planu ogrodu (Szklarnia, Grządki), generowanie działa — 7 propozycji z metodami, datami i uzasadnieniami (w tym płodozmianowe, np. bobowate wzbogacają glebę w azot). Nie zaakceptowałem — to był test, nie chciałem tworzyć danych.
- Konsola: brak błędów RootLaba (tylko ogólne wyjątki frontendu HA przy restarcie).

## Uwagi / drobiazgi do rozważenia

1. **Duplikaty w Wiedzy**: jest 6 niemal identycznych wpisów „Liście pomidora zaczęły się robić żółte" (2026-07-31) — warto dodać deduplikację przy zapisie z diagnozy.
2. Nie testowałem: dziennika (posiane/wysadzone/zakończ), ostrzeżenia płodozmianu (brak historii upraw) i siewu sukcesywnego end-to-end — wymagają utworzenia realnych danych.

Powodzenia z kolejną betą! 🌱
