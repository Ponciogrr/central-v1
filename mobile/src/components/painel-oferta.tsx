// Painel animado de ofertas (Parte A): desliza da base quando chega uma oferta
// nova, mostrando a oferta mais recente com os botões de aceitar/recusar.
// O usuário pode fechar; o painel volta quando uma oferta NOVA chega (id ainda
// não visto). Se restarem várias, indica a quantidade.

import { Ionicons } from '@expo/vector-icons'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { OfertaApi } from '@/api/cliente'
import CartaoOferta from '@/components/cartao-oferta'
import PainelDeslizante from '@/components/painel-deslizante'
import { useTema } from '@/theme'

interface Props {
  visivel: boolean
  ofertas: OfertaApi[]
  aoFechar: () => void
  onAceitar: (id: string) => Promise<unknown>
  onRecusar: (id: string) => Promise<unknown>
}

export default function PainelOferta({ visivel, ofertas, aoFechar, onAceitar, onRecusar }: Props) {
  const { cores } = useTema()
  const maisRecente = ofertas[0]
  const restantes = ofertas.length - 1

  return (
    <PainelDeslizante visivel={visivel} aoFechar={aoFechar}>
      <View style={styles.topo}>
        <Text style={[styles.titulo, { color: cores.texto }]}>Nova oferta de entrega</Text>
        <Pressable
          onPress={aoFechar}
          focusable={false}
          tabIndex={-1}
          hitSlop={8}
          accessibilityLabel="Fechar painel de ofertas"
          style={styles.fecharArea}
        >
          <Ionicons name="close" size={24} color={cores.textoSuave} />
        </Pressable>
      </View>

      {maisRecente ? (
        <CartaoOferta oferta={maisRecente} onAceitar={onAceitar} onRecusar={onRecusar} />
      ) : null}

      {restantes > 0 ? (
        <Text style={[styles.restantes, { color: cores.textoSuave }]}>
          + {restantes} oferta{restantes > 1 ? 's' : ''} além desta — veja a lista na tela.
        </Text>
      ) : null}
    </PainelDeslizante>
  )
}

const styles = StyleSheet.create({
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  titulo: {
    fontSize: 16,
    fontWeight: '700',
    flexShrink: 1,
  },
  fecharArea: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restantes: {
    fontSize: 12,
    textAlign: 'center',
  },
})
