import { randomUUID } from 'expo-crypto';
import type { OpeningSlot } from '../core/program';
import type { PlayMode, Playlist, RepeatMode, Track, TrackKind } from '../core/types';
import { getDb } from './database';

const now = () => Date.now();

type TrackRow = {
  id: string; title: string; artist: string | null; album: string | null; duration_ms: number | null;
  file_uri: string; source: string; source_ref: string | null; license: string | null; kind: string; enabled: number;
};

const toTrack = (r: TrackRow): Track => ({
  id: r.id, title: r.title, artist: r.artist, album: r.album, durationMs: r.duration_ms,
  fileUri: r.file_uri, source: r.source, sourceRef: r.source_ref, license: r.license, kind: r.kind as TrackKind, enabled: !!r.enabled,
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
    `INSERT INTO tracks (id,title,artist,album,duration_ms,file_uri,source,source_ref,license,kind,enabled,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    id, t.title, t.artist, t.album, t.durationMs, t.fileUri, t.source, t.sourceRef, t.license, t.kind, t.enabled ? 1 : 0, ts, ts,
  );
  return { ...t, id };
}

export async function updateTrack(id: string, patch: Partial<Pick<Track, 'title' | 'artist' | 'album' | 'kind' | 'license' | 'durationMs' | 'enabled'>>): Promise<void> {
  const db = await getDb();
  const cur = await db.getFirstAsync<TrackRow>('SELECT * FROM tracks WHERE id = ?', id);
  if (!cur) return;
  const next = { ...toTrack(cur), ...patch };
  await db.runAsync(
    'UPDATE tracks SET title=?, artist=?, album=?, kind=?, license=?, duration_ms=?, enabled=?, updated_at=? WHERE id=?',
    next.title, next.artist, next.album, next.kind, next.license, next.durationMs, next.enabled ? 1 : 0, now(), id,
  );
}

export async function deleteTrack(id: string): Promise<void> {
  const db = await getDb();
  const ts = now();
  await db.runAsync('UPDATE tracks SET deleted_at=?, updated_at=? WHERE id=?', ts, ts, id);
  await db.runAsync('UPDATE playlist_tracks SET deleted_at=?, updated_at=? WHERE track_id=? AND deleted_at IS NULL', ts, ts, id);
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

// ---- Horaires d'ouverture ----

type SlotRow = { id: string; day: number; start_min: number; end_min: number };

export async function listSlots(): Promise<OpeningSlot[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<SlotRow>('SELECT * FROM opening_slots WHERE deleted_at IS NULL ORDER BY day, start_min');
  return rows.map((r) => ({ id: r.id, day: r.day, startMin: r.start_min, endMin: r.end_min }));
}

export async function saveSlot(slot: Omit<OpeningSlot, 'id'> & { id?: string }): Promise<OpeningSlot> {
  const db = await getDb();
  const ts = now();
  if (slot.id) {
    await db.runAsync('UPDATE opening_slots SET day=?, start_min=?, end_min=?, updated_at=? WHERE id=?', slot.day, slot.startMin, slot.endMin, ts, slot.id);
    return { ...slot, id: slot.id };
  }
  const id = randomUUID();
  await db.runAsync('INSERT INTO opening_slots (id,day,start_min,end_min,updated_at) VALUES (?,?,?,?,?)', id, slot.day, slot.startMin, slot.endMin, ts);
  return { ...slot, id };
}

export async function deleteSlot(id: string): Promise<void> {
  const db = await getDb();
  const ts = now();
  await db.runAsync('UPDATE opening_slots SET deleted_at=?, updated_at=? WHERE id=?', ts, ts, id);
}

// ---- Journal ----

export type LogEntry = { at: number; message: string };

export async function appendLog(entry: LogEntry): Promise<void> {
  const db = await getDb();
  await db.runAsync('INSERT INTO event_log (at,message) VALUES (?,?)', entry.at, entry.message);
}

/** Les entrées les plus récentes d'abord. */
export async function listLog(limit = 300): Promise<LogEntry[]> {
  const db = await getDb();
  return db.getAllAsync<LogEntry>('SELECT at, message FROM event_log ORDER BY id DESC LIMIT ?', limit);
}

/** Ne garde que les `keep` dernières entrées. */
export async function trimLog(keep = 1000): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM event_log WHERE id <= (SELECT MAX(id) FROM event_log) - ?', keep);
}

export async function clearLog(): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM event_log');
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
