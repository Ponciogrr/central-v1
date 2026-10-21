// Painel deslizante (bottom sheet) — base animada das telas.
// Sobe da base com transição curta; fundo escurece ao abrir e fecha ao tocar
// fora (quando `aoFechar` é informado). Sem bibliotecas externas: usa apenas
// Animated do React Native. Respeita "reduzir movimento" (pula a animação).

import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native'
import { useMovimentoReduzido } from '@/movimento'
import { useTema } from '@/theme'

interface Props {
  visivel: boolean
  aoFechar?: () => void
  children: ReactNode
}

const USAR_DRIVER = Platform.OS !== 'web'

export default function PainelDeslizante({ visivel, aoFechar, children }: Props) {
  const { cores } = useTema()
  const reduzido = useMovimentoReduzido()
  // Altura real da janela/tela: usada para o deslocamento inicial e para o
  // limite da prancha (funciona em celular baixo, tablet e desktop).
  const { height: alturaTela } = useWindowDimensions()
  const progresso = useRef(new Animated.Value(visivel ? 1 : 0)).current
  const animacaoRef = useRef<Animated.CompositeAnimation | null>(null)
  const [exibir, setExibir] = useState(visivel)
  const [altura, setAltura] = useState(0)

  useEffect(() => {
    animacaoRef.current?.stop()

    if (visivel) {
      setExibir(true)
      if (reduzido) {
        progresso.setValue(1)
        return
      }
      animacaoRef.current = Animated.timing(progresso, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: USAR_DRIVER,
      })
      animacaoRef.current.start()
      return
    }

    if (reduzido) {
      progresso.setValue(0)
      setExibir(false)
      return
    }
    animacaoRef.current = Animated.timing(progresso, {
      toValue: 0,
      duration: 200,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: USAR_DRIVER,
    })
    animacaoRef.current.start(({ finished }) => {
      if (finished) setExibir(false)
    })
  }, [visivel, reduzido, progresso])

  useEffect(() => () => animacaoRef.current?.stop(), [])

  if (!exibir) return null

  // Antes do primeiro layout, desliza a partir da altura da tela (não de um
  // número fixo). Depois, usa a altura medida da própria prancha.
  const deslocamento = altura > 0 ? altura : alturaTela
  const alturaMaximaPrancha = Math.round(alturaTela * 0.85)

  return (
    <View style={styles.camada} pointerEvents="auto">
      <Animated.View style={[styles.fundo, { opacity: progresso.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 0.55],
      }) }]}>
        <Pressable
          onPress={aoFechar}
          focusable={false}
          tabIndex={-1}
          style={StyleSheet.absoluteFill}
          accessibilityLabel="Fechar painel"
        />
      </Animated.View>

      <Animated.View
        onLayout={evento => setAltura(evento.nativeEvent.layout.height)}
        style={[
          styles.prancha,
          {
            backgroundColor: cores.superficie,
            borderColor: cores.borda,
            maxHeight: alturaMaximaPrancha,
            transform: [
              {
                translateY: progresso.interpolate({
                  inputRange: [0, 1],
                  outputRange: [deslocamento, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={[styles.pegador, { backgroundColor: cores.borda }]} />
        <ScrollView
          contentContainerStyle={styles.conteudoPainel}
          style={styles.rolagemPainel}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          {children}
        </ScrollView>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  camada: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    zIndex: 40,
  },
  fundo: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#000000',
  },
  prancha: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    paddingBottom: 24,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 8,
  },
  conteudoPainel: {
    paddingBottom: 4,
  },
  rolagemPainel: {
    flexShrink: 1,
  },
  pegador: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 999,
    marginBottom: 4,
  },
})
