// Estado das entregas do usuário autenticado (lojista/pessoa física).
// Centraliza carregar/criar/cancelar para as telas não repetirem lógica.
//
// Atualização por CONSULTA PERIÓDICA (a cada 5 s) enquanto a tela está em foco:
// o solicitante vê mudanças de status (aceite, cancelamento pelo motoboy com
// "Buscando substituto", reatribuição a outro motoboy) SEM trocar de aba nem
// recarregar. Não há WebSocket nem notificação em segundo plano nesta etapa.
//
// Regras de recurso: no máximo UM temporizador; nada é consultado fora de foco;
// as consultas periódicas são SILENCIOSAS (não mexem em "carregando" e ignoram
// erro temporário para não apagar a lista já visível); uma consulta por vez.

import { useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  cancelarEntrega as cancelarApi,
  criarEntrega as criarApi,
  listarEntregas,
  mensagemDeErro,
  type DadosNovaEntrega,
  type EntregaApi,
} from '@/api/cliente'
import { useSessao } from '@/sessao'

const INTERVALO_CONSULTA_MS = 5000

export function useMinhasEntregas() {
  const { token } = useSessao()
  const [entregas, setEntregas] = useState<EntregaApi[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const buscaRef = useRef(false)
  const tokenRef = useRef<string | null>(token)
  tokenRef.current = token

  const desligarTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // Recarrega a lista do servidor. `silencioso` = consulta periódica (não mexe
  // em "carregando" e ignora erro temporário para preservar a lista na tela).
  // Sem sessão apenas limpa o estado (telas de demonstração não têm dados reais).
  const carregar = useCallback(
    async (silencioso = false): Promise<void> => {
      const atual = tokenRef.current
      if (!atual) {
        if (!silencioso) {
          setEntregas([])
          setErro('')
          setCarregando(false)
        }
        return
      }
      if (buscaRef.current) return
      buscaRef.current = true
      if (!silencioso) {
        setCarregando(true)
        setErro('')
      }
      try {
        setEntregas(await listarEntregas(atual))
      } catch (falha) {
        if (!silencioso) setErro(mensagemDeErro(falha))
      } finally {
        buscaRef.current = false
        if (!silencioso) setCarregando(false)
      }
    },
    [],
  )

  const ligarTimer = useCallback(() => {
    if (timerRef.current !== null) return
    timerRef.current = setInterval(() => {
      void carregar(true)
    }, INTERVALO_CONSULTA_MS)
  }, [carregar])

  // Ao ganhar foco: consulta visível e começa o polling.
  // Ao perder o foco: para o polling imediatamente (nenhuma consulta depois).
  useFocusEffect(
    useCallback(() => {
      void carregar(false)
      ligarTimer()
      return desligarTimer
    }, [carregar, ligarTimer, desligarTimer]),
  )

  // Segurança extra: nunca deixa um temporizador sobreviver ao componente.
  useEffect(() => desligarTimer, [desligarTimer])

  // Aplica no estado local o objeto devolvido pela API (fonte da verdade),
  // sem depender de uma nova consulta. O próximo tick silencioso reconcilia.
  const aplicar = useCallback((entrega: EntregaApi) => {
    setEntregas(prev => {
      const existe = prev.some(e => e.id === entrega.id)
      return existe ? prev.map(e => (e.id === entrega.id ? entrega : e)) : [entrega, ...prev]
    })
  }, [])

  const criar = useCallback(
    async (dados: DadosNovaEntrega): Promise<EntregaApi> => {
      if (!token) throw new Error('Sessão não iniciada.')
      const nova = await criarApi(token, dados)
      aplicar(nova)
      return nova
    },
    [token, aplicar],
  )

  const cancelar = useCallback(
    async (id: string, motivo?: string): Promise<EntregaApi> => {
      if (!token) throw new Error('Sessão não iniciada.')
      const atualizada = await cancelarApi(token, id, motivo)
      aplicar(atualizada)
      return atualizada
    },
    [token, aplicar],
  )

  return { entregas, carregando, erro, carregar, criar, cancelar }
}
