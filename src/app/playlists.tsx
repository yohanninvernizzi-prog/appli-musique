import { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { engine } from '../audio/engine';
import type { PlayMode, Playlist, RepeatMode, Track } from '../core/types';
import {
  addToPlaylist, createPlaylist, deletePlaylist, getPlaylistTrackIds, getTracksByIds, listPlaylists, listTracks,
  movePlaylistTrack, removeFromPlaylist, updatePlaylist,
} from '../db/repo';
import { Button, Card, Chip, Field, Muted, Row, Title } from '../ui/components';
import { useLoad } from '../ui/hooks';
import { colors, space } from '../ui/theme';

export default function Playlists() {
  const { width } = useWindowDimensions();
  const wide = width >= 800;
  const [playlists, reloadLists] = useLoad<Playlist[]>(listPlaylists, []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const selected = playlists.find((p) => p.id === selectedId) ?? null;

  useEffect(() => {
    if (selectedId && !playlists.some((p) => p.id === selectedId)) setSelectedId(null);
  }, [playlists, selectedId]);

  async function create() {
    const name = newName.trim();
    if (!name) return;
    const p = await createPlaylist(name);
    setNewName('');
    await reloadLists();
    setSelectedId(p.id);
  }

  const list = (
    <View style={{ gap: space.sm, flex: wide ? 0 : undefined, width: wide ? 300 : undefined }}>
      <Title>Playlists</Title>
      <Row>
        <View style={{ flex: 1, minWidth: 140 }}>
          <Field label="Nouvelle playlist" value={newName} onChangeText={setNewName} placeholder="Nom" onSubmitEditing={create} />
        </View>
        <Button label="Créer" kind="primary" onPress={create} style={{ marginTop: 20 }} />
      </Row>
      {playlists.length === 0 && <Muted>Aucune playlist pour l'instant.</Muted>}
      {playlists.map((p) => (
        <Chip key={p.id} label={p.name} active={p.id === selectedId} onPress={() => setSelectedId(p.id)} />
      ))}
    </View>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: space.lg, gap: space.lg, flexDirection: wide ? 'row' : 'column', alignItems: 'flex-start' }}>
      {list}
      <View style={{ flex: wide ? 1 : undefined, alignSelf: 'stretch', gap: space.md }}>
        {selected ? (
          <PlaylistDetail key={selected.id} playlist={selected} onChanged={reloadLists} />
        ) : (
          <Muted>Sélectionnez ou créez une playlist.</Muted>
        )}
      </View>
    </ScrollView>
  );
}

function PlaylistDetail({ playlist, onChanged }: { playlist: Playlist; onChanged: () => Promise<void> }) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [library, setLibrary] = useState<Track[]>([]);
  const [picking, setPicking] = useState(false);
  const [name, setName] = useState(playlist.name);

  async function refresh() {
    const ids = await getPlaylistTrackIds(playlist.id);
    setTracks(await getTracksByIds(ids));
  }
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlist.id]);

  async function openPicker() {
    setLibrary(await listTracks('music'));
    setPicking(true);
  }

  async function play(startId?: string) {
    if (tracks.length === 0) return;
    await engine.load(tracks, { label: playlist.name, playMode: playlist.playMode, repeatMode: playlist.repeatMode, startId });
  }

  async function setModes(playMode: PlayMode, repeatMode: RepeatMode) {
    await updatePlaylist(playlist.id, { playMode, repeatMode });
    await onChanged();
  }

  async function rename() {
    const n = name.trim();
    if (n && n !== playlist.name) {
      await updatePlaylist(playlist.id, { name: n });
      await onChanged();
    }
  }

  function remove() {
    Alert.alert('Supprimer la playlist ?', playlist.name, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => { await deletePlaylist(playlist.id); await onChanged(); } },
    ]);
  }

  return (
    <View style={{ gap: space.md }}>
      <Row>
        <View style={{ flex: 1, minWidth: 160 }}>
          <Field label="Nom" value={name} onChangeText={setName} onBlur={rename} onSubmitEditing={rename} />
        </View>
      </Row>
      <Row>
        <Button label="Lire" kind="primary" onPress={() => play()} disabled={tracks.length === 0} />
        <Chip label="Linéaire" active={playlist.playMode === 'linear'} onPress={() => setModes('linear', playlist.repeatMode)} />
        <Chip label="Aléatoire" active={playlist.playMode === 'shuffle'} onPress={() => setModes('shuffle', playlist.repeatMode)} />
        <Chip label="Sans boucle" active={playlist.repeatMode === 'off'} onPress={() => setModes(playlist.playMode, 'off')} />
        <Chip label="Boucle playlist" active={playlist.repeatMode === 'all'} onPress={() => setModes(playlist.playMode, 'all')} />
        <Chip label="Boucle titre" active={playlist.repeatMode === 'one'} onPress={() => setModes(playlist.playMode, 'one')} />
      </Row>
      <Row>
        <Button label={picking ? 'Terminer' : 'Ajouter des titres'} onPress={() => (picking ? setPicking(false) : openPicker())} />
        <Button label="Supprimer la playlist" kind="danger" onPress={remove} />
      </Row>

      {picking && (
        <Card>
          <Muted>Touchez un titre pour l'ajouter à la playlist.</Muted>
          {library.length === 0 && <Muted>La bibliothèque ne contient aucune musique.</Muted>}
          {library.map((t) => {
            const inList = tracks.some((x) => x.id === t.id);
            return (
              <Row key={t.id} style={{ justifyContent: 'space-between' }}>
                <Text style={{ color: colors.text, flex: 1 }}>{t.title}</Text>
                <Button label={inList ? 'Déjà ajouté' : 'Ajouter'} disabled={inList} onPress={async () => { await addToPlaylist(playlist.id, [t.id]); await refresh(); }} />
              </Row>
            );
          })}
        </Card>
      )}

      {tracks.length === 0 && !picking && <Muted>Playlist vide.</Muted>}
      {tracks.map((t, i) => (
        <Card key={t.id}>
          <Text style={{ color: colors.text, fontWeight: '600' }}>{i + 1}. {t.title}</Text>
          <Row>
            <Button label="Lire d'ici" onPress={() => play(t.id)} />
            <Button label="↑" onPress={async () => { await movePlaylistTrack(playlist.id, t.id, -1); await refresh(); }} disabled={i === 0} />
            <Button label="↓" onPress={async () => { await movePlaylistTrack(playlist.id, t.id, 1); await refresh(); }} disabled={i === tracks.length - 1} />
            <Button label="Retirer" kind="danger" onPress={async () => { await removeFromPlaylist(playlist.id, t.id); await refresh(); }} />
          </Row>
        </Card>
      ))}
    </View>
  );
}
