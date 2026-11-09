import { describe, expect, it } from 'vitest';
import {
  adIndexFor, isAdTime, isOpen, nextAdTime, nextBoundary, nextClockMultiple, ProgramRunner, slotError,
  type OpeningSlot, type Override, type ProgramConfig,
} from './program';

// Semaine d'exemple : lundi 17h-19h30, mardi 12h-13h et 17h-19h30, mercredi 14h-19h30.
const WEEK: OpeningSlot[] = [
  { id: 'lun', day: 1, startMin: 17 * 60, endMin: 19 * 60 + 30 },
  { id: 'mar1', day: 2, startMin: 12 * 60, endMin: 13 * 60 },
  { id: 'mar2', day: 2, startMin: 17 * 60, endMin: 19 * 60 + 30 },
  { id: 'mer', day: 3, startMin: 14 * 60, endMin: 19 * 60 + 30 },
];

// Octobre 2026 : le 5 est un lundi, le 6 un mardi, le 7 un mercredi.
const at = (day: number, h: number, m: number, s = 0) => new Date(2026, 9, day, h, m, s);

describe('isOpen', () => {
  it('début inclus, fin exclue', () => {
    expect(isOpen(WEEK, at(5, 16, 59, 59))).toBe(false);
    expect(isOpen(WEEK, at(5, 17, 0))).toBe(true);
    expect(isOpen(WEEK, at(5, 19, 29, 59))).toBe(true);
    expect(isOpen(WEEK, at(5, 19, 30))).toBe(false);
  });
  it('deux plages le même jour', () => {
    expect(isOpen(WEEK, at(6, 12, 30))).toBe(true);
    expect(isOpen(WEEK, at(6, 15, 0))).toBe(false);
    expect(isOpen(WEEK, at(6, 18, 0))).toBe(true);
  });
  it('jour sans plage', () => {
    expect(isOpen(WEEK, at(8, 18, 0))).toBe(false);
    expect(isOpen([], at(5, 18, 0))).toBe(false);
  });
});

describe('nextBoundary', () => {
  it('prochaine ouverture quand c\'est fermé', () => {
    expect(nextBoundary(WEEK, at(5, 10, 0))).toEqual({ at: at(5, 17, 0), opens: true });
    expect(nextBoundary(WEEK, at(6, 13, 0))).toEqual({ at: at(6, 17, 0), opens: true });
  });
  it('prochaine fermeture quand c\'est ouvert', () => {
    expect(nextBoundary(WEEK, at(6, 12, 0))).toEqual({ at: at(6, 13, 0), opens: false });
  });
  it('passe à la semaine suivante', () => {
    expect(nextBoundary(WEEK, at(7, 20, 0))).toEqual({ at: at(12, 17, 0), opens: true });
  });
  it('fusionne deux plages qui se touchent, y compris à minuit', () => {
    const slots: OpeningSlot[] = [
      { id: 'a', day: 1, startMin: 22 * 60, endMin: 24 * 60 },
      { id: 'b', day: 2, startMin: 0, endMin: 60 },
    ];
    expect(nextBoundary(slots, at(5, 23, 0))).toEqual({ at: at(6, 1, 0), opens: false });
  });
  it('aucune plage : null', () => {
    expect(nextBoundary([], at(5, 10, 0))).toBeNull();
  });
});

describe('publicités', () => {
  it('cale sur l\'horloge', () => {
    expect(nextClockMultiple(15, at(5, 17, 7))).toEqual(at(5, 17, 15));
    expect(nextClockMultiple(15, at(5, 17, 15))).toEqual(at(5, 17, 30));
    expect(nextClockMultiple(20, at(5, 23, 50))).toEqual(at(6, 0, 0));
  });
  it('pas de publicité à l\'instant de l\'ouverture ni après la fermeture', () => {
    expect(isAdTime(WEEK, at(5, 17, 0))).toBe(false);
    expect(isAdTime(WEEK, at(5, 17, 15))).toBe(true);
    expect(isAdTime(WEEK, at(5, 19, 30))).toBe(false);
  });
  it('prochaine publicité pendant et hors horaires', () => {
    expect(nextAdTime(WEEK, 15, at(5, 17, 2))).toEqual(at(5, 17, 15));
    expect(nextAdTime(WEEK, 15, at(5, 19, 15))).toEqual(at(6, 12, 15));
    expect(nextAdTime(WEEK, 30, at(6, 12, 30))).toEqual(at(6, 17, 30));
    expect(nextAdTime(WEEK, 15, at(8, 9, 0))).toEqual(at(12, 17, 15));
    expect(nextAdTime([], 15, at(5, 9, 0))).toBeNull();
  });
  it('les publicités passent à tour de rôle', () => {
    const a = adIndexFor(at(5, 17, 15), 15, 3);
    const b = adIndexFor(at(5, 17, 30), 15, 3);
    const c = adIndexFor(at(5, 17, 45), 15, 3);
    expect(new Set([a, b, c]).size).toBe(3);
    expect(b).toBe((a + 1) % 3);
    expect(adIndexFor(at(5, 18, 0), 15, 3)).toBe(a);
    expect(adIndexFor(at(5, 18, 0), 15, 0)).toBe(-1);
  });
});

describe('slotError', () => {
  it('refuse une plage inversée ou qui en chevauche une autre', () => {
    expect(slotError(WEEK, { id: 'x', day: 4, startMin: 600, endMin: 600 })).not.toBeNull();
    expect(slotError(WEEK, { id: 'x', day: 2, startMin: 12 * 60 + 30, endMin: 14 * 60 })).not.toBeNull();
    expect(slotError(WEEK, { id: 'x', day: 2, startMin: 13 * 60, endMin: 14 * 60 })).toBeNull();
    // Modifier une plage existante ne la fait pas entrer en conflit avec elle-même.
    expect(slotError(WEEK, { id: 'lun', day: 1, startMin: 16 * 60, endMin: 19 * 60 })).toBeNull();
  });
});

describe('ProgramRunner', () => {
  function harness(start: Date, config: Partial<ProgramConfig> = {}) {
    let nowMs = start.getTime();
    let timer: { fn: () => void; at: number } | null = null;
    const cfg: ProgramConfig = { slots: WEEK, intervalMin: 15, auto: true, ...config };
    const events: string[] = [];
    const hm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const runner = new ProgramRunner({
      getConfig: () => cfg,
      onAirChange: (on) => events.push(`${on ? 'on' : 'off'}@${hm(new Date(nowMs))}`),
      onAd: (slot, late) => events.push(`ad@${hm(slot)}+${Math.round(late / 1000)}`),
      onGap: (ms) => events.push(`gap:${Math.round(ms / 60_000)}min`),
      now: () => new Date(nowMs),
      setTimer: (fn, ms) => (timer = { fn, at: nowMs + ms }),
      clearTimer: () => (timer = null),
    });
    /** Avance le temps en exécutant les réveils à l'heure. */
    const runUntil = (end: Date) => {
      while (timer && timer.at <= end.getTime()) {
        const t = timer;
        timer = null;
        nowMs = t.at;
        t.fn();
      }
      nowMs = end.getTime();
    };
    /** Simule une mise en veille : le temps passe, puis le réveil en attente s'exécute en retard. */
    const sleepUntil = (end: Date) => {
      nowMs = end.getTime();
      const t = timer;
      timer = null;
      t?.fn();
    };
    return { runner, events, cfg, runUntil, sleepUntil, setOverride: (o: Override) => runner.setOverride(o) };
  }

  it('démarre à l\'ouverture, passe les publicités, coupe à la fermeture', () => {
    const h = harness(at(5, 16, 50));
    h.runner.start();
    h.runUntil(at(5, 20, 0));
    expect(h.events).toEqual([
      'on@17:00',
      'ad@17:15+0', 'ad@17:30+0', 'ad@17:45+0', 'ad@18:00+0', 'ad@18:15+0', 'ad@18:30+0', 'ad@18:45+0', 'ad@19:00+0', 'ad@19:15+0',
      'off@19:30',
    ]);
  });

  it('gère deux plages dans la journée', () => {
    const h = harness(at(6, 11, 0), { intervalMin: 30 });
    h.runner.start();
    h.runUntil(at(6, 23, 0));
    expect(h.events).toEqual([
      'on@12:00', 'ad@12:30+0', 'off@13:00',
      'on@17:00', 'ad@17:30+0', 'ad@18:00+0', 'ad@18:30+0', 'ad@19:00+0', 'off@19:30',
    ]);
  });

  it('lancée pendant les horaires, démarre tout de suite sans publicité immédiate', () => {
    const h = harness(at(5, 17, 15));
    h.runner.start();
    expect(h.events).toEqual(['on@17:15']);
    h.runUntil(at(5, 17, 31));
    expect(h.events).toEqual(['on@17:15', 'ad@17:30+0']);
  });

  it('mode automatique désactivé : rien ne démarre', () => {
    const h = harness(at(5, 16, 50), { auto: false });
    h.runner.start();
    h.runUntil(at(5, 20, 0));
    expect(h.events).toEqual([]);
    expect(h.runner.nextAd()).toBeNull();
  });

  it('après une courte veille, joue la publicité manquée une seule fois et signale le trou', () => {
    const h = harness(at(5, 17, 1));
    h.runner.start();
    h.runUntil(at(5, 17, 14));
    h.sleepUntil(at(5, 17, 16)); // réveil 1 min après le créneau de 17:15
    h.runUntil(at(5, 17, 20));
    expect(h.events).toEqual(['on@17:01', 'gap:2min', 'ad@17:15+60']);
  });

  it('après une longue veille, abandonne les publicités trop anciennes', () => {
    const h = harness(at(5, 17, 1));
    h.runner.start();
    h.runUntil(at(5, 17, 14));
    h.sleepUntil(at(5, 18, 10)); // 17:15 à 18:00 manqués, trop vieux
    h.runUntil(at(5, 18, 16));
    expect(h.events).toEqual(['on@17:01', 'gap:56min', 'ad@18:15+0']);
  });

  it('une veille à cheval sur la fermeture coupe l\'antenne au réveil', () => {
    const h = harness(at(5, 19, 20));
    h.runner.start();
    h.sleepUntil(at(5, 21, 0));
    expect(h.events.at(-1)).toBe('off@21:00');
    expect(h.runner.isOnAir).toBe(false);
  });

  it('forçage « diffuser maintenant » hors horaires, jusqu\'au prochain changement d\'horaire', () => {
    const h = harness(at(5, 10, 5));
    h.runner.start();
    h.setOverride('on');
    h.runUntil(at(5, 10, 31));
    expect(h.events).toEqual(['on@10:05', 'ad@10:15+0', 'ad@10:30+0']);
    h.runUntil(at(5, 17, 1));
    // À 17:00 le programme reprend la main : on reste à l'antenne, sans coupure.
    expect(h.runner.currentOverride).toBeNull();
    expect(h.runner.isOnAir).toBe(true);
    expect(h.events.filter((e) => e.startsWith('off'))).toEqual([]);
    h.runUntil(at(5, 19, 31));
    expect(h.events.at(-1)).toBe('off@19:30');
  });

  it('forçage « couper » pendant les horaires, puis reprise à l\'ouverture suivante', () => {
    const h = harness(at(6, 12, 10));
    h.runner.start();
    h.setOverride('off');
    h.runUntil(at(6, 16, 0));
    expect(h.events).toEqual(['on@12:10', 'off@12:10']);
    expect(h.runner.nextAd()).toEqual(at(6, 17, 15));
    h.runUntil(at(6, 17, 1));
    expect(h.events.at(-1)).toBe('on@17:00');
  });

  it('annuler un forçage revient à l\'état prévu par les horaires', () => {
    const h = harness(at(5, 10, 5));
    h.runner.start();
    h.setOverride('on');
    h.setOverride(null);
    expect(h.events).toEqual(['on@10:05', 'off@10:05']);
  });

  it('stop coupe l\'antenne et arrête les réveils', () => {
    const h = harness(at(5, 17, 5));
    h.runner.start();
    h.runner.stop();
    h.runUntil(at(5, 18, 0));
    expect(h.events).toEqual(['on@17:05', 'off@17:05']);
  });
});
