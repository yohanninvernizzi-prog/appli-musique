import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, View } from 'react-native';
import { engine } from '../audio/engine';
import type { Playlist, Track } from '../core/types';
import {
  addToPlaylist, createPlaylist, deletePlaylist, deleteTrack, getPlaylistTrackIds, listPlaylists, listTracks, removeFromPlaylist, updatePlaylist,
} from '../db/repo';
import { getSource } from '../sources/registry';
import { Body, Button, Card, Field, Icon, IconButton, Muted, Notice, Row, Screen, Segmented, Title } from '../ui/components';
import { formatTime, useEngine, useLoad } from '../ui/hooks';
import { colors, radius, space } from '../ui/theme';

type View_ = 'tracks' | 'playlists';

const matches = (t: Track, query: string) => t.title.toLowerCase().includes(query.trim().toLowerCase());

export default function Music() {
  const [view, setView] = useState<View_>('tracks');
  const [tracks, reloadTracks] = useLoad<Track[]>(() => listTracks('music'), []);
  const [playlists, reloadPlaylists] = useLoad<Playlist[]>(listPlaylists, []);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = playlists.find((p) => p.id === openId) ?? null;

  if (open) {
    return (
      <Screen scroll={false}>
        <PlaylistDetail
          key={open.id}
          playlist={open}
          library={tracks}
          onBack={() => setOpenId(null)}
          onChanged={async () => { await reloadPlaylists(); await engine.reload(); }}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <Title subtitle={`${tracks.length} titre${tracks.length > 1 ? 's' : ''} sur cette tablette`}>Musique</Title>
      <Segmented value={view} onChange={setView} options={[{ value: 'tracks', label: 'Titres' }, { value: 'playlists', label: 'Playlists' }]} />
      {view === 'tracks' ? (
        <TrackList tracks={tracks} onChanged={async () => { await reloadTracks(); await engine.reload(); }} />
      ) : (
        <PlaylistList playlists={playlists} onOpen={setOpenId} onChanged={async () => { await reloadPlaylists(); await engine.reload(); }} />
      )}
    </Screen>
  );
}

function TrackList({ tracks, onChanged }: { tracks: Track[]; onChanged: () => Promise<void> }) {
  const s = useEngine();
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const shown = useMemo(() => (query.trim() ? tracks.filter((t) => matches(t, query)) : tracks), [tracks, query]);

  async function importFiles() {
    setBusy(true);
    try {
      const added = await getSource('local')!.importTracks({ kind: 'music' });
      await onChanged();
      if (added.length) Alert.alert('Import terminé', `${added.length} titre${added.length > 1 ? 's ajoutés' : ' ajouté'}.`);
    } catch (e) {
      Alert.alert('Import impossible', String(e));
    } finally {
      setBusy(false);
    }
  }

  function remove(t: Track) {
    Alert.alert('Supprimer ce titre ?', `« ${t.title} » sera retiré de la tablette et des playlists.`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          await getSource(t.source)?.remove(t);
          await deleteTrack(t.id);
          await onChanged();
        },
      },
    ]);
  }

  return (
    <>
      <Row style={{ flexWrap: 'nowrap' }}>
        <View style={{ flex: 1 }}>
          <Field value={query} onChangeText={setQuery} placeholder="Rechercher un titre" autoCorrect={false} />
        </View>
        <Button label={busy ? 'Import…' : 'Importer'} icon="add" kind="primary" onPress={importFiles} disabled={busy} />
      </Row>
      <FlatList
        data={shown}
        keyExtractor={(t) => t.id}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: space.xl }}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.border }} />}
        ListEmptyComponent={
          tracks.length === 0
            ? <Notice>Touchez « Importer » pour choisir vos fichiers audio (MP3, M4A, WAV, FLAC…). Vous pouvez en sélectionner plusieurs à la fois.</Notice>
            : <Muted>Aucun titre ne correspond à « {query} ».</Muted>
        }
        renderItem={({ item }) => {
          const playingThis = s.announcement?.id === item.id;
          return (
            <Row style={{ flexWrap: 'nowrap', gap: space.md, minHeight: 60 }}>
              <IconButton icon={playingThis ? 'stop' : 'play'} label={playingThis ? "Arrêter l'écoute" : `Écouter ${item.title}`} size={40} onPress={() => (playingThis ? engine.stopPreview() : engine.preview(item))} />
              <View style={{ flex: 1 }}>
                <Body numberOfLines={1} style={{ fontWeight: '600' }}>{item.title}</Body>
                {item.durationMs ? <Muted>{formatTime(item.durationMs)}</Muted> : null}
              </View>
              <IconButton icon="trash-outline" label={`Supprimer ${item.title}`} kind="danger" size={40} onPress={() => remove(item)} />
            </Row>
          );
        }}
      />
    </>
  );
}

function PlaylistList({ playlists, onOpen, onChanged }: { playlists: Playlist[]; onOpen: (id: string) => void; onChanged: () => Promise<void> }) {
  const s = useEngine();
  const [name, setName] = useState('');
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    void Promise.all(playlists.map(async (p) => [p.id, (await getPlaylistTrackIds(p.id)).length] as const)).then((entries) => {
      if (!cancelled) setCounts(Object.fromEntries(entries));
    });
    return () => { cancelled = true; };
  }, [playlists]);

  async function create() {
    const n = name.trim();
    if (!n) return;
    const p = await createPlaylist(n);
    setName('');
    await onChanged();
    onOpen(p.id);
  }

  return (
    <>
      <Row style={{ flexWrap: 'nowrap' }}>
        <View style={{ flex: 1 }}>
          <Field value={name} onChangeText={setName} placeholder="Nom de la nouvelle playlist" onSubmitEditing={create} />
        </View>
        <Button label="Créer" icon="add" kind="primary" onPress={create} disabled={!name.trim()} />
      </Row>
      <FlatList
        data={playlists}
        keyExtractor={(p) => p.id}
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: space.md, paddingBottom: space.xl }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<Notice>Une playlist regroupe des titres (par exemple « Matin calme » ou « Été »). Choisissez ensuite sur l'écran Radio laquelle diffuser.</Notice>}
        renderItem={({ item }) => (
          <Pressable accessibilityRole="button" onPress={() => onOpen(item.id)} style={({ pressed }) => pressed && { opacity: 0.7 }}>
            <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="musical-notes" color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Body numberOfLines={1} style={{ fontWeight: '700', fontSize: 16 }}>{item.name}</Body>
                <Muted>
                  {counts[item.id] ?? 0} titre{(counts[item.id] ?? 0) > 1 ? 's' : ''}
                  {s.sourceId === item.id ? ' · diffusée par la radio' : ''}
                </Muted>
              </View>
              <Icon name="chevron-forward" color={colors.muted} />
            </Card>
          </Pressable>
        )}
      />
    </>
  );
}

function PlaylistDetail({ playlist, library, onBack, onChanged }: {
  playlist: Playlist; library: Track[]; onBack: () => void; onChanged: () => Promise<void>;
}) {
  const s = useEngine();
  const [name, setName] = useState(playlist.name);
  const [members, setMembers] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const shown = useMemo(() => (query.trim() ? library.filter((t) => matches(t, query)) : library), [library, query]);
  const isSource = s.sourceId === playlist.id;

  useEffect(() => {
    void getPlaylistTrackIds(playlist.id).then((ids) => setMembers(new Set(ids)));
  }, [playlist.id]);

  async function toggle(t: Track) {
    const next = new Set(members);
    if (next.has(t.id)) {
      next.delete(t.id);
      await removeFromPlaylist(playlist.id, t.id);
    } else {
      next.add(t.id);
      await addToPlaylist(playlist.id, [t.id]);
    }
    setMembers(next);
  }

  async function rename() {
    const n = name.trim();
    if (n && n !== playlist.name) {
      await updatePlaylist(playlist.id, { name: n });
      await onChanged();
    }
  }

  function remove() {
    Alert.alert('Supprimer la playlist ?', `« ${playlist.name} » sera supprimée. Les titres restent sur la tablette.`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          await deletePlaylist(playlist.id);
          if (isSource) await engine.setSource('all');
          await onChanged();
          onBack();
        },
      },
    ]);
  }

  return (
    <>
      <Row style={{ flexWrap: 'nowrap' }}>
        <IconButton icon="arrow-back" label="Retour aux playlists" onPress={async () => { await rename(); await onChanged(); onBack(); }} />
        <View style={{ flex: 1 }}>
          <Field value={name} onChangeText={setName} onBlur={rename} onSubmitEditing={rename} placeholder="Nom de la playlist" style={{ fontSize: 18, fontWeight: '700' }} />
        </View>
        <IconButton icon="trash-outline" label="Supprimer la playlist" kind="danger" onPress={remove} />
      </Row>
      <Row style={{ justifyContent: 'space-between' }}>
        <Muted>{members.size} titre{members.size > 1 ? 's' : ''} sur {library.length} · touchez un titre pour l'ajouter ou le retirer</Muted>
      </Row>
      {isSource ? (
        <Notice icon="radio-outline">Cette playlist est celle que la radio diffuse.</Notice>
      ) : (
        <Button label="Diffuser cette playlist à la radio" icon="radio-outline" onPress={() => engine.setSource(playlist.id)} disabled={members.size === 0} />
      )}
      <Field value={query} onChangeText={setQuery} placeholder="Rechercher un titre" autoCorrect={false} />
      <FlatList
        data={shown}
        keyExtractor={(t) => t.id}
        extraData={members}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: space.xl }}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.border }} />}
        ListEmptyComponent={library.length === 0 ? <Notice>Importez d'abord des titres dans l'onglet « Titres ».</Notice> : <Muted>Aucun titre ne correspond à « {query} ».</Muted>}
        renderItem={({ item }) => {
          const inList = members.has(item.id);
          return (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: inList }}
              onPress={() => toggle(item)}
              style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56 }, pressed && { opacity: 0.6 }]}
            >
              <Icon name={inList ? 'checkmark-circle' : 'ellipse-outline'} size={26} color={inList ? colors.accent : colors.border} />
              <Body numberOfLines={1} style={{ flex: 1, fontWeight: inList ? '600' : '400' }}>{item.title}</Body>
              {item.durationMs ? <Muted>{formatTime(item.durationMs)}</Muted> : null}
            </Pressable>
          );
        }}
      />
    </>
  );
}
