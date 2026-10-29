import { el } from './Hud';
import type { Vec2 } from '../systems/vector';

/** Darstellung des Joysticks (Basis + Knauf). Die Logik steckt in systems/joystick.ts. */
export class JoystickView {
  private readonly node: HTMLDivElement;
  private readonly knob: HTMLDivElement;

  constructor(root: HTMLElement, radius: number) {
    this.node = el('div', 'joystick');
    this.node.style.setProperty('--stick-radius', `${radius}px`);
    const base = el('div', 'base');
    this.knob = el('div', 'knob');
    this.node.append(base, this.knob);
    root.append(this.node);
  }

  show(origin: Vec2, knob: Vec2, active: boolean): void {
    this.node.style.transform = `translate(${origin.x}px, ${origin.y}px)`;
    this.knob.style.transform = `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))`;
    this.node.style.opacity = active ? '1' : '0.4';
  }
}
