export type TextTable = Readonly<Record<string, string>>;

/**
 * Holt einen Text per Schlüssel und ersetzt Platzhalter wie `{depth}`.
 * Fehlende Schlüssel werden sichtbar als `[[schlüssel]]` angezeigt statt still zu verschwinden.
 */
export function translate(
  table: TextTable,
  key: string,
  params: Readonly<Record<string, string | number>> = {},
): string {
  const raw = table[key];
  if (raw === undefined) return `[[${key}]]`;
  return raw.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}
