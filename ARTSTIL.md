# Inkognito – Stil-Leitfaden

Stand: 29.10.2026. Dieses Dokument ist die verbindliche Vorlage für Grafik, UI, Dialoge und Bewegung. Es ergänzt INKOGNITO.md, bei Widersprüchen gilt dieses Dokument für alles Optische.

## 1. Was wir von wem lernen

| Vorbild | Was wir übernehmen | Was wir nicht übernehmen |
| --- | --- | --- |
| **Dave the Diver** (Hauptvorbild) | Pixel-Figuren vor „echter“, tiefer Welt; flache 2D-Unterwasserwelt sah den Entwicklern zu langweilig aus, deshalb 3D-Tiefe im Hintergrund und große Fische in 3D [1][2]. Tauchen am Tag, Verwalten am Abend. Dialoge mit ausdrucksstarken Porträts, klarer Textbox, wichtige Wörter gelb hervorgehoben, keine Pixel-Schrift im Fließtext [3]. Ein Handy als Menü-Zentrale mit Apps [4]. Tonalität: verspielt statt düster [5]. | Figuren, Namen, Logos und konkrete Grafiken. Die Restaurant-Steuerung mit Laufen (wir verwalten per Tippen). |
| **Tiny Tower** (Mobile, NimbleBit) | Hochkant-Querschnitt mit Etagen, die man per Wischen durchscrollt; jede Etage ist ein Raum mit Bewohnern; Jobs nach Fähigkeiten; gut lesbare Pixel-Art auf kleinen Bildschirmen [6]. | Aufbau als Turm aus gleich großen Kästen. |
| **Fallout Shelter** | Querschnitt-Basis, Räume brauchen einen bestimmten Wert (Stärke, Wahrnehmung …), Bewohner werden per Ziehen auf Räume verteilt, Räume wachsen durch Ausbau, Eingangsräume werden verteidigt [7][8]. | Sterile Bunker-Optik, Wartezeiten-Monetarisierung. |
| **Spiritfarer** | Seitenansicht einer Basis, die man Stück für Stück ausbaut; jede Figur bekommt ihr eigenes Häuschen mit Geschichte; warme, handgemalte Stimmung [9]. | Plattformer-Steuerung auf der Basis. |
| **Cult of the Lamb** | Anhänger übernehmen Jobs (Farm, Holz, Kochen), Gebäude schalten sich Schritt für Schritt frei; niedliche Optik trifft dunkle Themen, das passt zu Zombie-Fischen [10][11]. | Kult-/Opfer-Themen. |
| **Dredge** | „Aberrationen“: verfremdete Fische (zusätzliche Augen, freiliegende Knochen), seltener und mehr wert, im Inventar farbig markiert; der Händler nennt sie „verdorben“ [12]. Vorlage für Zombie-Fische und Bruno. | Horror-Ton, Panik-UI. |
| **Eastward** | Pixel-Art mit modernem Licht (Glühen, weiches Licht, warme Palette), Anime-Ausdruck in Gesichtern [13]. | Top-down-Perspektive. |

Hinweis zu den Quellen: Einige Seiten (gamedeveloper.com, halabaojia) waren aus der Arbeitsumgebung nicht direkt abrufbar, die Angaben dazu stammen aus Suchergebnissen. Beschreibungen ohne Quellenangabe sind eigene Beobachtungen aus den Spielen.

## 2. Grundregel: drei Ebenen, drei Stile

| Ebene | Stil | Regel |
| --- | --- | --- |
| **Welt** (Wasser, Licht, Felsen, Ruinen, Korallen) | Gemalt bzw. weich gerendert, hohe Auflösung | Tiefe durch 4–6 Ebenen mit Dunst; nie flache Farbflächen; Lichtstrahlen und Kaustiken nur in flachem Wasser |
| **Figuren** (Oktopus, Fische, Figuren, Gebäude-Details) | Pixel-Sprites, 3× skaliert, scharf | 4-stufige Farbrampe, farbige Outline, große Augen mit Glanzpunkt, gesättigter als die Welt |
| **UI** (HUD, Dialoge, Menüs) | Flach, kräftig, „gezeichnet“ | Dicke dunkle Kontur, harte Schatten, Gelb als Signalfarbe, runde fette Schrift; keine Glas-/Blur-Karten |

## 3. Welt

**Tiefe und Ebenen (2,5D).** Jede Szene besteht aus Ebenen, die unterschiedlich schnell scrollen: Fernes Wasser (fest) → Silhouetten (0,15) → Ruinen/Felsen hinten (0,35) → Spielebene (1,0) → Vordergrund-Korallen (1,15–1,25, leicht unscharf/dunkler). Hintere Ebenen sind kleiner, blauer und heller (Luftperspektive unter Wasser).

**Farben je Zone** (Wasser oben → unten, Licht):

| Zone | Wasser | Akzentlicht |
| --- | --- | --- |
| Riff (Basis) | `#9AF0E4` → `#1E7FA0` | warmes Sonnenlicht `#FFF2C4`, Kaustiken auf Sand |
| Kelpwald | `#7FE8E0` → `#0F4F7A` | goldene Strahlen, grüne Kelp-Silhouetten |
| Dämmerzone | `#1C4E8A` → `#0B1E45` | Biolumineszenz Cyan `#5CF2FF`, Violett `#B07CFF` |
| Mitternacht | `#2A1C5A` → `#120A2E` (nie Schwarz) | Neon-Grün `#7DFF8A`, Magenta `#FF4FD8` |
| Quellen | `#3A4A5A` → `#1A2026` | Glut-Orange `#FF8A3D` |

**Formsprache.** Felsen und Ruinen haben weiche, große Formen mit wenigen Details; Details nur dort, wo gespielt wird (Podeste, Eingänge). Korallen stehen in Gruppen, nie einzeln verstreut. Keine perfekten Kreise oder Rechtecke in der Welt.

## 4. Figuren und Fische

- **Größen:** Oktopus 32×32, kleine Fische 16–24 breit, große Fische 48–96, Figuren 32–48 (alles vor 3×).
- **Lesbarkeit:** Figur hebt sich immer vom Hintergrund ab: gesättigter, dunklere Kontur, Glanzpunkt im Auge.
- **Echt plus niedlich:** echte Körperform und Flossen, Kopf etwas größer, Augen groß.
- **Varianten:** Zombie-Fische entsättigt grün-grau `#8FB89A`, ein Auge leuchtend, Gräten sichtbar, leichtes Zucken in der Idle-Animation. Böse Fische: rote Augen, eckigere Silhouette. Riesig: 1,5× Größe, eigener Sprite.
- **Animationen:** Reihen idle, swim, turn, catch, je 4–8 Frames, 10 fps. Figuren im Riff zusätzlich `talk` (Mund auf/zu) und `react` (Freude, Schreck).
- **Porträts für Dialoge:** pro Figur eigenes 64×64-Porträt mit 3–4 Gesichtsausdrücken (normal, freut sich, genervt, Schreck). Dateiname `portrait_<id>_<ausdruck>.png`.

## 5. Riff-Basis: Querschnitt statt Schwimmen

Vorbild Tiny Tower und Fallout Shelter, mit der Tiefe von Dave the Diver:

- **Man schwimmt im Riff nicht.** Das Riff ist ein Querschnitt durch eine Felswand mit Grotten, Ruinen und Vorsprüngen. Die Kamera wird per Wischen verschoben (hochkant senkrecht, quer waagerecht), Antippen wählt aus.
- **Jede Grotte ist ein Ort:** altes Haus, Seegras-Farm, Muschelbank, Brunos Wrack, später Werkbank, Exerzierplatz. Jede Story-Figur steht auf ihrem Podest in ihrer Grotte.
- **Gesperrte Grotten** sind sichtbar, aber dunkel und mit Felsbrocken verschlossen, das macht neugierig.
- **Der Oktopus** sitzt in seiner eigenen Grotte (Wohnzimmer mit Ausrüstungsständer), von dort startet der Tauchgang über einen großen Knopf.
- **Fische leben sichtbar:** Arbeiter wuseln in ihrer Grotte, freie Fische schwimmen ums Haus, wartende stehen vor der Tür an.
- **Hochkant:** Grotten untereinander, wie Etagen. **Quer:** dieselben Grotten als breites Panorama, zwei Reihen.

## 6. UI-Bausatz

**Farben (Tokens):**

| Token | Wert | Verwendung |
| --- | --- | --- |
| `ink` | `#0E1A2B` | Konturen, harte Schatten, dunkler Text |
| `panel` | `#17304D` | Hintergrund von Dialogen und Menüs |
| `panel-light` | `#22476E` | Innenkante, Listenzeilen |
| `paper` | `#FFF6E0` | heller Text, helle Karten (Auftragszettel) |
| `signal` | `#FFD23F` | Hervorhebungen, Hauptknopf, Namen, Schlüsselwörter |
| `coral` | `#FF6B6B` | Warnung, Schaden, „zu wenig“ |
| `kelp` | `#7BD88F` | Gewinn, „+12 Muscheln“ |
| `water` | `#5CE1E6` | Luft, Wasser, Info |

**Formen:**
- Panels: Kontur 3px `ink`, Ecken 10px, innen 2px helle Kante oben, harter Schatten 0 4px 0 `ink`. Kein Blur, keine Transparenz.
- Knöpfe: wie Panels, dazu ein „Sockel“ (Schatten 0 5px) der beim Drücken auf 0 1px schrumpft. Mindestens 48×48 dp.
- Hauptknopf (Tauchen, Bestätigen): `signal` mit `ink`-Text, groß.
- Zahlen mit Symbol: Muschel- und Futter-Icon vor der Zahl (16×16 Pixel-Icon, 2× skaliert).

**Schrift:** Überschriften, Namen, Zahlen: **Baloo 2** (fett, rund). Fließtext: **Nunito** (gut lesbar, kein Pixel-Font, wie bei Dave the Diver [3]). Schlüsselwörter in Dialogen in `signal`.

**Dialoge (wie Dave the Diver):**
- Großes Porträt (128px) links unten, ragt über den Rand der Textbox.
- Namensschild als gelber Reiter oben an der Box.
- Text erscheint Buchstabe für Buchstabe (Tippen zeigt sofort alles), ▼ blinkt, wenn es weitergeht.
- Antworten als Knöpfe über der Box rechts gestapelt.
- Hochkant: Box über die volle Breite unten. Quer: Box unten, Antworten rechts daneben.

**HUD im Tauchgang:**
- Oben links: runder **Luft-Ring** um ein Oktopus-Icon mit Restzeit, darunter Tiefe als Zahl. Wird rot und pulsiert unter 25 %.
- Unter dem Ring: gefangene Fische als kleine Blasen mit Fisch-Icon.
- Unten: Arm-Leiste mit den ausgerüsteten Gadgets als runde Knöpfe mit Pixel-Icons.

**Menüs:** Statt verschachtelter Karten ein „Muschel-Handy“ des Oktopus (Hommage an Daves Handy [4]): Apps für Haus, Fische, Ausrüstung, Aufträge, Freunde, Einstellungen.

**Rückmeldungen:** Zahlen fliegen aus dem Ort nach oben (`+3` in `kelp`), Figuren hüpfen beim Antippen, Ausbau mit Staubwolke und Plopp.

## 7. Bewegung und Juice

- Hit-Stop beim Fang (60–80 ms), kleine Kamera-Erschütterung, Blasen-Plopp.
- Schrotflinte: kräftiger Rückstoß, Mündungsblitz, getroffene Fische drehen sich mit Sternchen auf den Rücken.
- Squash & Stretch beim Wenden und Beschleunigen.
- UI: Panels federn rein (Back-Out, 200 ms), nie schlagartig.

## 8. Ton

Freundlich-trocken. Kurze Zeilen. Im Tauchgang höchstens eine Zeile, längere Gags nur im Riff. Echte Meeresfakten als Pointe (Seegurken atmen durch den Hintern).

## 9. Do & Don't

| Do | Don't |
| --- | --- |
| Kräftige Konturen und harte Schatten im UI | Glas-Optik, Blur, halbtransparente Kästen |
| Pixel-Figuren vor weicher, tiefer Welt | Pixel-Hintergründe in derselben Auflösung wie Figuren |
| Gelb nur für das Wichtigste | Viele Akzentfarben gleichzeitig |
| Tippen und Wischen im Riff | Den Oktopus durchs Riff steuern |
| Eigene Figuren und Namen | Dave-the-Diver-Figuren, -Logos oder -Screens nachbauen |

## Quellen

1. Screen Rant, Interview zu den Inspirationen von Dave the Diver: https://screenrant.com/dave-diver-game-interview/
2. Software Engineering Daily, Developing Dave the Diver: https://softwareengineeringdaily.com/2024/04/09/developing-dave-the-diver-with-jaeho-hwang-and-minsuk-cha/
3. Game Accessibility Nexus, Deaf Game Review – Dave the Diver: https://www.gameaccessibilitynexus.com/blog/2024/02/13/dave-the-diver-deaf-game-review/
4. Dave the Diver Wiki, Smartphone: https://dave-the-diver.fandom.com/wiki/Smartphone
5. GameRant, Interview mit Director Jaeho Hwang: https://gamerant.com/dave-the-diver-interview/
6. Tiny Tower im App Store: https://apps.apple.com/app/422667065
7. Fallout Wiki, Fallout Shelter rooms: https://fallout.wiki/wiki/Fallout_Shelter_rooms
8. Giant Bomb, Fallout Shelter: https://giantbomb.com/wiki/Games/Fallout_Shelter
9. PC Gamer, Spiritfarer: https://pcgamer.com/spiritfarer-is-a-hand-drawn-crafting-story-game-about-making-friends-with-animals
10. Explosion Network, Cult of the Lamb Review: https://explosionnetwork.com/cult-of-the-lamb-review
11. Stevivor, Cult of the Lamb Preview: https://stevivor.com/previews/cult-lamb-preview-aussie-made-diabolical/
12. Dredge Wiki, Aberrations: https://dredge.wiki.gg/wiki/Aberrations
13. 80.lv, Eastward: https://80.lv/articles/eastward-charming-chinese-pixel-art-adventure
