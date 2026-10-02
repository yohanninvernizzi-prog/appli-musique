import * as Linking from 'expo-linking';
import { useKeepAwake } from 'expo-keep-awake';
import { useState } from 'react';
import { Alert, Platform, Switch, Text } from 'react-native';
import { engine } from '../audio/engine';
import type { Playlist } from '../core/types';
import { getPlaylistTrackIds, getTracksByIds, listPlaylists, listTracks } from '../db/repo';
import { Button, Card, Chip, Muted, Row, Screen, Title } from '../ui/components';
import { formatClock, useEngine, useLoad } from '../ui/hooks';
import { colors } from '../ui/theme';

function KeepAwake() {
  useKeepAwake();
  return null;
}

export default function Radio() {
  const s = useEngine();
  const [playlists] = useLoad<Playlist[]>(listPlaylists, []);
  const [source, setSource] = useState<string>('all'); // 'all' ou id de playlist
  const [stayAwake, setStayAwake] = useState(false);

  async function start() {
    const playlist = playlists.find((p) => p.id === source);
    const ids = playlist ? await getPlaylistTrackIds(playlist.id) : null;
    const tracks = ids ? await getTracksByIds(ids) : await listTracks('music');
    if (tracks.length === 0) return Alert.alert('Rien à diffuser', 'Ajoutez des musiques à la bibliothèque (ou à la playlist choisie).');
    await engine.load(tracks, {
      label: playlist?.name ?? 'Toute la bibliothèque',
      playMode: playlist?.playMode ?? 'shuffle',
      repeatMode: playlist?.repeatMode ?? 'all',
    });
    await engine.startRadio();
  }

  function openBatterySettings() {
    if (Platform.OS !== 'android') return;
    Linking.sendIntent('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS').catch(() =>
      Linking.openSettings().catch(() => Alert.alert('Réglages indisponibles', "Ouvrez Réglages > Applications > Appli Musique > Batterie.")),
    );
  }

  return (
    <Screen>
      {stayAwake && <KeepAwake />}
      <Title>Mode radio</Title>
      <Muted>Diffusion continue avec annonces planifiées. Laissez la tablette branchée sur secteur pour un usage prolongé.</Muted>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>{s.radio ? 'Radio active' : 'Radio arrêtée'}</Text>
          <Switch value={s.radio} onValueChange={(v) => (v ? start() : engine.stopRadio())} />
        </Row>
        <Muted>Source musicale</Muted>
        <Row>
          <Chip label="Toute la bibliothèque (aléatoire)" active={source === 'all'} onPress={() => setSource('all')} />
          {playlists.map((p) => (
            <Chip key={p.id} label={p.name} active={source === p.id} onPress={() => setSource(p.id)} />
          ))}
        </Row>
        <Muted>
          {s.nextAnnouncement ? `Prochaine annonce : « ${s.nextAnnouncement.name} » à ${formatClock(s.nextAnnouncement.at)}` : 'Aucune annonce planifiée (voir l\'onglet Annonces).'}
        </Muted>
        <Muted>{s.current ? `En cours : ${s.current.title}` : 'Aucun titre chargé'}</Muted>
      </Card>

      <Card>
        <Text style={{ color: colors.text, fontWeight: '700' }}>Fiabilité écran éteint</Text>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={{ color: colors.text, flex: 1 }}>Garder l'écran allumé</Text>
          <Switch value={stayAwake} onValueChange={setStayAwake} />
        </Row>
        <Muted>Si l'annonce ne part pas écran éteint, autorisez l'application à ignorer l'optimisation de la batterie :</Muted>
        <Button label="Ouvrir les réglages batterie" onPress={openBatterySettings} />
      </Card>

      <Card>
        <Text style={{ color: colors.text, fontWeight: '700' }}>Journal</Text>
        {s.log.length === 0 && <Muted>Aucun événement.</Muted>}
        {s.log.map((l, i) => (
          <Text key={i} style={{ color: colors.muted, fontFamily: Platform.select({ android: 'monospace', default: 'Courier' }), fontSize: 12 }}>
            {l}
          </Text>
        ))}
      </Card>
    </Screen>
  );
}
