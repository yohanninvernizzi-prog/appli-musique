import { useState } from 'react';
import { Alert, FlatList, Text, View } from 'react-native';
import { engine } from '../audio/engine';
import type { Track, TrackKind } from '../core/types';
import { deleteTrack, listTracks, updateTrack } from '../db/repo';
import { getSource } from '../sources/registry';
import { Button, Card, Chip, Muted, Row, Screen, Title } from '../ui/components';
import { formatTime, useLoad } from '../ui/hooks';
import { colors, space } from '../ui/theme';

export default function Library() {
  const [kind, setKind] = useState<TrackKind>('music');
  const [tracks, reload] = useLoad<Track[]>(() => listTracks(), []);
  const [busy, setBusy] = useState(false);
  const shown = tracks.filter((t) => t.kind === kind);

  async function importFiles() {
    setBusy(true);
    try {
      const added = await getSource('local')!.importTracks({ kind });
      await reload();
      if (added.length) Alert.alert('Import terminé', `${added.length} fichier(s) ajouté(s).`);
    } catch (e) {
      Alert.alert('Import impossible', String(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(t: Track) {
    Alert.alert('Supprimer ?', `« ${t.title} » sera retiré de la bibliothèque et des playlists.`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          await getSource(t.source)?.remove(t);
          await deleteTrack(t.id);
          await reload();
          await engine.reloadRules();
        },
      },
    ]);
  }

  async function switchKind(t: Track) {
    await updateTrack(t.id, { kind: t.kind === 'music' ? 'jingle' : 'music' });
    await reload();
  }

  return (
    <Screen scroll={false}>
      <View style={{ padding: space.lg, gap: space.md, flex: 1 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Title>Bibliothèque</Title>
          <Button label={busy ? 'Import…' : `Importer des ${kind === 'music' ? 'musiques' : 'annonces'}`} kind="primary" onPress={importFiles} disabled={busy} />
        </Row>
        <Row>
          <Chip label={`Musiques (${tracks.filter((t) => t.kind === 'music').length})`} active={kind === 'music'} onPress={() => setKind('music')} />
          <Chip label={`Annonces (${tracks.filter((t) => t.kind === 'jingle').length})`} active={kind === 'jingle'} onPress={() => setKind('jingle')} />
        </Row>
        <FlatList
          data={shown}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ gap: space.sm }}
          ListEmptyComponent={<Muted>Aucun fichier. Utilisez « Importer » pour ajouter des MP3, M4A, WAV, FLAC…</Muted>}
          renderItem={({ item }) => (
            <Card>
              <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16 }}>{item.title}</Text>
              <Muted>
                {[item.artist, item.album, item.durationMs ? formatTime(item.durationMs) : null, item.license].filter(Boolean).join(' · ') || item.sourceRef || ''}
              </Muted>
              <Row>
                {item.kind === 'music' && (
                  <Button label="Écouter" onPress={() => engine.load([item], { label: item.title, playMode: 'linear', repeatMode: 'off' })} />
                )}
                <Button label={item.kind === 'music' ? 'Passer en annonce' : 'Passer en musique'} onPress={() => switchKind(item)} />
                <Button label="Supprimer" kind="danger" onPress={() => remove(item)} />
              </Row>
            </Card>
          )}
        />
      </View>
    </Screen>
  );
}
