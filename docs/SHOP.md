# Katalog sklepu RootLab

Każda instalacja RootLab automatycznie pobiera katalog produktów spod stałego
adresu (`SHOP_CATALOG_URL` w `const.py`) i podsuwa go AI w rozmowach Diagnozy AI —
gdy temat dotyczy nawozów, środków ochrony, narzędzi czy nasion, AI poleca
pasujące produkty z linkami do sklepu. Użytkownik niczego nie konfiguruje.

## Format katalogu

Publiczny plik/endpoint JSON zwracający listę produktów:

```json
[
  {
    "name": "Nawóz do pomidorów 1 kg",
    "price": "29 zł",
    "url": "https://sklep.example.pl/produkt/nawoz-do-pomidorow",
    "desc": "Organiczny, do gruntu i doniczek; dawkowanie 1 łyżka / roślinę co 2 tyg."
  }
]
```

- `name` — wymagane; reszta opcjonalna.
- `desc` ucinany do 200 znaków; katalog do 60 pozycji.
- Odświeżanie: co 6 h (cache w pamięci HA) albo ręcznie w Ustawieniach → „Pokaż / odśwież katalog".
- Błąd sieci/formatu = brak rekomendacji, bez wpływu na resztę aplikacji.

## Dziś: katalog w tym repo

`shop/catalog.json` w gałęzi `main` — edycja pliku na GitHubie natychmiast
aktualizuje rekomendacje we wszystkich instalacjach (bez wydawania wersji).

## Docelowo: własny sklep

Dowolny backend, który odda ten JSON pod stałym adresem HTTPS:

- **WordPress + WooCommerce** — mini-wtyczka albo endpoint eksportujący produkty
  do tego formatu (nazwa, cena, permalink, krótki opis),
- statyczny plik na hostingu,
- cokolwiek innego (Shoper, własne API…).

Po postawieniu sklepu wystarczy podmienić `SHOP_CATALOG_URL` w
`custom_components/rootlab/const.py` na adres endpointu i wydać wersję.
Zamówienia odbywają się na stronie sklepu (RootLab tylko linkuje).
