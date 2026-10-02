export type TrackKind = 'music' | 'jingle';

export type Track = {
  id: string;
  title: string;
  artist: string | null;
  album: string | null;
  durationMs: number | null;
  fileUri: string;
  /** Provenance du titre : permet d'ajouter d'autres sources plus tard. */
  source: string;
  sourceRef: string | null;
  license: string | null;
  kind: TrackKind;
};

export type PlayMode = 'linear' | 'shuffle';
export type RepeatMode = 'off' | 'all' | 'one';

export type Playlist = {
  id: string;
  name: string;
  playMode: PlayMode;
  repeatMode: RepeatMode;
};

export type AnnouncementRule = {
  id: string;
  name: string;
  trackId: string;
  /** Intervalle en minutes ; les créneaux sont calés sur minuit (00:00, 00:15, ...). */
  intervalMin: number;
  /** Début et fin de la plage active, en minutes depuis minuit (fin exclue). */
  startMin: number;
  endMin: number;
  /** Jours actifs : bit 0 = dimanche ... bit 6 = samedi. */
  daysMask: number;
  fadeMs: number;
  volume: number;
  enabled: boolean;
  playWhenIdle: boolean;
};

export const ALL_DAYS = 0b1111111;
