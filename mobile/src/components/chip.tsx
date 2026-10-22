// Etiqueta de estado ("chip"): cor + texto curto, para mostrar o status de uma
// rota, entrega ou conta sem repetir cores espalhadas pelas telas.

import { StyleSheet, Text, View } from 'react-native'
import { useTema } from '@/theme'
import type { Tom } from '@/formato'

interface Props {
  texto: string
  tom?: Tom
}

export default function Chip({ texto, tom = 'neutro' }: Props) {
  const { cores } = useTema()
  const paleta: Record<Tom, { fundo: string; texto: string; borda: string }> = {
    neutro: { fundo: cores.superficie2, texto: cores.textoSuave, borda: cores.borda },
    acao: { fundo: cores.acao, texto: cores.acaoTexto, borda: cores.acaoBorda },
    destaque: { fundo: cores.destaque, texto: '#FFFFFF', borda: cores.destaque },
    perigo: { fundo: cores.perigo, texto: '#FFFFFF', borda: cores.perigo },
    sucesso: { fundo: cores.acao, texto: cores.acaoTexto, borda: cores.acaoBorda },
  }
  const cor = paleta[tom]
  return (
    <View style={[styles.chip, { backgroundColor: cor.fundo, borderColor: cor.borda }]}>
      <Text style={[styles.texto, { color: cor.texto }]}>{texto}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  texto: {
    fontSize: 12,
    fontWeight: '700',
  },
})
