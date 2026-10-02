import { randomUUID } from 'expo-crypto';
import type { AnnouncementRule, PlayMode, Playlist, RepeatMode, Track, TrackKind } from '../core/types';
import { getDb } from './database';

const now = () => Date.now();

type TrackRow = {
  id: string; title: string; artist: string | null; album: string | null; duration_ms: number | null;
  file_uri: string; source: string; source_ref: string | null; license: string | null; kind: string;
};

const toTrack = (r: TrackRow): Track => ({
  id: r.id, title: r.title, artist: r.artist, album: r.album, durationMs: r.duration_ms,
  fileUri: r.file_uri, source: r.source, sourceRef: r.source_ref, license: r.license, kind: r.kind as TrackKind,
});

export async function listTracks(kind?: TrackKind): Promise<Track[]> {
  const db = await getDb();
  const rows = kind
    ? await db.getAllAsync<TrackRow>('SELECT * FROM tracks WHERE deleted_at IS NULL AND kind = ? ORDER BY title COLLATE NOCASE', kind)
    : await db.getAllAsync<TrackRow>('SELECT * FROM tracks WHERE deleted_at IS NULL ORDER BY title COLLATE NOCASE');
  return rows.map(toTrack);
}

export async function getTracksByIds(ids: string[]): Promise<Track[]> {
  if (ids.length === 0) return [];
  const db = await getDb();
  const marks = ids.map(() => '?').join(',');
  const rows = await db.getAllAsync<TrackRow>(`SELECT * FROM tracks WHERE id IN (${marks})`, ids);
  const byId = new Map(rows.map((r) => [r.id, toTrack(r)]));
  return ids.map((id) => byId.get(id)).filter((t): t is Track => !!t);
}

export async function insertTrack(t: Omit<Track, 'id'>): Promise<Track> {
  const db = await getDb();
  const id = randomUUID();
  const ts = now();
  await db.runAsync(
    `INSERT INTO tracks (id,title,artist,album,duration_ms,file_uri,source,source_ref,license,kind,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    id, t.title, t.artist, t.album, t.durationMs, t.fileUri, t.source, t.sourceRef, t.license, t.kind, ts, ts,
  );
  return { ...t, id };
}

export async function updateTrack(id: string, patch: Partial<Pick<Track, 'title' | 'artist' | 'album' | 'kind' | 'license' | 'durationMs'>>): Promise<void> {
  const db = await getDb();
  const cur = await db.getFirstAsync<TrackRow>('SELECT * FROM tracks WHERE id = ?', id);
  if (!cur) return;
  const next = { ...toTrack(cur), ...patch };
  await db.runAsync(
    'UPDATE tracks SET title=?, artist=?, album=?, kind=?, license=?, duration_ms=?, updated_at=? WHERE id=?',
    next.title, next.artist, next.album, next.kind, next.license, next.durationMs, now(), id,
  );
}

export async function deleteTrack(id: string): Promise<void> {
  const db = await getDb();
  const ts = now();
  await db.runAsync('UPDATE tracks SET deleted_at=?, updated_at=? WHERE id=?', ts, ts, id);
  await db.runAsync('UPDATE playlist_tracks SET deleted_at=?, updated_at=? WHERE track_id=? AND deleted_at IS NULL', ts, ts, id);
  await db.runAsync('UPDATE announcement_rules SET enabled=0, updated_at=? WHERE track_id=? AND deleted_at IS NULL', ts, id);
}

// ---- Playlists ----

type PlaylistRow = { id: string; name: string; play_mode: string; repeat_mode: string };
const toPlaylist = (r: PlaylistRow): Playlist => ({ id: r.id, name: r.name, playMode: r.play_mode as PlayMode, repeatMode: r.repeat_mode as RepeatMode });

export async function listPlaylists(): Promise<Playlist[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<PlaylistRow>('SELECT * FROM playlists WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE');
  return rows.map(toPlaylist);
}

export async function createPlaylist(name: string): Promise<Playlist> {
  const db = await getDb();
  const id = randomUUID();
  const ts = now();
  await db.runAsync('INSERT INTO playlists (id,name,created_at,updated_at) VALUES (?,?,?,?)', id, name, ts, ts);
  return { id, name, playMode: 'linear', repeatMode: 'all' };
}

export async function updatePlaylist(id: string, patch: Partial<Omit<Playlist, 'id'>>): Promise<void> {
  const db = await getDb();
  const cur = await db.getFirstAsync<PlaylistRow>('SELECT * FROM playlists WHERE id=?', id);
  if (!cur) return;
  const next = { ...toPlaylist(cur), ...patch };
  await db.runAsync('UPDATE playlists SET name=?, play_mode=?, repeat_mode=?, updated_at=? WHERE id=?', next.name, next.playMode, next.repeatMode, now(), id);
}

export async function deletePlaylist(id: string): Promise<void> {
  const db = await getDb();
  const ts = now();
  await db.runAsync('UPDATE playlists SET deleted_at=?, updated_at=? WHERE id=?', ts, ts, id);
  await db.runAsync('UPDATE playlist_tracks SET deleted_at=?, updated_at=? WHERE playlist_id=? AND deleted_at IS NULL', ts, ts, id);
}

export async function getPlaylistTrackIds(playlistId: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ track_id: string }>(
    `SELECT pt.track_id FROM playlist_tracks pt
     JOIN tracks t ON t.id = pt.track_id AND t.deleted_at IS NULL
     WHERE pt.playlist_id=? AND pt.deleted_at IS NULL ORDER BY pt.position`, playlistId);
  return rows.map((r) => r.track_id);
}

export async function addToPlaylist(playlistId: string, trackIds: string[]): Promise<void> {
  const db = await getDb();
  const existing = await getPlaylistTrackIds(playlistId);
  const max = await db.getFirstAsync<{ m: number | null }>('SELECT MAX(position) AS m FROM playlist_tracks WHERE playlist_id=?', playlistId);
  let pos = (max?.m ?? -1) + 1;
  const ts = now();
  for (const trackId of trackIds) {
    if (existing.includes(trackId)) continue;
    await db.runAsync('INSERT INTO playlist_tracks (id,playlist_id,track_id,position,updated_at) VALUES (?,?,?,?,?)', randomUUID(), playlistId, trackId, pos++, ts);
  }
}

export async function removeFromPlaylist(playlistId: string, trackId: string): Promise<void> {
  const db = await getDb();
  const ts = now();
  await db.runAsync('UPDATE playlist_tracks SET deleted_at=?, updated_at=? WHERE playlist_id=? AND track_id=? AND deleted_at IS NULL', ts, ts, playlistId, trackId);
}

export async function movePlaylistTrack(playlistId: string, trackId: string, delta: -1 | 1): Promise<void> {
  const ids = await getPlaylistTrackIds(playlistId);
  const i = ids.indexOf(trackId);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  const db = await getDb();
  const ts = now();
  await db.withTransactionAsync(async () => {
    for (let p = 0; p < ids.length; p++) {
      await db.runAsync('UPDATE playlist_tracks SET position=?, updated_at=? WHERE playlist_id=? AND track_id=? AND deleted_at IS NULL', p, ts, playlistId, ids[p]);
    }
  });
}

// ---- Annonces ----

type RuleRow = {
  id: string; name: string; track_id: string; interval_min: number; start_min: number; end_min: number;
  days_mask: number; fade_ms: number; volume: number; enabled: number; play_when_idle: number;
};
const toRule = (r: RuleRow): AnnouncementRule => ({
  id: r.id, name: r.name, trackId: r.track_id, intervalMin: r.interval_min, startMin: r.start_min, endMin: r.end_min,
  daysMask: r.days_mask, fadeMs: r.fade_ms, volume: r.volume, enabled: !!r.enabled, playWhenIdle: !!r.play_when_idle,
});

export async function listRules(): Promise<AnnouncementRule[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<RuleRow>('SELECT * FROM announcement_rules WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE');
  return rows.map(toRule);
}

export async function saveRule(rule: Omit<AnnouncementRule, 'id'> & { id?: string }): Promise<AnnouncementRule> {
  const db = await getDb();
  const ts = now();
  const id = rule.id ?? randomUUID();
  const exists = rule.id ? await db.getFirstAsync('SELECT id FROM announcement_rules WHERE id=?', id) : null;
  if (exists) {
    await db.runAsync(
      `UPDATE announcement_rules SET name=?, track_id=?, interval_min=?, start_min=?, end_min=?, days_mask=?, fade_ms=?, volume=?, enabled=?, play_when_idle=?, deleted_at=NULL, updated_at=? WHERE id=?`,
      rule.name, rule.trackId, rule.intervalMin, rule.startMin, rule.endMin, rule.daysMask, rule.fadeMs, rule.volume, rule.enabled ? 1 : 0, rule.playWhenIdle ? 1 : 0, ts, id,
    );
  } else {
    await db.runAsync(
      `INSERT INTO announcement_rules (id,name,track_id,interval_min,start_min,end_min,days_mask,fade_ms,volume,enabled,play_when_idle,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      id, rule.name, rule.trackId, rule.intervalMin, rule.startMin, rule.endMin, rule.daysMask, rule.fadeMs, rule.volume, rule.enabled ? 1 : 0, rule.playWhenIdle ? 1 : 0, ts, ts,
    );
  }
  return { ...rule, id };
}

export async function deleteRule(id: string): Promise<void> {
  const db = await getDb();
  const ts = now();
  await db.runAsync('UPDATE announcement_rules SET deleted_at=?, updated_at=? WHERE id=?', ts, ts, id);
}

// ---- Réglages ----

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key=?', key);
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('INSERT INTO settings (key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at', key, value, now());
}
