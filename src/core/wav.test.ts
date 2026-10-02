import { describe, expect, it } from 'vitest';
import { silentWav } from './wav';

describe('silentWav', () => {
  it('produit un WAV valide de la bonne taille', () => {
    const w = silentWav(1, 8000);
    expect(String.fromCharCode(...w.slice(0, 4))).toBe('RIFF');
    expect(String.fromCharCode(...w.slice(8, 12))).toBe('WAVE');
    expect(w.length).toBe(44 + 8000);
    expect(new DataView(w.buffer).getUint32(4, true)).toBe(w.length - 8);
    expect(w[44]).toBe(128);
  });
});
