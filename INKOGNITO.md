# Inkognito – Game Design Konzept

Stand: 29.10.2026 (Neustart als Angel-Incremental; Recherche in RECHERCHE-ANGELN.md, Optik in ARTSTIL.md)

## Pitch & Kernidee

Inkognito ist ein lustiges Angel-Incremental für Mobile: Ein Oktopus mit Fake-Bart und Fischerhut gibt sich als ganz normaler menschlicher Fischer aus, wirft vom Boot aus seine Angel in immer tiefere Meereszonen und lernt dabei echte, oft unglaubliche Fakten über Fische und andere Meerestiere.

**Genre:** Kurze aktive Angel-Runden (Ridiculous Fishing, Tiny Fishing) plus Idle-Fortschritt, Sammeln echter Arten (Animal Crossing, AbyssRium).

**Alleinstellungsmerkmale:**

- **Ein Oktopus, inkognito:** Fake-Bart, schlechte Ausreden, misstrauische Hafenleute. Daraus entstehen die Dialoge und Gags.
- **Lernen nebenbei:** Jede Art ist echt, jeder Erstfang zeigt einen echten Fakt. Wissen bringt im Spiel Vorteile.
- **Echte Tiefe:** Die Zonen entsprechen den echten Meereszonen, von Sonnenlicht bis Tiefseegraben.
- **Acht Arme, acht Angeln:** Jeder Arm ist ein Angel-Platz für die Idle-Crew. Mehr Arme frei = mehr Einnahmen.

**Zielplattform:** Mobile (hochkant zuerst, quer unterstützt) und Browser. **Runde:** 20–40 Sekunden. **Session:** 2–10 Minuten.

## Core Loop

1. **Auswerfen:** An Deck tippen, der Haken fällt.
2. **Abstieg (ausweichen):** Der Haken sinkt, der Daumen lenkt ihn links und rechts. Berührt er einen Fisch, beißt der an und der Aufstieg beginnt sofort. Ziel: so tief wie möglich, denn tiefer ist seltener und wertvoller. Ohne Berührung geht es bis zum Ende der Leine.
3. **Aufstieg (einsammeln):** Die Leine wird eingeholt, jetzt fängt der Haken alles, was er berührt, bis er voll ist.
4. **Finale an Deck:** Die Fische fliegen ins Boot, Münzen ploppen. Antippen eines fliegenden Fisches gibt einen Bonus (Combo).
5. **Neue Art?** Fakt-Karte mit echtem Fakt und einem Kommentar des verkleideten Oktopus. Eintrag ins Fischbuch.
6. **Upgrades kaufen,** nächster Wurf.

**Idle:** Die Crew angelt weiter, auch wenn das Spiel zu ist. Beim Zurückkommen zeigt ein Pop-up die Ausbeute.

## Upgrades

| Upgrade | Wirkung | Vorbild |
| --- | --- | --- |
| Leine | Maximale Tiefe | Tiny Fishing |
| Haken | Wie viele Fische pro Aufstieg | Tiny Fishing |
| Crew | Münzen pro Minute, auch offline | Tiny Fishing |
| Köder (später) | Bestimmte Arten tauchen öfter auf | Cat Goes Fishing |
| Sonar (später) | Zeigt seltene Arten am Rand an | eigene Idee |
| Arme (später) | Weitere Angel-Plätze für die Crew | eigene Idee |

Kosten steigen exponentiell, so abgestimmt, dass das nächste Upgrade immer erreichbar ist und das übernächste knapp nicht.

## Zonen & Arten (Startmeer)

Echte Meereszonen. Pro Zone 3–6 Arten, alle echt, jede mit Fakt.

| Zone | Tiefe | Licht | Beispiel-Arten |
| --- | --- | --- | --- |
| Sonnenlichtzone | 0–200 m | hell, Strahlen | Hering, Makrele, Mondfisch |
| Dämmerzone | 200–1000 m | blau, erste Leuchtpunkte | Laternenfisch, Beilfisch, Gespensterfisch |
| Mitternachtszone | 1000–4000 m | dunkel, Biolumineszenz | Viperfisch, Anglerfisch, Pelikanaal |
| Tiefsee-Ebene | 4000–6000 m | fast schwarz | Seeschwein (Seegurke), Dumbo-Oktopus |
| Tiefseegraben | ab 6000 m | schwarz | Mariana-Scheibenbauch |

**Fakten:** kurz, wahr, überraschend. Jeder Fakt wird vor Veröffentlichung gegen eine seriöse Quelle geprüft (Museen, Forschungsinstitute, Fachartikel); die Quelle steht in den Daten.

## Fischbuch & Lernen

- Alle Arten des Meeres als Karten; unbekannte als Silhouette mit Tiefenhinweis.
- Erstfang: Fakt-Karte mit Kommentar des Oktopus.
- **Wissen zahlt sich aus:** Bekannte Arten bringen mehr Münzen.
- **Sammel-Sets:** zum Beispiel „Leuchtende Tiere“ oder „Zähne!“, geben dauerhafte Boni.
- **Mini-Quiz an Deck (später):** Gelegentlich fragt eine Figur nach einem Fakt aus dem Fischbuch. Richtige Antwort gibt Extra-Münzen.

## Figuren im Hafen

Der Hafen ist das Menü der Basis. Hier wohnen die Figuren, die das Spiel tragen:

| Figur | Rolle | Gag |
| --- | --- | --- |
| Der Oktopus („Kapitän Bert“) | Spielfigur | Fake-Bart, schlechte Ausreden, „acht Arme? Das ist Rheuma“ |
| Hafenmeisterin Hilde | Upgrades, Leine und Boot | Ist sich sicher, dass mit Bert was nicht stimmt |
| Bruno | Fischhändler | Ein Hai im Trenchcoat, ebenfalls inkognito; die beiden decken sich gegenseitig |
| Professorin Qualle | Fischbuch, Quiz | Liebt Fakten, hat kein Gehirn und sagt das auch |

Dialoge und Reaktions-Szenen wie bei Dave the Diver (siehe ARTSTIL.md).

## Prestige: Neue Meere

Wenn das Fischbuch eines Meeres weit genug gefüllt ist, kann Bert weiterziehen: neues Meer, neue Arten und Zonen, Münzen und Upgrades setzen sich zurück, das Fischbuch und ein dauerhafter Bonus bleiben.

| Meer | Besonderheit |
| --- | --- |
| Startmeer (offener Atlantik) | alle Zonen, Grundarten |
| Nordsee | flach, Strömung, Plattfische |
| Korallenriff | bunt, Schwärme, giftige Arten |
| Arktis | Eis an der Oberfläche, langsame Riesen |

## Online

Login und Cloud-Speicherstand über Supabase (schon gebaut). Später: Freunde vergleichen Tiefenrekord und Fischbuch, wöchentlicher „Fisch der Woche“.

## Art Direction

Verbindlich ist **ARTSTIL.md**. Für das Angel-Spiel heißt das: Oben Himmel und Boot mit Pixel-Figuren, darunter ein senkrechter Querschnitt durchs Meer, der mit der Tiefe dunkler wird und in dem Biolumineszenz leuchtet. Fische als Pixel-Sprites mit echter Körperform und großen Augen.

## Steuerung

| Element | Hochkant | Quer |
| --- | --- | --- |
| Auswerfen | Großer Knopf unten | Großer Knopf rechts unten |
| Haken lenken | Daumen irgendwo ziehen, der Haken folgt waagerecht | gleich |
| Combo an Deck | Fliegende Fische antippen | gleich |
| Münzen, Tiefe | oben | oben |
| Upgrades, Fischbuch | Leiste unten (an Deck) | Leiste rechts |

Am Desktop: Maus oder Pfeiltasten lenken, Leertaste wirft aus.

## Technik

Phaser 3, TypeScript, Vite, Supabase. Spiellogik in `src/systems/` ohne Phaser, Zufall nur über den Seed-RNG, Inhalte in `/data`, Texte in `data/texts.de.json`, Spielstand versioniert mit Migration.

**Meilensteine:**

1. **Prototyp Angel-Runde:** Auswerfen, Abstieg, Aufstieg, Finale, drei Upgrades, Offline-Einnahmen, Fakt-Karte beim Erstfang, Fischbuch-Liste. Fertig, wenn eine Runde am Handy Spaß macht und die ersten 10 Minuten ein Upgrade nach dem anderen ermöglichen.
2. **Inhalt Startmeer:** 15–20 echte Arten mit geprüften Fakten, Sammel-Sets, Wissens-Bonus.
3. **Hafen & Figuren:** Hilde, Bruno, Professorin Qualle mit Dialogen, Reaktions-Szenen, Mini-Quiz.
4. **Grafik & Juice:** Stil nach ARTSTIL.md, echte Sprites, Animationen.
5. **Online:** Login und Cloud-Spielstand (vorhanden), Freunde und Bestenlisten.
6. **Prestige:** weitere Meere.
7. **Duelle:** Gleicher Seed, wer angelt in 3 Würfen mehr?

## Asset-Regeln

| Typ | Größe (vor 3× Skalierung) | Dateiname |
| --- | --- | --- |
| Oktopus (verkleidet) | 32 × 32 | `player_octopus.png` |
| Fische | 16–24 breit (klein), 32–64 (groß) | `fish_<id>.png` |
| Figuren | 32 × 32 bis 48 × 48 | `npc_<id>.png`, Porträts `portrait_<id>.png` |
| Boot | 64 × 32 | `boat_<stufe>.png` |
| Hintergründe | 1920 × 1080 | `bg_<meer>_<ebene>.png` |

Animationen als Spritesheets in Reihen, 4–8 Frames, 10 fps. Platzhalter in finalen Größen und Namen.
