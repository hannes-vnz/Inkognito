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

## Seekarte & Angelplätze

Kleine Karte von oben, kein Open World: Bert fährt den Kutter frei (Daumen ziehen), Bojen markieren Angelplätze. Jeder Platz hat eine maximale Tiefe und Lieblingsarten, die dort öfter anbeißen. Der **Motor** (Boot-Upgrade) bestimmt die Reichweite um den Hafen, jede Stufe schaltet einen Platz frei. Unterwegs treibt Treibgut mit Münzen, nach jedem Wurf neu. Figuren gibt es nur im Hafen.

| Platz | Bis | Motor |
| --- | --- | --- |
| Hafenbucht | 200 m | Start |
| Schelfkante | 1000 m | Stufe 2 |
| Offene See | 4000 m | Stufe 3 |
| Tiefsee-Ebene | 6000 m | Stufe 4 |
| Tiefseegraben | 11000 m | Stufe 5 |

Daten in data/spots.json, Werte in data/game.json (map). Später: weitere Boot-Upgrades (Licht, Rumpf, Laderaum), Ereignisse auf der Fahrt.

## Zonen & Arten (Startmeer)

Echte Meereszonen. Pro Zone 3–6 Arten, alle echt, jede mit Fakt.

| Zone | Tiefe | Licht | Beispiel-Arten |
| --- | --- | --- | --- |
| Sonnenlichtzone | 0–200 m | hell, Strahlen | Hering, Makrele, Mondfisch |
| Dämmerzone | 200–1000 m | blau, erste Leuchtpunkte | Laternenfisch, Beilfisch, Gespensterfisch |
| Mitternachtszone | 1000–4000 m | dunkel, Biolumineszenz | Viperfisch, Anglerfisch, Pelikanaal |
| Tiefsee-Ebene | 4000–6000 m | fast schwarz | Seeschwein (Seegurke), Dumbo-Oktopus |
| Tiefseegraben | ab 6000 m | schwarz | Mariana-Scheibenbauch, Tiefsee-Flohkrebs |

Die Tiefenangaben der Arten sind ihre echten Lebensbereiche, deshalb tauchen manche in mehreren Zonen auf. Nicht alle Tiere sind Fische (Kalmare, Galeere, Seeschwein, Flohkrebs); das Set „Keine Fische!“ macht genau das zum Lernziel.

**Fakten:** kurz, wahr, überraschend. Jeder Fakt wird vor Veröffentlichung gegen eine seriöse Quelle geprüft (Museen, Forschungsinstitute, Fachartikel); die Quelle steht in den Daten.

## Fischbuch & Lernen

- Alle Arten des Meeres als Karten; unbekannte als Silhouette mit Tiefenhinweis.
- Erstfang: Fakt-Karte mit Kommentar des Oktopus.
- **Wissen zahlt sich aus:** Bekannte Arten bringen mehr Münzen.
- **Sammel-Sets:** zum Beispiel „Leuchtende Tiere“ oder „Zähne!“, geben dauerhafte Boni.
- **Mini-Quiz an Deck:** Gelegentlich fragt eine Figur nach einem Fakt aus dem Fischbuch. Richtige Antwort gibt Extra-Münzen.

## Figuren im Hafen

Der Hafen ist das Menü der Basis. Hier wohnen die Figuren, die das Spiel tragen:

| Figur | Rolle | Gag |
| --- | --- | --- |
| Der Oktopus („Kapitän Bert“) | Spielfigur | Sieht fast aus wie ein gemütlicher Fischer: orange Haut, Ölmantel, Südwester, Nasen-Brille mit Schnurrbart und Fake-Bart. Nur die Tentakel-Hände mit Saugnäpfen und die Tentakel in den Gummistiefeln verraten ihn. Schlechte Ausreden, „acht Arme? Das ist Rheuma“ |
| Hafenmeisterin Hilde | Upgrades, Leine und Boot | Ist sich sicher, dass mit Bert was nicht stimmt |
| Bruno | Fischhändler | Ein Hai im Trenchcoat, ebenfalls inkognito; die beiden decken sich gegenseitig |
| Professorin Qualle | Fischbuch, Quiz | Liebt Fakten, hat kein Gehirn und sagt das auch |
| Opa Knut | Hinweise zur Legende | Echter Bart, zweifelt an Berts |
| Möwe Gisela | Schwarm-Tipp gegen Fischbrötchen: ein erreichbarer Platz bringt 3 Würfe lang doppelte Münzen (Preis steigt mit den Upgrades) | Riecht die Tinte, klaut ab und zu einen Fisch |
| Herr Schulze | Bootscharter einmal am Tag: doppelte Münzen, aber sein Blitz kostet einen Haken; neue Arten klebt er ins Urlaubsalbum | Tourist, hält Bruno für einen Hai (stimmt) |

Dialoge und Reaktions-Szenen wie bei Dave the Diver (siehe ARTSTIL.md).

## Tag & Nacht, Legenden

**Tag und Nacht** wechseln mit den Würfen (4 Tag, 2 Nacht; Uhr läuft nur beim Angeln, Vorbild Dredge). Nachts ist alles dunkler, leuchtende Arten beißen dreimal so oft an.

**Legenden:** Jedes Meer hat ein sagenhaftes Monster mit einem echten Tier dahinter. Es taucht nur am richtigen Platz, zur richtigen Tageszeit und in passender Tiefe auf; mit zu schwachem Haken reißt die Leine. Hält der Haken, folgt ein kurzer **Kampf**: dem Monster mit dem Daumen folgen holt es ein, sonst steigt die Spannung bis die Leine reißt. **Opa Knut** erzählt davon und verrät nach und nach vage Hinweise (alle 2 Würfe einer).

| Meer | Legende | Echtes Tier | Wo und wann |
| --- | --- | --- | --- |
| Atlantik | Die Seeschlange | Riemenfisch | Offene See, nachts, 200–500 m, Haken ab 8 |
| Nordsee | Das Ungeheuer von Stronsay | Riesenhai | Doggerbank, tagsüber, 0–40 m, Haken ab 6 |

**Köder (Bruno):** gelten für einen Wurf, Preis wächst mit Leine und Haken. Leuchtköder (leuchtende Arten ×3), Krabbelköder (alles außer Fischen ×3), Legendenköder (Legende kommt sicher, wenn Platz, Zeit und Tiefe stimmen). Daten in data/baits.json.

## Prestige: Neue Meere

Kennt Bert genug Arten eines Meeres (Atlantik: 15 von 21), leuchtet auf der Seekarte „Neues Meer“. Weiterziehen setzt Münzen und alle Upgrades zurück. Fischbuch, Sets, Story, Rekord und Tagesbonus bleiben, dazu dauerhaft +25 % Münzen pro verlassenem Meer. Jedes Meer hat eigene Zonen, Plätze und Arten (data/seas.json, spots.json, fish.json mit `sea`). Hilde lässt sich „rein zufällig“ mitversetzen.

| Meer | Besonderheit | Stand |
| --- | --- | --- |
| Offener Atlantik | alle Zonen bis 11000 m, 21 Arten | fertig |
| Nordsee | flach (bis 700 m), **Strömung** treibt den Haken, 14 Arten, 3 Sets | fertig |
| Korallenriff | bunt, Schwärme, giftige Arten | später |
| Arktis | Eis an der Oberfläche, langsame Riesen | später |

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

1. ✅ **Prototyp Angel-Runde:** Auswerfen, Abstieg, Aufstieg, Finale, drei Upgrades, Offline-Einnahmen, Fakt-Karte beim Erstfang, Fischbuch-Liste. Fertig, wenn eine Runde am Handy Spaß macht und die ersten 10 Minuten ein Upgrade nach dem anderen ermöglichen.
2. ✅ **Inhalt Startmeer:** 15–20 echte Arten mit geprüften Fakten, Sammel-Sets, Wissens-Bonus. (21 Arten, 5 Sets, Fakten am 29.10.2026 geprüft, Quelle je Art in data/fish.json)
3. ✅ **Hafen & Figuren:** Hilde, Bruno, Professorin Qualle mit Dialogen, Reaktions-Szenen, Mini-Quiz. (8 Story-Momente, Brunos Wunschfisch, 21 Quizfragen; Inhalte in data/npcs.json, story.json, quiz.json)
3b. ✅ **Seekarte:** Angelplätze, Motor, Treibgut; dazu erste Sounds (synthetisiert, data/sounds.json), Münzflug und rollender Zähler.
4. **Grafik & Juice:** Stil nach ARTSTIL.md, echte Sprites, Animationen. (Teil 1 ✅: alle Fische, Bert, Kutter und Figuren neu gezeichnet, Porträts mit 4 Ausdrücken, ziehende Wolken, Wellen, Wal-Schatten, Spritzer, Hitstop, Funken. Offen: echte gezeichnete Grafik statt Generator, Musik.)
5. **Online:** Login und Cloud-Spielstand (vorhanden), Freunde und Bestenlisten.
6. **Prestige:** ✅ System und Nordsee; Korallenriff und Arktis folgen.
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
