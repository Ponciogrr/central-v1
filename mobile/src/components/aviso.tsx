// Aviso rápido (toast) de feedback: mensagem curta no topo da tela com entrada
// animada e desaparecimento automático. Uso: `const { aviso, mostrar, ocultar } =
// useAviso()` na tela e `<BarraAviso aviso={aviso} aoFechar={ocultar} />` perto
// do conteúdo. Sem bibliotecas externas; respeita "reduzir movimento".

import { Ionicons } from '@expo/vector-icons'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { useMovimentoReduzido } from '@/movimento'
import { useTema } from '@/theme'

export interface AvisoEstado {
  id: number
  texto: string
  tom: 'ok' | 'erro' | 'info'
}

const DURACAO_MS = 3500
const USAR_DRIVER = Platform.OS !== 'web'

export function useAviso() {
  const [aviso, setAviso] = useState<AvisoEstado | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const ocultar = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setAviso(null)
  }, [])

  const mostrar = useCallback(
    (texto: string, tom: AvisoEstado['tom'] = 'ok') => {
      if (timerRef.current !== null) clearTimeout(timerRef.current)
      setAviso({ id: Date.now(), texto, tom })
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        setAviso(null)
      }, DURACAO_MS)
    },
    [],
  )

  useEffect(() => () => {
    if (timerRef.current !== null) clearTimeout(timerRef.current)
  }, [])

  return { aviso, mostrar, ocultar }
}

interface PropsBarra {
  aviso: AvisoEstado | null
  aoFechar: () => void
}

export function BarraAviso({ aviso, aoFechar }: PropsBarra) {
  if (!aviso) return null
  return <ItemAviso key={aviso.id} aviso={aviso} aoFechar={aoFechar} />
}

function ItemAviso({ aviso, aoFechar }: { aviso: AvisoEstado; aoFechar: () => void }) {
  const { cores } = useTema()
  const reduzido = useMovimentoReduzido()
  const entrada = useRef(new Animated.Value(reduzido ? 1 : 0)).current

  useEffect(() => {
    if (reduzido) {
      entrada.setValue(1)
      return
    }
    const animacao = Animated.timing(entrada, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: USAR_DRIVER,
    })
    animacao.start()
    return () => animacao.stop()
  }, [entrada, reduzido])

  const cor =
    aviso.tom === 'ok' ? cores.acao : aviso.tom === 'erro' ? cores.perigo : cores.destaque

  return (
    <Animated.View
      style={[
        styles.aviso,
        {
          backgroundColor: cores.superficie2,
          borderColor: cor,
          opacity: entrada,
          transform: [
            {
              translateY: entrada.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }),
            },
          ],
        },
      ]}
      accessibilityRole="alert"
    >
      <View style={[styles.ponto, { backgroundColor: cor }]} />
      <Text style={[styles.texto, { color: cores.texto }]} numberOfLines={3}>
        {aviso.texto}
      </Text>
      <Pressable
        onPress={aoFechar}
        focusable={false}
        tabIndex={-1}
        hitSlop={8}
        accessibilityLabel="Fechar aviso"
        style={styles.fecharArea}
      >
        <Ionicons name="close" size={20} color={cores.textoSuave} />
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  aviso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  ponto: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  texto: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  fecharArea: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
