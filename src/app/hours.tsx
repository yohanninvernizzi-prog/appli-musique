import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { engine } from '../audio/engine';
import { slotError, type OpeningSlot } from '../core/program';
import { deleteSlot, listSlots, saveSlot } from '../db/repo';
import { Body, Button, Card, Chip, Icon, IconButton, Label, Muted, Row, Screen, Title } from '../ui/components';
import { formatHm, useLoad } from '../ui/hooks';
import { colors, radius, space } from '../ui/theme';

/** Jours affichés du lundi au dimanche (valeurs : 0 = dimanche ... 6 = samedi). */
const WEEK = [1, 2, 3, 4, 5, 6, 0];
const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const DAY_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

type Draft = { id?: string; day: number; startMin: number; endMin: number };

export default function Hours() {
  const [slots, reload] = useLoad<OpeningSlot[]>(listSlots, []);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [copyFrom, setCopyFrom] = useState<number | null>(null);

  async function changed() {
    await reload();
    await engine.reload();
  }

  async function save(d: Draft) {
    const error = slotError(slots, { ...d, id: d.id ?? '' });
    if (error) return Alert.alert('Plage impossible', error);
    await saveSlot(d);
    setDraft(null);
    await changed();
  }

  async function remove(slot: OpeningSlot) {
    await deleteSlot(slot.id);
    setDraft(null);
    await changed();
  }

  /** Remplace les horaires du jour `to` par ceux du jour `from`. */
  async function copyDay(from: number, to: number) {
    for (const s of slots.filter((x) => x.day === to)) await deleteSlot(s.id);
    for (const s of slots.filter((x) => x.day === from)) await saveSlot({ day: to, startMin: s.startMin, endMin: s.endMin });
    await changed();
  }

  function startNew(day: number) {
    const last = slots.filter((s) => s.day === day).at(-1);
    const startMin = last ? Math.min(last.endMin + 60, 22 * 60) : 17 * 60;
    setCopyFrom(null);
    setDraft({ day, startMin, endMin: Math.min(startMin + 120, 24 * 60) });
  }

  return (
    <Screen>
      <Title subtitle="La radio démarre et s'arrête toute seule sur ces plages. Les publicités ne passent que pendant ces horaires.">
        Horaires d'ouverture
      </Title>

      {WEEK.map((day) => {
        const daySlots = slots.filter((s) => s.day === day);
        const editingHere = draft?.day === day;
        return (
          <Card key={day}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>{DAY_NAMES[day]}</Text>
              {daySlots.length === 0 && !editingHere && <Muted>Fermé</Muted>}
            </Row>

            {daySlots.map((slot) =>
              draft?.id === slot.id ? null : (
                <Pressable
                  key={slot.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Modifier la plage ${formatHm(slot.startMin)} à ${formatHm(slot.endMin)}`}
                  onPress={() => { setCopyFrom(null); setDraft({ ...slot }); }}
                  style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.accentSoft, borderRadius: radius.sm, paddingHorizontal: space.lg, minHeight: 52 }, pressed && { opacity: 0.7 }]}
                >
                  <Icon name="time-outline" size={18} color={colors.accent} />
                  <Text style={{ flex: 1, color: colors.accent, fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                    {formatHm(slot.startMin)} – {formatHm(slot.endMin)}
                  </Text>
                  <Icon name="create-outline" size={18} color={colors.accent} />
                </Pressable>
              ),
            )}

            {editingHere && draft && (
              <SlotEditor
                draft={draft}
                onChange={setDraft}
                onSave={() => save(draft)}
                onCancel={() => setDraft(null)}
                onDelete={draft.id ? () => remove(draft as OpeningSlot) : undefined}
              />
            )}

            {!editingHere && (
              <Row>
                <Button label="Ajouter une plage" icon="add" onPress={() => startNew(day)} />
                {daySlots.length > 0 && (
                  <Button label="Copier vers…" icon="copy-outline" kind="ghost" onPress={() => setCopyFrom(copyFrom === day ? null : day)} />
                )}
              </Row>
            )}

            {copyFrom === day && (
              <View style={{ gap: space.sm }}>
                <Muted>Touchez un jour pour lui donner les mêmes horaires que {DAY_NAMES[day].toLowerCase()} (ses horaires actuels sont remplacés).</Muted>
                <Row>
                  {WEEK.filter((d) => d !== day).map((d) => (
                    <Chip key={d} label={DAY_SHORT[d]} onPress={() => copyDay(day, d)} />
                  ))}
                  <Button label="Terminé" kind="ghost" onPress={() => setCopyFrom(null)} />
                </Row>
              </View>
            )}
          </Card>
        );
      })}
    </Screen>
  );
}

function SlotEditor({ draft, onChange, onSave, onCancel, onDelete }: {
  draft: Draft; onChange: (d: Draft) => void; onSave: () => void; onCancel: () => void; onDelete?: () => void;
}) {
  return (
    <View style={{ gap: space.md, borderWidth: 1, borderColor: colors.accent, borderRadius: radius.sm, padding: space.md }}>
      <TimePicker label="Ouverture" value={draft.startMin} onChange={(startMin) => onChange({ ...draft, startMin })} />
      <TimePicker label="Fermeture" value={draft.endMin} onChange={(endMin) => onChange({ ...draft, endMin })} />
      <Row>
        <Button label="Enregistrer" icon="checkmark" kind="primary" onPress={onSave} />
        <Button label="Annuler" kind="ghost" onPress={onCancel} />
        {onDelete && <Button label="Supprimer" icon="trash-outline" kind="danger" onPress={onDelete} />}
      </Row>
    </View>
  );
}

/** Choix d'une heure sans clavier : boutons − / + pour l'heure, pastilles pour les minutes. */
function TimePicker({ label, value, onChange }: { label: string; value: number; onChange: (min: number) => void }) {
  const hour = Math.floor(value / 60);
  const minute = value % 60;
  const setHour = (h: number) => onChange(h >= 24 ? 24 * 60 : Math.max(0, h) * 60 + minute);
  return (
    <View style={{ gap: space.sm }}>
      <Label>{label}</Label>
      <Row style={{ gap: space.md }}>
        <Row style={{ flexWrap: 'nowrap' }}>
          <IconButton icon="remove" label={`${label} : une heure plus tôt`} onPress={() => setHour(hour - 1)} disabled={hour <= 0} />
          <Text style={{ width: 86, textAlign: 'center', color: colors.text, fontSize: 26, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{formatHm(value)}</Text>
          <IconButton icon="add" label={`${label} : une heure plus tard`} onPress={() => setHour(hour + 1)} disabled={hour >= 24} />
        </Row>
        <Row>
          {[0, 15, 30, 45].map((m) => (
            <Chip key={m} label={`:${String(m).padStart(2, '0')}`} active={minute === m} disabled={hour >= 24 && m > 0} onPress={() => onChange(hour * 60 + m)} />
          ))}
        </Row>
      </Row>
      {minute % 15 !== 0 && <Body>Minutes actuelles : {minute}</Body>}
    </View>
  );
}
