/**
 * Migrations versionnées (PRAGMA user_version).
 * Chaque table synchronisable a : id (UUID), updated_at (ms) et deleted_at (suppression logique),
 * pour pouvoir fusionner proprement plusieurs appareils plus tard.
 */
export const MIGRATIONS: string[] = [
  // v1
  `
  CREATE TABLE tracks (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    artist TEXT,
    album TEXT,
    duration_ms INTEGER,
    file_uri TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'local',
    source_ref TEXT,
    license TEXT,
    kind TEXT NOT NULL DEFAULT 'music',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER
  );
  CREATE INDEX idx_tracks_kind ON tracks(kind, deleted_at);

  CREATE TABLE playlists (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    play_mode TEXT NOT NULL DEFAULT 'linear',
    repeat_mode TEXT NOT NULL DEFAULT 'all',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER
  );

  CREATE TABLE playlist_tracks (
    id TEXT PRIMARY KEY NOT NULL,
    playlist_id TEXT NOT NULL,
    track_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER
  );
  CREATE INDEX idx_playlist_tracks ON playlist_tracks(playlist_id, deleted_at, position);

  CREATE TABLE announcement_rules (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    track_id TEXT NOT NULL,
    interval_min INTEGER NOT NULL,
    start_min INTEGER NOT NULL DEFAULT 0,
    end_min INTEGER NOT NULL DEFAULT 1440,
    days_mask INTEGER NOT NULL DEFAULT 127,
    fade_ms INTEGER NOT NULL DEFAULT 2000,
    volume REAL NOT NULL DEFAULT 1,
    enabled INTEGER NOT NULL DEFAULT 1,
    play_when_idle INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER
  );

  CREATE TABLE settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
  `,
];
