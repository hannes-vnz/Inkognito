# Inkognito – Game Design Konzept

Stand: 29.10.2026 (Neustart als Angel-Incremental; Recherche in RECHERCHE-ANGELN.md, Optik in ARTSTIL.md)

## Pitch & Kernidee

Inkognito ist ein lustiges Angel-Incremental für Mobile: Ein Oktopus mit Fake-Bart und Fischerhut gibt sich als ganz normaler menschlicher Fischer aus, wirft vom Boot aus seine Angel in immer tiefere Meereszonen und lernt dabei echte, oft unglaubliche Fakten über Fische und andere Meerestiere.

**Genre:** Kurze aktive Angel-Runden (Ridiculous Fishing, Tiny Fishing) plus Idle-Fortschritt, Sammeln echter Arten (Animal Crossing, AbyssRium).

**Alleinstellungsmerkmale:**

- **Ein Oktopus, inkognito:** Fake-Bart, schlechte Ausreden, misstrauische Hafenleute. Daraus entstehen die Dialoge und Gags.
- **Lernen nebenbei:** Jede Art ist echt, jeder Erstfang zeigt einen echten Fakt. Wissen bringt im Spiel Vorteile.
- **Echte Tiefe:** Die Zonen entsprechen den echten Meereszonen, von Sonnenlicht bis Tiefseegraben.

**Zielplattform:** Mobile (hochkant zuerst, quer unterstützt) und Browser. **Runde:** 20–40 Sekunden. **Session:** 2–10 Minuten.

## Core Loop

1. **Auswerfen:** An Deck tippen, der Haken fällt.
2. **Abstieg (ausweichen):** Der Haken sinkt, der Daumen lenkt ihn links und rechts. Berührt er einen Fisch, beißt der an und der Aufstieg beginnt sofort. Ziel: so tief wie möglich, denn tiefer ist seltener und wertvoller. Ohne Berührung geht es bis zum Ende der Leine.
3. **Aufstieg (einsammeln):** Die Leine wird eingeholt, jetzt fängt der Haken alles, was er berührt, bis er voll ist.
4. **Finale an Deck:** Die Fische fliegen ins Boot, Münzen ploppen. Antippen eines fliegenden Fisches gibt einen Bonus (Combo).
5. **Neue Art?** Fakt-Karte mit echtem Fakt und einem Kommentar des verkleideten Oktopus. Eintrag ins Fischbuch.
6. **Upgrades kaufen,** nächster Wurf.

**Kein Idle:** Es gibt keine Offline-Einnahmen. Wer täglich vorbeischaut, bekommt den **Tagesbonus** (wächst mit Serie und Upgrade-Stufen).

**Bedienung:** Unten eine feste Leiste: Karte, Kiste (Inventar, Verkauf an Bruno), Upgrades (bei Hilde) und Gadgets (Professor Blinker) gibt es nur in der Stadt, dazu das Fischbuch; darunter Auswerfen.

**Tutorial (Stadt):** Der Heimathafen ist das Tutorial: auswerfen, Kiste verkaufen (Bruno legt einen Willkommensbonus drauf), erstes Upgrade bei Hilde, Karte öffnen. Danach geht es direkt raus auf Meer 1.

## Fischkiste und Markt

Gefangenes landet erst in der **Fischkiste** (Knopf oben rechts) und wird bei **Bruno** im Hafen verkauft. Jede Art hat einen eigenen **Tageskurs**, der in Wellen steigt und fällt (neue Kurse alle 3 Würfe, Pfeile zeigen den Trend). Verkaufen geht einzeln oder alles auf einmal; angetippte Fische bringen das Doppelte, Brunos Wunschfisch die Prämie obendrauf. Wer wartet, bis der Hering teuer ist, verdient mehr. Werte in data/game.json (`market`), Regeln in src/systems/market.ts.

## Upgrades

| Upgrade | Wirkung | Vorbild |
| --- | --- | --- |
| Leine | Maximale Tiefe | Tiny Fishing |
| Haken | Wie viele Fische pro Aufstieg | Tiny Fishing |
| Kiste | Platz für Fische; ist sie voll, schwimmt der Rest zurück | Dredge |
| Köder (später) | Bestimmte Arten tauchen öfter auf | Cat Goes Fishing |
| Sonar (später) | Zeigt seltene Arten am Rand an | eigene Idee |

Kosten steigen exponentiell, so abgestimmt, dass das nächste Upgrade immer erreichbar ist und das übernächste knapp nicht.

## Seekarte & Angelplätze

Kleine Karte von oben, kein Open World und **kein Steuern**: Eine Zielliste zeigt Heimathafen (Stadt), die Plätze des aktuellen Meeres und was zum nächsten Meer fehlt. Ziel antippen (oder die Boje), der Kutter fährt von allein hin und angelt sofort los. Treibgut antippen holt es ab. Jeder Platz hat eine maximale Tiefe und Lieblingsarten. Der **Motor** bestimmt die Reichweite: Der Startmotor erreicht Heimathafen und ersten Platz, jede weitere Stufe genau einen neuen. Figuren, Upgrades und Gadgets gibt es nur in der Stadt.

| Nordsee | Bis | Motor |
| --- | --- | --- |
| Wattkante (Heimathafen) | 20 m | Start |
| Doggerbank | 50 m | Start |
| Helgoländer Felsen | 100 m | Stufe 2 |
| Norwegische Rinne | 700 m | Stufe 3 |

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
| Bruno | Kauft den Fang zum Tageskurs, Wunschfisch, Köder | Ein Hai im Trenchcoat, ebenfalls inkognito; die beiden decken sich gegenseitig |
| Professorin Qualle | Fischbuch, Quiz | Liebt Fakten, hat kein Gehirn und sagt das auch |
| Opa Knut | Hinweise zur Legende | Echter Bart, zweifelt an Berts |
| Professor Blinker | Gadgets für den Haken: Bremsfallschirm (sinkt langsamer), Magnet-Spule (größerer Fangradius), Panzerhaken (erster Biss prallt ab); einmal kaufen, eins hängt am Haken | Erfinder mit Qualle im Helm („mein Assistent“) |
| Möwe Gisela | Schwarm-Tipp gegen Fischbrötchen: an einem erreichbaren Platz hängen 3 Würfe lang zwei Fische mehr am Haken (Preis steigt mit den Upgrades) | Riecht die Tinte, klaut ab und zu einen Fisch |
| Herr Schulze | Bootscharter einmal am Tag: zahlt den Wert des Fangs bar, aber sein Blitz kostet einen Haken; neue Arten klebt er ins Urlaubsalbum | Tourist, hält Bruno für einen Hai (stimmt) |

Dialoge und Reaktions-Szenen wie bei Dave the Diver (siehe ARTSTIL.md).

## Tag & Nacht, Legenden

**Tag und Nacht** wechseln mit den Würfen (4 Tag, 2 Nacht; Uhr läuft nur beim Angeln, Vorbild Dredge). Nachts ist alles dunkler, leuchtende Arten beißen dreimal so oft an.

**Legenden:** Jedes Meer hat ein sagenhaftes Monster mit einem echten Tier dahinter. Es taucht nur am richtigen Platz, zur richtigen Tageszeit und in passender Tiefe auf; mit zu schwachem Haken reißt die Leine. Hält der Haken, folgt ein kurzer **Kampf**: dem Monster mit dem Daumen folgen holt es ein, sonst steigt die Spannung bis die Leine reißt. **Opa Knut** erzählt davon und verrät nach und nach vage Hinweise (alle 2 Würfe einer).

| Meer | Legende | Echtes Tier | Wo und wann |
| --- | --- | --- | --- |
| Nordsee | Der Uralt-Stör | Europäischer Stör | Helgoländer Felsen, tagsüber, 40–100 m, Haken ab 6 |
| Südsee | Der Titan-Krake | Riesenkalmar | Offene See, nachts, 300–1000 m, Haken ab 8 |

**Köder (Bruno):** gelten für einen Wurf, Preis wächst mit Leine und Haken. Leuchtköder (leuchtende Arten ×3), Krabbelköder (alles außer Fischen ×3), Legendenköder (Legende kommt sicher, wenn Platz, Zeit und Tiefe stimmen). Daten in data/baits.json.

## Prestige: Sechs Meere

Weiter ins nächste Meer geht es erst, wenn Bert genug Arten des Meeres kennt (Nordsee: 10) **und** die Legende gefangen hat: In ihrem Bauch steckt ein Stück Seekarte der Meeresbehörde, das zum nächsten Meer führt. Weiterziehen setzt Münzen und alle Upgrades zurück. Fischbuch, Sets, Story, Rekord und Tagesbonus bleiben, dazu dauerhaft +25 % Münzen pro verlassenem Meer. Jedes Meer hat eigene Zonen, Plätze und Arten (data/seas.json, spots.json, fish.json mit `sea`). Hilde und Knut lassen sich „rein zufällig“ mitversetzen.

| Nr. | Meer | Besonderheit | Legende | Stand |
| --- | --- | --- | --- | --- |
| 1 | Nordsee & Küste | Heimathafen, flach (bis 700 m), **Strömung**, 17 Arten | Uralt-Stör | fertig |
| 2 | Südsee (Korallenriff & Pazifik) | Riff oben, darunter alle Zonen bis zum Marianengraben, 24 Arten | Titan-Krake | fertig (Riff noch ausbauen) |
| 3 | Arktisches Eismeer | Eis an der Oberfläche, U-Boot-Basis der Behörde | offen | später |
| 4 | Traum-Ozean | surreal, biolumineszent; wer hinter allem steckt | offen | später |
| 5 | Fegefeuer-Abgrund | Lava-Schlote, die Black Box der Behörde | offen | später |
| 6 | Urzeit-Riss | prähistorisch, Finale gegen den Ur-Leviathan | Ur-Leviathan | später |

## Geschichte: Bert gegen die Meeresbehörde

Bert ist ein Oktopus, der seit dem Intro als Fischer verkleidet lebt. Die **Meeresbehörde** (Inspektorin Klementine, Wachtmeister Scholle) schnüffelt ihm hinterher, weil ihr der Fischer mit dem Riesenbart verdächtig vorkommt. Gleichzeitig findet Bert heraus, dass die Behörde **Müll in sein Meer kippt** und in einem Riff-Labor Experimente macht. Hinweise kommen per **Flaschenpost** (data/bottles.json) und von Opa Knut; jede besiegte Legende liefert ein Kartenstück zum nächsten Meer. Klementine und Scholle bekommen eigene Auftritte, sobald ihre Grafiken im einheitlichen Stil fertig sind.

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
