# Inkognito – Game Design Konzept

Stand: 29.10.2026 (Überarbeitung: Riff als 2,5D-Basis mit Haus und Jobs, Gadgets, Zombie-Fische, Fischarmee)

## Pitch & Kernidee

Inkognito ist ein Unterwasser-Abenteuer für Mobile: Du spielst einen Oktopus, der mit acht Armen voller Gadgets Fische fängt, sie in einem alten Haus im Riff einquartiert und für sich arbeiten lässt, während das Riff Stück für Stück zur Heimat voller schräger Figuren wird.

**Genre-Mix:** Tauch-Action (Fangen, Ausweichen, Erkunden) im Wechsel mit Basis-Management (Riff ausbauen, Bewohner zufriedenstellen, Aufträge von NPCs).

**Alleinstellungsmerkmale:**

- Acht Arme als acht Werkzeug-Slots, und jeder Arm hat eine eigene Meinung.
- Fische werden gefangen statt gegessen: Sie schlafen im alten Haus, haben Werte und übernehmen Jobs (Seegras farmen, Muscheln sammeln, bauen, kämpfen).
- Böse Fische und Zombie-Fische bringen Action: mit der Schrotflinte k.o. schießen, dann einsammeln, behalten oder beim Hai verkaufen.
- Das Riff ist eine 2,5D-Basis zum Durchschwimmen: Jede Story-Figur hat ihre Ecke auf einem Podest und schaltet ein Feature frei.
- Der Walfall als großer Wendepunkt: Ein Wal sinkt neben das Riff und öffnet neue Zonen und Bewohner.

**Zielplattform:** Mobile (hochkant und quer) und Browser. **Tauchgang:** 5–10 Minuten. **Session:** 1–2 Tauchgänge plus Basis-Zeit.

## Core Loop

Das Spiel wechselt zwischen Tauchgang und Riff-Basis; was du draußen fängst, verändert drinnen, was du bauen und erleben kannst.

1. **Im Riff vorbereiten:** Gadgets auf die Arme legen, Begleitfisch wählen, Aufträge der Story-Figuren annehmen.
2. **Tauchgang in Echtzeit:** Eine Zone mit festem Layout und wechselnden Fischen, Ereignissen und Räubern. Steuerung: Bewegen + 1 Aktionstaste, weitere Arme per Schnellwahl. Sauerstoff begrenzt die Zeit.
3. **Fangen:** Kleine Fische mit der Blasenkanone, große mit der Angel, böse und Zombie-Fische erst mit der Schrotflinte k.o. schießen. Gefangene Fische schweben in Blasen hinter dir her, Räuber versuchen sie dir abzujagen.
4. **Zurück ins Riff:** Fische ziehen ins alte Haus (solange Platz ist), warten vor der Tür oder gehen an den Hai. Jeder Fang hat eigene Werte.
5. **Basis-Zeit (wie die Sushi-Abende bei Dave the Diver):** Jobs verteilen, Futter und Muscheln einsammeln, Haus und Farm ausbauen, mit den Figuren reden. Danach der nächste Tauchgang.

**Walfall (Prestige):** Erreicht das Riff eine Stufe, kannst du einen Walfall auslösen. Ein Wal sinkt neben dein Riff, öffnet eine neue Zone und bringt Aasfresser-Bewohner. Muscheln (Währung) setzen sich zurück, Bewohner und Arm-Upgrades bleiben.

## Der Oktopus & seine acht Arme

Die Hauptfigur ist ein Oktopus, dessen acht Arme acht Werkzeug-Slots sind; zu Beginn sind zwei frei, jeder weitere ist ein großer Fortschritt.

| Arm-Werkzeug | Funktion |
| --- | --- |
| Blasenkanone | Hauptwerkzeug, fängt kleine und mittlere Fische lebend in Blasen |
| Angel | Für große Arten, Zieh-Minispiel mit mehreren Armen |
| Netz | Fängt Schwärme, aber mit Beifang |
| Laterne | Licht für tiefe Zonen, lockt neugierige Arten |
| Tintensack | Flucht und Tarnung vor Räubern |
| Greifarm | Schätze, Muscheln und Bauteile vom Grund holen |
| Saugnapf-Anker | An Felsen festhalten gegen Strömung |
| Werkzeug-Arm | Reparieren und Bauen unterwegs |
| Fisch-Radar | Zeigt am Bildschirmrand, wo eine gewählte Art schwimmt |
| Schrotflinte | Gag-Waffe mit Streuschuss: schießt Fische k.o. (Sternchen, schwimmen bäuchlings), dann einsammeln. Pflicht gegen Zombie- und böse Fische |

Jeder Arm ist ein Gadget-Platz: Was auf den Armen liegt, nimmst du mit in den Tauchgang. Mehr Arme = mehr Gadgets gleichzeitig, das macht die Spielweise je nach Ausrüstung anders.

**Blasen-Munition:** Klebeblase (bremst schnelle Fische), Köderblase (lockt an), Doppelblase (zwei kleine Fische), Panzerblase (für stachelige Arten).

**Die Arme reden mit:** Etwa zwei Drittel der Nervenzellen eines Oktopus sitzen in den Armen. Im Spiel hat jeder Arm einen Namen und eine Persönlichkeit, kommentiert Fehlschüsse und Käufe, und Upgrades verbessern auch die Laune des Arms.

## Riff-Basis: Haus, Jobs & Story-Figuren

Das Riff ist eine **2,5D-Basis im Querschnitt** (Vorbild Tiny Tower und Fallout Shelter, Tiefe wie bei Dave the Diver): eine Felswand mit Grotten, Ruinen und Vorsprüngen. **Man schwimmt im Riff nicht**, man wischt die Kamera und tippt Grotten, Figuren und Gebäude an. Hochkant liegen die Grotten wie Etagen übereinander, quer als Panorama in zwei Reihen. Der Oktopus sitzt in seiner eigenen Grotte, von dort geht es zum Tauchen. Details im Stil-Leitfaden ARTSTIL.md.

**Das alte Haus:** Alle gefangenen Fische schlafen in einem großen, alten Haus (eine versunkene Villa). Seine Ausbaustufe bestimmt, wie viele Fische du halten kannst (**Fischstärke**). Wer keinen Platz hat, wartet vor der Tür, bis ausgebaut oder verkauft wird.

**Fische haben Werte:** Stärke, Tempo und Fleiß, bei jedem Fang neu ausgewürfelt (Seed-RNG). Seltene Varianten (Zombie, Riesig, Farbmorph) haben bessere Werte.

**Jobs:** Jeder Fisch im Haus kann einen Job übernehmen, die Leistung hängt am passenden Wert:

| Job | Wert | Ergebnis |
| --- | --- | --- |
| Seegras-Farm | Fleiß | Futter (alle Fische essen, ohne Futter arbeiten sie nur halb so gut) |
| Muscheln sammeln | Tempo | Muscheln |
| Bautrupp | Stärke | Ausbauten gehen schneller (später) |
| Wache | Stärke | Verteidigt das Riff gegen Angriffe (später) |
| Expedition | alle | Fische ziehen los und bringen nach Zeit Beute (später) |

**Story-Figuren auf Podesten:** Jede Figur bekommt ihre Ecke auf einem Podest im Riff, zieht im Lauf der Story ein, erklärt ihr Feature in kurzen Dialogen (Vorbild: Dave the Diver) und gibt Aufträge.

| Figur | Ecke | Feature |
| --- | --- | --- |
| Kalle Krebs, Hausverwalter | Vor dem alten Haus | Einstieg, Haus und Ausbau |
| Gisela Seegurke | Seegras-Farm | Jobs und Futter (und die Seegurken-Gewerkschaft) |
| Bruno, abgehalfterter Hai | Wrack am Rand | Kauft Fische für Muscheln, zahlt extra für Zombie-Fische |
| Werkzeug-Garnele | Werkbank | Gadgets und Arm-Plätze |
| General Barsch | Exerzierplatz | Fischarmee: Begleiter, Expeditionen, Verteidigung |
| Pottwal-Bürgermeister | Ganz hinten, schläft | Große Ausbauten, Wecken als Event |

**Fischarmee (drei Stufen):**
1. **Expeditionen:** Fische ziehen los und bringen nach Zeit Beute (passiv, auch offline).
2. **Begleiter:** Ein Fisch begleitet dich im Tauchgang und hilft je nach Werten (verscheucht Räuber, sammelt k.o. Fische ein).
3. **Verteidigung:** Böse Fische greifen das Riff an, Wachen halten dagegen.

**Veränderung über die Woche:** Neue Figuren ziehen ein, sobald die Story es freigibt. Ab Tag 5 kommen Events wie die Laichwanderung (eine Art massenhaft, Preise fallen) und ein wöchentlicher „Fisch der Woche“ mit Sonderauftrag.

## Zonen

Fünf Zonen mit je eigener Regel sorgen dafür, dass sich jede Tiefe anders spielt.

| Zone | Tiefe | Sonderregel | Typische Arten & Räuber | Boss |
| --- | --- | --- | --- | --- |
| Kelpwald | 0–200 m | Strömungen treiben dich ab, Algen verstecken Fische | Barsche, Seeigel, Otter-Banden | Krabbenkönig auf einem Thron aus Müll |
| Korallenriff | 0–50 m (Seitenzweig) | Bunt und eng, viele Schwärme | Papageifische, Muränen, Feuerfische | Riesenmuschel, die nur bei Komplimenten aufgeht |
| Dämmerzone | 200–1000 m | Sicht nur im Lichtkegel, ohne Laterne siehst du nur Augen | Laternenfische, Kalmare, Quallen | Riesenkalmar mit Lampenfieber |
| Mitternachtszone | 1000–4000 m | Druck: ohne Druck-Upgrade wird der Oktopus langsam | Anglerfische, Pelikanaale, Viperfische | Anglerfisch-Influencer mit Fan-Schwarm |
| Hydrothermalquellen | 4000 m+ | Hitzezonen schaden, geben aber Energie | Röhrenwürmer, Yeti-Krabben, Riesenasseln | Uralter Pottwal (schläft, muss geweckt werden) |

**Zufallsereignisse pro Tauchgang** (eins von ~20): Strömungsrennen, Schwarm-Invasion, Händler-Einsiedlerkrebs, Taucher-Müll mit Loot, Walgesang (alle Fische tanzen 10 s).

## Meta-Progression & Langzeitmotivation

Jeder Spieltag schaltet mindestens eine neue Sache frei, und neue Inhalte verändern Regeln statt nur Zahlen.

| Spieltag | Neues |
| --- | --- |
| 1 | Kelpwald, Blasenkanone, Kalle und das alte Haus, Gisela und die Seegras-Farm |
| 2 | Bruno der Hai (Handel), Schrotflinte, erste Zombie-Fische |
| 3 | Korallenriff, Werkzeug-Garnele (Gadgets, Fisch-Radar), Angel |
| 4 | Dämmerzone, Laterne, General Barsch (Begleiter, Expeditionen) |
| 5 | Mitternachtszone, erster Walfall möglich |
| 6–7 | Hydrothermalquellen, Events, Fisch der Woche |

**Abwechslung über Systeme:**

- **Fischbuch:** Über 100 Arten, je mit Fundort, Lieblingsköder und einem echten Fakt.
- **Tages-Mutatoren:** Jeden Tag eine Regel für alle, z. B. „Strömung doppelt so stark“ oder „Nur Nachtfische“.
- **NPC-Questreihen:** Jeder NPC hat eine kleine Geschichte über mehrere Tage, die neue Gebäude oder Arme freischaltet.
- **Seltene Begegnungen:** Legendäre Arten (Grönlandhai, Riesenmanta) mit etwa 2 % Chance pro Tauchgang.

## Art Direction: Pixel-Figuren in gemalter Welt

Verbindlich für alles Optische ist der Stil-Leitfaden **ARTSTIL.md** (Vorbilder, Farben, UI-Bausatz, Dialoge, HUD).

Vorbild ist der Stil von Dave the Diver: Figuren und Fische sind Pixel-Sprites, Unterwasserwelt und Licht sind hochauflösend gemalt (dichte Korallen im Vordergrund, Lichtstrahlen, Ruinen und Dunst in der Tiefe), die UI ist modern und flach. Auch Ablauf, Mechaniken und Dialoge (Figuren-Porträts, kurze Zeilen, Auftrags-Karten) nehmen Dave the Diver als Vorbild. Alle Figuren, Namen und Grafiken sind eigene Designs.

| Ebene | Stil | Details |
| --- | --- | --- |
| Hintergrund | Gemalt, hochauflösend | Weiche Verläufe, Lichtstrahlen, 3–4 Parallax-Ebenen mit Wasserdunst |
| Figuren & Fische | Pixel-Sprites 24–48 px, 3× skaliert | 4-stufige Farbrampe pro Material, farbige statt schwarzer Outline, große Augen mit Glanzpunkt |
| UI | Flach, modern | Abgerundete halbtransparente Karten, klare Sans-Schrift, keine Pixel-Schrift |

**Lesbarkeit:**

- Figuren sind gesättigter und kontrastreicher als die Welt; der Hintergrund wird mit der Tiefe blauer und dunstiger.
- Fische nach dem Prinzip echt plus niedlich: echte Körperform und Flossen, vereinfacht, mit großen Augen. Bosse wirken eher tollpatschig als bedrohlich.
- Licht wirkt auf Sprites: Light2D mit Normal Maps, Bloom auf leuchtenden Objekten, Kopflampe als weicher Lichtkegel.

| Zone | Wasser | Licht |
| --- | --- | --- |
| Flachriff, Kelpwald | Helles Cyan bis Türkis | Warme Sonnenstrahlen, Kaustiken auf dem Sand |
| Dämmerzone | Tiefblau | Kopflampe, Biolumineszenz in Cyan und Violett |
| Mitternachtszone | Violettblau, nie reines Schwarz | Neon-Grün und Magenta der Tiefseebewohner |
| Hydrothermalquellen | Blaugrau mit Rauch | Glühendes Orange |

**Juice:** Blasen beim Schwimmen, Meeresschnee als Schwebeteilchen, Fische drehen sich mit Squash-Animation, kurzer Freeze bei Treffern, leichter Kamera-Zoom beim Einholen der Angel.

## Humor

Der Humor entsteht aus drei Quellen: redseligen Armen, Kreaturen mit Alltagsproblemen und echten Meeresbiologie-Fakten, die lustiger sind als Erfindungen.

- **Arm-Namen:** Deine Arme heißen z. B. „Gerd“ und „Arm Sieben“ und haben zu jedem Fehlschuss eine Meinung.
- **Abschiedsworte:** Verkaufte Fische hinterlassen eine Zeile, z. B. „Grüß mir das Aquarium.“
- **Kreaturen-Persönlichkeiten:** Seegurken streiken, der Einsiedlerkrebs-Makler hat selbst Wohnungsnot, Quallen haben kein Gehirn und sagen das auch.
- **Echte Fakten als Gags:** Alles entwickelt sich irgendwann zur Krabbe (seltene Variante „Karzinisierung“), Pistolenkrebse knallen lauter als ein Schuss, Seegurken atmen durch den Hintern.
- **Kugelfisch-Inflation:** Ein Bewohner bläht deine Muscheln auf: mehr Währung, aber alles wird teurer.
- **Pottwal-Endboss:** Er schläft senkrecht; du musst ihn wecken, und er ist sehr schlecht gelaunt.

**Ton:** Freundlich-trocken, nie zynisch. Texte kurz (max. 1 Zeile im Tauchgang), längere Gags nur im Riff.

## Technik & Claude Code Umsetzung

Phaser 3 mit TypeScript und Vite: browserfähig, gut für Sprite-Rendering mit Licht und Arcade-Physik.

**Mobile, hochkant und quer:**

| | Hochkant | Quer |
| --- | --- | --- |
| Tauchgang | Kamera folgt nach unten, Abtauchen wird zum Hauptgefühl | Breitere Sicht für Schwärme und Bosse |
| Riff-Basis | Grotten als Etagen übereinander, senkrecht wischen | Grotten als Panorama in zwei Reihen, waagerecht wischen |
| Steuerung | Joystick unten, Tippen zum Schießen, Arm-Leiste unten | Joystick links, Zielen und Schießen rechts, Arm-Leiste rechts |

Phaser mit `Scale.RESIZE`, UI an Bildschirmrändern verankert, Safe Areas beachtet. Zuerst als PWA im Browser, später mit Capacitor als App für iOS und Android.

**Grundsätze:**

- **Datengetrieben:** Fische, Arme, NPCs, Zonen, Quests und Texte als JSON in `/data`, damit neue Inhalte ohne Code-Änderung dazukommen.
- **Render-Setup:** `pixelArt: true`, Sprites 3× ohne Glättung skaliert, Hintergründe in voller Auflösung (1920×1080), Light2D-Pipeline mit Normal Maps.
- **Speicherstand:** Lokal in `localStorage` als Cache, online in Supabase synchronisiert, versioniert mit Migrationsfunktion.
- **Platzhalter zuerst:** Generierte Formen in finalen Größen und Dateinamen (siehe Asset-Regeln).

**Ordnerstruktur:**

```
src/
  scenes/    Boot, Riff, Dive, Dialog, Ui
  systems/   rng, catch, residents, economy, quests, save, sync (ohne Phaser-Imports)
  entities/  Octopus, Fish, Bubble, Npc
data/        fish.json, arms.json, npcs.json, zones.json, quests.json, buildings.json, events.json, texts.de.json
assets/      sprites, backgrounds, sfx, music
supabase/    migrations
```

**Meilensteine:**

1. ✅ **Bewegung:** Oktopus mit Unterwasser-Trägheit, Kamera, ein Hintergrund mit Parallax. Fertig, wenn sich Schwimmen hochkant und quer auf einem Handy flüssig anfühlt (60 fps).
2. ✅ **Fangen:** Blasenkanone, 3 Fischarten mit Verhalten, Fische folgen in Blasen. Fertig, wenn ein Fang vom Zielen bis zur Blase unter 3 Sekunden dauert und sich gut anfühlt.
3. ✅ **Tauchgang komplett:** Sauerstoff, Rückkehr zum Riff, ein Räuber, Kelpwald als Zone. Fertig, wenn ein Tauchgang von Start bis Rückkehr spielbar ist.
4. **Riff-Basis (neu):** 2,5D-Riff mit Ebenen und Podesten, altes Haus mit Ausbaustufen, Fisch-Werte, Jobs Seegras-Farm und Muscheln sammeln, Futter, Bruno der Hai als Händler, Story-Aufträge von Kalle, Gisela und Bruno. Fertig, wenn ein Fang ins Haus zieht, einen Job übernimmt und Futter oder Muscheln erarbeitet, und wenn ein Fisch an Bruno verkauft werden kann.
5. **Online:** Login, Cloud-Speicherstand, Freundesliste. Fertig, wenn derselbe Spielstand auf zwei Geräten lädt.
6. **Gadgets & böse Fische:** Arme als Gadget-Plätze mit Ausrüsten im Riff, Schrotflinte, Fisch-Radar, Zombie- und böse Fische (k.o. schießen, einsammeln). Fertig, wenn zwei verschiedene Ausrüstungen sich spürbar anders spielen.
7. **Fischarmee:** Begleiter im Tauchgang, Expeditionen, Riff-Verteidigung.
8. **Inhalt:** Angel, weitere Zonen, alle Figuren, Zucht, Walfall, Events.
9. **Gegen Freunde:** Asynchrone Duelle, danach Echtzeit (siehe Online & Multiplayer).

## Online & Multiplayer

Alle Spielstände liegen online; Freunde-Kämpfe kommen in zwei Stufen, erst asynchron, dann in Echtzeit.

**Backend:** Supabase (Login per E-Mail oder Google, Postgres-Datenbank, Realtime-Kanäle). Der Spielstand wird bei jeder Rückkehr ins Riff und beim Schließen synchronisiert; offline spielt man mit dem lokalen Cache weiter. Bei Konflikten gewinnt der neuere Stand mit Zeitstempel.

| Tabelle | Inhalt |
| --- | --- |
| profiles | Name, Avatar-Farbe des Oktopus, Riff-Stufe |
| saves | Spielstand als JSON, Version, Zeitstempel |
| friends | Freundschaften und Anfragen per Code |
| duels | Herausforderungen, Ergebnisse, Status |
| leaderboards | Wöchentliche Wertungen (größter Fang, Fischbuch-Fortschritt) |

**Stufe 1, asynchron (Meilenstein 9):**

- **Riff-Besuch:** Das Riff eines Freundes ansehen, ein Geschenk dalassen, einen Fisch tauschen.
- **Fang-Duell:** Beide spielen denselben Tauchgang mit gleichem Seed, wer in 3 Minuten mehr Punkte fängt, gewinnt.
- **Wochen-Turnier:** Fisch der Woche fangen, Bestenliste unter Freunden.

**Stufe 2, Echtzeit (später):**

- **Blasen-Arena:** Zwei Oktopusse in einer kleinen Arena schießen sich gegenseitig in Blasen ein, wer dreimal gefangen ist, verliert. Tinte, Netz und Greifarm werden zu Kampf-Werkzeugen.
- **Technik:** Für 1-gegen-1 reicht Supabase Realtime am Anfang; bei Cheat-Problemen oder mehr Spielern ein eigener Server mit Colyseus.

Wichtig: Die Spiellogik von Anfang an ohne `Math.random` bauen, sondern mit einem Seed-Zufallsgenerator, sonst sind faire Duelle später kaum möglich.

## Datenformate

Alle Inhalte liegen als JSON in `/data`; jede Datei ist ein Array solcher Einträge, Texte stehen nur als Schlüssel drin und kommen aus `texts.de.json`.

**fish.json:**

```json
{
  "id": "clownfish",
  "nameKey": "fish.clownfish.name",
  "zone": "reef",
  "rarity": "common",
  "behavior": "curious",
  "speed": 1.2,
  "catchWith": ["bubble", "net"],
  "home": { "needs": "anemone", "enemies": ["grouper"] },
  "produces": { "shells": 2, "everySeconds": 60 },
  "sellValue": 15,
  "factKey": "fish.clownfish.fact",
  "sprite": "fish_clownfish"
}
```

**arms.json:**

```json
{
  "id": "bubble_cannon",
  "slotUnlock": 1,
  "cooldownMs": 600,
  "ammo": ["basic", "sticky", "bait", "double", "armored"],
  "upgrades": [{ "level": 2, "cost": 120, "effect": { "cooldownMs": 450 } }],
  "personalityKey": "arm.gerd"
}
```

**npcs.json (mit Dialog):**

```json
{
  "id": "hermit_broker",
  "nameKey": "npc.broker.name",
  "unlock": { "residentsAtLeast": 3 },
  "dialog": {
    "start": { "textKey": "npc.broker.hello", "options": [
      { "textKey": "npc.broker.opt_flat", "next": "flat" },
      { "textKey": "npc.broker.opt_bye", "next": null }
    ]},
    "flat": { "textKey": "npc.broker.flat", "action": { "type": "startQuest", "quest": "move_in_1" } }
  }
}
```

**fish.json** bekommt zusätzlich Wertebereiche für die Fang-Würfel:

```json
"stats": { "strength": [1, 3], "speed": [2, 4], "diligence": [1, 3] }
```

**jobs.json:**

```json
{ "id": "seaweed_farm", "nameKey": "job.seaweed_farm.name", "building": "seaweed_farm", "stat": "diligence", "produces": { "food": 0.5 } }
```

Weitere Dateien nach gleichem Muster: `zones.json`, `quests.json`, `buildings.json` (mit Ausbaustufen), `npcs.json` (mit Podest und Freischaltung), `events.json`.

## Steuerung & UI-Layout

Hochkant mit einem Daumen, quer mit zwei Daumen spielbar; alle Elemente sitzen am Rand, die Mitte bleibt frei.

| Element | Hochkant | Quer |
| --- | --- | --- |
| Bewegung | Schwebender Joystick, erscheint dort, wo der Daumen unten aufsetzt | Joystick links unten |
| Schießen / Angeln | Kurz tippen in der oberen Bildschirmhälfte, Ziel = Tippstelle | Rechter Daumen: ziehen zum Zielen, loslassen zum Schießen |
| Arm-Leiste | Unten mittig, 2–8 runde Buttons, wischen zum Wechseln | Rechts unten im Bogen um den Schuss-Bereich |
| Sauerstoff & Tiefe | Oben links | Oben links |
| Muscheln | Oben rechts | Oben rechts |
| Gefangene Fische | Kleine Blasen-Leiste unter der Tiefe | Kleine Blasen-Leiste unter der Tiefe |
| Dialoge | Untere Bildschirmhälfte, große Antwort-Buttons | Unteres Drittel, Antworten rechts |

**Regeln:** Buttons mindestens 48 × 48 dp, Safe Areas für Notch und Home-Leiste, Vibration bei Fang und Treffer (abschaltbar), Pause beim Wechsel der Ausrichtung. Am Desktop: WASD/Pfeile, Maus zum Zielen, Zifferntasten für Arme.

## Asset-Regeln

Claude Code baut mit generierten Platzhaltern in den finalen Größen und Namen, damit echte Grafiken später nur ausgetauscht werden müssen.

| Typ | Größe (Pixel, vor 3× Skalierung) | Ankerpunkt | Dateiname |
| --- | --- | --- | --- |
| Oktopus | 32 × 32 | Körpermitte | `player_octopus.png` + `_n.png` für Normal Map |
| Kleine Fische | 16–24 breit | Mitte | `fish_<id>.png` |
| Große Fische, Bosse | 48–96 breit | Mitte | `fish_<id>.png`, Bosse als `boss_<id>.png` |
| NPCs | 32 × 32 bis 48 × 48 | Unten mittig | `npc_<id>.png` |
| Arm-Icons | 16 × 16 | Mitte | `arm_<id>.png` |
| Hintergründe | 1920 × 1080, nicht skaliert | Oben links | `bg_<zone>_<ebene>.png` |

**Animationen:** Spritesheets in Reihen (idle, swim, turn, catch), 4–8 Frames je Reihe, 10 fps. **Werkzeuge:** Aseprite für Sprites, Laigter für Normal Maps. **Platzhalter:** farbige Formen mit Augen, je Art eigene Farbe, damit Tests lesbar bleiben.

## Start-Prompt für Claude Code

„Lies CLAUDE.md und INKOGNITO.md. Setze Meilenstein 1 um und zeig mir am Ende, wie ich es auf dem Handy teste.“
