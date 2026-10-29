# Inkognito

Mobile-first Unterwasser-Spiel mit Phaser 3, TypeScript und Vite. Konzept: [INKOGNITO.md](INKOGNITO.md), Regeln für die Umsetzung: [CLAUDE.md](CLAUDE.md).

## Loslegen

```bash
npm install
npm run dev        # Dev-Server, auch im WLAN erreichbar
npm test           # Unit-Tests für src/systems/
npm run build      # Typecheck + Produktions-Build nach dist/
```

Platzhaltergrafiken neu erzeugen (überschreibt `assets/sprites` und `assets/backgrounds`):

```bash
npm run assets:placeholders
```

## Online spielen

Jeder Push auf `main` baut das Spiel und veröffentlicht es auf GitHub Pages:
**https://hannes-vnz.github.io/Inkognito/** (FPS-Anzeige: `…/Inkognito/#debug`).

## Lokal auf dem Handy testen

1. Handy und Rechner ins selbe WLAN.
2. `npm run dev` starten. Vite zeigt neben `Local` auch eine `Network`-Adresse, z. B. `http://192.168.0.23:5173/`.
3. Diese Adresse im Handy-Browser öffnen. Mit `?debug` hinten dran (`http://192.168.0.23:5173/?debug`) erscheint oben rechts die FPS-Anzeige.
4. Für Vollbild: im Browser-Menü „Zum Home-Bildschirm“ wählen und von dort starten.

Steuerung:
- **Schwimmen:** Daumen in der unteren Hälfte (hochkant) bzw. linken Hälfte (quer) aufsetzen und ziehen. Desktop: WASD oder Pfeiltasten.
- **Schießen (Blasenkanone):** Kurz tippen, Ziel ist die Tippstelle. Quer kann man rechts auch ziehen zum Zielen und loslassen zum Schießen. Desktop: Mausklick oder Leertaste.
- **Riff:** Zu Kalle (Makler) oder einer Höhle schwimmen, dann den gelben Knopf tippen (Desktop: E). Jeder Fisch passt in genau eine Höhle, Bewohner produzieren Muscheln. Der Ring rechts oben startet den Tauchgang.
- Eine leichte Zielhilfe lenkt Schüsse auf Fische, die knapp daneben liegen. Gefangene Fische schweben in Blasen hinterher (max. 8).
