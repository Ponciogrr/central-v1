import { Ionicons } from '@expo/vector-icons'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useTema } from '@/theme'

interface Acao {
  rotulo: string
  onPress: () => void
}

interface Props {
  titulo: string
  dica: string
  icone?: keyof typeof Ionicons.glyphMap
  acao?: Acao
}

export default function Vazio({ titulo, dica, icone = 'file-tray-outline', acao }: Props) {
  const { cores } = useTema()
  return (
    <View style={[styles.wrap, { backgroundColor: cores.superficie, borderColor: cores.borda }]}>
      <View style={[styles.iconeArea, { backgroundColor: cores.superficie2 }]}>
        <Ionicons name={icone} size={22} color={cores.textoSuave} />
      </View>
      <View style={styles.textos}>
        <Text style={[styles.titulo, { color: cores.texto }]}>{titulo}</Text>
        <Text style={[styles.dica, { color: cores.textoSuave }]}>{dica}</Text>
      </View>
      {acao ? (
        <Pressable
          onPress={acao.onPress}
          accessibilityRole="button"
          accessibilityLabel={acao.rotulo}
          focusable
          style={({ pressed }) => [
            styles.acao,
            { borderColor: cores.borda, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={[styles.acaoTexto, { color: cores.texto }]}>{acao.rotulo}</Text>
          <Ionicons name="chevron-forward" size={16} color={cores.textoSuave} />
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
    gap: 12,
    alignItems: 'flex-start',
  },
  iconeArea: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textos: {
    gap: 4,
  },
  titulo: {
    fontSize: 16,
    fontWeight: '700',
  },
  dica: {
    fontSize: 14,
    lineHeight: 20,
  },
  acao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  acaoTexto: {
    fontSize: 14,
    fontWeight: '700',
  },
})
