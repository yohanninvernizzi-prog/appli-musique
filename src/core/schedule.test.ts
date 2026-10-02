import { describe, expect, it } from 'vitest';
import { AnnouncementScheduler, nextDue, nextOccurrence } from './schedule';
import { ALL_DAYS, type AnnouncementRule } from './types';

const rule = (over: Partial<AnnouncementRule> = {}): AnnouncementRule => ({
  id: 'r1',
  name: 'Annonce',
  trackId: 't1',
  intervalMin: 15,
  startMin: 0,
  endMin: 24 * 60,
  daysMask: ALL_DAYS,
  fadeMs: 2000,
  volume: 1,
  enabled: true,
  playWhenIdle: true,
  ...over,
});

const at = (h: number, m: number, s = 0, day = 6) => new Date(2026, 9, day, h, m, s); // 6 oct. 2026 (mardi)

describe('nextOccurrence', () => {
  it('cale les créneaux sur l\'horloge', () => {
    expect(nextOccurrence(rule(), at(10, 7))).toEqual(at(10, 15));
    expect(nextOccurrence(rule(), at(10, 15))).toEqual(at(10, 30));
    expect(nextOccurrence(rule({ intervalMin: 30 }), at(10, 31))).toEqual(at(11, 0));
  });
  it('respecte la plage horaire', () => {
    const r = rule({ startMin: 9 * 60, endMin: 18 * 60 });
    expect(nextOccurrence(r, at(8, 0))).toEqual(at(9, 0));
  });
  it('dernier créneau avant la fin de plage', () => {
    const r = rule({ startMin: 9 * 60, endMin: 18 * 60 });
    expect(nextOccurrence(r, at(17, 30))).toEqual(at(17, 45));
    expect(nextOccurrence(r, at(17, 45))).toEqual(new Date(2026, 9, 7, 9, 0));
  });
  it('respecte les jours actifs', () => {
    // mardi (2) exclu : on saute au mercredi
    const r = rule({ daysMask: ALL_DAYS & ~(1 << 2), intervalMin: 60 });
    expect(nextOccurrence(r, at(10, 0))).toEqual(new Date(2026, 9, 7, 0, 0));
  });
  it('règle désactivée ou sans jour : null', () => {
    expect(nextOccurrence(rule({ enabled: false }), at(10, 0))).toBeNull();
    expect(nextOccurrence(rule({ daysMask: 0 }), at(10, 0))).toBeNull();
  });
});

describe('nextDue', () => {
  it('choisit la règle la plus proche', () => {
    const a = rule({ id: 'a', intervalMin: 30 });
    const b = rule({ id: 'b', intervalMin: 15 });
    expect(nextDue([a, b], at(10, 1))?.rule.id).toBe('b');
    expect(nextDue([], at(10, 1))).toBeNull();
  });
});

describe('AnnouncementScheduler', () => {
  function harness(rules: AnnouncementRule[], start: Date) {
    let nowMs = start.getTime();
    const timers: { fn: () => void; at: number }[] = [];
    const fired: string[] = [];
    const s = new AnnouncementScheduler({
      getRules: () => rules,
      onDue: (r, slot) => fired.push(`${r.id}@${slot.getHours()}:${String(slot.getMinutes()).padStart(2, '0')}`),
      now: () => new Date(nowMs),
      setTimer: (fn, ms) => {
        const t = { fn, at: nowMs + ms };
        timers.push(t);
        return t;
      },
      clearTimer: (h) => {
        const i = timers.indexOf(h as (typeof timers)[number]);
        if (i >= 0) timers.splice(i, 1);
      },
    });
    const advanceTo = (d: Date) => {
      // Fait avancer le temps en exécutant les timers dans l'ordre.
      while (timers.length) {
        timers.sort((x, y) => x.at - y.at);
        const t = timers[0];
        if (t.at > d.getTime()) break;
        timers.shift();
        nowMs = t.at;
        t.fn();
      }
      nowMs = d.getTime();
    };
    const jump = (d: Date) => {
      // Simule une veille : le temps saute sans exécuter les timers intermédiaires, puis le réveil.
      nowMs = d.getTime();
      timers.sort((x, y) => x.at - y.at);
      const t = timers.shift();
      t?.fn();
    };
    return { s, fired, advanceTo, jump };
  }

  it('déclenche aux créneaux d\'horloge', () => {
    const h = harness([rule()], at(10, 1));
    h.s.start();
    h.advanceTo(at(10, 46));
    expect(h.fired).toEqual(['r1@10:15', 'r1@10:30', 'r1@10:45']);
    h.s.stop();
  });
  it('ne rejoue pas un créneau deux fois', () => {
    const h = harness([rule()], at(10, 14, 50));
    h.s.start();
    h.advanceTo(at(10, 16));
    expect(h.fired).toEqual(['r1@10:15']);
  });
  it('rattrape un créneau manqué de peu après une veille', () => {
    const h = harness([rule()], at(10, 1));
    h.s.start();
    h.jump(at(10, 15, 40)); // réveil 40 s après le créneau
    expect(h.fired).toEqual(['r1@10:15']);
  });
  it('ignore un créneau trop ancien', () => {
    const h = harness([rule()], at(10, 1));
    h.s.start();
    h.jump(at(10, 20)); // réveil 5 min après : trop tard
    expect(h.fired).toEqual([]);
  });
  it('stop empêche tout déclenchement', () => {
    const h = harness([rule()], at(10, 1));
    h.s.start();
    h.s.stop();
    h.advanceTo(at(11, 0));
    expect(h.fired).toEqual([]);
  });
  it('plusieurs règles sur le même créneau', () => {
    const h = harness([rule({ id: 'a' }), rule({ id: 'b', intervalMin: 30 })], at(10, 20));
    h.s.start();
    h.advanceTo(at(10, 31));
    expect(h.fired).toEqual(['a@10:30', 'b@10:30']);
  });
});
