import { useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';
import { engine } from '../audio/engine';
import { ALL_DAYS, type AnnouncementRule, type Track } from '../core/types';
import { deleteRule, listRules, listTracks, saveRule } from '../db/repo';
import { Button, Card, Chip, Field, Muted, Row, Screen, Title } from '../ui/components';
import { formatHm, parseHm, useLoad } from '../ui/hooks';
import { colors, space } from '../ui/theme';

const DAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const PRESETS = [5, 10, 15, 30, 60];

type Draft = Omit<AnnouncementRule, 'id'> & { id?: string };

const emptyDraft = (trackId: string): Draft => ({
  name: 'Nouvelle annonce', trackId, intervalMin: 15, startMin: 0, endMin: 1440, daysMask: ALL_DAYS,
  fadeMs: 2000, volume: 1, enabled: true, playWhenIdle: true,
});

export default function Announcements() {
  const [rules, reload] = useLoad<AnnouncementRule[]>(listRules, []);
  const [audios, reloadAudios] = useLoad<Track[]>(() => listTracks(), []);
  const [draft, setDraft] = useState<Draft | null>(null);
  const trackName = (id: string) => audios.find((t) => t.id === id)?.title ?? '(audio supprimé)';

  async function commit(d: Draft) {
    if (d.intervalMin < 1) return Alert.alert('Intervalle invalide', 'Indiquez au moins 1 minute.');
    if (d.endMin <= d.startMin) return Alert.alert('Plage horaire invalide', "L'heure de fin doit être après l'heure de début.");
    if (d.daysMask === 0) return Alert.alert('Aucun jour sélectionné');
    await saveRule(d);
    setDraft(null);
    await reload();
    await engine.reloadRules();
  }

  async function toggle(r: AnnouncementRule, enabled: boolean) {
    await saveRule({ ...r, enabled });
    await reload();
    await engine.reloadRules();
  }

  async function remove(r: AnnouncementRule) {
    await deleteRule(r.id);
    await reload();
    await engine.reloadRules();
  }

  function startNew() {
    const first = audios.find((t) => t.kind === 'jingle') ?? audios[0];
    if (!first) return Alert.alert('Aucun audio', "Importez d'abord un audio dans la bibliothèque (onglet Annonces).");
    setDraft(emptyDraft(first.id));
  }

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <Title>Annonces récurrentes</Title>
        <Button label="Nouvelle règle" kind="primary" onPress={startNew} />
      </Row>
      <Muted>
        Les créneaux sont calés sur l'horloge (ex. 15 min : :00, :15, :30, :45). La musique s'éteint avec un fondu, l'annonce passe, puis la musique reprend toute seule.
      </Muted>

      {draft && <Editor draft={draft} audios={audios} onChange={setDraft} onSave={commit} onCancel={() => setDraft(null)} />}

      {rules.length === 0 && !draft && <Muted>Aucune règle pour l'instant.</Muted>}
      {rules.map((r) => (
        <Card key={r.id}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16, flex: 1 }}>{r.name}</Text>
            <Switch value={r.enabled} onValueChange={(v) => toggle(r, v)} />
          </Row>
          <Muted>
            « {trackName(r.trackId)} » · toutes les {r.intervalMin} min · {formatHm(r.startMin)}–{formatHm(r.endMin === 1440 ? 1440 : r.endMin)} ·{' '}
            {r.daysMask === ALL_DAYS ? 'tous les jours' : DAYS.filter((_, i) => r.daysMask & (1 << i)).join(' ')} · fondu {r.fadeMs / 1000}s
          </Muted>
          <Row>
            <Button label="Tester maintenant" onPress={() => engine.testAnnouncement(r)} />
            <Button label="Modifier" onPress={() => { void reloadAudios(); setDraft({ ...r }); }} />
            <Button label="Supprimer" kind="danger" onPress={() => remove(r)} />
          </Row>
        </Card>
      ))}
    </Screen>
  );
}

function Editor({ draft, audios, onChange, onSave, onCancel }: {
  draft: Draft; audios: Track[]; onChange: (d: Draft) => void; onSave: (d: Draft) => void; onCancel: () => void;
}) {
  const [start, setStart] = useState(formatHm(draft.startMin));
  const [end, setEnd] = useState(formatHm(draft.endMin));
  const [interval, setIntervalText] = useState(String(draft.intervalMin));
  const [fade, setFade] = useState(String(draft.fadeMs / 1000));
  const [volume, setVolume] = useState(String(Math.round(draft.volume * 100)));

  function save() {
    const startMin = parseHm(start);
    const endMin = parseHm(end);
    const intervalMin = Math.round(Number(interval));
    const fadeS = Number(fade.replace(',', '.'));
    const vol = Number(volume);
    if (startMin === null || endMin === null) return Alert.alert('Heure invalide', 'Format attendu : HH:MM (ex. 09:00).');
    if (!Number.isFinite(intervalMin) || intervalMin < 1) return Alert.alert('Intervalle invalide', 'Nombre de minutes, au moins 1.');
    if (!Number.isFinite(fadeS) || fadeS < 0 || fadeS > 30) return Alert.alert('Fondu invalide', 'Entre 0 et 30 secondes.');
    if (!Number.isFinite(vol) || vol < 0 || vol > 100) return Alert.alert('Volume invalide', 'Entre 0 et 100.');
    onSave({ ...draft, startMin, endMin, intervalMin, fadeMs: Math.round(fadeS * 1000), volume: vol / 100 });
  }

  return (
    <Card style={{ borderColor: colors.accent }}>
      <Field label="Nom" value={draft.name} onChangeText={(name) => onChange({ ...draft, name })} />

      <Muted>Audio à diffuser</Muted>
      <Row>
        {audios.map((t) => (
          <Chip key={t.id} label={`${t.kind === 'jingle' ? '📢 ' : '♪ '}${t.title}`} active={t.id === draft.trackId} onPress={() => onChange({ ...draft, trackId: t.id })} />
        ))}
      </Row>

      <Muted>Intervalle (minutes)</Muted>
      <Row>
        {PRESETS.map((m) => (
          <Chip key={m} label={`${m} min`} active={interval === String(m)} onPress={() => setIntervalText(String(m))} />
        ))}
      </Row>
      <Field label="Ou valeur personnalisée" value={interval} onChangeText={setIntervalText} keyboardType="number-pad" />

      <Row>
        <View style={{ flex: 1, minWidth: 120 }}><Field label="Début (HH:MM)" value={start} onChangeText={setStart} /></View>
        <View style={{ flex: 1, minWidth: 120 }}><Field label="Fin (HH:MM)" value={end} onChangeText={setEnd} /></View>
      </Row>

      <Muted>Jours actifs</Muted>
      <Row>
        {DAYS.map((d, i) => (
          <Chip key={d} label={d} active={!!(draft.daysMask & (1 << i))} onPress={() => onChange({ ...draft, daysMask: draft.daysMask ^ (1 << i) })} />
        ))}
      </Row>

      <Row>
        <View style={{ flex: 1, minWidth: 120 }}><Field label="Fondu (secondes)" value={fade} onChangeText={setFade} keyboardType="decimal-pad" /></View>
        <View style={{ flex: 1, minWidth: 120 }}><Field label="Volume de l'annonce (%)" value={volume} onChangeText={setVolume} keyboardType="number-pad" /></View>
      </Row>

      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={{ color: colors.text, flex: 1 }}>Jouer même si aucune musique ne joue</Text>
        <Switch value={draft.playWhenIdle} onValueChange={(v) => onChange({ ...draft, playWhenIdle: v })} />
      </Row>

      <Row style={{ marginTop: space.sm }}>
        <Button label="Enregistrer" kind="primary" onPress={save} />
        <Button label="Annuler" onPress={onCancel} />
      </Row>
    </Card>
  );
}
