import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { colors, space } from './theme';

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  if (!scroll) return <View style={styles.screen}>{children}</View>;
  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: space.lg, gap: space.md }}>
      {children}
    </ScrollView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Muted({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <Text style={[styles.muted, style as object]}>{children}</Text>;
}

export function Button({
  label, onPress, kind = 'default', disabled, style,
}: {
  label: string; onPress: () => void; kind?: 'default' | 'primary' | 'danger'; disabled?: boolean; style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        kind === 'primary' && { backgroundColor: colors.accent, borderColor: colors.accent },
        kind === 'danger' && { borderColor: colors.danger },
        disabled && { opacity: 0.4 },
        pressed && { opacity: 0.7 },
        style,
      ]}
    >
      <Text style={[styles.buttonText, kind === 'primary' && { color: colors.accentText }, kind === 'danger' && { color: colors.danger }]}>{label}</Text>
    </Pressable>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
      <Text style={[styles.chipText, active && { color: colors.accentText }]}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export function Field({ label, ...props }: { label: string } & TextInputProps) {
  return (
    <View style={{ gap: space.xs }}>
      <Text style={styles.muted}>{label}</Text>
      <TextInput placeholderTextColor={colors.muted} {...props} style={[styles.input, props.style]} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  title: { color: colors.text, fontSize: 22, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 13 },
  button: {
    minHeight: 44, paddingHorizontal: space.lg, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.panelAlt, alignItems: 'center', justifyContent: 'center',
  },
  buttonText: { color: colors.text, fontWeight: '600' },
  chip: { paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  card: { backgroundColor: colors.panel, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: space.md, gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  input: { minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panelAlt, color: colors.text, paddingHorizontal: space.md },
});
