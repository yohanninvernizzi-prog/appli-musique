/**
 * Programme de diffusion : horaires d'ouverture de la semaine et créneaux de publicité.
 * Logique pure (aucune dépendance native), testée dans program.test.ts.
 */

/** Une plage d'ouverture. `day` : 0 = dimanche ... 6 = samedi. Minutes depuis minuit, fin exclue. */
export type OpeningSlot = { id: string; day: number; startMin: number; endMin: number };

const MIN = 60_000;

function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60 + d.getMilliseconds() / 60_000;
}

function atMinute(day: Date, minute: number): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, minute);
}

/** Vrai si `date` tombe dans une plage d'ouverture (début inclus, fin exclue). */
export function isOpen(slots: readonly OpeningSlot[], date: Date): boolean {
  const day = date.getDay();
  const m = minutesOfDay(date);
  return slots.some((s) => s.day === day && m >= s.startMin && m < s.endMin);
}

export type Boundary = { at: Date; opens: boolean };

/** Prochain changement d'état (ouverture ou fermeture) strictement après `after`, sur 8 jours. */
export function nextBoundary(slots: readonly OpeningSlot[], after: Date): Boundary | null {
  const open = isOpen(slots, after);
  const candidates: number[] = [];
  for (let offset = 0; offset <= 8; offset++) {
    const day = new Date(after.getFullYear(), after.getMonth(), after.getDate() + offset);
    for (const s of slots) {
      if (s.day !== day.getDay()) continue;
      candidates.push(atMinute(day, s.startMin).getTime(), atMinute(day, s.endMin).getTime());
    }
  }
  candidates.sort((a, b) => a - b);
  for (const t of candidates) {
    if (t <= after.getTime()) continue;
    const at = new Date(t);
    if (isOpen(slots, at) !== open) return { at, opens: !open };
  }
  return null;
}

/**
 * Premier instant calé sur l'horloge (multiple de `intervalMin` depuis minuit) strictement après `after`.
 * Caler sur l'horloge plutôt que sur l'heure de lancement donne le même planning sur tous les appareils.
 */
export function nextClockMultiple(intervalMin: number, after: Date): Date {
  const step = Math.max(1, Math.floor(intervalMin));
  const m = Math.floor(minutesOfDay(after) / step + 1e-9) * step + step;
  return atMinute(after, m);
}

/**
 * Une publicité passe à `t` si le centre est ouvert à `t` et l'était déjà une minute avant :
 * on ne commence pas la diffusion par une publicité à l'instant de l'ouverture.
 */
export function isAdTime(slots: readonly OpeningSlot[], t: Date): boolean {
  return isOpen(slots, t) && isOpen(slots, new Date(t.getTime() - MIN));
}

/** Prochaine publicité prévue par les horaires, strictement après `after` (null si aucune sous 8 jours). */
export function nextAdTime(slots: readonly OpeningSlot[], intervalMin: number, after: Date): Date | null {
  const limit = after.getTime() + 8 * 24 * 60 * MIN;
  let t = nextClockMultiple(intervalMin, after);
  for (let guard = 0; guard < 20_000 && t.getTime() <= limit; guard++) {
    if (isAdTime(slots, t)) return t;
    if (!isOpen(slots, t)) {
      const b = nextBoundary(slots, t);
      if (!b) return null;
      // On saute directement à l'ouverture suivante (l'instant d'ouverture lui-même est exclu).
      t = nextClockMultiple(intervalMin, new Date(b.at.getTime() - 1));
      if (t.getTime() === b.at.getTime()) t = nextClockMultiple(intervalMin, t);
    } else {
      t = nextClockMultiple(intervalMin, t);
    }
  }
  return null;
}

/**
 * Rang de la publicité à diffuser pour un créneau : elles passent à tour de rôle.
 * Le calcul ne dépend que de l'heure du créneau, donc deux appareils choisissent la même.
 */
export function adIndexFor(slot: Date, intervalMin: number, count: number): number {
  if (count <= 0) return -1;
  const step = Math.max(1, Math.floor(intervalMin));
  return Math.floor(slot.getTime() / MIN / step) % count;
}

/** Message d'erreur si la plage est invalide ou chevauche une autre plage du même jour, sinon null. */
export function slotError(slots: readonly OpeningSlot[], candidate: OpeningSlot): string | null {
  if (candidate.endMin <= candidate.startMin) return "L'heure de fin doit être après l'heure de début.";
  const clash = slots.some(
    (s) => s.id !== candidate.id && s.day === candidate.day && candidate.startMin < s.endMin && s.startMin < candidate.endMin,
  );
  return clash ? 'Cette plage chevauche une autre plage du même jour.' : null;
}

export type ProgramConfig = {
  slots: readonly OpeningSlot[];
  intervalMin: number;
  /** Diffusion automatique selon les horaires. */
  auto: boolean;
};

/** Forçage manuel : diffuser hors horaires ('on') ou couper pendant les horaires ('off'). */
export type Override = 'on' | 'off' | null;

export type RunnerDeps = {
  getConfig: () => ProgramConfig;
  /** Appelé quand la diffusion doit démarrer (true) ou s'arrêter (false). */
  onAirChange: (onAir: boolean) => void;
  /** Appelé à l'heure d'une publicité. `lateMs` : retard constaté par rapport au créneau. */
  onAd: (slot: Date, lateMs: number) => void;
  /** Appelé quand l'horloge a sauté : l'application a été suspendue `ms` millisecondes. */
  onGap?: (ms: number) => void;
  /** Appelé à chaque réveil (signal de vie). */
  onTick?: (now: Date) => void;
  now?: () => Date;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  /** Une publicité en retard de plus que ce délai est abandonnée plutôt que rejouée. */
  graceMs?: number;
  /** Plafond d'attente entre deux réveils : on se recale sur l'horloge régulièrement. */
  maxWaitMs?: number;
};

/**
 * Suit l'horloge et décide : à l'antenne ou non, et quand passer une publicité.
 * À chaque réveil tout est recalculé d'après l'heure réelle, ce qui rattrape une mise en veille :
 * l'antenne est remise dans le bon état et une publicité manquée de peu est jouée (une seule).
 */
export class ProgramRunner {
  private handle: unknown = null;
  private running = false;
  private onAir = false;
  private override: Override = null;
  private lastCheck: Date;
  private expectedAt = 0;
  private lastAdSlot = 0;
  private readonly now: () => Date;
  private readonly setTimer: (fn: () => void, ms: number) => unknown;
  private readonly clearTimer: (h: unknown) => void;
  private readonly graceMs: number;
  private readonly maxWaitMs: number;

  constructor(private deps: RunnerDeps) {
    this.now = deps.now ?? (() => new Date());
    this.setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer = deps.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
    this.graceMs = deps.graceMs ?? 90_000;
    this.maxWaitMs = deps.maxWaitMs ?? 15_000;
    this.lastCheck = this.now();
  }

  get isOnAir(): boolean {
    return this.onAir;
  }

  get currentOverride(): Override {
    return this.override;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastCheck = this.now();
    this.expectedAt = 0;
    this.evaluate(false);
  }

  stop(): void {
    this.running = false;
    if (this.handle !== null) this.clearTimer(this.handle);
    this.handle = null;
    if (this.onAir) {
      this.onAir = false;
      this.deps.onAirChange(false);
    }
  }

  /** À appeler quand les horaires, l'intervalle ou le mode automatique changent. */
  refresh(): void {
    if (this.running) this.evaluate(false);
  }

  setOverride(value: Override): void {
    this.override = value;
    this.refresh();
  }

  /** Prochaine publicité compte tenu de l'état actuel (null si aucune de prévue). */
  nextAd(): Date | null {
    const { slots, intervalMin, auto } = this.deps.getConfig();
    const now = this.now();
    if (this.override === 'on') return nextClockMultiple(intervalMin, now);
    if (!auto) return null;
    const from = this.override === 'off' ? (nextBoundary(slots, now)?.at ?? null) : now;
    return from ? nextAdTime(slots, intervalMin, from) : null;
  }

  private evaluate(fromTimer: boolean): void {
    if (!this.running) return;
    if (this.handle !== null) this.clearTimer(this.handle);
    this.handle = null;
    const now = this.now();
    const { slots, intervalMin, auto } = this.deps.getConfig();

    if (fromTimer && this.expectedAt > 0) {
      const gap = now.getTime() - this.expectedAt;
      if (gap > 20_000) this.deps.onGap?.(gap);
    }
    this.deps.onTick?.(now);

    // Un forçage manuel prend fin au changement d'horaire suivant : le programme reprend la main.
    if (this.override !== null && auto) {
      const b = nextBoundary(slots, this.lastCheck);
      if (b && b.at.getTime() <= now.getTime()) this.override = null;
    }

    const wasOnAir = this.onAir;
    const desired = this.override === 'on' ? true : this.override === 'off' ? false : auto && isOpen(slots, now);
    if (desired !== wasOnAir) {
      this.onAir = desired;
      this.deps.onAirChange(desired);
    }

    // Publicités : seulement si on était déjà à l'antenne, et au plus une par réveil (la plus récente).
    if (wasOnAir && desired) {
      const from = Math.max(this.lastCheck.getTime(), now.getTime() - this.graceMs);
      let due: Date | null = null;
      let t = nextClockMultiple(intervalMin, new Date(from));
      for (let guard = 0; guard < 200 && t.getTime() <= now.getTime(); guard++) {
        if (this.override === 'on' || isAdTime(slots, t)) due = t;
        t = nextClockMultiple(intervalMin, t);
      }
      if (due && due.getTime() > this.lastAdSlot) {
        this.lastAdSlot = due.getTime();
        this.deps.onAd(due, now.getTime() - due.getTime());
      }
    }
    this.lastCheck = now;

    // Prochain réveil : le prochain événement, sans dépasser le plafond.
    let wait = this.maxWaitMs;
    const boundary = nextBoundary(slots, now);
    if (boundary) wait = Math.min(wait, boundary.at.getTime() - now.getTime());
    if (desired) wait = Math.min(wait, nextClockMultiple(intervalMin, now).getTime() - now.getTime());
    wait = Math.max(250, wait);
    this.expectedAt = now.getTime() + wait;
    this.handle = this.setTimer(() => this.evaluate(true), wait);
  }
}
