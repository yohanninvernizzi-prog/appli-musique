import type { Track } from '../core/types';

/**
 * Une source de musique : fichiers locaux aujourd'hui, catalogue cloud ou
 * service tiers demain. Le lecteur ne connaît que cette interface : ajouter
 * une source revient à ajouter un module, sans toucher au lecteur.
 */
export interface MusicSource {
  /** Identifiant stable stocké dans `tracks.source`. */
  readonly id: string;
  readonly label: string;
  /** Importe des titres dans la bibliothèque (ouvre un sélecteur, télécharge, etc.). */
  importTracks(opts: { kind: Track['kind'] }): Promise<Track[]>;
  /** URI lisible par le lecteur pour ce titre (fichier local, URL signée, ...). */
  resolvePlayableUri(track: Track): Promise<string>;
  /** Supprime les données de la source associées à ce titre (fichier copié, cache). */
  remove(track: Track): Promise<void>;
}
