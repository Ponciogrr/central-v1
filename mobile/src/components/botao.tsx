import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native'
import { useTema } from '@/theme'

interface Props {
  rotulo: string
  onPress: () => void
  tipo?: 'primario' | 'secundario' | 'perigo'
  style?: ViewStyle
  disabled?: boolean
}

export default function Botao({ rotulo, onPress, tipo = 'primario', style, disabled }: Props) {
  const { cores } = useTema()
  const fundo =
    tipo === 'primario' ? cores.acao : tipo === 'perigo' ? cores.perigo : cores.superficie2
  const textoCor = tipo === 'secundario' ? cores.texto : cores.acaoTexto
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityState={{ disabled: Boolean(disabled) }}
      focusable={!disabled}
      style={({ pressed }) => [
        styles.botao,
        {
          backgroundColor: fundo,
          borderColor: tipo === 'secundario' ? cores.borda : 'transparent',
          borderWidth: tipo === 'secundario' ? 1 : 0,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <Text
        numberOfLines={2}
        style={[styles.texto, { color: textoCor }]}
      >
        {rotulo}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  botao: {
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 1,
    minWidth: 0,
  },
  texto: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    flexShrink: 1,
  },
})
