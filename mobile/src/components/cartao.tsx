// Cartão: a superfície padrão da interface (grafite/roxo, cantos arredondados).
//
// Existe para todas as telas usarem a MESMA caixa: fundo, borda, raio e
// espaçamento padronizados. Antes cada tela montava a sua própria caixa.

import { StyleSheet, Text, View, type ViewStyle } from 'react-native'
import { useTema } from '@/theme'

interface Props {
  children: React.ReactNode
  titulo?: string
  subtitulo?: string
  // Ação opcional no canto superior direito (ícone + rótulo).
  acao?: { rotulo: string; onPress: () => void }
  style?: ViewStyle
  semPadding?: boolean
}

export default function Cartao({ children, titulo, subtitulo, acao, style, semPadding }: Props) {
  const { cores } = useTema()
  return (
    <View
      style={[
        styles.cartao,
        { backgroundColor: cores.superficie, borderColor: cores.borda },
        semPadding ? styles.semPadding : null,
        style,
      ]}
    >
      {(titulo || acao) && (
        <View style={styles.cabecalho}>
          <View style={styles.textos}>
            {titulo ? <Text style={[styles.titulo, { color: cores.texto }]}>{titulo}</Text> : null}
            {subtitulo ? (
              <Text style={[styles.subtitulo, { color: cores.textoSuave }]}>{subtitulo}</Text>
            ) : null}
          </View>
          {acao ? (
            <Text
              accessibilityRole="button"
              onPress={acao.onPress}
              style={[styles.acao, { color: cores.destaque }]}
            >
              {acao.rotulo}
            </Text>
          ) : null}
        </View>
      )}
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  cartao: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  semPadding: {
    padding: 0,
  },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  textos: {
    flex: 1,
    gap: 2,
  },
  titulo: {
    fontSize: 16,
    fontWeight: '700',
  },
  subtitulo: {
    fontSize: 13,
    lineHeight: 18,
  },
  acao: {
    fontSize: 14,
    fontWeight: '700',
  },
})
