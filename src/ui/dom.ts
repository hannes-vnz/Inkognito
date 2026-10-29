/** Kleines DOM-Hilfsmittel für die Oberfläche. */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

export function iconImg(name: string): HTMLImageElement {
  const img = el('img', 'icon');
  img.src = `sprites/${name}.png`;
  img.alt = '';
  return img;
}
