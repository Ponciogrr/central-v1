// Controle segmentado: alterna entre poucas visões da mesma tela.
// Substitui as abas duplicadas (ex.: "Rotas do dia" | "Minhas rotas" | "Encaixes"
// dentro de uma única tela, em vez de três abas na barra inferior).

import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useTema } from '@/theme'

export interface Segmento<T extends string> {
  chave: T
  rotulo: string
}

interface Props<T extends string> {
  segmentos: Segmento<T>[]
  valor: T
  onChange: (chave: T) => void
}

export default function Segmentado<T extends string>({ segmentos, valor, onChange }: Props<T>) {
  const { cores } = useTema()
  return (
    <View style={[styles.barra, { backgroundColor: cores.superficie2, borderColor: cores.borda }]}>
      {segmentos.map(segmento => {
        const ativo = segmento.chave === valor
        return (
          <Pressable
            key={segmento.chave}
            onPress={() => onChange(segmento.chave)}
            accessibilityRole="tab"
            accessibilityState={{ selected: ativo }}
            style={[
              styles.item,
              ativo ? { backgroundColor: cores.superficie } : null,
              ativo ? { borderColor: cores.borda } : null,
            ]}
          >
            <Text
              numberOfLines={1}
              style={[styles.texto, { color: ativo ? cores.texto : cores.textoSuave }]}
            >
              {segmento.rotulo}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  barra: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  item: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  texto: {
    fontSize: 13,
    fontWeight: '700',
  },
})
