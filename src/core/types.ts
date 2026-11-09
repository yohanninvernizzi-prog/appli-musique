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
  /** Pour une publicité : fait partie de la rotation. Sans effet sur une musique. */
  enabled: boolean;
};

export type PlayMode = 'linear' | 'shuffle';
export type RepeatMode = 'off' | 'all' | 'one';

export type Playlist = {
  id: string;
  name: string;
  playMode: PlayMode;
  repeatMode: RepeatMode;
};
