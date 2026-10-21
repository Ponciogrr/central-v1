// Preferência do sistema "reduzir movimento" (acessibilidade).
// As animações do app consultam este hook e pulam direto para o estado final.

import { useEffect, useState } from 'react'
import { AccessibilityInfo } from 'react-native'

export function useMovimentoReduzido(): boolean {
  const [reduzido, setReduzido] = useState(false)

  useEffect(() => {
    let ativo = true
    try {
      const consulta = AccessibilityInfo.isReduceMotionEnabled()
      if (consulta && typeof consulta.then === 'function') {
        consulta
          .then(valor => {
            if (ativo) setReduzido(valor === true)
          })
          .catch(() => {
            // sem informação: mantém animações normais
          })
      }
    } catch {
      // plataforma sem suporte: mantém animações normais
    }
    return () => {
      ativo = false
    }
  }, [])

  return reduzido
}
