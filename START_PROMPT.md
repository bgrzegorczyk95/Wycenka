# Pierwszy prompt do Claude Code

Skopiuj tekst poniżej linii i wklej w Claude Code w VS Code (w otwartym folderze projektu).

---

Budujemy aplikację „Wycenka” – oferty dla fachowców z nagrania głosowego. Wszystko, czego potrzebujesz, jest w tym repo:

- `CLAUDE.md` – zasady projektu (przeczytaj w całości, szczególnie „Zasady, których nie wolno łamać”),
- `docs/01-produkt.md` … `docs/08-otwarte-kwestie.md` – specyfikacja,
- `docs/fixtures/` – złoty przykład wyceny i szablon branży glazurnika,
- `mockups/` – 24 makiety (HTML z inline CSS + zrzuty PNG w `mockups/png/`), `mockups/index.html` to spis.

Zadanie na teraz:

1. Przeczytaj `CLAUDE.md` i wszystkie pliki w `docs/`. Przejrzyj kilka makiet (np. `mockups/png/Main.png`, `Pozycje.png`, `Klient.png`, `PanelOfert.png`) i ich HTML.
2. Napisz mi krótko (maks. 15 punktów): jak rozumiesz produkt, jaki jest plan dla etapów M0 i M1, i jakie masz pytania albo gdzie widzisz sprzeczności między `docs/` a makietami. Poczekaj na moją odpowiedź.
3. Po mojej akceptacji zrób **M0** (szkielet repo) i **M1** (silnik wyceny z testami na `docs/fixtures/lazienka-kowalska.json`) według `docs/07-plan-prac.md`. Silnik: najpierw testy, potem kod, pieniądze w groszach, BigInt przy mnożeniu.
4. Na koniec: uruchom `pnpm test`, `pnpm typecheck`, `pnpm lint`, pokaż wyniki i napisz, co zrobione, co odłożone i co proponujesz jako następny krok (M2).

Nie zaczynaj kolejnych etapów bez mojej zgody. Nie instaluj dużych bibliotek spoza stacku z `CLAUDE.md` bez pytania.

---

## Kolejne prompty (po zakończeniu poprzedniego etapu)

> Zrób etap **M2** z `docs/07-plan-prac.md`. Najpierw krótki plan i pytania, potem implementacja. Wygląd odwzoruj z makiet wymienionych przy etapie. Na koniec sprawdź kryteria „Gotowe gdy” i podsumuj.

Podmieniaj numer etapu (M3, M4…). Przy etapach z AI (M5, M9) dodaj:

> Najpierw zrób wersję z `MOCK_AI=1`, która zwraca dane z fixture, i całe UI na niej. Prawdziwe wywołania API dopiero potem.

Gdy coś wygląda inaczej niż na makiecie:

> Porównaj ekran `/oferty/:id` z `mockups/Pozycje.html` i `mockups/png/Pozycje.png` – popraw odstępy, rozmiary fontów i kolory, żeby były zgodne z makietą.
