import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ColorValue, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, space } from './theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/** Largeur maximale du contenu : garde des lignes lisibles sur tablette. */
const MAX_WIDTH = 760;

export function Icon({ name, size = 20, color = colors.text }: { name: IconName; size?: number; color?: ColorValue }) {
  return <Ionicons name={name} size={size} color={color} />;
}

/** Écran avec marges et zone sûre. `scroll={false}` pour un écran qui contient déjà une liste défilante. */
export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const insets = useSafeAreaInsets();
  const top = insets.top + space.lg;
  if (!scroll) {
    return (
      <View style={[styles.screen, { paddingTop: top }]}>
        <View style={[styles.column, { flex: 1, paddingHorizontal: space.lg }]}>{children}</View>
      </View>
    );
  }
  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingTop: top, paddingHorizontal: space.lg, paddingBottom: space.xxl }} keyboardShouldPersistTaps="handled">
      <View style={styles.column}>{children}</View>
    </ScrollView>
  );
}

export function Title({ children, subtitle }: { children: ReactNode; subtitle?: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={styles.title}>{children}</Text>
      {subtitle ? <Text style={styles.muted}>{subtitle}</Text> : null}
    </View>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function Body({ children, style, numberOfLines }: { children: ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  return <Text numberOfLines={numberOfLines} style={[styles.body, style]}>{children}</Text>;
}

export function Muted({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

type ButtonKind = 'default' | 'primary' | 'danger' | 'ghost';

export function Button({
  label, onPress, kind = 'default', icon, disabled, style,
}: {
  label: string; onPress: () => void; kind?: ButtonKind; icon?: IconName; disabled?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const fg = kind === 'primary' ? colors.accentText : kind === 'danger' ? colors.danger : colors.accent;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        kind === 'primary' && { backgroundColor: colors.accent },
        kind === 'danger' && { backgroundColor: colors.dangerSoft },
        kind === 'ghost' && { backgroundColor: 'transparent' },
        disabled && { opacity: 0.4 },
        pressed && { opacity: 0.7 },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
      <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

/** Bouton rond avec une icône seule ; `label` sert aux lecteurs d'écran. */
export function IconButton({
  icon, label, onPress, kind = 'default', size = 44, disabled,
}: {
  icon: IconName; label: string; onPress: () => void; kind?: ButtonKind; size?: number; disabled?: boolean;
}) {
  const fg = kind === 'primary' ? colors.accentText : kind === 'danger' ? colors.danger : colors.accent;
  const bg = kind === 'primary' ? colors.accent : kind === 'ghost' || kind === 'danger' ? 'transparent' : colors.accentSoft;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => [
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' },
        disabled && { opacity: 0.35 },
        pressed && { opacity: 0.6 },
      ]}
    >
      <Ionicons name={icon} size={Math.round(size * 0.48)} color={fg} />
    </Pressable>
  );
}

export function Chip({ label, active, onPress, disabled }: { label: string; active?: boolean; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      disabled={disabled}
      style={[styles.chip, active && { backgroundColor: colors.accent, borderColor: colors.accent }, disabled && { opacity: 0.4 }]}
    >
      <Text style={[styles.chipText, active && { color: colors.accentText }]}>{label}</Text>
    </Pressable>
  );
}

/** Choix entre deux ou trois vues d'un même écran. */
export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => (
        <Pressable key={o.value} accessibilityRole="button" onPress={() => onChange(o.value)} style={[styles.segment, o.value === value && styles.segmentActive]}>
          <Text style={[styles.chipText, { color: o.value === value ? colors.accent : colors.muted }]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: colors.border }} />;
}

export function Field({ label, ...props }: { label?: string } & TextInputProps) {
  return (
    <View style={{ gap: space.xs }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput placeholderTextColor={colors.muted} {...props} style={[styles.input, props.style]} />
    </View>
  );
}

/** Message d'information ou d'alerte sur fond coloré. */
export function Notice({ children, tone = 'info', icon }: { children: ReactNode; tone?: 'info' | 'warn'; icon?: IconName }) {
  const fg = tone === 'warn' ? colors.warn : colors.accent;
  return (
    <View style={[styles.notice, { backgroundColor: tone === 'warn' ? colors.warnSoft : colors.accentSoft }]}>
      <Ionicons name={icon ?? (tone === 'warn' ? 'alert-circle-outline' : 'information-circle-outline')} size={20} color={fg} />
      <Text style={[styles.body, { color: fg, flex: 1 }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  column: { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', gap: space.lg },
  title: { color: colors.text, fontSize: 28, fontWeight: '700', letterSpacing: -0.3 },
  label: { color: colors.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  body: { color: colors.text, fontSize: 15, lineHeight: 21 },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  button: {
    minHeight: 46, paddingHorizontal: space.lg, borderRadius: radius.sm, backgroundColor: colors.accentSoft,
    flexDirection: 'row', gap: space.sm, alignItems: 'center', justifyContent: 'center',
  },
  buttonText: { fontSize: 15, fontWeight: '600' },
  chip: {
    minHeight: 40, paddingHorizontal: space.lg, justifyContent: 'center', borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel,
  },
  chipText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  segmented: { flexDirection: 'row', backgroundColor: colors.panelAlt, borderRadius: radius.sm, padding: 4 },
  segment: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm - 3 },
  segmentActive: { backgroundColor: colors.panel },
  card: { backgroundColor: colors.panel, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: space.lg, gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  input: {
    minHeight: 46, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel,
    color: colors.text, paddingHorizontal: space.md, fontSize: 15,
  },
  notice: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start', padding: space.md, borderRadius: radius.sm },
});
