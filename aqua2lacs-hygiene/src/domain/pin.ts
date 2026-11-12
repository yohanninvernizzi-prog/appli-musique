/**
 * Empreinte d'un code PIN pour le mode démo (données stockées sur l'appareil).
 * Ce n'est PAS une protection forte : elle évite seulement d'enregistrer le code en clair.
 * Avec Supabase, la vérification se fera côté serveur.
 */
export function hashPin(pin: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  const s = `a2l:${pin}`;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 + c, 0x85ebca6b) ^ (h2 >>> 13);
  }
  return (h1 >>> 0).toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0");
}
