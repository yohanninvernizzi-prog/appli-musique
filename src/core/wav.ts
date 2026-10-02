/** Construit un WAV mono 8 bits de silence (octets sans en-tête de fichier externe). */
export function silentWav(seconds = 1, sampleRate = 8000): Uint8Array {
  const samples = Math.max(1, Math.round(seconds * sampleRate));
  const buf = new Uint8Array(44 + samples);
  const view = new DataView(buf.buffer);
  const ascii = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) buf[off + i] = s.charCodeAt(i);
  };
  ascii(0, 'RIFF');
  view.setUint32(4, 36 + samples, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true); // taille du bloc fmt
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true); // octets/s (8 bits mono)
  view.setUint16(32, 1, true); // alignement
  view.setUint16(34, 8, true); // bits par échantillon
  ascii(36, 'data');
  view.setUint32(40, samples, true);
  buf.fill(128, 44); // 128 = silence en PCM 8 bits non signé
  return buf;
}
