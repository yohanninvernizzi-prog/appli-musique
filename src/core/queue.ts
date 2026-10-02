import type { PlayMode, RepeatMode } from './types';

export type Rng = () => number;

/** Mélange de Fisher-Yates ; `first` (si fourni) est placé en tête. */
export function shuffled<T>(items: readonly T[], rng: Rng = Math.random, first?: T): T[] {
  const rest = first === undefined ? [...items] : items.filter((x) => x !== first);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return first === undefined ? rest : [first, ...rest];
}

/**
 * File d'attente de lecture : linéaire ou aléatoire, avec répétition
 * (aucune, toute la liste, ou le titre en cours).
 */
export class PlayQueue {
  private source: string[];
  private order: string[];
  private index = 0;

  constructor(
    ids: readonly string[],
    private playMode: PlayMode = 'linear',
    private repeatMode: RepeatMode = 'off',
    private rng: Rng = Math.random,
    startId?: string,
  ) {
    this.source = [...ids];
    this.order = this.buildOrder(startId);
    const at = startId === undefined ? -1 : this.order.indexOf(startId);
    this.index = at >= 0 ? at : 0;
  }

  private buildOrder(startId?: string): string[] {
    const first = startId !== undefined && this.source.includes(startId) ? startId : undefined;
    if (this.playMode === 'shuffle') return shuffled(this.source, this.rng, first);
    return [...this.source];
  }

  get length(): number {
    return this.order.length;
  }

  get current(): string | null {
    return this.order[this.index] ?? null;
  }

  get upcoming(): string[] {
    return this.order.slice(this.index + 1);
  }

  setMode(playMode: PlayMode, repeatMode: RepeatMode): void {
    const currentId = this.current;
    this.playMode = playMode;
    this.repeatMode = repeatMode;
    this.order = this.buildOrder(currentId ?? undefined);
    this.index = currentId === null ? 0 : Math.max(0, this.order.indexOf(currentId));
  }

  /** Positionne la file sur un titre (linéaire : se place dessus ; aléatoire : le met en tête). */
  jumpTo(id: string): boolean {
    if (!this.source.includes(id)) return false;
    if (this.playMode === 'shuffle') {
      this.order = shuffled(this.source, this.rng, id);
      this.index = 0;
    } else {
      this.index = this.order.indexOf(id);
    }
    return true;
  }

  /** Avance après la fin d'un titre (tient compte de la répétition d'un titre). */
  advance(): string | null {
    if (this.repeatMode === 'one') return this.current;
    return this.skipNext();
  }

  /** Passage manuel au titre suivant (ignore la répétition d'un titre). */
  skipNext(): string | null {
    if (this.order.length === 0) return null;
    if (this.index + 1 < this.order.length) {
      this.index += 1;
      return this.current;
    }
    if (this.repeatMode === 'off') return null;
    // Fin de liste avec répétition : on repart du début (nouveau mélange si aléatoire).
    const last = this.current;
    if (this.playMode === 'shuffle') {
      let next = shuffled(this.source, this.rng);
      if (next.length > 1 && next[0] === last) {
        [next[0], next[1]] = [next[1], next[0]];
      }
      this.order = next;
    }
    this.index = 0;
    return this.current;
  }

  skipPrevious(): string | null {
    if (this.order.length === 0) return null;
    if (this.index > 0) {
      this.index -= 1;
    } else if (this.repeatMode === 'all') {
      this.index = this.order.length - 1;
    }
    return this.current;
  }
}
