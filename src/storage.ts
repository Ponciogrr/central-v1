import type { EstadoApp } from './types'

const CHAVE = 'central-motoboys:v1'

export const ESTADO_INICIAL: EstadoApp = {
  papel: null,
  sessaoId: null,
  motoboyOnline: false,
  motoboyNome: '',
  entregas: [],
}

export function carregarEstado(): EstadoApp {
  try {
    const bruto = localStorage.getItem(CHAVE)
    if (!bruto) return ESTADO_INICIAL
    const dados = JSON.parse(bruto) as Partial<EstadoApp>
    return {
      papel: dados.papel ?? null,
      sessaoId: dados.sessaoId ?? null,
      motoboyOnline: dados.motoboyOnline ?? false,
      motoboyNome: dados.motoboyNome ?? '',
      entregas: Array.isArray(dados.entregas) ? dados.entregas : [],
    }
  } catch {
    return ESTADO_INICIAL
  }
}

export function salvarEstado(estado: EstadoApp): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(estado))
  } catch {
    // quota cheia ou modo privado — segue em memória
  }
}

export function novoId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}
