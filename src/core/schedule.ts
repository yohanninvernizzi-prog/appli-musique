import type { AnnouncementRule } from './types';

/**
 * Prochain créneau de la règle strictement après `after`.
 * Les créneaux sont calés sur minuit : un intervalle de 15 min donne
 * 00:00, 00:15, 00:30, ... quel que soit l'appareil ou l'heure de lancement,
 * ce qui permet à un second appareil de reprendre le même planning.
 * Cherche jusqu'à 8 jours en avant, renvoie null si rien n'est planifié.
 */
export function nextOccurrence(rule: AnnouncementRule, after: Date): Date | null {
  if (!rule.enabled || rule.intervalMin < 1) return null;
  const step = Math.floor(rule.intervalMin);
  for (let dayOffset = 0; dayOffset <= 8; dayOffset++) {
    const day = new Date(after.getFullYear(), after.getMonth(), after.getDate() + dayOffset);
    if ((rule.daysMask & (1 << day.getDay())) === 0) continue;
    for (let m = 0; m < 24 * 60; m += step) {
      if (m < rule.startMin || m >= rule.endMin) continue;
      const slot = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, m);
      if (slot.getTime() > after.getTime()) return slot;
    }
  }
  return null;
}

export type NextDue = { rule: AnnouncementRule; at: Date };

/** Prochaine annonce toutes règles confondues (la plus proche dans le temps). */
export function nextDue(rules: readonly AnnouncementRule[], after: Date): NextDue | null {
  let best: NextDue | null = null;
  for (const rule of rules) {
    const at = nextOccurrence(rule, after);
    if (at && (best === null || at.getTime() < best.at.getTime())) best = { rule, at };
  }
  return best;
}

export type SchedulerDeps = {
  getRules: () => readonly AnnouncementRule[];
  onDue: (rule: AnnouncementRule, slot: Date) => void;
  now?: () => Date;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  /** Un créneau en retard de plus que ce délai est ignoré plutôt que rejoué. */
  graceMs?: number;
  /** Plafond d'attente d'un timer : on se resynchronise sur l'horloge régulièrement. */
  maxWaitMs?: number;
};

/**
 * Déclenche les annonces à l'heure des créneaux.
 * Robuste à la veille : à chaque réveil on recalcule d'après l'horloge murale,
 * un créneau manqué de peu est joué, un créneau trop ancien est ignoré,
 * et un même créneau n'est jamais joué deux fois.
 */
export class AnnouncementScheduler {
  private handle: unknown = null;
  private running = false;
  private lastCheck: Date;
  private fired = new Set<string>();
  private readonly now: () => Date;
  private readonly setTimer: (fn: () => void, ms: number) => unknown;
  private readonly clearTimer: (h: unknown) => void;
  private readonly graceMs: number;
  private readonly maxWaitMs: number;

  constructor(private deps: SchedulerDeps) {
    this.now = deps.now ?? (() => new Date());
    this.setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer = deps.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
    this.graceMs = deps.graceMs ?? 90_000;
    this.maxWaitMs = deps.maxWaitMs ?? 30_000;
    this.lastCheck = this.now();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastCheck = this.now();
    this.arm();
  }

  stop(): void {
    this.running = false;
    if (this.handle !== null) this.clearTimer(this.handle);
    this.handle = null;
  }

  /** À appeler quand les règles changent. */
  refresh(): void {
    if (!this.running) return;
    if (this.handle !== null) this.clearTimer(this.handle);
    this.arm();
  }

  private arm(): void {
    const now = this.now();
    const due = nextDue(this.deps.getRules(), new Date(Math.max(this.lastCheck.getTime(), now.getTime() - this.graceMs)));
    const wait = due ? Math.max(0, due.at.getTime() - now.getTime()) : this.maxWaitMs;
    this.handle = this.setTimer(() => this.tick(), Math.min(wait, this.maxWaitMs));
  }

  private tick(): void {
    if (!this.running) return;
    const now = this.now();
    const from = Math.max(this.lastCheck.getTime(), now.getTime() - this.graceMs);
    for (const rule of this.deps.getRules()) {
      let cursor = new Date(from);
      for (let guard = 0; guard < 50; guard++) {
        const slot = nextOccurrence(rule, cursor);
        if (!slot || slot.getTime() > now.getTime()) break;
        const key = `${rule.id}@${slot.getTime()}`;
        if (!this.fired.has(key)) {
          this.fired.add(key);
          this.deps.onDue(rule, slot);
        }
        cursor = slot;
      }
    }
    this.lastCheck = now;
    // Évite que l'ensemble grossisse indéfiniment.
    if (this.fired.size > 500) {
      const keep = [...this.fired].slice(-100);
      this.fired = new Set(keep);
    }
    this.arm();
  }
}
