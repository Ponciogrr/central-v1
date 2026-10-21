// Alternador de disponibilidade (Online/Offline) redesenhado: botão de largura
// completa com ponto de status (pulsa enquanto online), rótulo claro e estado
// "Aguarde…" durante a troca. Substitui o Switch genérico; mesma função de antes
// (POST /courier/availability). Respeita "reduzir movimento" (sem pulso).

import { useEffect, useRef } from 'react'
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { useMovimentoReduzido } from '@/movimento'
import { useTema } from '@/theme'

const USAR_DRIVER = Platform.OS !== 'web'

interface Props {
  online: boolean
  alternando: boolean
  desativado?: boolean
  onAlternar: (proximo: boolean) => void
}

export default function AlternadorDisponibilidade({
  online,
  alternando,
  desativado = false,
  onAlternar,
}: Props) {
  const { cores } = useTema()
  const reduzido = useMovimentoReduzido()
  const pulso = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (reduzido || !online || desativado) {
      pulso.setValue(0)
      return
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulso, {
          toValue: 1,
          duration: 900,
          easing: Easing.out(Easing.quad),
          useNativeDriver: USAR_DRIVER,
        }),
        Animated.timing(pulso, {
          toValue: 0,
          duration: 900,
          easing: Easing.in(Easing.quad),
          useNativeDriver: USAR_DRIVER,
        }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [pulso, reduzido, online, desativado])

  const pressionado = desativado || alternando

  return (
    <Pressable
      onPress={() => {
        if (!pressionado) onAlternar(!online)
      }}
      disabled={pressionado}
      accessibilityRole="switch"
      accessibilityState={{ checked: online, disabled: pressionado }}
      accessibilityLabel="Disponibilidade para receber ofertas"
      accessibilityHint={online ? 'Toque para ficar offline' : 'Toque para ficar online'}
      style={[
        styles.botao,
        {
          backgroundColor: online ? cores.superficie2 : cores.superficie,
          borderColor: online ? cores.acao : cores.borda,
          opacity: pressionado ? 0.7 : 1,
        },
      ]}
    >
      <View style={styles.esquerda}>
        <View style={styles.areaPonto}>
          <Animated.View
            style={[
              styles.pontoExterno,
              {
                backgroundColor: cores.acao,
                opacity: pulso.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.7] }),
                transform: [
                  { scale: pulso.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) },
                ],
              },
            ]}
          />
          <View style={[styles.ponto, { backgroundColor: online ? cores.acao : cores.textoSuave }]} />
        </View>
        <View style={styles.textos}>
          <Text style={[styles.titulo, { color: cores.texto }]}>
            {alternando
              ? 'Aguarde…'
              : online
                ? 'Você está ONLINE'
                : 'Você está OFFLINE'}
          </Text>
          <Text style={[styles.subtitulo, { color: cores.textoSuave }]}>
            {online
              ? 'Recebendo ofertas · painel consulta a cada 5 s'
              : 'Toque para entrar em serviço e receber ofertas'}
          </Text>
        </View>
      </View>
      <Text style={[styles.seta, { color: online ? cores.acao : cores.textoSuave }]}>
        {online ? 'Sair' : 'Entrar'}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  botao: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderWidth: 2,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    minHeight: 56,
  },
  esquerda: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 1,
  },
  areaPonto: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pontoExterno: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 999,
  },
  ponto: {
    width: 12,
    height: 12,
    borderRadius: 999,
  },
  textos: {
    flexShrink: 1,
    gap: 4,
  },
  titulo: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  subtitulo: {
    fontSize: 12,
    lineHeight: 16,
  },
  seta: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
})
