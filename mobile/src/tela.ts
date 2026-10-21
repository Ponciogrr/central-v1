// Utilitários de dimensão da tela (web e nativo).
//
// Centraliza as medições usadas pela responsividade: largura/altura atuais e
// classificações simples. Reutiliza useWindowDimensions do React Native —
// sem dependência nova e atualizando em redimensionamento (web/celular/tablet).

import { Platform, useWindowDimensions, type ViewStyle } from 'react-native'

export interface Tela {
  largura: number
  altura: number
  // Celular estreito (320–379): paddings e textos mais enxutos.
  compacta: boolean
  // Celular baixo (< 640 de altura): evita centralizar verticalmente conteúdo
  // maior que a tela (senão o topo fica cortado e inalcançável).
  baixa: boolean
  // Desktop/tablet: permite containers mais largos e centralizados.
  larga: boolean
  // Padding de tela adequado à largura.
  padding: number
}

export function useTela(): Tela {
  const { width, height } = useWindowDimensions()
  return {
    largura: width,
    altura: height,
    compacta: width < 380,
    baixa: height < 640,
    larga: width >= 900,
    padding: width < 380 ? 16 : 24,
  }
}

// Estilo da barra de abas: no celular ocupa 100% da largura; na web fica
// limitada e centralizada, para não esticar as abas em telas grandes.
export function estiloTabBar(cores: { fundo: string; borda: string }): ViewStyle {
  const base: ViewStyle = {
    backgroundColor: cores.fundo,
    borderTopColor: cores.borda,
  }
  if (Platform.OS !== 'web') return base
  return {
    ...base,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  }
}
