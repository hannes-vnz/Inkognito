/**
 * Setzt Text mit Hervorhebungen: *Wort* wird gelb (wie wichtige Begriffe bei Dave the Diver).
 * Baut DOM-Knoten statt HTML, damit nie Markup aus Texten interpretiert wird.
 */
export function setRichText(node: HTMLElement, text: string): void {
  node.replaceChildren();
  text.split(/(\*[^*]+\*)/g).forEach((part) => {
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      const mark = document.createElement('span');
      mark.className = 'mark';
      mark.textContent = part.slice(1, -1);
      node.append(mark);
    } else if (part) node.append(document.createTextNode(part));
  });
}

/** Sichtbarer Text ohne Markierungszeichen (für Längen und Schreibmaschine). */
export const plainText = (text: string): string => text.replace(/\*([^*]+)\*/g, '$1');

/**
 * Schreibmaschinen-Effekt: Text erscheint Zeichen für Zeichen, Markierungen bleiben erhalten.
 * Gibt eine Funktion zurück, die sofort alles zeigt.
 */
export function typeRichText(node: HTMLElement, text: string, charsPerSecond = 55): () => void {
  const total = plainText(text).length;
  let shown = 0;
  let timer = 0;
  const render = () => {
    let left = shown;
    const partial = text.replace(/(\*[^*]+\*)|[^*]+/g, (part) => {
      const isMark = part.startsWith('*') && part.endsWith('*') && part.length > 2;
      const body = isMark ? part.slice(1, -1) : part;
      const take = Math.max(0, Math.min(body.length, left));
      left -= take;
      if (take === 0) return '';
      return isMark ? `*${body.slice(0, take)}*` : body.slice(0, take);
    });
    setRichText(node, partial);
  };
  const finish = () => {
    window.clearInterval(timer);
    shown = total;
    setRichText(node, text);
  };
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    finish();
    return finish;
  }
  setRichText(node, '');
  timer = window.setInterval(() => {
    shown += 1;
    if (shown >= total) finish();
    else render();
  }, 1000 / charsPerSecond);
  return finish;
}
