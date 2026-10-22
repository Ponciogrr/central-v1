// Métrica: número grande (com dígitos de largura fixa) + rótulo.
// Usada no painel administrativo (visão geral e operação).

import { StyleSheet, Text, View } from 'react-native'
import { NUMEROS, useTema } from '@/theme'

interface Props {
  valor: number | string
  rotulo: string
  // Destaque visual para números que exigem atenção (ex.: bloqueios).
  alerta?: boolean
}

export default function Metrica({ valor, rotulo, alerta = false }: Props) {
  const { cores } = useTema()
  return (
    <View
      style={[
        styles.caixa,
        { backgroundColor: cores.superficie, borderColor: alerta ? cores.perigo : cores.borda },
      ]}
    >
      <Text style={[styles.valor, NUMEROS, { color: alerta ? cores.perigo : cores.texto }]}>
        {valor}
      </Text>
      <Text style={[styles.rotulo, { color: cores.textoSuave }]}>{rotulo}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  caixa: {
    flexGrow: 1,
    flexBasis: 150,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 2,
  },
  valor: {
    fontSize: 26,
    fontWeight: '700',
  },
  rotulo: {
    fontSize: 13,
    lineHeight: 18,
  },
})
