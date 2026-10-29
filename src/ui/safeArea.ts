export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

let probe: HTMLDivElement | null = null;

/** Liest die Safe Areas (Notch, Home-Leiste) aus CSS `env()` aus. */
export function readSafeArea(): Insets {
  if (!probe) {
    probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;visibility:hidden;pointer-events:none;' +
      'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);';
    document.body.appendChild(probe);
  }
  const s = getComputedStyle(probe);
  return {
    top: parseFloat(s.paddingTop) || 0,
    right: parseFloat(s.paddingRight) || 0,
    bottom: parseFloat(s.paddingBottom) || 0,
    left: parseFloat(s.paddingLeft) || 0,
  };
}
