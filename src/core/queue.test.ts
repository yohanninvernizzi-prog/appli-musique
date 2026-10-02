import { describe, expect, it } from 'vitest';
import { PlayQueue, shuffled } from './queue';

const ids = ['a', 'b', 'c', 'd'];
const seeded = (seed = 1) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

describe('shuffled', () => {
  it('conserve tous les éléments et place first en tête', () => {
    const r = shuffled(ids, seeded(3), 'c');
    expect(r[0]).toBe('c');
    expect([...r].sort()).toEqual(ids);
  });
});

describe('PlayQueue linéaire', () => {
  it('parcourt dans l\'ordre puis s\'arrête sans répétition', () => {
    const q = new PlayQueue(ids, 'linear', 'off');
    expect(q.current).toBe('a');
    expect(q.advance()).toBe('b');
    expect(q.advance()).toBe('c');
    expect(q.advance()).toBe('d');
    expect(q.advance()).toBeNull();
  });
  it('boucle sur la playlist avec repeat all', () => {
    const q = new PlayQueue(ids, 'linear', 'all');
    for (let i = 0; i < 3; i++) q.advance();
    expect(q.current).toBe('d');
    expect(q.advance()).toBe('a');
  });
  it('boucle sur le titre avec repeat one, mais skipNext passe au suivant', () => {
    const q = new PlayQueue(ids, 'linear', 'one');
    expect(q.advance()).toBe('a');
    expect(q.advance()).toBe('a');
    expect(q.skipNext()).toBe('b');
  });
  it('démarre sur le titre demandé', () => {
    const q = new PlayQueue(ids, 'linear', 'off', Math.random, 'c');
    expect(q.current).toBe('c');
    expect(q.upcoming).toEqual(['d']);
  });
  it('précédent', () => {
    const q = new PlayQueue(ids, 'linear', 'off');
    q.skipNext();
    expect(q.skipPrevious()).toBe('a');
    expect(q.skipPrevious()).toBe('a');
    const all = new PlayQueue(ids, 'linear', 'all');
    expect(all.skipPrevious()).toBe('d');
  });
  it('liste vide', () => {
    const q = new PlayQueue([], 'linear', 'all');
    expect(q.current).toBeNull();
    expect(q.advance()).toBeNull();
  });
});

describe('PlayQueue aléatoire', () => {
  it('joue chaque titre une fois par cycle', () => {
    const q = new PlayQueue(ids, 'shuffle', 'all', seeded(7));
    const seen = [q.current!];
    for (let i = 0; i < 3; i++) seen.push(q.advance()!);
    expect([...seen].sort()).toEqual(ids);
  });
  it('ne rejoue pas le même titre à la jonction de deux cycles', () => {
    for (let s = 1; s < 40; s++) {
      const q = new PlayQueue(ids, 'shuffle', 'all', seeded(s));
      for (let i = 0; i < 3; i++) q.advance();
      const last = q.current;
      expect(q.advance()).not.toBe(last);
    }
  });
  it('setMode conserve le titre courant', () => {
    const q = new PlayQueue(ids, 'linear', 'off');
    q.skipNext();
    q.setMode('shuffle', 'all');
    expect(q.current).toBe('b');
    q.setMode('linear', 'off');
    expect(q.current).toBe('b');
    expect(q.upcoming).toEqual(['c', 'd']);
  });
  it('jumpTo met le titre en tête', () => {
    const q = new PlayQueue(ids, 'shuffle', 'off', seeded(2));
    expect(q.jumpTo('d')).toBe(true);
    expect(q.current).toBe('d');
    expect(q.jumpTo('zzz')).toBe(false);
  });
});
