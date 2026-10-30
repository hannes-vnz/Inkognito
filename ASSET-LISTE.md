# Inkognito – Asset-Liste für die Grafik

Stand: 29.10.2026. Alle Grafiken, die das Spiel braucht, mit Maß, Dateiname und Prompt-Idee.
Alles unter **A** ersetzt vorhandene Platzhalter 1:1: Datei mit gleichem Namen und gleichem Maß in den Ordner legen, fertig.
**B** ist neu und braucht eine kleine Code-Anpassung (mache ich, sobald die Bilder da sind).

## So liefern

- **PNG mit transparentem Hintergrund**, Pixel-Art ohne Weichzeichnung und ohne Kantenglättung.
- **Spritesheets:** gleich große Felder ohne Abstand; jede Animation ist eine **Zeile**, die Frames laufen von links nach rechts.
- **Maße exakt** wie angegeben (das Spiel skaliert selbst 2–3×). Lieber zu groß liefern als zu klein: Ich kann mit einem Skript zuschneiden, verkleinern (Nearest Neighbor), den Hintergrund entfernen und die Frames ausrichten.
- **Hinweis zu Gemini:** Bildgeneratoren halten Raster und Figur über viele Frames schlecht konsistent. Das klappt besser:
  1. Zuerst **ein Referenzbild** der Figur machen und dann bei jedem Prompt mitgeben.
  2. **Wenige Schlüsselposen** (2–4) einzeln erzeugen statt ganzer Streifen auf einmal.
  3. Die Rohbilder schickst du mir, ich baue daraus die Streifen.

### Einspielen (macht Claude bzw. jeder mit dem Projekt)

```
npm run art:import -- sprites/anim_bert_talk.png rohbilder/talk/        # Ordner mit Einzelbildern = Frames
npm run art:import -- sprites/anim_bert_shock.png shock.png --frames 10 --once
npm run art:import -- sprites/npc_hilde.png hilde_sheet.png --grid 4x3
npm run art:import -- sprites/fish_cod.png kabeljau.jpg                  # ein Bild, Bewegung wird abgeleitet
```

Das Skript (`scripts/import-art.mjs`) stellt frei (auch karierte Fake-Transparenz), schneidet zu, verkleinert pixelgenau, richtet die Frames aus und setzt das Sheet nach dem Raster aus den Spieldaten zusammen. Bei Acting-Streifen trägt es die Frame-Anzahl in `data/anims.json` ein. Jede eingespielte Datei steht danach in `scripts/final-art.json`, und `npm run assets:placeholders` überschreibt sie nie mehr.

### Stil-Block (vor jeden Prompt setzen)

> Pixel art game sprite, crisp hard pixels, no anti-aliasing, limited palette with 4-tone color ramps, colored dark outline (#0E1A2B), big expressive eyes with a white highlight, saturated warm colors, cute but slightly goofy, side view, transparent background, in the style of modern indie pixel games like Dave the Diver and Eastward. Same character design in every image.

## Die Figuren (Referenz für alle Prompts)

| Figur | Aussehen |
| --- | --- |
| **Bert** (Hauptfigur) | Oktopus, als menschlicher Fischer verkleidet. Runder Oktopuskopf in warmem Orange-Braun mit Flecken (nicht lila), Augen mit **waagerechten Balken-Pupillen**. Gelber Südwester (leicht schief), gelber Ölmantel über Matrosenhemd, runde Brille mit **angeklebter Knollennase**, buschige Fake-Augenbrauen, viel zu großer brauner **Fake-Bart** mit Gummiband hinter den Ohren, Gummistiefel. Tentakel mit Saugnäpfen gucken aus Ärmeln, Kragen und unter dem Mantel heraus. Er will unbedingt normal wirken. |
| **Fischer Bert** (der echte, nur im Intro) | Älterer Mensch, wettergegerbt, grauer Vollbart, Wollmütze, Ölzeug; gemütlich, zufrieden. |
| **Hafenmeisterin Hilde** | Strenge, aber herzliche ältere Frau, Kapitänsmütze, Fernglas um den Hals, blaue Uniformjacke. Misstrauischer Blick. |
| **Bruno, Fischhändler** | Ein **Hai** im zu kleinen Trenchcoat mit Hut, Rückenflosse ragt durch den Mantel, breites Grinsen mit Zähnen; zwielichtiger Händler. |
| **Professorin Qualle** | Ohrenqualle mit Doktorhut, großer Brille und Fliege, schwebt; „kein Gehirn, aber ein Diplom“. |
| **Opa Knut** | Uralter Seebär mit echtem, vollem lockigem Bart, Pfeife mit Rauch, Strickmütze, ein Auge zugekniffen; erzählt Legenden. |
| **Möwe Gisela** | Dicke Silbermöwe, gelber Schnabel mit rotem Fleck, strenges Auge, klaut alles. |
| **Herr Schulze** | Tourist aus dem Ruhrgebiet: Hawaiihemd, Strohhut, Sonnenbrille auf der Stirn, Kamera am Riemen, Sonnenbrand, Shorts, Socken in Sandalen. |

## A. Platzhalter ersetzen (ohne Code-Änderung)

### A1. Bert – Acting-Animationen für die Filmszenen (am wichtigsten)

Streifen: **96 × 96 pro Frame**, alle Frames in einer Zeile. Halbnah (Kopf bis Bauch), Blick zur Kamera. Ordner `assets/sprites/`.

| Datei | Frames | fps | Schleife | Was passiert |
| --- | --- | --- | --- | --- |
| `anim_bert_talk.png` | 8 | 10 | ja | Erzählt etwas, Mund auf/zu, Bart wackelt mit, Tentakel gestikulieren. |
| `anim_bert_happy.png` | 8 | 12 | ja | Freut sich riesig, hüpft, Tentakel jubeln in die Luft, Augen zu Halbmonden. |
| `anim_bert_shock.png` | 10 | 12 | nein | Schreck: zuckt zusammen, Augen werden riesig, Brille und Nase springen hoch, Hut fliegt kurz ab. Letzter Frame hält. |
| `anim_bert_busted.png` | 8 | 8 | ja | Ertappt: Schweißtropfen, grinst verkrampft, Fake-Bart rutscht, er drückt ihn wieder fest. |
| `anim_bert_reel.png` | 6 | 10 | ja | Kurbelt mit aller Kraft an der Angel, Tentakel um die Rute gewickelt. |
| `anim_bert_raw.png` | 8 | 6 | ja | **Unverkleidet:** nackter Oktopus auf dem Meeresboden, wechselt Farbe und Hautstruktur (Tarnung). |
| `anim_bert_dressup.png` | 12 | 5 | nein | Zieht sich Stück für Stück an: Mantel → Hut → Brille mit Nase → Augenbrauen → Bart → posiert. Letzter Frame hält. |

### A2. Bert – Spielfigur

`assets/sprites/player_octopus.png`: **192 × 128**, Felder **32 × 32** (6 Spalten × 4 Zeilen, leere Felder bleiben transparent). Seitenansicht, steht an Deck.

| Zeile | Animation | Frames | fps |
| --- | --- | --- | --- |
| 0 | idle (atmet, blinzelt, Tentakel ringelt sich unter dem Mantel) | 6 | 6 |
| 1 | cast (holt aus und wirft die Angel aus) | 4 | 12 |
| 2 | cheer (jubelt, Tentakel hoch) | 4 | 10 |
| 3 | sweat (schwitzt, Bart verrutscht) | 4 | 8 |

### A3. Porträts für Dialoge

**64 × 64** pro Bild, Kopf und Schultern, Blick leicht zur Seite, in `assets/sprites/`. Pro Figur 4 Ausdrücke:

`portrait_<id>.png` (normal), `portrait_<id>_happy.png`, `portrait_<id>_annoyed.png`, `portrait_<id>_shock.png`

IDs: `bert`, `hilde`, `bruno`, `qualle`, `knut`, `gisela`, `schulze` → **28 Bilder**.

### A4. Figuren am Hafen (Spritesheets)

`assets/sprites/npc_<id>.png`: **128 × 96**, Felder **32 × 32** (4 Spalten × 3 Zeilen), für `hilde`, `bruno`, `qualle`, `knut`, `gisela`, `schulze`.

| Zeile | Animation | Frames | fps |
| --- | --- | --- | --- |
| 0 | idle | 4 | 4 |
| 1 | talk | 4 | 8 |
| 2 | react (Freude oder Schreck, zur Figur passend: Hilde hebt das Fernglas, Bruno tippt an den Hut, Gisela flattert, Schulze blitzt mit der Kamera) | 4 | 8 |

### A5. Fische (37 Arten)

`assets/sprites/fish_<id>.png`, Seitenansicht nach **rechts** schwimmend, echte Körperform, etwas größerer Kopf und große Augen.
Raster: 4 Spalten × 4 Zeilen. **Dateigröße = 4 × Feldbreite mal 4 × Feldhöhe** (z. B. Hering 18 × 8 → 72 × 32).

| Zeile | Animation | Frames | fps |
| --- | --- | --- | --- |
| 0 | idle | 4 | 6 |
| 1 | swim | 4 | 10 |
| 2 | turn (dreht sich) | 4 | 12 |
| 3 | catch (zappelt am Haken) | 4 | 12 |

| id | Name | Feld (B × H) |
| --- | --- | --- |
| man_o_war | Portugiesische Galeere | 18 × 20 |
| flying_fish | Fliegender Fisch | 20 × 12 |
| herring | Hering | 18 × 8 |
| mackerel | Makrele | 20 × 8 |
| tuna | Blauflossen-Thunfisch | 32 × 14 |
| sunfish | Mondfisch | 24 × 24 |
| hatchetfish | Beilfisch | 16 × 12 |
| lanternfish | Laternenfisch | 16 × 8 |
| giant_squid | Riesenkalmar | 48 × 20 |
| viperfish | Viperfisch | 22 × 8 |
| fangtooth | Fangzahnfisch | 20 × 14 |
| barreleye | Gespensterfisch | 20 × 12 |
| vampire_squid | Vampirtintenfisch | 22 × 20 |
| gulper | Pelikanaal | 24 × 10 |
| black_swallower | Schwarzer Schlinger | 20 × 14 |
| anglerfish | Anglerfisch | 22 × 18 |
| tripod_fish | Dreibeinfisch | 24 × 16 |
| sea_pig | Seeschwein | 18 × 12 |
| dumbo | Dumbo-Oktopus | 20 × 18 |
| snailfish | Mariana-Scheibenbauch | 20 × 10 |
| amphipod | Tiefsee-Flohkrebs | 16 × 10 |
| brown_shrimp | Nordseegarnele | 16 × 10 |
| moon_jelly | Ohrenqualle | 16 × 18 |
| plaice | Scholle | 22 × 12 |
| weever | Petermännchen | 18 × 9 |
| garfish | Hornhecht | 30 × 8 |
| starfish | Gemeiner Seestern | 16 × 16 |
| gurnard | Grauer Knurrhahn | 22 × 10 |
| edible_crab | Taschenkrebs | 20 × 14 |
| lumpsucker | Seehase | 18 × 16 |
| catshark | Kleingefleckter Katzenhai | 28 × 10 |
| cod | Kabeljau | 26 × 12 |
| turbot | Steinbutt | 26 × 16 |
| monkfish | Seeteufel | 30 × 18 |
| langoustine | Kaisergranat | 20 × 12 |
| oarfish | Riemenfisch – **Legende „Die Seeschlange“** | 64 × 16 |
| basking_shark | Riesenhai – **Legende „Das Ungeheuer von Stronsay“** | 64 × 24 |

Tipp: Bei den Fischen reicht notfalls ein gutes Einzelbild pro Art, die vier Zeilen (Wackeln, Schwanzschlag, Drehen) kann ich daraus per Skript ableiten.

### A6. Boot, Kleinkram, Icons

| Datei | Maß | Inhalt |
| --- | --- | --- |
| `sprites/boat_1.png` | 64 × 32 | Kleiner Fischkutter, rot-weiß, Seitenansicht, Kajüte rechts |
| `sprites/boat_top.png` | 32 × 32 | Kutter von oben (Seekarte) |
| `sprites/buoy.png` | 16 × 24 | Rot-weiße Boje |
| `sprites/hook.png` | 8 × 12 | Angelhaken |
| `sprites/fx_crate.png` | 16 × 16 | Treibende Holzkiste (Strandgut) |
| `sprites/fx_bottle.png` | 16 × 16 | Flaschenpost |
| `sprites/fx_bubble.png` | 8 × 8 | Luftblase |
| `sprites/icon_coin.png` | 16 × 16 | Münze |
| `sprites/icon_fish.png` | 16 × 16 | Fisch-Symbol |
| `sprites/icon_book.png` | 16 × 16 | Fischbuch |
| `sprites/icon_map.png` | 16 × 16 | Seekarte |
| `icons/icon-192.png`, `icons/icon-512.png` | 192², 512² | App-Icon: Berts Gesicht mit Südwester und Fake-Bart |

### A7. Hintergründe (gemalt/weich, nicht Pixel)

Laut Stil-Leitfaden: Die Welt ist weich gemalt mit Tiefe und Dunst, die Figuren davor sind Pixel. Ordner `assets/backgrounds/`.

| Datei | Maß | Inhalt |
| --- | --- | --- |
| `bg_harbor_0.png` | 1920 × 1080 | Kleine norddeutsche Hafenstadt: Giebelhäuser, Leuchtturm, Kaimauer, Himmel; untere ~40 % frei für Wasser |
| `bg_sea_0.png` | 1920 × 1080 | Offenes Meer, Himmel und Horizont (ferne Ebene) |
| `bg_sea_1.png` | 1920 × 1080 | Unterwasser, Sonnenlichtzone mit Lichtstrahlen (mittlere Ebene) |
| `bg_deep_far.png` | 288 × 256 | Tiefsee, ferne Ebene, kachelbar (dunkelblau mit Schwebeteilchen) |
| `bg_deep_rocks.png` | 960 × 512 | Tiefsee-Felsen als Silhouetten, waagerecht kachelbar |

### A8. Deko (Meeresboden und Hafen), Ordner `assets/decor/`

| Datei | Maß | Inhalt |
| --- | --- | --- |
| `seabed.png` | 176 × 68 | Meeresboden mit Sand und Steinen, waagerecht kachelbar |
| `decor_seaweed.png` | 52 × 67 | Seegras |
| `decor_coral_pink.png` / `decor_coral_yellow.png` | 48 × 56 / 46 × 51 | Korallen |
| `decor_arch.png` | 198 × 205 | Felsbogen |
| `decor_ruins.png` | 245 × 186 | Versunkene Ruine |
| `decor_totem.png` | 120 × 231 | Versunkener Totempfahl |
| `decor_log.png` | 85 × 98 | Versunkener Baumstamm |
| `harbor_hut.png` | 192 × 122 | Fischerhütte am Kai |
| `harbor_barrel.png` / `harbor_barrel_small.png` | 16 × 15 / 16 × 11 | Fässer |

### A9. Hafenleben (`assets/life/`)

Diese Bilder stammen aus freien Asset-Paketen (siehe CREDITS.md) und sehen schon ordentlich aus, sie haben also die **niedrigste Priorität**. Felder 48 × 48, Frames nebeneinander:

| Datei | Frames | Wer / was |
| --- | --- | --- |
| `life_angler_fish.png` / `life_angler_hook.png` | 4 / 6 | Angler Jens: angelt / zieht etwas raus; auch **Fischer Bert im Intro** |
| `life_angler_walk.png`, `_idle`, `_hurt`, `_death` | 6, 4, 2, 6 | Fischer Bert im Intro: geht, steht, erschrickt, fällt über Bord |
| `life_angler2_fish.png` / `_hook` | 4 / 6 | Angler Ole |
| `life_rower.png` + `life_rowboat.png` (74 × 18) | 4 | Ruderer im Boot |
| `life_hermit.png` (Felder 32 × 32) | 10 + 4 | Einsiedlerkrebs: hebt die Schere, flitzt |
| `life_cat.png` (Felder 16 × 16) | 6 × 4 | Kater Krümel |

## B. Neu (ich baue es ein, wenn die Bilder da sind)

Nach Wirkung sortiert:

1. **Fischer Bert als eigene Figur fürs Intro** (statt des Anglers aus dem Asset-Paket): 48 × 48 Felder, Zeilen angeln (4), zieht (6), geht (6), steht (4), rutscht aus und fällt (6), treibt im Rettungsring und winkt (4).
2. **Mehr Acting-Animationen für Bert** (96 × 96, wie A1):
   - `anim_bert_eat`: probiert heimlich rohen Fisch, merkt, dass jemand guckt.
   - `anim_bert_ink`: verschluckt sich und spritzt Tinte.
   - `anim_bert_salute`: salutiert übertrieben menschlich.
   - `anim_bert_sneeze`: niest, der Bart fliegt weg.
3. **Acting-Animationen für die Nebenfiguren** (96 × 96, je 6–8 Frames):
   - `anim_bruno_deal`: reibt sich die Flossen.
   - `anim_hilde_suspicious`: kneift ein Auge zu und starrt.
   - `anim_gisela_steal`: schnappt sich einen Fisch und haut ab.
   - `anim_schulze_photo`: Blitzlicht.
   - `anim_knut_story`: Pfeife, Rauchkringel.
   - `anim_qualle_lecture`: Zeigestock.
4. **Boot-Stufen** `boat_2.png` bis `boat_4.png` (64 × 32): Der Kutter wird mit den Motor-Upgrades größer und schicker (Stufe 4 mit Kran und Lichterkette).
5. **Legenden in groß** für die Kampfszene: `legend_oarfish.png` und `legend_basking_shark.png`, 192 × 96, Zeilen schwimmen (6), wütend (4), besiegt (4).
6. **Nordsee-Hintergründe** `bg_northsea_0.png` / `bg_northsea_1.png` (1920 × 1080): graueres Licht, Watt am Horizont, Helgoland-Felsen.
7. **Hintergründe für Filmszenen** (statt der CSS-Muster), je 1080 × 1080, damit sie hochkant und quer passen:
   - `cut_spotlight`: Bühne mit Spot.
   - `cut_marquee`: Glühbirnen-Rahmen.
   - `cut_table`: Holztisch von oben.
   - `cut_deep`: Tiefsee.
   - `cut_night`: Nachthimmel über dem Meer.
8. **Köder-Icons** `icon_bait_glow`, `icon_bait_crawl`, `icon_bait_legend` (16 × 16).

## Reihenfolge-Empfehlung

1. **Bert-Referenzbild** festlegen (ein großes, sauberes Bild), danach A1 und A2. Er ist ständig zu sehen.
2. **Porträts** (A3), weil die Dialoge am meisten Bildfläche haben.
3. Hafen-Figuren (A4) und Hintergrund Hafen (A7).
4. Fische (A5), gern nach und nach.
5. Der Rest.
