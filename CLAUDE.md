# Inkognito – Regeln für Claude Code

## Projekt
Mobile-first Unterwasser-Spiel, Konzept in INKOGNITO.md. Immer zuerst den aktuellen Meilenstein dort lesen.

## Stack
Phaser 3, TypeScript (strict), Vite, Supabase (Auth, Postgres, Realtime). Später Capacitor für iOS/Android.

## Regeln
- Inhalte nur in /data als JSON, nie hart im Code.
- Alle Texte über data/texts.de.json, Schlüssel statt Klartext.
- Zufall nur über den Seed-RNG in src/systems/rng.ts, nie Math.random.
- Spiellogik getrennt von Darstellung (src/systems/ ohne Phaser-Imports), damit sie testbar und duell-fähig bleibt.
- Layout für hochkant UND quer, nach jeder Änderung bei 390x844 und 844x390 prüfen.
- Platzhaltergrafik in finalen Größen und Dateinamen laut Asset-Regeln in INKOGNITO.md.
- Spielstand versioniert, jede Formatänderung braucht eine Migration.
- Keine Geheimnisse im Code, Supabase-Keys über .env (und .env in .gitignore).

## Arbeitsweise
- Ein Meilenstein nach dem anderen, Abnahmekriterien aus INKOGNITO.md erfüllen.
- Am Ende jedes Meilensteins: kurze Zusammenfassung, was fertig ist und was offen bleibt.
- Unit-Tests (Vitest) für src/systems/.
