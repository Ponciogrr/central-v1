// Contabilidade do motoboy (aba Histórico): resumo financeiro das entregas
// concluídas + despesas pessoais OPCIONAIS.
//
// Recursos: consulta ao focar (padrão do app, sem WebSocket/push). A carga é
// única por foco (resumo + despesas em paralelo). As despesas, quando mudam,
// recarregam o resumo do servidor — o cálculo é sempre feito na API/PostgreSQL
// (fonte de verdade), nunca no app.
//
// Fórmula (documentada no backend): saldoEstimado = totalEntregas - totalDespesas,
// usando o MESMO período. totalEntregas soma APENAS deliveries com status
// 'entregue'; despesas são declarações pessoais do motoboy (não verificadas).

import { useFocusEffect } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import {
  atualizarDespesa as atualizarApi,
  buscarResumoFinanceiro,
  criarDespesa as criarApi,
  excluirDespesa as excluirApi,
  listarDespesas,
  mensagemDeErro,
  type DadosDespesa,
  type DespesaApi,
  type ResumoFinanceiroApi,
} from '@/api/cliente'
import { useSessao } from '@/sessao'

// Período padrão do resumo: os últimos sete dias (incluindo hoje).
export interface Periodo {
  inicio: string // 'AAAA-MM-DD'
  fim: string
}

// Data local no formato AAAA-MM-DD (sem conversão de fuso).
export function paraDataIso(data: Date): string {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

export function ultimosSeteDias(referencia = new Date()): Periodo {
  const fim = new Date(referencia.getFullYear(), referencia.getMonth(), referencia.getDate())
  const inicio = new Date(fim)
  inicio.setDate(inicio.getDate() - 6)
  return { inicio: paraDataIso(inicio), fim: paraDataIso(fim) }
}

export function useContabilidadeMotoboy(periodo?: Periodo) {
  const { token } = useSessao()
  const fixo = periodo ? `${periodo.inicio}|${periodo.fim}` : 'padrao'

  const [resumo, setResumo] = useState<ResumoFinanceiroApi | null>(null)
  const [despesas, setDespesas] = useState<DespesaApi[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  // Guarda o período vigente para reusar após criar/editar/excluir despesa.
  const periodoRef = useRef<Periodo>(periodo ?? ultimosSeteDias())
  periodoRef.current = periodo ?? periodoRef.current

  const carregar = useCallback(async () => {
    if (!token) {
      setResumo(null)
      setDespesas([])
      setErro('')
      setCarregando(false)
      return
    }
    setCarregando(true)
    setErro('')
    try {
      const p = periodo ?? ultimosSeteDias()
      const [r, d] = await Promise.all([
        buscarResumoFinanceiro(token, p.inicio, p.fim),
        listarDespesas(token),
      ])
      setResumo(r)
      setDespesas(d)
    } catch (falha) {
      setErro(mensagemDeErro(falha))
    } finally {
      setCarregando(false)
    }
  }, [token, periodo])

  useFocusEffect(
    useCallback(() => {
      void carregar()
    }, [carregar]),
  )

  const adicionar = useCallback(
    async (dados: DadosDespesa) => {
      if (!token) throw new Error('Sessão não iniciada.')
      await criarApi(token, dados)
      await carregar()
    },
    [token, carregar],
  )

  const editar = useCallback(
    async (id: string, dados: DadosDespesa) => {
      if (!token) throw new Error('Sessão não iniciada.')
      await atualizarApi(token, id, dados)
      await carregar()
    },
    [token, carregar],
  )

  const remover = useCallback(
    async (id: string) => {
      if (!token) throw new Error('Sessão não iniciada.')
      await excluirApi(token, id)
      await carregar()
    },
    [token, carregar],
  )

  return {
    resumo,
    despesas,
    carregando,
    erro,
    recarregar: carregar,
    adicionar,
    editar,
    remover,
    periodo: periodoRef.current,
  }
}
